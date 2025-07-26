// server.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

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
            winner: null
        };

        db.battles.push(newBattle);
        writeDB(db);
        res.redirect('/'); // 创建成功后重定向回首页
    });
});

// POST /api/battles/:id/vote - 用户投票
app.post('/api/battles/:id/vote', (req, res) => {
    const battleId = parseInt(req.params.id);
    const { option } = req.body; // 'option1' 或 'option2'

    const db = readDB();
    const battle = db.battles.find(b => b.id === battleId);

    if (battle && (option === 'option1' || option === 'option2')) {
        battle[option].votes++;
        
        // 决出胜者逻辑
        if (battle.option1.votes > battle.option2.votes) {
            battle.winner = battle.option1.name;
        } else if (battle.option2.votes > battle.option1.votes) {
            battle.winner = battle.option2.name;
        } else {
            battle.winner = '平局';
        }

        writeDB(db);
        res.json(battle);
    } else {
        res.status(404).json({ error: '未找到对战或选项无效' });
    }
});


// --- 启动服务器 ---
app.listen(PORT, () => {
    console.log(`服务器正在 http://localhost:${PORT} 运行`);
});