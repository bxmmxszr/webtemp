// server.js
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os'); // 添加 os 模块

require('dotenv').config();

// 加载路由
const userRoutes = require('./users');
const quizRecordRoutes = require('./quizRecordRoutes');
 
// 注册路由
app.use('/api/users', userRoutes);
app.use('/api/quiz', quizRecordRoutes);

// 导入CSV处理库
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

// 导入multer用于文件上传
const multer = require('multer');
const app = express();

// --- 修改: 将默认端口改为 5000 以避免与前端开发服务器冲突 ---
//const PORT = process.env.PORT || 5000;
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_here_change_this';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';


//const User = require('./models/User'); // 如果需要获取用户ID等，但不导出基本信息
//const LearningRecord = require('./models/LearningRecord');
//const Vocabulary = require('./models/Vocabulary');
//const UserVocabularyRecord = require('./models/UserVocabularyRecord');
//const QuizRecord = require('./models/QuizRecord'); // 确保此模型已定义
//const IncorrectWord = require('./models/IncorrectWord');

// --- 引入所有需要在路由中直接使用的模型 ---
const User = require('./models/User');
const LearningRecord = require('./models/LearningRecord');
//const Vocabulary = require('./models/Vocabulary');
//const CoreVocabulary = require('./models/CoreVocabulary'); // 确保引入 CoreVocabulary
const UserVocabularyRecord = require('./models/UserVocabularyRecord');
const QuizRecord = require('./models/QuizRecord');
const IncorrectWord = require('./models/IncorrectWord');
const Passage = require('./models/Passage'); // 引入 Passage 模型
// --- 模型引入结束 ---
// 引入模型，让 Mongoose 知道这些模型的存在
require('./models/Passage'); // 确保引入了 Passage


// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static('uploads'));
app.use('/exports', express.static('exports'));
app.use(express.static('.')); // 服务静态HTML文件

// ========== 添加: 引入并使用路由文件 ========== //
// 引入路由文件
// passage 路由
//const passageRoutes = require('./routes/passageRoutes'); // 请确保路径正确
//app.use('/api/passages', passageRoutes);

const passageRoutes = require('./passageRoutes');
app.use('/api/passage', passageRoutes);
// 如果有其他路由文件，也以同样方式引入
// ========== 路由引入结束 ========== //

// 在 server.js 的适当位置（通常在数据库连接之后，路由定义之前）
// 引入模型，即使你暂时没有在 server.js 中直接使用它
// 这样做是为了让 Mongoose 知道这个模型的存在
require('./models/Passage');

// 如果有其他模型文件，也以同样方式引入
// require('./models/User');
// require('./models/CoreVocabulary');


// 连接MongoDB数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/english_learning');
// 数据库连接状态监听
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB连接错误:'));
db.once('open', () => {
  console.log('✅ MongoDB数据库连接成功');
});


// ========== 数据模型 ==========

// 用户模型
//const userSchema = new mongoose.Schema({
//    email: { type: String, required: true, unique: true },
//    password: { type: String, required: true },
//    name: { type: String, required: true },
//    phone: String,
//    birthday: String,
//    bio: String,
//    createdAt: { type: Date, default: Date.now },
//    lastLogin: Date,
//    isAdmin: { type: Boolean, default: false }
//});
//const User = mongoose.model('User', userSchema);

// 学习记录模型
const learningRecordSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    content: String,
    duration: Number,
    score: Number,
    date: { type: Date, default: Date.now }
});

//const LearningRecord = mongoose.model('LearningRecord', learningRecordSchema);

// 生词表模型
//const vocabularySchema = new mongoose.Schema({
//    userId: { type: String, required: true },
//    word: { type: String, required: true },
//    translation: { type: String, required: true },
//    partOfSpeech: String,
//    source: String,
//    createdAt: { type: Date, default: Date.now }
//});

const vocabularySchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true }, // 使用 userId 字符串存储
    word: { type: String, required: true },
    translation: { type: String, required: true },
    partOfSpeech: { type: String, default: '' },
    source: { type: String, default: '用户添加' }, // 记录来源
    createdAt: { type: Date, default: Date.now }
});

const Vocabulary = mongoose.model('Vocabulary', vocabularySchema); // 模型名 'Vocabulary'

//const Vocabulary = mongoose.model('Vocabulary', vocabularySchema);

// 核心词汇模型
const coreVocabularySchema = new mongoose.Schema({
    word: { type: String, required: true, unique: true },
    pronunciation: String,
    translation: { type: String, required: true },
    partOfSpeech: String,
    example: String,
    exampleTranslation: String,
    difficulty: { 
        type: String, 
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    category: { type: String, required: true }, // 用于年级分类，如 'grade7', 'grade8'
    tags: [String],
    frequency: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const CoreVocabulary = mongoose.model('CoreVocabulary', coreVocabularySchema);

// 用户词汇学习记录模型
const userVocabularyRecordSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    vocabularyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'CoreVocabulary' },
    status: { 
        type: String, 
        enum: ['new', 'learning', 'reviewing', 'mastered', 'forgotten'],
        default: 'new'
    },
    firstLearnedAt: { type: Date },
    lastReviewedAt: { type: Date },
    reviewCount: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    nextReviewDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

//const UserVocabularyRecord = mongoose.model('UserVocabularyRecord', userVocabularyRecordSchema);

// ========== 错误单词模型 (新增/确认) ==========
//const incorrectWordSchema = new mongoose.Schema({
//    user: { // 使用 userId 字符串存储，与现有模型保持一致
//        type: String,
//        required: true,
//        index: true // 为用户查询优化
//    },
//    vocabularyId: { // 可选：关联核心词汇ID
//        type: mongoose.Schema.Types.ObjectId,
//        ref: 'CoreVocabulary',
//        // required: false,
//    },
//    word: {
//        type: String,
//        required: true,
//        trim: true
//    },
//    translation: {
//        type: String,
//        required: true,
//        trim: true
//    },
//    partOfSpeech: {
//        type: String,
//        default: ''
//    },
//    source: { // 记录来源，例如 "中译英测试 - 2024/1/1"
//        type: String,
//        default: '词汇测试'
//    },
//    createdAt: {
//        type: Date,
//        default: Date.now
//    }
//});

// 错误单词记录模型 (用于词汇测试)
const incorrectWordSchema = new mongoose.Schema({
    // 词汇 (关联到 Vocabulary 集合)
    vocabularyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vocabulary', required: true },
    // 用户 (存储用户ID字符串，与 Vocabulary 等模型保持一致)
    // --- 修改前 ---
    // user: { // 使用 userId 字符串存储，与现有模型保持一致
    //      type: String,
    //      required: true,
    //      index: true // 为用户查询优化
    // },
    // --- 修改后 ---
    userId: { // <-- 改为 userId
         type: String,
         required: true,
         index: true // 为用户查询优化
    },
    // 记录创建时间
    createdAt: { type: Date, default: Date.now }
});

//const IncorrectWord = mongoose.model('IncorrectWord', incorrectWordSchema);


// 可选：为用户+单词组合创建唯一索引，防止重复记录（如果需要此逻辑）
// incorrectWordSchema.index({ user: 1, word: 1 }, { unique: true });

//const IncorrectWord = mongoose.model('IncorrectWord', incorrectWordSchema);

// ========== 测试记录模型 (新增/确认) ==========
const quizRecordSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true }, // 关联用户
    type: { // 测试类型
        type: String,
        required: true,
        enum: ['chinese-to-english', 'english-to-chinese', 'spelling']
    },
    score: { type: Number, required: true }, // 百分比得分 (0-100)
    questions: { type: Number, required: true }, // 总题目数
    correct: { type: Number, required: true }, // 答对题数
    timeTaken: { type: Number, required: true }, // 耗时（秒）
    date: { type: Date, default: Date.now } // 测试完成日期
});

//const QuizRecord = mongoose.model('QuizRecord', quizRecordSchema);


// 配置文件上传
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
        cb(null, 'vocabulary-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传CSV文件'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB限制
    }
});

// ========== 中间件 ==========

// JWT认证中间件
//function authenticateToken(req, res, next) {
//    const authHeader = req.headers['authorization'];
//    const token = authHeader && authHeader.split(' ')[1];
//    
//    if (!token) {
//        return res.status(401).json({ 
//            success: false,
//            error: '访问令牌缺失' 
//        });
//    }
//    
//    jwt.verify(token, JWT_SECRET, (err, user) => {
//        if (err) {
//            return res.status(403).json({ 
//                success: false,
//                error: '令牌无效' 
//            });
//        }
//        req.user = user;
//        next();
//    });
//}
// server.js 中的 authenticateToken 中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ success: false, error: '访问令牌缺失' });
    }

    jwt.verify(token, JWT_SECRET, (err, decodedPayload) => { // 使用 decodedPayload 避免混淆
        if (err) {
            return res.status(403).json({ success: false, error: '令牌无效' });
        }

        // --- 修改点：明确构造 req.user 对象 ---
        // 确保无论 payload 里是 id 还是 userId，都统一到 req.user.userId
        req.user = {
            userId: decodedPayload.userId || decodedPayload.id || decodedPayload._id // 根据实际签发的 payload 调整
        };
        // 如果 payload 里还有其他你需要的字段，也可以加进来
        req.user.email = decodedPayload.email;

        next();
    });
}


