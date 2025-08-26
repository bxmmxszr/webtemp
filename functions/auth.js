// middleware/auth.js
const jwt = require('jsonwebtoken');

// 验证JWT Token中间件
const authenticateToken = (req, res, next) => {
    // 从请求头获取token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ 
            success: false,
            error: '访问令牌缺失' 
        });
    }
    
    // 验证token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ 
                    success: false,
                    error: '令牌已过期' 
                });
            }
            return res.status(403).json({ 
                success: false,
                error: '令牌无效' 
            });
        }
        
        // 将用户信息添加到请求对象中
        req.user = user;
        next();
    });
};

// 管理员权限验证中间件
const requireAdmin = (req, res, next) => {
    // 简单的管理员检查（实际项目中应该有更完善的权限系统）
    const adminEmails = ['admin@example.com', 'admin@liuxinenglish.com'];
    
    if (!req.user || !adminEmails.includes(req.user.email)) {
        return res.status(403).json({ 
            success: false,
            error: '需要管理员权限' 
        });
    }
    
    next();
};

// 可选认证中间件（用户已登录则验证，未登录也允许访问）
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        req.user = null;
        return next();
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
};

// 生成访问令牌
const generateAccessToken = (userData) => {
    return jwt.sign(
        {
            userId: userData._id,
            email: userData.email,
            name: userData.name
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
    );
};

// 生成刷新令牌（可选）
const generateRefreshToken = (userData) => {
    return jwt.sign(
        {
            userId: userData._id,
            email: userData.email
        },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
        {
            expiresIn: '7d'
        }
    );
};

// 验证刷新令牌
const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh');
};

module.exports = {
    authenticateToken,
    requireAdmin,
    optionalAuth,
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
};