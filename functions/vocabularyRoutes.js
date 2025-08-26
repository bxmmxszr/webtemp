// routes/vocabularyRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const Vocabulary = require('../models/Vocabulary');
const UserVocabularyRecord = require('../models/UserVocabularyRecord');
const jwt = require('jsonwebtoken');

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

// 管理员权限检查中间件
function requireAdmin(req, res, next) {
    const adminEmails = ['admin@example.com', 'admin@liuxinenglish.com'];
    if (!req.user || !adminEmails.includes(req.user.email)) {
        return res.status(403).json({ 
            success: false,
            error: '需要管理员权限' 
        });
    }
    next();
}

// 获取每日随机词汇（10-15个）
router.get('/daily', authenticateToken, async (req, res) => {
    try {
        const { count = 12, category, difficulty } = req.query;
        
        let query = {};
        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;
        
        // 获取用户今天已学习的词汇
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const userRecords = await UserVocabularyRecord.find({
            userId: req.user.userId,
            createdAt: { $gte: today }
        }).select('vocabularyId');
        
        const learnedToday = userRecords.map(record => record.vocabularyId);
        
        // 构建排除已学习词汇的查询
        if (learnedToday.length > 0) {
            query._id = { $nin: learnedToday };
        }
        
        // 随机获取指定数量的词汇
        const vocabulary = await Vocabulary.aggregate([
            { $match: query },
            { $sample: { size: parseInt(count) } }
        ]);
        
        res.json({
            success: true,
            vocabulary,
            message: `成功获取 ${vocabulary.length} 个词汇`
        });
    } catch (error) {
        console.error('获取每日词汇失败:', error);
        res.status(500).json({
            success: false,
            error: '获取词汇失败'
        });
    }
});

// 获取用户待复习词汇
router.get('/review', authenticateToken, async (req, res) => {
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
router.post('/record', authenticateToken, async (req, res) => {
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
router.get('/stats', authenticateToken, async (req, res) => {
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

// 上传CSV文件导入词汇（管理员功能）- 完整实现
router.post('/import', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
    try {
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

                            const existingVocab = await Vocabulary.findOne({ word: vocab.word });
                            
                            if (existingVocab) {
                                await Vocabulary.findByIdAndUpdate(existingVocab._id, {
                                    ...vocab,
                                    updatedAt: new Date(),
                                    tags: vocab.tags ? vocab.tags.split(',').map(tag => tag.trim()) : []
                                });
                                console.log('更新现有词汇:', vocab.word);
                            } else {
                                const newVocab = new Vocabulary({
                                    word: vocab.word,
                                    pronunciation: vocab.pronunciation || '',
                                    translation: vocab.translation,
                                    partOfSpeech: vocab.partOfSpeech || '',
                                    example: vocab.example || '',
                                    exampleTranslation: vocab.exampleTranslation || '',
                                    difficulty: vocab.difficulty || 'beginner',
                                    category: vocab.category || 'general',
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
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
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
        
        const vocabulary = await Vocabulary.find(query).sort({ createdAt: -1 });
        
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
router.get('/list', authenticateToken, requireAdmin, async (req, res) => {
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
        
        const vocabulary = await Vocabulary.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await Vocabulary.countDocuments(query);
        
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
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const vocabularyData = req.body;
        const vocab = new Vocabulary(vocabularyData);
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
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const vocabularyData = req.body;
        const vocab = await Vocabulary.findByIdAndUpdate(
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
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Vocabulary.findByIdAndDelete(id);
        
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

module.exports = router;