// 管理员权限检查中间件
//function requireAdmin(req, res, next) {
//    const adminEmails = ['admin@example.com', 'admin@liuxinenglish.com'];
//    if (!req.user || !adminEmails.includes(req.user.email)) {
//        return res.status(403).json({ 
//            success: false,
//            error: '需要管理员权限' 
//        });
//    }
//    next();
//}

// server.js
function requireAdmin(req, res, next) {
    // 从环境变量或默认值获取管理员邮箱列表
    const adminEmailsString = process.env.ADMIN_EMAILS || 'admin@example.com';
    const adminEmails = adminEmailsString.split(',').map(email => email.trim());
    
	// --- 添加调试日志 ---
    console.log("DEBUG requireAdmin: Checking user", req.user, "against admins", adminEmails);
    // --- 添加调试日志结束 ---
	
    // 检查 req.user 是否存在，其 email 是否在管理员列表中
    if (req.user && req.user.email && adminEmails.includes(req.user.email)) {
        next(); // 是管理员，继续
    } else {
        // 不是管理员，拒绝访问
        console.warn(`用户 ${req.user?.email || 'Unknown'} 尝试访问管理员资源被拒绝。`);
        res.status(403).json({ success: false, error: '需要管理员权限' });
    }
}

//// 管理员权限检查中间件
//function requireAdmin(req, res, next) {
//    const adminEmails = ['admin@example.com']; // 硬编码且列表不完整
//    if (adminEmails.includes(req.user.email)) {
//        next();
//    } else {
//        res.status(403).json({ success: false, error: '需要管理员权限' });
//    }
//}

// 管理员权限检查中间件
function requireAdmin(req, res, next) {
    const adminEmailsString = process.env.ADMIN_EMAILS || 'admin@example.com';
    const adminEmails = adminEmailsString.split(',').map(email => email.trim());

    if (req.user && req.user.email && adminEmails.includes(req.user.email)) {
        next();
    } else {
        console.warn(`用户 ${req.user?.email || 'Unknown'} 尝试访问管理员资源被拒绝。`);
        res.status(403).json({ success: false, error: '需要管理员权限' });
    }
}

// ========== API路由 ==========

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true,
        service: 'English Learning Platform API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// 用户注册
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        // 验证输入
        if (!email || !password || !name) {
            return res.status(400).json({ 
                success: false,
                error: '请填写所有必填字段' 
            });
        }
        
        // 检查用户是否已存在
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                error: '该邮箱已被注册' 
            });
        }
        
        // 密码加密
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 创建新用户
        const newUser = new User({
            email,
            password: hashedPassword,
            name,
            createdAt: new Date()
        });
        
        await newUser.save();
        
        res.status(201).json({ 
            success: true,
            message: '注册成功', 
            user: { 
                id: newUser._id, 
                email: newUser.email, 
                name: newUser.name 
            }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ 
            success: false,
            error: '服务器错误' 
        });
    }
});

//// 用户登录
//app.post('/api/login', async (req, res) => {
//    try {
//        const { email, password } = req.body;
//        
//        // 验证输入
//        if (!email || !password) {
//            return res.status(400).json({ 
//                success: false,
//                error: '请填写邮箱和密码' 
//            });
//        }
//        
//        // 查找用户
//        const user = await User.findOne({ email });
//        if (!user) {
//            return res.status(400).json({ 
//                success: false,
//                error: '用户不存在' 
//            });
//        }
//        
//        // 验证密码
//        const isValidPassword = await bcrypt.compare(password, user.password);
//        if (!isValidPassword) {
//            return res.status(400).json({ 
//                success: false,
//                error: '密码错误' 
//            });
//        }
//        
//        // 更新最后登录时间
//        user.lastLogin = new Date();
//        await user.save();
//        
//        // 生成JWT token
//        const token = jwt.sign(
//            { 
//                userId: user._id, 
//                email: user.email,
//                name: user.name
//            }, 
//            JWT_SECRET, 
//            { expiresIn: '24h' }
//        );
//        
//        res.json({ 
//            success: true,
//            message: '登录成功', 
//            token,
//            user: { 
//                id: user._id, 
//                email: user.email, 
//                name: user.name,
//                phone: user.phone,
//                birthday: user.birthday,
//                bio: user.bio
//            }
//        });
//    } catch (error) {
//        console.error('登录错误:', error);
//        res.status(500).json({ 
//            success: false,
//            error: '服务器错误' 
//        });
//    }
//});

// 获取用户信息
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                error: '用户不存在' 
            });
        }
        
        res.json({ 
            success: true,
            user: { 
                id: user._id, 
                email: user.email, 
                name: user.name,
                phone: user.phone,
                birthday: user.birthday,
                bio: user.bio,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.status(500).json({ 
            success: false,
            error: '服务器错误' 
        });
    }
});

// 获取用户信息
// server.js 中的登录路由
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. 查找用户
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, error: '邮箱或密码错误' });
        }

        // 2. 验证密码
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: '邮箱或密码错误' });
        }

        // 3. 准备 JWT payload - *** 关键检查点 ***
        // 确保这里的字段名是 'userId'
        const payload = {
            userId: user._id, // <--- 确保是 userId
            email: user.email
            // 可以包含其他非敏感信息
        };

        // 4. 签发 token
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        // 5. 更新最后登录时间 (可选)
        user.lastLogin = Date.now();
        await user.save();

        // 6. 返回成功响应
        res.json({
            success: true,
            message: '登录成功',
            token: token, // 将 token 发送给前端
            user: {
                id: user._id,
                email: user.email,
                name: user.name
                // ... 其他用户信息
            }
        });

    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 更新用户信息
app.put('/api/user', authenticateToken, async (req, res) => {
    try {
        const { name, phone, birthday, bio } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { name, phone, birthday, bio },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                error: '用户不存在' 
            });
        }
        
        res.json({ 
            success: true,
            message: '用户信息更新成功', 
            user: { 
                id: user._id, 
                email: user.email, 
                name: user.name,
                phone: user.phone,
                birthday: user.birthday,
                bio: user.bio,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        console.error('更新用户信息错误:', error);
        res.status(500).json({ 
            success: false,
            error: '服务器错误' 
        });
    }
});

// 修改密码
app.put('/api/user/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false,
                error: '请填写当前密码和新密码' 
            });
        }
        
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                error: '用户不存在' 
            });
        }
        
        // 验证当前密码
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ 
                success: false,
                error: '当前密码错误' 
            });
        }
        
        // 密码加密
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        
        await user.save();
        
        res.json({ 
            success: true,
            message: '密码修改成功' 
        });
    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json({ 
            success: false,
            error: '服务器错误' 
        });
    }
});

// 添加学习记录
app.post('/api/learning-records', authenticateToken, async (req, res) => {
    try {
        const { content, duration, score } = req.body;
        
        const record = new LearningRecord({
            userId: req.user.userId,
            content,
            duration,
            score
        });
        
        await record.save();
        
        res.status(201).json({ 
            success: true,
            message: '学习记录添加成功', 
            record 
        });
    } catch (error) {
        console.error('添加学习记录错误:', error);
        res.status(500).json({ 
            success: false,
            error: '服务器错误' 
        });
    }
});

// 获取学习记录
app.get('/api/learning-records', authenticateToken, async (req, res) => {
    try {
        const records = await LearningRecord.find({ userId: req.user.userId })
            .sort({ date: -1 })
            .limit(50);
        
        res.json({ 
            success: true,
            records 
        });
    } catch (error) {
        console.error('获取学习记录错误:', error);
        res.status(500).json({ 
            success: false,
            error: '服务器错误' 
        });
    }
});

/*
// 添加生词
app.post('/api/vocabulary', authenticateToken, async (req, res) => {
    try {
        const { word, translation, partOfSpeech, source } = req.body;
        
        const vocabulary = new Vocabulary({
            userId: req.user.userId,
            word,
            translation,
            partOfSpeech,
            source
        });
        
        await vocabulary.save();
        
        res.status(201).json({ 
            success: true,
            message: '生词添加成功', 
            vocabulary 
        });
    } catch (error) {
        console.error('添加生词错误:', error);
        res.status(500).json({ 
            success: false,
            error: '服务器错误' 
        });
    }
});
*/

