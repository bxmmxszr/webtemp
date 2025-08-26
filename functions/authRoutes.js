// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 用户注册
router.post('/register', async (req, res) => {
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

// 用户登录
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 验证输入
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                error: '请填写邮箱和密码' 
            });
        }
        
        // 查找用户
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ 
                success: false,
                error: '用户不存在' 
            });
        }
        
        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ 
                success: false,
                error: '密码错误' 
            });
        }
        
        // 更新最后登录时间
        user.lastLogin = new Date();
        await user.save();
        
        // 生成JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email,
                name: user.name
            }, 
            process.env.JWT_SECRET || 'fallback_secret_key', 
            { expiresIn: '24h' }
        );
        
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
        res.status(500).json({ 
            success: false,
            error: '服务器错误' 
        });
    }
});

// 获取用户信息
router.get('/user', authenticateToken, async (req, res) => {
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

// 更新用户信息
router.put('/user', authenticateToken, async (req, res) => {
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
router.put('/user/password', authenticateToken, async (req, res) => {
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

// 认证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false,
            error: '访问令牌缺失' 
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key', (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false,
                error: '令牌无效' 
            });
        }
        req.user = user;
        next();
    });
}

module.exports = router;