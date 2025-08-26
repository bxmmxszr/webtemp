// routes/passageRoutes.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
// ========== 添加这一行 ========== //
const jwt = require('jsonwebtoken'); // 引入 jwt 模块
// ============================== //
require('dotenv').config(); // 如果需要使用环境变量，也应引入

// 使用 express.Router 创建模块化的路由处理器
const router = express.Router();

// 引入 Passage 模型
const Passage = require('../models/Passage');

// --- JWT 密钥和中间件 ---
// 确保 JWT_SECRET 可用
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_here_change_this';

// JWT认证中间件 (复制自 server.js)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: '访问令牌缺失' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => { // <-- 现在 jwt 已定义
        if (err) {
            return res.status(403).json({ success: false, error: '令牌无效' });
        }
        req.user = user;
        next();
    });
}

// 管理员权限检查中间件 (复制自 server.js)
function requireAdmin(req, res, next) {
    // 从环境变量获取管理员邮箱列表，或使用默认值
    const adminEmailsString = process.env.ADMIN_EMAILS || 'admin@example.com';
    const adminEmails = adminEmailsString.split(',').map(email => email.trim());

    if (req.user && req.user.email && adminEmails.includes(req.user.email)) {
        next();
    } else {
        console.warn(`用户 ${req.user?.email || 'Unknown'} 尝试访问管理员资源被拒绝。`);
        return res.status(403).json({ success: false, error: '需要管理员权限' });
    }
}
// --- 中间件结束 ---


// --- multer 配置 ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'passage-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const passageUpload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传CSV文件'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB限制
});
// --- multer 配置结束 ---


// --- Passage API Routes ---

// 上传短文CSV (管理员)
// 使用本地定义的 passageUpload
router.post('/import', authenticateToken, requireAdmin, passageUpload.single('file'), async (req, res) => { // <-- 修改这里使用 passageUpload
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '请选择要上传的CSV文件' });
        }

        const results = [];
        const errors = [];

        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                try {
                    let successCount = 0;
                    for (const passageData of results) {
                        try {
                            if (!passageData.title || !passageData.content || !passageData.grade) {
                                errors.push({ passageData, error: '缺少必需字段: title, content, grade' });
                                continue;
                            }
                            const passage = new Passage(passageData);
                            await passage.save();
                            successCount++;
                        } catch (saveError) {
                            errors.push({ passageData, error: saveError.message }); // 修正变量名
                        }
                    }

                    // 删除临时文件
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }

                    res.json({
                        success: true,
                        importedCount: successCount,
                        errors: errors,
                        message: `短文导入成功！成功导入 ${successCount} 篇短文。`
                    });
                } catch (processError) {
                    console.error('处理CSV数据失败:', processError);
                    // 删除临时文件
                    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                    res.status(500).json({ success: false, error: '短文导入失败: ' + processError.message });
                }
            })
            .on('error', (fileError) => {
                console.error('CSV文件处理错误:', fileError);
                // 删除临时文件 (如果存在)
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                res.status(500).json({ success: false, error: '文件处理失败: ' + fileError.message });
            });

    } catch (error) {
        console.error('导入短文失败:', error);
        // 确保即使在顶层 catch 中也尝试删除文件
        if (req.file && fs.existsSync(req.file.path)) {
             try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { console.error('删除临时文件失败:', unlinkErr); }
        }
        res.status(500).json({ success: false, error: '导入短文失败: ' + error.message });
    }
});

// 获取指定年级的随机短文
// --- 修正: 解除注释并修复路由 ---
router.get('/random', authenticateToken, async (req, res) => { // <-- 使用 /random 路径并移除 requireAdmin
    try {
        // --- 修正: 从查询参数获取 grade ---
        const { grade } = req.query;

        if (!grade) {
            return res.status(400).json({ success: false, error: '请提供年级参数 (grade)' });
        }

        // 使用聚合管道随机选择一篇
        const passages = await Passage.aggregate([
            { $match: { grade: grade } },
            { $sample: { size: 1 } }
        ]);

        if (passages.length === 0) {
             // --- 修正: 返回 404 状态码 ---
             return res.status(404).json({ success: false, error: `未找到年级为 ${grade} 的短文` });
        }

        // --- 修正: 返回完整的 passage 对象 ---
        res.json({ success: true, passage: passages[0] });
    } catch (error) {
        console.error('获取随机短文失败:', error);
        res.status(500).json({ success: false, error: '获取随机短文失败: ' + error.message });
    }
});

// 获取短文列表 (管理员)
// --- 修正: 确保只有一个 /list 路由 ---
router.get('/list', authenticateToken, requireAdmin, async (req, res) => { // <-- 保留 /list 路由和 requireAdmin
     try {
         // --- 修正: 从查询参数获取分页和筛选参数 ---
         const { page = 1, limit = 20, grade, search } = req.query;
         let query = {};
         if (grade) query.grade = grade;
         if (search) {
             // --- 修正: 搜索标题和内容 ---
             query.$or = [
                 { title: { $regex: search, $options: 'i' } },
                 { content: { $regex: search, $options: 'i' } }
             ];
         }
         const skip = (parseInt(page) - 1) * parseInt(limit);
         // --- 修正: 按创建时间倒序排列 ---
         const passages = await Passage.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
         const total = await Passage.countDocuments(query);
         res.json({
             success: true,
             passages, // --- 修正: 返回 passages 数组 ---
             pagination: { // --- 修正: 返回分页信息 ---
                 currentPage: parseInt(page),
                 totalPages: Math.ceil(total / parseInt(limit)),
                 totalItems: total,
                 itemsPerPage: parseInt(limit)
             }
         });
     } catch (error) {
         console.error('获取短文列表失败:', error);
         res.status(500).json({ success: false, error: '获取短文列表失败: ' + error.message });
     }
});

// 获取单篇短文详情
router.get('/:id', authenticateToken, async (req, res) => {
     try {
         const { id } = req.params;
         // --- 修正: 使用 findById ---
         const passage = await Passage.findById(id);
         if (!passage) {
              return res.status(404).json({ success: false, error: '短文不存在' });
         }
         res.json({ success: true, passage });
     } catch (error) {
         console.error('获取短文详情失败:', error);
         res.status(500).json({ success: false, error: '获取短文详情失败: ' + error.message });
     }
});

// 导出 router 实例，以便在 server.js 中使用
module.exports = router;