// 添加生词
app.post('/api/vocabulary', authenticateToken, async (req, res) => {
    try {
        const { word, translation, partOfSpeech, source } = req.body;
        const vocabulary = new Vocabulary({
            userId: req.user.userId, // 从认证中间件获取用户ID
            word,
            translation,
            partOfSpeech,
            source // 确保 source 被接收和存储
        });
        await vocabulary.save();
        res.status(201).json({
            success: true,
            message: '生词添加成功',
            vocabulary // 可选：返回创建的文档
        });
    } catch (error) {
        console.error('添加生词错误:', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 获取生词表
//app.get('/api/vocabulary', authenticateToken, async (req, res) => {
//    try {
//        const vocabulary = await Vocabulary.find({ userId: req.user.userId })
//            .sort({ createdAt: -1 });
//        
//        res.json({ 
//            success: true,
//            vocabulary 
//        });
//    } catch (error) {
//        console.error('获取生词表错误:', error);
//        res.status(500).json({ 
//            success: false,
//            error: '服务器错误' 
//        });
//    }
//});

/*
// 获取生词表 (修改后 - 结合核心词汇信息)
app.get('/api/vocabulary', authenticateToken, async (req, res) => {
    try {
        // 1. 获取当前用户的生词列表 (来自 Vocabulary 集合)
        const userVocabularyList = await Vocabulary.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        console.log(`用户 ${req.user.userId} 的生词数量: ${userVocabularyList.length}`);

        // 2. 提取单词名称，准备批量查询核心词汇库
        const userWordNames = userVocabularyList.map(vocab => vocab.word);
        console.log(`需要查询的核心词汇:`, userWordNames);

        // 3. 从核心词汇库 (CoreVocabularyItem 集合) 中查找这些单词的详细信息
        // 使用 $in 操作符进行批量查询
        let detailedVocabularyMap = {}; // 用于存储 { word: coreVocabularyItem }
        if (userWordNames.length > 0) {
            const coreVocabularyDetails = await CoreVocabularyItem.find({ word: { $in: userWordNames } });
            console.log(`从核心词汇库找到 ${coreVocabularyDetails.length} 个匹配项`);
            // 将数组转换为 Map，方便后续快速查找
            coreVocabularyDetails.forEach(coreItem => {
                // 以防万一有重复单词（虽然 CSV 中不应有），只保留第一个找到的
                if (!detailedVocabularyMap[coreItem.word]) {
                    detailedVocabularyMap[coreItem.word] = coreItem;
                }
            });
        }

        // 4. 合并用户生词信息和核心词汇详细信息
        const enrichedVocabularyList = userVocabularyList.map(userVocab => {
            const coreDetail = detailedVocabularyMap[userVocab.word];
            // 创建一个合并后的对象返回给前端
            // 优先使用核心词汇库的详细信息，用户添加时的信息作为补充
            return {
                // 来自用户生词表的信息
                _id: userVocab._id,
                userId: userVocab.userId, // 通常前端不需要，但可以保留
                word: userVocab.word,
                // --- 关键修改点：使用核心词汇库的翻译 ---
                // 如果核心库有翻译，则使用；否则使用用户自己添加的（可能不准确）
                translation: coreDetail?.translation || userVocab.translation || 'N/A',
                // --- 关键修改点：添加核心词汇库的字段 ---
                partOfSpeech: coreDetail?.partOfSpeech || userVocab.partOfSpeech || '', // 词性
                difficulty: coreDetail?.difficulty || 'N/A', // 难度
                category: coreDetail?.category || 'N/A', // 分类
                // 可以添加更多核心词汇库的字段...
                // 保留用户生词表的来源和创建时间
                source: userVocab.source || 'N/A',
                createdAt: userVocab.createdAt,
                updatedAt: userVocab.updatedAt
                // 注意：不要直接返回 coreDetail 对象，只选择需要的字段合并
            };
        });

        // 5. 返回合并后的列表
        res.json({
            success: true,
            vocabulary: enrichedVocabularyList // 返回增强后的列表
        });

    } catch (error) {
        console.error('获取并合并生词表错误:', error);
        res.status(500).json({
            success: false,
            error: '服务器错误'
        });
    }
});
*/

// 获取生词表 (修改后 - 结合核心词汇信息)
app.get('/api/vocabulary', authenticateToken, async (req, res) => {
    try {
        // 1. 获取当前用户的生词列表 (来自 Vocabulary 集合)
        // 注意：模型字段是 userId，查询也用 userId
        const userVocabularyList = await Vocabulary.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        console.log(`[GET /api/vocabulary] 用户 ${req.user.userId} 的生词数量: ${userVocabularyList.length}`);

        // 2. 提取单词名称，准备批量查询核心词汇库 (CoreVocabulary 集合)
        const userWordNames = userVocabularyList.map(vocab => vocab.word);
        console.log(`[GET /api/vocabulary] 需要查询的核心词汇:`, userWordNames);

        // 3. 从核心词汇库中查找这些单词的详细信息
        let detailedVocabularyMap = {}; // 用于存储 { word: coreVocabularyItem }
        if (userWordNames.length > 0) {
            // 使用 $in 操作符进行高效批量查询
            const coreVocabularyDetails = await CoreVocabulary.find({ word: { $in: userWordNames } });
            console.log(`[GET /api/vocabulary] 从核心词汇库找到 ${coreVocabularyDetails.length} 个匹配项`);
            // 将数组转换为 Map，方便后续 O(1) 时间复杂度查找
            coreVocabularyDetails.forEach(coreItem => {
                // 以防万一 CSV 中有重复单词（虽然不应该），只保留第一个找到的
                if (!detailedVocabularyMap[coreItem.word]) {
                    detailedVocabularyMap[coreItem.word] = coreItem.toObject(); // 转换为普通对象
                }
            });
        }

        // 4. 合并用户生词信息和核心词汇详细信息
        // 如果核心库中找不到，则保留用户生词的基本信息
        const enrichedVocabularyList = userVocabularyList.map(userVocab => {
            const userVocabObj = userVocab.toObject(); // 转换 Mongoose Document 为普通对象
            const coreDetail = detailedVocabularyMap[userVocabObj.word];

            if (coreDetail) {
                // 如果在核心词汇库中找到了，则用核心库的信息覆盖或补充用户信息
                // 保留用户生词表的 _id, userId, source, createdAt, updatedAt
                return {
                    ...userVocabObj, // 保留用户生词的元数据
                    // --- 使用核心词汇库的详细信息覆盖 ---
                    word: coreDetail.word,
                    pronunciation: coreDetail.pronunciation || userVocabObj.pronunciation || '',
                    translation: coreDetail.translation || userVocabObj.translation || 'N/A',
                    partOfSpeech: coreDetail.partOfSpeech || userVocabObj.partOfSpeech || '',
                    example: coreDetail.example || userVocabObj.example || '',
                    exampleTranslation: coreDetail.exampleTranslation || userVocabObj.exampleTranslation || '',
                    difficulty: coreDetail.difficulty || userVocabObj.difficulty || 'N/A',
                    category: coreDetail.category || userVocabObj.category || 'N/A',
                    tags: coreDetail.tags || userVocabObj.tags || [],
                    // ... 可以根据需要添加 CoreVocabulary 模型的其他字段
                };
            } else {
                // 如果核心库中没找到，保留用户添加的信息，其他字段设为默认值或空
                console.log(`[GET /api/vocabulary] 警告：单词 '${userVocabObj.word}' 在核心词汇库中未找到。`);
                return {
                    ...userVocabObj,
                    pronunciation: userVocabObj.pronunciation || '',
                    partOfSpeech: userVocabObj.partOfSpeech || '',
                    example: userVocabObj.example || '',
                    exampleTranslation: userVocabObj.exampleTranslation || '',
                    difficulty: userVocabObj.difficulty || 'N/A', // 或 'Unknown'
                    category: userVocabObj.category || 'N/A',     // 或 'Unknown'
                    tags: Array.isArray(userVocabObj.tags) ? userVocabObj.tags : (userVocabObj.tags ? [userVocabObj.tags] : [])
                };
            }
        });

        // 5. 返回合并后的列表
        res.json({
            success: true,
            vocabulary: enrichedVocabularyList, // 返回增强后的列表
            message: `成功加载 ${enrichedVocabularyList.length} 个生词`
        });
        console.log(`[GET /api/vocabulary] 成功为用户 ${req.user.userId} 返回 ${enrichedVocabularyList.length} 个 enriched 词汇`);

    } catch (error) {
        console.error('[GET /api/vocabulary] 获取并合并生词表错误:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误，无法加载生词表'
        });
    }
});

// 删除生词
app.delete('/api/vocabulary/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const vocabulary = await Vocabulary.findOneAndDelete({
            _id: id,
            userId: req.user.userId
        });
        
        if (!vocabulary) {
            return res.status(404).json({ 
                success: false,
                error: '生词不存在' 
            });
        }
        
        res.json({ 
            success: true,
            message: '生词删除成功' 
        });
    } catch (error) {
        console.error('删除生词错误:', error);
        res.status(500).json({ 
            success: false,
            error: '服务器错误' 
        });
    }
});



