// routes/quizRecordRoutes.js
const express = require('express');
const router = express.Router();
const QuizRecord = require('../models/QuizRecord');
const jwt = require('jsonwebtoken');

// JWT认证中间件
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

// 获取用户测试记录
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, startDate, endDate } = req.query;
        
        let query = { userId: req.user.userId };
        if (type) query.type = type;
        
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const records = await QuizRecord.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await QuizRecord.countDocuments(query);
        
        res.json({
            success: true,
            records,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('获取测试记录失败:', error);
        res.status(500).json({
            success: false,
            error: '获取测试记录失败'
        });
    }
});

// 添加测试记录
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { type, score, questions, correct, timeTaken, answers, date } = req.body;
        
        const record = new QuizRecord({
            userId: req.user.userId,
            type,
            score,
            questions,
            correct,
            timeTaken,
            answers: answers || [],
            date: date || new Date()
        });
        
        await record.save();
        
        res.status(201).json({
            success: true,
            record,
            message: '测试记录添加成功'
        });
    } catch (error) {
        console.error('添加测试记录失败:', error);
        res.status(500).json({
            success: false,
            error: '添加测试记录失败'
        });
    }
});

// 获取测试统计
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await QuizRecord.aggregate([
            { $match: { userId: req.user.userId } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    avgScore: { $avg: '$score' },
                    totalQuestions: { $sum: '$questions' },
                    totalCorrect: { $sum: '$correct' },
                    totalTime: { $sum: '$timeTaken' }
                }
            }
        ]);
        
        const overallStats = await QuizRecord.aggregate([
            { $match: { userId: req.user.userId } },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    avgOverallScore: { $avg: '$score' },
                    totalQuestions: { $sum: '$questions' },
                    totalCorrect: { $sum: '$correct' },
                    totalTime: { $sum: '$timeTaken' }
                }
            }
        ]);
        
        res.json({
            success: true,
            stats,
            overall: overallStats[0] || {
                totalCount: 0,
                avgOverallScore: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                totalTime: 0
            }
        });
    } catch (error) {
        console.error('获取测试统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取测试统计失败'
        });
    }
});

// 删除测试记录
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const record = await QuizRecord.findOneAndDelete({
            _id: id,
            userId: req.user.userId
        });
        
        if (!record) {
            return res.status(404).json({
                success: false,
                error: '测试记录不存在'
            });
        }
        
        res.json({
            success: true,
            message: '测试记录删除成功'
        });
    } catch (error) {
        console.error('删除测试记录失败:', error);
        res.status(500).json({
            success: false,
            error: '删除测试记录失败'
        });
    }
});

module.exports = router;