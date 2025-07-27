// server.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', true);   // 信任代理，允许获取真实的客户端 IP            
const PORT = process.env.PORT || 3000;

// --- 数据库文件路径 ---
const DB_FILE = './db.json';

// --- 配置 Multer 用于图片上传 ---
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage
}).fields([{ name: 'option1Image' }, { name: 'option2Image' }]);


// --- 中间件 ---
// 使用 express.static 来提供 public 文件夹中的静态文件 (HTML, CSS, JS)
app.use(express.static('public'));
// 解析 URL-encoded 的请求体 (用于表单提交)
app.use(express.urlencoded({ extended: true }));
// 解析 JSON 格式的请求体
app.use(express.json());

// --- 数据库操作辅助函数 ---
const readDB = () => {
    // 如果 db.json 文件不存在，则创建一个空的对象
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

// GET /api/battles - 获取所有对战
app.get('/api/battles', (req, res) => {
    const db = readDB();
    res.json(db.battles);
});

// POST /api/admin/battles - 管理员创建新的对战
app.post('/api/admin/battles', (req, res) => {
    upload(req, res, (err) => {
         const correctPassword = process.env.ADMIN_PASSWORD || "devpassword"; // 本地开发时使用 "devpassword"
        const { adminPassword } = req.body;

        if (adminPassword !== correctPassword) {
            return res.status(403).send('密码错误，无权操作！');
        }
        // --- 验证结束 ---

        if(err){
            return res.status(500).json({ error: err.message });
        }

        const { option1Name, option2Name } = req.body;
        const db = readDB();

        const newBattle = {
            id: Date.now(),
            option1: {
                name: option1Name,
                image: `/uploads/${req.files.option1Image[0].filename}`,
                votes: 0
            },
            option2: {
                name: option2Name,
                image: `/uploads/${req.files.option2Image[0].filename}`,
                votes: 0
            },
            winner: null,
            votedIPs: [] // 创建对战时，初始化votedIPs数组
        };

        db.battles.push(newBattle);
        writeDB(db);
        // 创建成功后，可以重定向或返回成功消息
        // 为了避免表单重复提交，最好是重定向
        res.redirect('/');
    });
});

// POST /api/battles/:id/vote - 用户投票
app.post('/api/battles/:id/vote', (req, res) => {
    const battleId = parseInt(req.params.id);
    const { option } = req.body; // 'option1' 或 'option2'
    const userIp = req.ip; // 获取用户的IP地址

    const db = readDB();
    const battle = db.battles.find(b => b.id === battleId);

    if (!battle) {
        return res.status(404).json({ error: '未找到对战' });
    }

    // --- 新增的防重复投票逻辑 ---
    if (!battle.votedIPs) {
        battle.votedIPs = []; // 如果 votedIPs 字段不存在，则初始化为空数组
    }

    if (battle.votedIPs.includes(userIp)) {
        // 如果IP已经存在，则返回错误信息
        return res.status(403).json({ error: '您已经投过票了！' });
    }
    // --- 逻辑结束 ---


    if (option === 'option1' || option === 'option2') {
        battle[option].votes++;
        battle.votedIPs.push(userIp); // 将IP存入数组

        // 决出胜者逻辑
        if (battle.option1.votes > battle.option2.votes) {
            battle.winner = battle.option1.name;
        } else if (battle.option2.votes > battle.option2.votes) {
            battle.winner = battle.option2.name;
        } else {
            battle.winner = '平局';
        }

        writeDB(db);
        res.json(battle);
    } else {
        res.status(400).json({ error: '选项无效' });
    }
});


// --- 启动服务器 ---
app.listen(PORT, () => {
    console.log(`服务器正在 http://localhost:${PORT} 运行`);
});