// 添加错误单词记录
app.post('/api/incorrect-words', authenticateToken, async (req, res) => {
    try {
        const { vocabularyId } = req.body;

        // 基本验证
        if (!vocabularyId) {
            return res.status(400).json({ success: false, error: '缺少 vocabularyId' });
        }

        // 检查词汇是否存在且属于当前用户
        const vocabulary = await Vocabulary.findOne({ _id: vocabularyId, userId: req.user.userId });
        if (!vocabulary) {
            return res.status(404).json({ success: false, error: '未找到对应的生词或生词不属于当前用户' });
        }

        // 创建新的错误记录
        const newIncorrectWord = new IncorrectWord({
            // --- 修改前 ---
            // user: req.user.userId, // 从认证中间件获取用户ID
            // --- 修改后 ---
            userId: req.user.userId, // <-- 改为 userId
            vocabularyId: vocabularyId
        });

        const savedRecord = await newIncorrectWord.save();

        // 可选：更新 Vocabulary 中的错误次数字段 (如果有的话)
        // await Vocabulary.findByIdAndUpdate(vocabularyId, { $inc: { errorCount: 1 } });

        res.status(201).json({
            success: true,
            message: '错误单词记录添加成功',
            record: savedRecord
        });
    } catch (error) {
        console.error('添加错误单词记录失败:', error);
        // 处理 Mongoose 验证错误
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        // 唯一索引冲突错误处理 (如果设置了唯一索引，例如 user + vocabularyId)
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: '该单词已存在于您的错误列表中' });
        }
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});


// 获取用户的错误单词历史记录
app.get('/api/incorrect-words', authenticateToken, async (req, res) => {
    try {
        // 可以添加分页、排序、筛选参数处理，这里简化
        // --- 修改点：查询条件从 { user: ... } 改为 { userId: ... } ---
        const incorrectWords = await IncorrectWord.find({ userId: req.user.userId }) // 从认证中间件获取用户ID，并使用 userId 字段查询
            .populate('vocabularyId')
            .sort({ createdAt: -1 }) // 按创建时间倒序
            .limit(50); // 限制数量

        res.json({
            success: true,
            records: incorrectWords
        });
    } catch (error) {
        console.error('获取错误单词记录失败:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// ========== 核心词汇API ==========

// 获取用户每日新学词汇 (修改版 - 更灵活)
app.get('/api/core-vocabulary/daily', authenticateToken, async (req, res) => {
    try {
        const { count = 10, category = 'general' } = req.query;
        const queryBase = { category: category }; // 基础查询条件

        // 1. 获取用户今天已学的词汇ID
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const userRecords = await UserVocabularyRecord.find({
            userId: req.user.userId,
            status: { $in: ['learning', 'mastered', 'reviewing'] },
            lastReviewedAt: { $gte: startOfDay, $lte: endOfDay }
        }).select('vocabularyId');
        const learnedTodayIds = userRecords.map(record => record.vocabularyId);

        let finalVocabulary = [];
        let message = '';

        // 2. 尝试获取排除今天已学词汇的新词
        if (learnedTodayIds.length > 0) {
            const queryWithoutLearned = { ...queryBase, _id: { $nin: learnedTodayIds } };
            const vocabularyWithoutLearned = await CoreVocabulary.aggregate([
                { $match: queryWithoutLearned },
                { $sample: { size: parseInt(count) } }
            ]);

            if (vocabularyWithoutLearned.length > 0) {
                finalVocabulary = vocabularyWithoutLearned;
                message = `成功获取 ${finalVocabulary.length} 个新词（已排除今日已学）`;
            }
        }

        // 3. 如果排除后没有词，或者还没达到请求的数量，则补充（或全部）获取
        if (finalVocabulary.length === 0) {
            // 如果 learnedTodayIds 为空，或者排除后没词，则获取所有该类别的词
            const allVocabulary = await CoreVocabulary.aggregate([
                { $match: queryBase },
                { $sample: { size: parseInt(count) } }
            ]);
            finalVocabulary = allVocabulary;
            message = `成功获取 ${finalVocabulary.length} 个词汇（包含可能的今日已学）`;
        }
        // 可选：如果 finalVocabulary.length < count 但 > 0，可以考虑从 learnedTodayIds 中再随机补充一些，
        // 但这通常不是必需的，因为 $sample 通常能很好地处理。

        res.json({
            success: true,
            vocabulary: finalVocabulary,
            message: message
        });
    } catch (error) {
        console.error('获取每日词汇失败:', error);
        res.status(500).json({ success: false, error: '获取词汇失败' });
    }
});

//// 获取每日随机词汇（10-15个）
//// --- 修改: 确保能正确处理 category 查询参数 ---
//app.get('/api/core-vocabulary/daily', authenticateToken, async (req, res) => {
//    try {
//        // --- 修改: 从查询参数获取 count, category, difficulty ---
//        const { count = 12, category, difficulty } = req.query;
//        
//        // --- 修改: 构建查询对象 ---
//        let query = {}; // 初始化查询对象
//        if (category) {
//            query.category = category; // 如果提供了 category，则添加到查询条件
//        }
//        if (difficulty) {
//            query.difficulty = difficulty; // 如果提供了 difficulty，则添加到查询条件
//        }
//        // --- 修改结束 ---
//
//        // 获取用户今天已学习的词汇 (这部分逻辑保持不变)
//        const today = new Date();
//        today.setHours(0, 0, 0, 0);
//        
//        const userRecords = await UserVocabularyRecord.find({
//            userId: req.user.userId,
//            createdAt: { $gte: today }
//        }).select('vocabularyId');
//        
//        const learnedToday = userRecords.map(record => record.vocabularyId);
//        
//        // 构建排除已学习词汇的查询 (这部分逻辑保持不变)
//        if (learnedToday.length > 0) {
//            query._id = { $nin: learnedToday };
//        }
//        
//        // 随机获取指定数量的词汇 (这部分逻辑保持不变)
//        const vocabulary = await CoreVocabulary.aggregate([
//            { $match: query }, // 使用构建好的查询对象
//            { $sample: { size: parseInt(count) } }
//        ]);
//        
//        res.json({
//            success: true,
//            vocabulary,
//            message: `成功获取 ${vocabulary.length} 个词汇`
//        });
//    } catch (error) {
//        console.error('获取每日词汇失败:', error);
//        res.status(500).json({
//            success: false,
//            error: '获取词汇失败'
//        });
//    }
//});

// 获取用户待复习词汇
app.get('/api/core-vocabulary/review', authenticateToken, async (req, res) => {
    try {
        const { count = 5 } = req.query;
        
        const now = new Date();
        const reviewRecords = await UserVocabularyRecord.find({
            userId: req.user.userId,
            status: { $in: ['learning', 'reviewing'] },
            nextReviewDate: { $lte: now }
        }).populate('vocabularyId');
        
        // 随机选择指定数量的词汇
        const shuffled = reviewRecords.sort(() => 0.5 - Math.random());
        const selectedRecords = shuffled.slice(0, parseInt(count));
        const vocabulary = selectedRecords.map(record => record.vocabularyId);
        
        res.json({
            success: true,
            vocabulary,
            message: `成功获取 ${vocabulary.length} 个复习词汇`
        });
    } catch (error) {
        console.error('获取复习词汇失败:', error);
        res.status(500).json({
            success: false,
            error: '获取复习词汇失败'
        });
    }
});

// 更新用户词汇学习记录
app.post('/api/core-vocabulary/record', authenticateToken, async (req, res) => {
    try {
        const { vocabularyId, status, isCorrect } = req.body;
        
        let record = await UserVocabularyRecord.findOne({
            userId: req.user.userId,
            vocabularyId: vocabularyId
        });
        
        if (!record) {
            // 创建新记录
            record = new UserVocabularyRecord({
                userId: req.user.userId,
                vocabularyId: vocabularyId,
                status: status,
                firstLearnedAt: new Date()
            });
        } else {
            // 更新现有记录
            record.status = status;
            record.lastReviewedAt = new Date();
            record.reviewCount += 1;
            
            if (isCorrect !== null) {
                if (isCorrect) {
                    record.correctCount += 1;
                } else {
                    record.incorrectCount += 1;
                }
            }
            
            // 基于遗忘曲线计算下次复习时间
            record.nextReviewDate = calculateNextReviewDate(
                record.reviewCount,
                record.correctCount,
                record.incorrectCount
            );
        }
        
        await record.save();
        
        res.json({
            success: true,
            record,
            message: '学习记录更新成功'
        });
    } catch (error) {
        console.error('更新学习记录失败:', error);
        res.status(500).json({
            success: false,
            error: '更新学习记录失败'
        });
    }
});

// 基于遗忘曲线计算下次复习时间
function calculateNextReviewDate(reviewCount, correctCount, incorrectCount) {
    const totalReviews = reviewCount;
    const accuracyRate = totalReviews > 0 ? correctCount / totalReviews : 1;
    
    let daysToAdd;
    if (accuracyRate >= 0.9) {
        daysToAdd = Math.pow(2, reviewCount);
    } else if (accuracyRate >= 0.7) {
        daysToAdd = Math.max(1, Math.floor(reviewCount / 2));
    } else {
        daysToAdd = 0.5;
    }
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    return nextDate;
}

// 获取用户学习统计
app.get('/api/core-vocabulary/stats', authenticateToken, async (req, res) => {
    try {
        const totalLearned = await UserVocabularyRecord.countDocuments({
            userId: req.user.userId,
            status: 'mastered'
        });
        
        const totalReviewing = await UserVocabularyRecord.countDocuments({
            userId: req.user.userId,
            status: { $in: ['learning', 'reviewing'] }
        });
        
        const totalNew = await UserVocabularyRecord.countDocuments({
            userId: req.user.userId,
            status: 'new'
        });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayLearned = await UserVocabularyRecord.countDocuments({
            userId: req.user.userId,
            createdAt: { $gte: today }
        });
        
        res.json({
            success: true,
            stats: {
                totalLearned,
                totalReviewing,
                totalNew,
                todayLearned
            }
        });
    } catch (error) {
        console.error('获取学习统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取学习统计失败'
        });
    }
});

// 上传CSV文件导入词汇（管理员功能）- 添加详细日志
app.post('/api/core-vocabulary/import', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
    try {
        // 详细日志：接收到文件上传请求
        console.log('接收到文件上传请求:', {
            fieldname: req.file ? req.file.fieldname : 'undefined',
            originalname: req.file ? req.file.originalname : 'undefined',
            encoding: req.file ? req.file.encoding : 'undefined',
            mimetype: req.file ? req.file.mimetype : 'undefined',
            destination: req.file ? req.file.destination : 'undefined',
            filename: req.file ? req.file.filename : 'undefined',
            path: req.file ? req.file.path : 'undefined',
            size: req.file ? req.file.size : 0
        });

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '请选择要上传的CSV文件'
            });
        }

        const results = [];
        const errors = [];
        
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => {
                console.log('读取CSV数据:', data);
                results.push(data);
            })
            .on('end', async () => {
                try {
                    console.log(`CSV文件读取完成，共读取 ${results.length} 行数据`);
                    let successCount = 0;
                    
                    for (const vocab of results) {
                        try {
                            console.log('处理词汇数据:', vocab);
                            
                            if (!vocab.word || !vocab.translation) {
                                const errorMsg = `词汇 "${vocab.word || 'unknown'}" 缺少必需字段`;
                                errors.push(errorMsg);
                                console.error(errorMsg);
                                continue;
                            }

                            const existingVocab = await CoreVocabulary.findOne({ word: vocab.word });
                            
                            if (existingVocab) {
                                await CoreVocabulary.findByIdAndUpdate(existingVocab._id, {
                                    ...vocab,
                                    updatedAt: new Date(),
                                    tags: vocab.tags ? vocab.tags.split(',').map(tag => tag.trim()) : []
                                });
                                console.log('更新现有词汇:', vocab.word);
                            } else {
                                const newVocab = new CoreVocabulary({
                                    word: vocab.word,
                                    pronunciation: vocab.pronunciation || '',
                                    translation: vocab.translation,
                                    partOfSpeech: vocab.partOfSpeech || '',
                                    example: vocab.example || '',
                                    exampleTranslation: vocab.exampleTranslation || '',
                                    difficulty: vocab.difficulty || 'beginner',
                                    category: vocab.category || 'general', // 确保有 category 字段
                                    tags: vocab.tags ? vocab.tags.split(',').map(tag => tag.trim()) : []
                                });
                                await newVocab.save();
                                console.log('创建新词汇:', vocab.word);
                            }
                            successCount++;
                        } catch (error) {
                            const errorMsg = `导入词汇 "${vocab.word}" 失败: ${error.message}`;
                            errors.push(errorMsg);
                            console.error(errorMsg);
                        }
                    }
                    
                    // 删除临时文件
                    fs.unlinkSync(req.file.path);
                    console.log('临时文件已删除:', req.file.path);
                    
                    res.json({
                        success: true,
                        importedCount: successCount,
                        errors,
                        message: `词汇导入成功！成功导入 ${successCount} 个词汇`
                    });
                } catch (error) {
                    console.error('处理CSV数据失败:', error);
                    // 删除临时文件
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    res.status(500).json({
                        success: false,
                        error: '词汇导入失败: ' + error.message
                    });
                }
            })
            .on('error', (error) => {
                console.error('CSV文件处理错误:', error);
                // 删除临时文件
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                res.status(500).json({
                    success: false,
                    error: '文件处理失败: ' + error.message
                });
            });
    } catch (error) {
        console.error('导入词汇失败:', error);
        res.status(500).json({
            success: false,
            error: '导入词汇失败: ' + error.message
        });
    }
});

