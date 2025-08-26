// controllers/vocabularyController.js
const Vocabulary = require('../models/Vocabulary');
const UserVocabularyRecord = require('../models/UserVocabularyRecord');
const CSVService = require('../services/csvService');
const fs = require('fs');
const path = require('path');

class VocabularyController {
    // 获取每日随机词汇（10-15个）
    async getDailyVocabulary(req, res) {
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
    }

    // 获取用户待复习词汇
    async getReviewVocabulary(req, res) {
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
    }

    // 更新用户词汇学习记录
    async updateVocabularyRecord(req, res) {
        try {
            const { vocabularyId, status, isCorrect } = req.body;
            const userId = req.user.userId;
            
            let record = await UserVocabularyRecord.findOne({
                userId: userId,
                vocabularyId: vocabularyId
            });
            
            if (!record) {
                // 创建新记录
                record = new UserVocabularyRecord({
                    userId: userId,
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
                record.nextReviewDate = this.calculateNextReviewDate(
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
    }

    // 基于遗忘曲线计算下次复习时间
    calculateNextReviewDate(reviewCount, correctCount, incorrectCount) {
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
    async getVocabularyStats(req, res) {
        try {
            const userId = req.user.userId;
            
            const totalLearned = await UserVocabularyRecord.countDocuments({
                userId: userId,
                status: 'mastered'
            });
            
            const totalReviewing = await UserVocabularyRecord.countDocuments({
                userId: userId,
                status: { $in: ['learning', 'reviewing'] }
            });
            
            const totalNew = await UserVocabularyRecord.countDocuments({
                userId: userId,
                status: 'new'
            });
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayLearned = await UserVocabularyRecord.countDocuments({
                userId: userId,
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
    }

    // 上传CSV文件导入词汇（管理员功能）
    async importVocabularyFromCSV(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: '请选择要上传的CSV文件'
                });
            }

            console.log('接收到文件上传请求:', {
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                encoding: req.file.encoding,
                mimetype: req.file.mimetype,
                destination: req.file.destination,
                filename: req.file.filename,
                path: req.file.path,
                size: req.file.size
            });

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
    }

    // 导出词汇为CSV（管理员功能）
    async exportVocabularyToCSV(req, res) {
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
    }

    // 获取所有词汇列表（管理员功能）
    async getAllVocabulary(req, res) {
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
    }

    // 添加词汇（管理员功能）
    async addVocabulary(req, res) {
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
    }

    // 更新词汇（管理员功能）
    async updateVocabulary(req, res) {
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
    }

    // 删除词汇（管理员功能）
    async deleteVocabulary(req, res) {
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
    }
}

module.exports = new VocabularyController();