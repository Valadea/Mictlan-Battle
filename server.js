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
// server.js (替换此部分)

app.get('/api/data', (req, res) => {
    const db = readDB();
    const now = new Date();
    let dbWasModified = false; // 标记数据库是否被修改

    // 遍历所有对战，检查是否需要“结算”
    db.battles.forEach(battle => {
        // 首先，确保 deadline 存在，且当前时间已超过截止时间
        const isExpired = battle.deadline && (now > new Date(battle.deadline));

        // 如果已截止，并且胜者还未被记录（winner is null），则进行结算
        if (isExpired && battle.winner === null) {
            console.log(`结算对战 ID: ${battle.id}`); // 在服务器后台打印日志，方便调试
            if (battle.option1.votes > battle.option2.votes) {
                battle.winner = battle.option1.name;
            } else if (battle.option2.votes > battle.option1.votes) {
                battle.winner = battle.option2.name;
            } else {
                battle.winner = '平局';
            }
            dbWasModified = true; // 标记需要将更新后的胜者信息写回文件
        }
    });

    // 如果在上面的循环中结算了任何对战，就将更新写回 db.json
    if (dbWasModified) {
        console.log('检测到新的结算，正在更新 db.json...');
        writeDB(db);
    }

    // 准备要发给客户端的公开数据（移除敏感信息）
    const publicBattles = db.battles.map(battle => {
        const { votedIPs, ...publicData } = battle;
        return publicData;
    });

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
    // ======================= 投票接口调试日志 开始 =======================
    console.log("\n<<<<<<<<<< 投票接口被触发 >>>>>>>>>>");
    const battleId = parseInt(req.params.id);
    const { option } = req.body;
    console.log(`[投票日志] 收到对战ID: ${battleId} 的投票请求`);
    console.log(`[投票日志] 投票选项: ${option}`);

    const db = readDB();
    const battle = db.battles.find(b => b.id === battleId);

    if (!battle) {
        console.error("[投票日志] 错误：未找到ID为 " + battleId + " 的对战！");
        return res.status(404).json({ error: '未找到对战' });
    }
    
    // 暂时忽略截止时间，确保能投票
    // if (new Date() > new Date(battle.deadline)) return res.status(403).json({ error: '投票已截止！' });

    console.log(`[投票日志] 投票前票数: ${battle.option1.name}(${battle.option1.votes}) vs ${battle.option2.name}(${battle.option2.votes})`);

    if (option === 'option1' || option === 'option2') {
        battle[option].votes++; // 增加票数
        console.log(`[投票日志] 投票后票数: ${battle.option1.name}(${battle.option1.votes}) vs ${battle.option2.name}(${battle.option2.votes})`);
        
        console.log("[投票日志] 准备执行 writeDB 将更新写入 db.json...");
        writeDB(db);
        console.log("[投票日志] writeDB 执行完毕！");
        
        res.json({ message: '投票成功！' }); // 返回成功信息
    } else {
        console.error("[投票日志] 错误：无效的投票选项 " + option);
        res.status(400).json({ error: '选项无效' });
    }
    console.log("<<<<<<<<<< 投票接口处理结束 >>>>>>>>>>\n");
    // ======================= 投票接口调试日志 结束 =======================
});

app.listen(PORT, () => {
    console.log(`服务器正在 http://localhost:${PORT} 运行`);
});