// 导出词汇为CSV（管理员功能）
app.get('/api/core-vocabulary/export', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { category, difficulty, search } = req.query;
        
        let query = {};
        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;
        if (search) {
            query.$or = [
                { word: { $regex: search, $options: 'i' } },
                { translation: { $regex: search, $options: 'i' } }
            ];
        }
        
        const vocabulary = await CoreVocabulary.find(query).sort({ createdAt: -1 });
        
        const fileName = `vocabulary-export-${Date.now()}.csv`;
        const outputPath = path.join('exports', fileName);
        
        // 确保导出目录存在
        const exportDir = 'exports';
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        
        const csvWriter = createObjectCsvWriter({
            path: outputPath,
            header: [
                { id: 'word', title: 'word' },
                { id: 'pronunciation', title: 'pronunciation' },
                { id: 'translation', title: 'translation' },
                { id: 'partOfSpeech', title: 'partOfSpeech' },
                { id: 'example', title: 'example' },
                { id: 'exampleTranslation', title: 'exampleTranslation' },
                { id: 'difficulty', title: 'difficulty' },
                { id: 'category', title: 'category' },
                { id: 'tags', title: 'tags' }
            ]
        });
        
        const records = vocabulary.map(vocab => ({
            word: vocab.word,
            pronunciation: vocab.pronunciation,
            translation: vocab.translation,
            partOfSpeech: vocab.partOfSpeech,
            example: vocab.example,
            exampleTranslation: vocab.exampleTranslation,
            difficulty: vocab.difficulty,
            category: vocab.category,
            tags: Array.isArray(vocab.tags) ? vocab.tags.join(',') : ''
        }));
        
        await csvWriter.writeRecords(records);
        
        // 提供文件下载
        res.download(outputPath, fileName, (err) => {
            // 下载完成后删除临时文件
            if (!err) {
                setTimeout(() => {
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }
                }, 1000);
            }
        });
    } catch (error) {
        console.error('导出词汇失败:', error);
        res.status(500).json({
            success: false,
            error: '导出词汇失败: ' + error.message
        });
    }
});

// 获取所有词汇列表（管理员功能）
app.get('/api/core-vocabulary/list', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, category, difficulty, search } = req.query;
        
        let query = {};
        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;
        if (search) {
            query.$or = [
                { word: { $regex: search, $options: 'i' } },
                { translation: { $regex: search, $options: 'i' } }
            ];
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const vocabulary = await CoreVocabulary.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await CoreVocabulary.countDocuments(query);
        
        res.json({
            success: true,
            vocabulary,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('获取词汇列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取词汇列表失败: ' + error.message
        });
    }
});

// 添加词汇（管理员功能）
app.post('/api/core-vocabulary', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const vocabularyData = req.body;
        const vocab = new CoreVocabulary(vocabularyData);
        await vocab.save();
        
        res.status(201).json({
            success: true,
            vocabulary: vocab,
            message: '词汇添加成功'
        });
    } catch (error) {
        console.error('添加词汇失败:', error);
        res.status(500).json({
            success: false,
            error: '添加词汇失败: ' + error.message
        });
    }
});

// 更新词汇（管理员功能）
app.put('/api/core-vocabulary/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const vocabularyData = req.body;
        const vocab = await CoreVocabulary.findByIdAndUpdate(
            id,
            { ...vocabularyData, updatedAt: new Date() },
            { new: true }
        );
        
        if (!vocab) {
            return res.status(404).json({
                success: false,
                error: '词汇不存在'
            });
        }
        
        res.json({
            success: true,
            vocabulary: vocab,
            message: '词汇更新成功'
        });
    } catch (error) {
        console.error('更新词汇失败:', error);
        res.status(500).json({
            success: false,
            error: '更新词汇失败: ' + error.message
        });
    }
});

// 删除词汇（管理员功能）
app.delete('/api/core-vocabulary/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await CoreVocabulary.findByIdAndDelete(id);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                error: '词汇不存在'
            });
        }
        
        // 同时删除相关的用户记录
        await UserVocabularyRecord.deleteMany({ vocabularyId: id });
        
        res.json({
            success: true,
            message: '词汇删除成功'
        });
    } catch (error) {
        console.error('删除词汇失败:', error);
        res.status(500).json({
            success: false,
            error: '删除词汇失败: ' + error.message
        });
    }
});

// ========== 错误单词 API (新增/确认) ==========

