// server.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 让Render能正确获取IP
app.set('trust proxy', true);

// --- 数据库文件路径 ---
const DB_FILE = './db.json';

// --- 配置 Multer 用于图片上传 ---
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage }).fields([{ name: 'option1Image' }, { name: 'option2Image' }]);

// --- 中间件 ---
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- 数据库操作辅助函数 ---
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ battles: [] }));
    }
    const data = fs.readFileSync(DB_FILE);
    return JSON.parse(data);
};
const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// --- API 路由 ---

// GET /api/battles - 获取所有对战（带截止时间逻辑）
app.get('/api/battles', (req, res) => {
    const db = readDB();
    const now = new Date();

    const publicBattles = db.battles.map(battle => {
        const battleDeadline = new Date(battle.deadline);
        const isExpired = now > battleDeadline;

        if (isExpired) {
            // 时间到了，返回完整数据
            return battle;
        } else {
            // 时间没到，隐藏结果，只返回必要信息
            const { winner, ...rest } = battle;
            return { ...rest, winner: null }; // 确保winner字段为null
        }
    });

    res.json(publicBattles);
});

// POST /api/admin/battles - 管理员创建新的对战（增加deadline）
app.post('/api/admin/battles', (req, res) => {
    upload(req, res, (err) => {
        const correctPassword = process.env.ADMIN_PASSWORD || "devpassword";
        const { adminPassword, option1Name, option2Name, deadline } = req.body;

        if (adminPassword !== correctPassword) {
            return res.status(403).send('密码错误，无权操作！');
        }
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!deadline) {
            return res.status(400).send('必须设置截止时间！');
        }

        const db = readDB();
        const newBattle = {
            id: Date.now(),
            option1: { name: option1Name, image: `/uploads/${req.files.option1Image[0].filename}`, votes: 0 },
            option2: { name: option2Name, image: `/uploads/${req.files.option2Image[0].filename}`, votes: 0 },
            deadline: deadline, // 存储截止时间
            winner: null,
            votedIPs: []
        };
        db.battles.push(newBattle);
        writeDB(db);
        res.redirect('/');
    });
});

// DELETE /api/admin/battles/:id - 管理员移除对战
app.delete('/api/admin/battles/:id', (req, res) => {
    const correctPassword = process.env.ADMIN_PASSWORD || "devpassword";
    const { adminPassword } = req.body;
    
    if (adminPassword !== correctPassword) {
        return res.status(403).json({ error: '密码错误，无权操作！' });
    }

    const battleId = parseInt(req.params.id);
    const db = readDB();
    
    const battleIndex = db.battles.findIndex(b => b.id === battleId);

    if (battleIndex > -1) {
        db.battles.splice(battleIndex, 1); // 从数组中移除
        writeDB(db);
        res.json({ message: '对战已成功移除' });
    } else {
        res.status(404).json({ error: '未找到该对战' });
    }
});


// POST /api/battles/:id/vote - 用户投票
app.post('/api/battles/:id/vote', (req, res) => {
    const battleId = parseInt(req.params.id);
    const { option } = req.body;
    const userIp = req.ip;

    const db = readDB();
    const battle = db.battles.find(b => b.id === battleId);

    if (!battle) return res.status(404).json({ error: '未找到对战' });
    
    // 检查是否已过截止日期
    if (new Date() > new Date(battle.deadline)) {
        return res.status(403).json({ error: '投票已截止！' });
    }

    if (!battle.votedIPs) battle.votedIPs = [];
    if (battle.votedIPs.includes(userIp)) return res.status(403).json({ error: '您已经投过票了！' });

    if (option === 'option1' || option === 'option2') {
        battle[option].votes++;
        battle.votedIPs.push(userIp);

        if (battle.option1.votes > battle.option2.votes) {
            battle.winner = battle.option1.name;
        } else if (battle.option2.votes > battle.option1.votes) {
            battle.winner = battle.option2.name;
        } else {
            battle.winner = '平局';
        }

        writeDB(db);
        // 返回一个不含winner的版本，让前端依赖 GET 接口获取最终结果
        const { winner, ...rest } = battle;
        res.json(rest);

    } else {
        res.status(400).json({ error: '选项无效' });
    }
});


// --- 启动服务器 ---
app.listen(PORT, () => {
    console.log(`服务器正在 http://localhost:${PORT} 运行`);
});