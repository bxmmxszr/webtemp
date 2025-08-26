// server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); // 添加 Mongoose
require('dotenv').config(); // 用于加载环境变量

const app = express();
const PORT = process.env.PORT || 3000;

// JWT 密钥，优先使用环境变量
const JWT_SECRET = process.env.JWT_SECRET_DEMO || 'fallback_demo_secret_key_change_this';

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== MongoDB 连接 ==========
// 优先使用环境变量中的连接字符串，否则使用默认本地地址
const MONGODB_URI = process.env.MONGODB_URI_DEMO || 'mongodb://localhost:27017/english_learning_demo';
mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB 连接错误 (Demo):'));
db.once('open', () => {
    console.log('✅ MongoDB 数据库连接成功 (Demo)');
});

// ========== 数据模型 ==========
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    phone: String,
    birthday: String,
    bio: String,
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date,
    isAdmin: { type: Boolean, default: false }
    // 可根据需要添加更多字段
});

// 在 email 字段上创建唯一索引（Schema 中已定义 unique: true，这会自动创建索引）
// userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

// ========== JWT 认证中间件 ==========
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: '访问令牌缺失' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: '令牌无效' });
        }
        req.user = user; // 将解码后的用户信息附加到 req 对象
        next();
    });
}

// ========== API 路由 ==========

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'English Learning Platform API (Demo)',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// 用户注册
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // 基本输入验证
        if (!email || !password || !name) {
            return res.status(400).json({ success: false, error: '请填写所有必填字段 (邮箱, 密码, 姓名)' });
        }

        // 检查用户是否已存在 (Mongoose 会利用 email 的唯一索引)
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, error: '该邮箱已被注册' });
        }

        // 密码加密
        const saltRounds = 10; // 推荐值
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 创建新用户文档
        const newUser = new User({
            email,
            password: hashedPassword,
            name
            // phone, birthday, bio 等可选字段可以在后续更新时添加
        });

        // 保存到数据库
        const savedUser = await newUser.save();

        // 生成JWT token
        const token = jwt.sign(
            { userId: savedUser._id, email: savedUser.email, name: savedUser.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 返回成功响应 (不返回密码)
        res.status(201).json({
            success: true,
            message: '注册成功',
            token,
            user: {
                id: savedUser._id,
                email: savedUser.email,
                name: savedUser.name
                // phone: savedUser.phone,
                // birthday: savedUser.birthday,
                // bio: savedUser.bio
            }
        });

    } catch (error) {
        console.error('注册错误:', error);
        // 处理 Mongoose 验证错误或唯一索引冲突
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        if (error.code === 11000) { // MongoDB 唯一索引冲突错误码
             return res.status(400).json({ success: false, error: '该邮箱已被注册' });
        }
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 用户登录
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 查找用户
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, error: '用户不存在' });
        }

        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, error: '密码错误' });
        }

        // 更新最后登录时间
        user.lastLogin = new Date();
        await user.save();

        // 生成JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 返回成功响应
        res.json({
            success: true,
            message: '登录成功',
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                birthday: user.birthday,
                bio: user.bio
            }
        });

    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 获取用户信息 (需要认证)
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        // 使用 req.user.userId (来自 JWT) 查询数据库
        const user = await User.findById(req.user.userId).select('-password'); // 排除密码字段

        if (!user) {
            return res.status(404).json({ success: false, error: '用户未找到' });
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
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 更新用户信息 (需要认证)
app.put('/api/user', authenticateToken, async (req, res) => {
    try {
        const { name, phone, birthday, bio } = req.body;
        const userId = req.user.userId; // 从 JWT 获取用户ID

        // 构建更新对象，只包含提供的字段
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (birthday !== undefined) updateData.birthday = birthday;
        if (bio !== undefined) updateData.bio = bio;

        // 查找并更新用户
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true } // 返回更新后的文档，并运行验证
        ).select('-password'); // 排除密码字段

        if (!updatedUser) {
            return res.status(404).json({ success: false, error: '用户未找到' });
        }

        res.json({
            success: true,
            message: '用户信息更新成功',
            user: {
                id: updatedUser._id,
                email: updatedUser.email,
                name: updatedUser.name,
                phone: updatedUser.phone,
                birthday: updatedUser.birthday,
                bio: updatedUser.bio
            }
        });

    } catch (error) {
        console.error('更新用户信息错误:', error);
        // 处理 Mongoose 验证错误
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, error: messages.join(', ') });
        }
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 修改密码 (需要认证)
app.put('/api/user/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: '请填写当前密码和新密码' });
        }

        // 查找用户 (需要密码字段用于验证)
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: '用户未找到' });
        }

        // 验证当前密码
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, error: '当前密码错误' });
        }

        // 密码加密
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // 更新密码
        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: '密码修改成功' });

    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Demo 服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 Demo API文档: http://localhost:${PORT}/api/health`);
});
