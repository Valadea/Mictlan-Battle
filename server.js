// server.js (完整替换)

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

const DB_FILE = './db.json';

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage }).fields([{ name: 'option1Image' }, { name: 'option2Image' }]);

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const readDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { eventTitle: "欢迎来到巅峰对决！", battles: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData));
        return initialData;
    }
    const data = fs.readFileSync(DB_FILE);
    return JSON.parse(data);
};
const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// --- API 路由 ---

// GET /api/data - 获取所有数据（对战列表+活动标题）
app.get('/api/data', (req, res) => {
    const db = readDB();
    const now = new Date();

    const publicBattles = db.battles.map(battle => {
        const battleDeadline = new Date(battle.deadline);
        const isExpired = now > battleDeadline;

        // 创建一个 battle 的副本以进行修改
        const battleData = { ...battle };

        if (isExpired) {
            // 对战已截止，此时根据最终票数决定胜者
            if (battleData.option1.votes > battleData.option2.votes) {
                battleData.winner = battleData.option1.name;
            } else if (battleData.option2.votes > battleData.option1.votes) {
                battleData.winner = battleData.option2.name;
            } else {
                battleData.winner = '平局';
            }
        } else {
            // 对战未截止，隐藏胜者信息
            battleData.winner = null;
        }
        
        // 移除敏感信息后再返回
        delete battleData.votedIPs;
        return battleData;
    });


    // 将活动标题和对战列表一起返回
    res.json({
        eventTitle: db.eventTitle,
        battles: publicBattles
    });
});

// POST /api/admin/event-title - 新增：管理员更新活动标题
app.post('/api/admin/event-title', (req, res) => {
    const correctPassword = process.env.ADMIN_PASSWORD || "devpassword";
    const { adminPassword, newTitle } = req.body;

    if (adminPassword !== correctPassword) {
        return res.status(403).json({ error: '密码错误，无权操作！' });
    }
    if (!newTitle) {
        return res.status(400).json({ error: '标题不能为空！' });
    }

    const db = readDB();
    db.eventTitle = newTitle;
    writeDB(db);
    res.json({ message: '活动标题已更新', newTitle: newTitle });
});


// POST /api/admin/battles - 管理员创建新的对战
app.post('/api/admin/battles', (req, res) => {
    upload(req, res, (err) => {
        const correctPassword = process.env.ADMIN_PASSWORD || "devpassword";
        const { adminPassword, option1Name, option2Name, deadline } = req.body;

        if (adminPassword !== correctPassword) return res.status(403).send('密码错误，无权操作！');
        if (err) return res.status(500).json({ error: err.message });
        if (!deadline) return res.status(400).send('必须设置截止时间！');

        const db = readDB();
        const newBattle = {
            id: Date.now(),
            option1: { name: option1Name, image: `/uploads/${req.files.option1Image[0].filename}`, votes: 0 },
            option2: { name: option2Name, image: `/uploads/${req.files.option2Image[0].filename}`, votes: 0 },
            deadline: deadline,
            winner: null,
            votedIPs: []
        };
        db.battles.push(newBattle);
        writeDB(db);
        res.redirect('/');
    });
});

// 其他API接口 (DELETE, POST vote) 保持不变...
// DELETE /api/admin/battles/:id
app.delete('/api/admin/battles/:id', (req, res) => {
    const correctPassword = process.env.ADMIN_PASSWORD || "devpassword";
    const { adminPassword } = req.body;
    
    if (adminPassword !== correctPassword) return res.status(403).json({ error: '密码错误，无权操作！' });

    const battleId = parseInt(req.params.id);
    const db = readDB();
    
    const battleIndex = db.battles.findIndex(b => b.id === battleId);

    if (battleIndex > -1) {
        db.battles.splice(battleIndex, 1);
        writeDB(db);
        res.json({ message: '对战已成功移除' });
    } else {
        res.status(404).json({ error: '未找到该对战' });
    }
});

// POST /api/battles/:id/vote
app.post('/api/battles/:id/vote', (req, res) => {
    const battleId = parseInt(req.params.id);
    const { option } = req.body;
    const userIp = req.ip;

    const db = readDB();
    const battle = db.battles.find(b => b.id === battleId);

    if (!battle) return res.status(404).json({ error: '未找到对战' });
    
    if (new Date() > new Date(battle.deadline)) return res.status(403).json({ error: '投票已截止！' });

    if (!battle.votedIPs) battle.votedIPs = [];
    if (battle.votedIPs.includes(userIp)) return res.status(403).json({ error: '您已经投过票了！' });

     if (option === 'option1' || option === 'option2') {
        battle[option].votes++;
        battle.votedIPs.push(userIp);

        // 删除了判断胜负的逻辑

        writeDB(db);
        // 为了安全，我们返回一个不包含敏感信息（如IP列表）的对象
        res.json({ message: '投票成功' });
    } else {
        res.status(400).json({ error: '选项无效' });
    }
});

app.listen(PORT, () => {
    console.log(`服务器正在 http://localhost:${PORT} 运行`);
});