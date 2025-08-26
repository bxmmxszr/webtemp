// routes/vocabularyApi.js
const express = require('express');
const router = express.Router();
const Vocabulary = require('../models/Vocabulary');
const UserVocabularyRecord = require('../models/UserVocabularyRecord');
const CSVService = require('../services/csvService');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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

// 获取每日随机词汇（10-15个）
router.get('/daily', async (req, res) => {
    try {
        const { count = 12, category, difficulty } = req.query;
        
        let query = {};
        if (category) query.category = category;
        if (difficulty) query.difficulty = difficulty;
        
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

// 上传CSV文件导入词汇（管理员功能）
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '请选择要上传的CSV文件'
            });
        }

        // 解析CSV文件
        const { data, errors: parseErrors } = await CSVService.parseCSV(req.file.path);
        
        if (parseErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'CSV文件解析错误',
                details: parseErrors
            });
        }

        // 验证数据格式
        const validationErrors = CSVService.validateVocabularyData(data);
        if (validationErrors.length > 0) {
            // 删除临时文件
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'CSV数据格式错误',
                details: validationErrors
            });
        }

        let successCount = 0;
        const errors = [];
        
        // 批量导入词汇
        for (const vocab of data) {
            try {
                const existingVocab = await Vocabulary.findOne({ word: vocab.word });
                
                if (existingVocab) {
                    // 更新现有词汇
                    await Vocabulary.findByIdAndUpdate(existingVocab._id, {
                        ...vocab,
                        updatedAt: new Date(),
                        tags: vocab.tags ? vocab.tags.split(',').map(tag => tag.trim()) : []
                    });
                } else {
                    // 创建新词汇
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
                }
                successCount++;
            } catch (error) {
                errors.push(`导入词汇 "${vocab.word}" 失败: ${error.message}`);
            }
        }
        
        // 删除临时文件
        fs.unlinkSync(req.file.path);
        
        res.json({
            success: true,
            importedCount: successCount,
            errors,
            message: `词汇导入成功！成功导入 ${successCount} 个词汇`
        });
    } catch (error) {
        console.error('导入词汇失败:', error);
        // 删除临时文件
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            error: '导入词汇失败: ' + error.message
        });
    }
});

// 导出词汇为CSV（管理员功能）
router.get('/export', async (req, res) => {
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
        
        // 生成CSV文件
        await CSVService.generateCSV(vocabulary, outputPath);
        
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
router.get('/list', async (req, res) => {
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
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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