// @desc    获取当前用户的错误单词列表
// @route   GET /api/incorrect-words
// @access  Private
app.get('/api/incorrect-words', authenticateToken, async (req, res) => {
    try {
        // 根据用户ID查询 (使用 req.user.userId)
        const incorrectWords = await IncorrectWord.find({ user: req.user.userId })
            .sort({ createdAt: -1 }) // 按创建时间倒序
            .populate('vocabularyId', 'word translation'); // 可选：填充关联的核心词汇信息

        res.json({
            success: true,
            count: incorrectWords.length,
            words: incorrectWords
        });
    } catch (error) {
        console.error('获取错误单词失败:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// @desc    添加一个错误单词
// @route   POST /api/incorrect-words
// @access  Private
app.post('/api/incorrect-words', authenticateToken, async (req, res) => {
    try {
        const { vocabularyId, word, translation, partOfSpeech, source } = req.body;

        // 基本验证
        if (!word || !translation) {
            return res.status(400).json({ success: false, error: '单词和翻译是必需的' });
        }

        // 检查是否已存在相同的单词记录 (对于该用户)
        // 注意：这取决于您是否希望允许重复记录。如果允许，则移除此检查。
        const existingWord = await IncorrectWord.findOne({ user: req.user.userId, word: word.trim() });
        if (existingWord) {
            // 如果允许更新来源等信息，可以在这里处理，否则返回错误
            // 为了简单起见，我们返回错误
            return res.status(400).json({ success: false, error: '该单词已存在于您的错误列表中' });
        }

        // 创建新的错误单词记录
        const newIncorrectWord = new IncorrectWord({
            user: req.user.userId, // 从 auth 中间件获取
            vocabularyId: vocabularyId || undefined, // 如果有则关联核心词汇ID (ObjectId)
            word: word.trim(),
            translation: translation.trim(),
            partOfSpeech: partOfSpeech || '',
            source: source || '词汇测试'
        });

        const savedWord = await newIncorrectWord.save();

        res.status(201).json({
            success: true,
            message: '错误单词记录成功',
            word: savedWord
        });
    } catch (error) {
        console.error('记录错误单词失败:', error);
        // Mongoose 验证错误处理
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        // 唯一索引冲突错误处理 (如果设置了唯一索引)
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: '该单词已存在于您的错误列表中' });
        }
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// ========== 测试记录 API (新增/确认) ==========

// @desc    保存测试记录
// @route   POST /api/quiz-records
// @access  Private
app.post('/api/quiz-records', authenticateToken, async (req, res) => {
    try {
        const { type, score, questions, correct, timeTaken, date } = req.body;

        // 基本验证 (可以根据需要加强)
        if (!type || score === undefined || questions === undefined || correct === undefined || timeTaken === undefined) {
             return res.status(400).json({ success: false, error: '缺少必要的测试记录字段' });
        }

        const newRecord = new QuizRecord({
            userId: req.user.userId, // 从认证中间件获取
            type,
            score,
            questions,
            correct,
            timeTaken,
            date: date ? new Date(date) : new Date() // 使用提供的日期或当前日期
        });

        const savedRecord = await newRecord.save();

        res.status(201).json({
            success: true,
            message: '测试记录保存成功',
            record: savedRecord
        });
    } catch (error) {
        console.error('保存测试记录失败:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});


// @desc    获取用户的测试历史记录
// @route   GET /api/quiz-records
// @access  Private
app.get('/api/quiz-records', authenticateToken, async (req, res) => {
    try {
        // 可以添加分页、排序、筛选参数处理，这里简化
        const records = await QuizRecord.find({ userId: req.user.userId })
            .sort({ date: -1 }) // 按日期倒序
            .limit(50); // 限制数量

        res.json({
            success: true,
            records: records
        });
    } catch (error) {
        console.error('获取测试记录失败:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// --- 在 server.js 中添加或修改数据导出路由 ---

// @desc 导出用户数据为 CSV (不包含基本信息)
// @route GET /api/data-export/csv
// @access Private
/*
app.get('/api/data-export/csv', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. 获取用户数据 (但不包含基本信息)
        // const user = await User.findById(userId); // 不需要获取基本信息

        // 2. 获取学习记录
        const learningRecords = await LearningRecord.find({ user: userId }).sort({ date: 1 });

        // 3. 获取生词表
        const vocabulary = await Vocabulary.find({ user: userId }).sort({ createdAt: -1 });

        // 4. 获取核心词汇记录
        const coreVocabularyRecords = await UserVocabularyRecord.find({ user: userId }).populate('vocabularyId').sort({ lastReviewed: -1 });

        // 5. 获取测试记录
        const quizRecords = await QuizRecord.find({ user: userId }).sort({ date: -1 });

        // 6. 获取错误单词
        const incorrectWords = await IncorrectWord.find({ userId: userId }).populate('vocabularyId').sort({ createdAt: -1 });
		console.log(`找到 ${incorrectWords.length}个错误单词`);

        // 7. 构造 CSV 内容 (不包含用户基本信息)
        // 这里简化处理，实际应用中需要将各个数组格式化为 CSV 行
        // 例如，可以为每个部分创建单独的 CSV 表或合并到一个表中
        // 使用 csv-writer 库会更方便
        
        // 示例：创建一个简单的 CSV 字符串
        let csvContent = "Data Type,Details\n"; // Header
        csvContent += "Learning Records Count," + learningRecords.length + "\n";
        csvContent += "Vocabulary Count," + vocabulary.length + "\n";
        csvContent += "Core Vocabulary Records Count," + coreVocabularyRecords.length + "\n";
        csvContent += "Quiz Records Count," + quizRecords.length + "\n";
        csvContent += "Incorrect Words Count," + incorrectWords.length + "\n";

        // 设置响应头以触发下载
        res.setHeader('Content-Disposition', `attachment; filename="learning_data_${Date.now()}.csv"`);
        res.setHeader('Content-Type', 'text/csv');
        res.send(csvContent); // 发送 CSV 字符串

        // --- 更复杂的 CSV 生成示例 (使用 csv-writer) ---
        //
        //const fileName = `learning_data_${userId}_${Date.now()}.csv`;
        //const outputPath = path.join('exports', fileName);
        //const exportDir = 'exports';
        //if (!fs.existsSync(exportDir)) {
        //    fs.mkdirSync(exportDir, { recursive: true });
        //}
		//
        //const csvWriter = createObjectCsvWriter({
        //    path: outputPath,
        //    header: [
        //        { id: 'dataType', title: 'Data Type' },
        //        { id: 'details', title: 'Details' }
        //        // 根据需要定义更详细的列
        //    ]
        //});
		//
        //const recordsToWrite = [
        //     { dataType: 'Learning Records Count', details: learningRecords.length.toString() },
        //     // ... 添加其他数据类型的记录
        //];
		//
        //await csvWriter.writeRecords(recordsToWrite);
        //res.download(outputPath, fileName, (err) => {
        //     if (err) {
        //         console.error('CSV文件下载错误:', err);
        //         res.status(500).json({ success: false, error: '文件下载失败' });
        //     }
        //     // 可选：下载后删除临时文件
        //     // fs.unlinkSync(outputPath);
        //});
        //

    } catch (error) {
        console.error('导出CSV数据失败:', error);
        res.status(500).json({ success: false, error: '导出数据失败: ' + error.message });
    }
});
*/


// @desc 导出用户数据为 JSON (不包含基本信息)
// @route GET /api/data-export/json
// @access Private
app.get('/api/data-export/json', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. 获取用户数据 (但不包含基本信息)
        // const user = await User.findById(userId); // 不需要获取基本信息

        // 2. 获取学习记录
        const learningRecords = await LearningRecord.find({ user: userId }).sort({ date: 1 });

        // 3. 获取生词表
        const vocabulary = await Vocabulary.find({ user: userId }).sort({ createdAt: -1 });

        // 4. 获取核心词汇记录
        const coreVocabularyRecords = await UserVocabularyRecord.find({ user: userId }).populate('vocabularyId').sort({ lastReviewed: -1 });

        // 5. 获取测试记录
        const quizRecords = await QuizRecord.find({ user: userId }).sort({ date: -1 });

        // 6. 获取错误单词
        const incorrectWords = await IncorrectWord.find({ user: userId }).populate('vocabularyId').sort({ createdAt: -1 });

        // 7. 构造 JSON 对象 (不包含用户基本信息)
        const exportData = {
            // 不包含 user: user,
            exportDate: new Date().toISOString(),
            data: {
                learningRecords: learningRecords,
                vocabulary: vocabulary,
                coreVocabularyRecords: coreVocabularyRecords.map(record => ({
                    // 只选择需要的字段，避免暴露敏感信息
                    vocabularyId: record.vocabularyId ? record.vocabularyId._id : null,
                    word: record.vocabularyId ? record.vocabularyId.word : 'N/A',
                    status: record.status,
                    nextReviewDate: record.nextReviewDate,
                    interval: record.interval,
                    repetition: record.repetition,
                    easeFactor: record.easeFactor,
                    lastReviewed: record.lastReviewed,
                    createdAt: record.createdAt
                })),
                quizRecords: quizRecords,
                incorrectWords: incorrectWords.map(word => ({
                    vocabularyId: word.vocabularyId ? word.vocabularyId._id : null,
                    word: word.vocabularyId ? word.vocabularyId.word : 'N/A',
                    createdAt: word.createdAt
                }))
            }
        };

        // 设置响应头以触发下载
        res.setHeader('Content-Disposition', `attachment; filename="learning_data_${Date.now()}.json"`);
        res.setHeader('Content-Type', 'application/json');
        // 发送 JSON 字符串
        res.send(JSON.stringify(exportData, null, 2));

    } catch (error) {
        console.error('导出JSON数据失败:', error);
        res.status(500).json({ success: false, error: '导出数据失败: ' + error.message });
    }
});

//-- // ========== 翻译记录模型 API 路由 ========== //
//-- const translationRecordSchema = new mongoose.Schema({
//--     userId: { type: String, required: true, index: true }, // 关联用户
//--     passageId: { type: String, required: true }, // 关联短文ID
//--     sentence: { type: String, required: true }, // 英文原句
//--     userTranslation: { type: String, required: true }, // 用户翻译
//--     aiTranslation: { type: String, required: true }, // AI翻译
//--     createdAt: { type: Date, default: Date.now } // 记录创建时间
//-- });
//-- 
//-- const TranslationRecord = mongoose.model('TranslationRecord', translationRecordSchema);
//-- 
//-- 
//-- // --- 保存翻译记录 API ---
//-- app.post('/api/translation-records', authenticateToken, async (req, res) => {
//--     try {
//--         const { passageId, sentence, userTranslation, aiTranslation } = req.body;
//-- 
//--         // 基本验证
//--         if (!passageId || !sentence || !userTranslation || !aiTranslation) {
//--              return res.status(400).json({ success: false, error: '缺少必要字段: passageId, sentence, userTranslation, aiTranslation' });
//--         }
//-- 
//--         // 创建新的翻译记录
//--         const newRecord = new TranslationRecord({
//--             userId: req.user.userId, // 从认证中间件获取
//--             passageId,
//--             sentence,
//--             userTranslation,
//--             aiTranslation
//--         });
//-- 
//--         // 保存到数据库
//--         await newRecord.save();
//-- 
//--         res.status(201).json({ success: true, message: '翻译记录保存成功', record: newRecord });
//--     } catch (error) {
//--         console.error('保存翻译记录失败:', error);
//--         res.status(500).json({ success: false, error: '服务器内部错误' });
//--     }
//-- });
//-- 
//-- 
//-- // --- 获取用户翻译记录 API ---
//-- app.get('/api/translation-records', authenticateToken, async (req, res) => {
//--     try {
//--         // 获取当前用户的所有翻译记录，并按创建时间倒序排列
//--         const records = await TranslationRecord.find({ userId: req.user.userId })
//--                                                  .sort({ createdAt: -1 }); // 最新的在前
//-- 
//--         res.json({ success: true, records });
//--     } catch (error) {
//--         console.error('获取翻译记录失败:', error);
//--         res.status(500).json({ success: false, error: '服务器内部错误' });
//--     }
//-- });

// ========== 翻译记录模型 API 路由 ========== //
// 1. 在模型定义区域添加 TranslationRecord 模型
const translationRecordSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true }, // 关联用户
    passageId: { type: String, required: true }, // 关联短文ID
    sentence: { type: String, required: true }, // 英文原句
    userTranslation: { type: String, required: true }, // 用户翻译
    aiTranslation: { type: String, required: true }, // AI翻译
    createdAt: { type: Date, default: Date.now } // 记录创建时间
});
const TranslationRecord = mongoose.model('TranslationRecord', translationRecordSchema);

// 2. 在 API 路由区域添加 POST 和 GET 路由
// 保存翻译记录 API
app.post('/api/translation-records', authenticateToken, async (req, res) => {
    console.log("[DEBUG] POST /api/translation-records called"); // <-- 添加
    console.log("[DEBUG] req.user (from authenticateToken):", req.user); // <-- 添加
    
	try {
        const { passageId, sentence, userTranslation, aiTranslation } = req.body;
		console.log("[DEBUG] Request body received:", { passageId, sentence, userTranslation, aiTranslation }); // <-- 添加


        // 基本验证
        if (!passageId || !sentence || !userTranslation || !aiTranslation) {
             return res.status(400).json({ success: false, error: '缺少必要字段: passageId, sentence, userTranslation, aiTranslation' });
        }

        // 创建新的翻译记录
        const newRecord = new TranslationRecord({
            userId: req.user.userId, // 从认证中间件获取
            passageId,
            sentence,
            userTranslation,
            aiTranslation
        });
		
		console.log("[DEBUG] New TranslationRecord object created:", newRecord.toObject()); // <-- 添加 (可选，信息量大)


        // 保存到数据库
		console.log("[DEBUG] About to save new record to database"); // <-- 添加
        await newRecord.save();
        console.log("[DEBUG] Record saved successfully"); // <-- 添加

        res.status(201).json({ success: true, message: '翻译记录保存成功', record: newRecord });
    } catch (error) {
        console.error('保存翻译记录失败:', error);
		console.error('[DEBUG] Error occurred while saving translation record:', error); // <-- 修改
        
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 获取用户翻译记录 API
app.get('/api/translation-records', authenticateToken, async (req, res) => {
    console.log("[DEBUG] GET /api/translation-records called"); // <-- 添加
    console.log("[DEBUG] req.user (from authenticateToken):", req.user); // <-- 添加
    
	try {
        // 获取当前用户的所有翻译记录，并按创建时间倒序排列
        console.log(`[DEBUG] Querying database for userId: ${req.user.userId}`); // <-- 添加
        const records = await TranslationRecord.find({ userId: req.user.userId })
                                                 .sort({ createdAt: -1 }); // 最新的在前

        console.log(`[DEBUG] Found ${records.length} records for user`); // <-- 添加
        // 打印前几条记录作为样本检查 (可选)
        // console.log("[DEBUG] Sample records:", records.slice(0, 2));
		
		res.json({ success: true, records });
    } catch (error) {
        console.error('获取翻译记录失败:', error);
		console.error('[DEBUG] Error occurred while fetching translation records:', error); // <-- 修改
        
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});


// ========== 数据导出 API 路由 ========== //
// @desc 导出用户数据为 CSV (不包含用户基本信息)
// @route GET /api/data-export/csv
// @access Private
app.get('/api/data-export/csv', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId; // 从 JWT token 中获取用户 ID

        console.log(`准备为用户 ${userId} 导出 CSV 数据...`);
		
		console.log('=== 数据导出调试信息 ===');
        console.log(`1. 从 JWT Token 解析出的 req.user:`, req.user);
        console.log(`2. 用于查询的 userId:`, userId);
        console.log(`3. userId 类型:`, typeof userId);
        console.log('========================');

        // 1. 获取学习记录
        //const learningRecords = await LearningRecord.find({ user: userId }).sort({ date: 1 });
        //console.log(`找到 ${learningRecords.length} 条学习记录`);
		
		const learningRecords = await LearningRecord.find({ userId: userId }).sort({ date: 1 });
		console.log(`找到 ${learningRecords.length} 条学习记录`);

        // 2. 获取生词表
        //const vocabulary = await Vocabulary.find({ user: userId }).sort({ createdAt: -1 });
        //console.log(`找到 ${vocabulary.length} 个生词`);

		const vocabulary = await Vocabulary.find({ userId: userId }).sort({ createdAt: -1 });
		console.log(`找到 ${vocabulary.length} 个生词`);
        
		// 3. 获取核心词汇记录
        //const coreVocabularyRecords = await UserVocabularyRecord.find({ user: userId }).populate('vocabularyId').sort({ lastReviewed: -1 });
        //console.log(`找到 ${coreVocabularyRecords.length} 条核心词汇记录`);
		
		const coreVocabularyRecords = await UserVocabularyRecord.find({ userId: userId }).populate('vocabularyId').sort({ lastReviewed: -1 });
		console.log(`找到 ${coreVocabularyRecords.length} 条核心词汇记录`);

        // 4. 获取测试记录
        //const quizRecords = await QuizRecord.find({ user: userId }).sort({ date: -1 });
        //console.log(`找到 ${quizRecords.length} 条测试记录`);
		
		const quizRecords = await QuizRecord.find({ userId: userId }).sort({ date: -1 });
		console.log(`找到 ${quizRecords.length} 条测试记录`);

        // 5. 获取错误单词
        //const incorrectWords = await IncorrectWord.find({ user: userId }).populate('vocabularyId').sort({ createdAt: -1 });
        //console.log(`找到 ${incorrectWords.length} 个错误单词`);
		
		const incorrectWords = await IncorrectWord.find({ userId: userId }).populate('vocabularyId').sort({ createdAt: -1 });
		console.log(`找到 ${incorrectWords.length} 个错误单词`);

        // --- 生成 CSV 内容 ---
        // 使用 csv-writer 库来生成结构化的 CSV
        const { createObjectCsvWriter } = require('csv-writer');
        const path = require('path');
        const os = require('os'); // 用于获取临时目录

        // 创建临时文件路径
        const tempDir = os.tmpdir();
        const fileName = `learning_data_${userId}_${Date.now()}.csv`;
        const outputPath = path.join(tempDir, fileName);

        // 定义 CSV 表头和数据映射
        const csvWriter = createObjectCsvWriter({
            path: outputPath,
            header: [
                { id: 'dataType', title: 'Data Type' },
                { id: 'id', title: 'ID' },
                { id: 'date', title: 'Date/CreatedAt' },
                { id: 'content', title: 'Content/Word' },
                { id: 'details', title: 'Details' },
                { id: 'score', title: 'Score' },
                { id: 'timeTaken', title: 'Time Taken (s)' },
                { id: 'status', title: 'Status' },
                { id: 'nextReview', title: 'Next Review Date' }
            ],
            // 强制加引号，防止内容中的逗号干扰
            alwaysQuote: true 
        });

        const recordsToWrite = [];

        // 添加学习记录
        learningRecords.forEach(record => {
            recordsToWrite.push({
                dataType: 'LearningRecord',
                id: record._id.toString(),
                date: record.date.toISOString(),
                content: record.content,
                details: `Duration: ${record.duration} min, Score: ${record.score}`,
                score: record.score,
                timeTaken: '',
                status: '',
                nextReview: ''
            });
        });

        // 添加生词
        vocabulary.forEach(word => {
            recordsToWrite.push({
                dataType: 'Vocabulary',
                id: word._id.toString(),
                date: word.createdAt.toISOString(),
                content: word.word,
                details: `Translation: ${word.translation}, Pronunciation: ${word.pronunciation || ''}, PartOfSpeech: ${word.partOfSpeech || ''}, Example: ${word.example || ''}`,
                score: '',
                timeTaken: '',
                status: '',
                nextReview: ''
            });
        });

        // 添加核心词汇记录
        coreVocabularyRecords.forEach(record => {
            const word = record.vocabularyId ? record.vocabularyId.word : 'Unknown';
            recordsToWrite.push({
                dataType: 'CoreVocabularyRecord',
                id: record._id.toString(),
                date: record.lastReviewed ? record.lastReviewed.toISOString() : '',
                content: word,
                details: `Translation: ${record.vocabularyId ? record.vocabularyId.translation : 'N/A'}`,
                score: '',
                timeTaken: '',
                status: record.status,
                nextReview: record.nextReviewDate ? record.nextReviewDate.toISOString() : ''
            });
        });

        // 添加测试记录
        quizRecords.forEach(record => {
            recordsToWrite.push({
                dataType: 'QuizRecord',
                id: record._id.toString(),
                date: record.date.toISOString(),
                content: record.type,
                details: `Questions: ${record.questions}, Correct: ${record.correct}`,
                score: record.score,
                timeTaken: record.timeTaken,
                status: '',
                nextReview: ''
            });
        });

        // 添加错误单词
        incorrectWords.forEach(word => {
            const wordStr = word.vocabularyId ? word.vocabularyId.word : (word.word || 'Unknown');
            recordsToWrite.push({
                dataType: 'IncorrectWord',
                id: word._id.toString(),
                date: word.createdAt.toISOString(),
                content: wordStr,
                details: `Translation: ${word.vocabularyId ? word.vocabularyId.translation : (word.translation || 'N/A')}`,
                score: '',
                timeTaken: '',
                status: '',
                nextReview: ''
            });
        });


        // 写入 CSV 文件
        await csvWriter.writeRecords(recordsToWrite);
        console.log(`CSV 文件已生成: ${outputPath}`);

        // 设置响应头以触发浏览器下载
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        
		// 在 `/api/data-export/csv` 路由中 res.sendFile 的回调里：
		res.sendFile(outputPath, (err) => {
			if (err) {
				console.error('发送 CSV 文件时出错:', err);
				// 如果发送失败，也尝试清理临时文件
				fs.unlink(outputPath, (unlinkErr) => {
					if (unlinkErr) console.error('清理临时 CSV 文件失败 (发送失败后):', unlinkErr);
				});
			} else {
				console.log('CSV 文件发送成功');
				// 发送成功后，异步清理临时文件
				fs.unlink(outputPath, (unlinkErr) => {
					if (unlinkErr) console.error('清理临时 CSV 文件失败:', unlinkErr);
					else console.log('临时 CSV 文件已清理');
				});
			}
		});
        //res.sendFile(outputPath, (err) => {
        //    if (err) {
        //        console.error('发送 CSV 文件时出错:', err);
        //    }
        //    // 可选：在发送后删除临时文件以节省空间
        //    // fs.unlink(outputPath, (unlinkErr) => {
        //    //     if (unlinkErr) console.error('删除临时 CSV 文件失败:', unlinkErr);
        //    //     else console.log('临时 CSV 文件已删除');
        //    // });
        //});

    } catch (error) {
        console.error('导出CSV数据失败:', error);
        // 即使出错也返回一个空的或错误信息的 CSV 文件，或者返回 JSON 错误
        res.status(500).setHeader('Content-Type', 'text/plain').send(`Error exporting data: ${error.message}`);
        // 或者返回 JSON 错误
        // res.status(500).json({ success: false, error: '导出数据失败: ' + error.message });
    }
});

// @desc 导出用户数据为 JSON (不包含用户基本信息)
// @route GET /api/data-export/json
// @access Private
app.get('/api/data-export/json', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log(`准备为用户 ${userId} 导出 JSON 数据...`);

        // 1. 获取学习记录
        const learningRecords = await LearningRecord.find({ user: userId }).sort({ date: 1 });

        // 2. 获取生词表
        const vocabulary = await Vocabulary.find({ user: userId }).sort({ createdAt: -1 });

        // 3. 获取核心词汇记录
        const coreVocabularyRecords = await UserVocabularyRecord.find({ user: userId }).populate('vocabularyId').sort({ lastReviewed: -1 });

        // 4. 获取测试记录
        const quizRecords = await QuizRecord.find({ user: userId }).sort({ date: -1 });

        // 5. 获取错误单词
        const incorrectWords = await IncorrectWord.find({ user: userId }).populate('vocabularyId').sort({ createdAt: -1 });

        // --- 构造 JSON 对象 ---
        const exportData = {
            exportDate: new Date().toISOString(),
            userId: userId, // 可以包含用户ID用于标识，但不包含姓名邮箱等
            data: {
                learningRecords: learningRecords.map(record => ({
                    id: record._id,
                    date: record.date,
                    content: record.content,
                    duration: record.duration,
                    score: record.score
                })),
                vocabulary: vocabulary.map(word => ({
                    id: word._id,
                    word: word.word,
                    translation: word.translation,
                    pronunciation: word.pronunciation,
                    partOfSpeech: word.partOfSpeech,
                    example: word.example,
                    createdAt: word.createdAt
                })),
                coreVocabularyRecords: coreVocabularyRecords.map(record => ({
                    id: record._id,
                    vocabularyId: record.vocabularyId ? record.vocabularyId._id : null,
                    word: record.vocabularyId ? record.vocabularyId.word : 'N/A',
                    translation: record.vocabularyId ? record.vocabularyId.translation : 'N/A',
                    status: record.status,
                    nextReviewDate: record.nextReviewDate,
                    lastReviewed: record.lastReviewed,
                    createdAt: record.createdAt
                })),
                quizRecords: quizRecords.map(record => ({
                    id: record._id,
                    type: record.type,
                    score: record.score,
                    questions: record.questions,
                    correct: record.correct,
                    timeTaken: record.timeTaken,
                    date: record.date
                })),
                incorrectWords: incorrectWords.map(word => ({
                    id: word._id,
                    vocabularyId: word.vocabularyId ? word.vocabularyId._id : null,
                    word: word.vocabularyId ? word.vocabularyId.word : (word.word || 'N/A'),
                    translation: word.vocabularyId ? word.vocabularyId.translation : (word.translation || 'N/A'),
                    createdAt: word.createdAt
                }))
            }
        };

        console.log(`JSON 数据构造完成，包含 ${learningRecords.length + vocabulary.length + coreVocabularyRecords.length + quizRecords.length + incorrectWords.length} 条记录`);

        // --- 发送 JSON 文件 ---
        const fileName = `learning_data_${userId}_${Date.now()}.json`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/json;charset=utf-8');
        res.send(JSON.stringify(exportData, null, 2)); // 格式化输出

    } catch (error) {
        console.error('导出JSON数据失败:', error);
        // 返回 JSON 错误信息
        res.status(500).json({ success: false, error: '导出数据失败: ' + error.message });
    }
});
// ========== 数据导出 API 路由结束 ========== //
// --- 数据导出路由结束 ---


// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 API文档: http://localhost:${PORT}/api/health`);
});

module.exports = app;