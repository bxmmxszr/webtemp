// services/vocabularyService.js
const Vocabulary = require('../models/Vocabulary');
const UserVocabularyRecord = require('../models/UserVocabularyRecord');
const fs = require('fs').promises;
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

class VocabularyService {
    // 从CSV文件导入词汇
    async importVocabularyFromCSV(filePath) {
        const results = [];
        const errors = [];
        
        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                    try {
                        const importedCount = await this.bulkImportVocabulary(results);
                        resolve({
                            success: true,
                            importedCount,
                            errors
                        });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // 批量导入词汇到数据库
    async bulkImportVocabulary(vocabularyList) {
        let successCount = 0;
        const errors = [];

        for (const vocab of vocabularyList) {
            try {
                // 验证必需字段
                if (!vocab.word || !vocab.translation) {
                    errors.push(`词汇 "${vocab.word || 'unknown'}" 缺少必需字段`);
                    continue;
                }

                // 查找是否已存在
                const existingVocab = await Vocabulary.findOne({ word: vocab.word });
                
                if (existingVocab) {
                    // 更新现有词汇
                    await Vocabulary.findByIdAndUpdate(existingVocab._id, {
                        ...vocab,
                        updatedAt: new Date()
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

        return { successCount, errors };
    }

    // 导出词汇为CSV
    async exportVocabularyToCSV(filters = {}, outputPath) {
        try {
            const query = this.buildQueryFromFilters(filters);
            const vocabulary = await Vocabulary.find(query).sort({ createdAt: -1 });

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
            return outputPath;
        } catch (error) {
            throw new Error(`导出CSV失败: ${error.message}`);
        }
    }

    // 根据过滤条件构建查询
    buildQueryFromFilters(filters) {
        const query = {};
        
        if (filters.category) {
            query.category = filters.category;
        }
        
        if (filters.difficulty) {
            query.difficulty = filters.difficulty;
        }
        
        if (filters.search) {
            query.$or = [
                { word: { $regex: filters.search, $options: 'i' } },
                { translation: { $regex: filters.search, $options: 'i' } }
            ];
        }
        
        return query;
    }

    // 获取随机词汇（每日学习）
    async getRandomVocabulary(userId, count = 10, filters = {}) {
        try {
            const query = this.buildQueryFromFilters(filters);
            
            // 获取用户今天已学习的词汇
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const userRecords = await UserVocabularyRecord.find({
                userId: userId,
                createdAt: { $gte: today }
            }).select('vocabularyId');
            
            const learnedToday = userRecords.map(record => record.vocabularyId);
            
            // 构建排除已学习词汇的查询
            if (learnedToday.length > 0) {
                query._id = { $nin: learnedToday };
            }
            
            // 随机获取词汇
            const vocabulary = await Vocabulary.aggregate([
                { $match: query },
                { $sample: { size: count } }
            ]);
            
            return vocabulary;
        } catch (error) {
            throw new Error(`获取随机词汇失败: ${error.message}`);
        }
    }

    // 获取用户待复习词汇（基于遗忘曲线）
    async getReviewVocabulary(userId, count = 5) {
        try {
            const now = new Date();
            
            // 获取需要复习的词汇（过了复习时间的）
            const reviewRecords = await UserVocabularyRecord.find({
                userId: userId,
                status: { $in: ['learning', 'reviewing'] },
                nextReviewDate: { $lte: now }
            }).populate('vocabularyId');
            
            // 随机选择指定数量的词汇
            const shuffled = reviewRecords.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count).map(record => record.vocabularyId);
        } catch (error) {
            throw new Error(`获取复习词汇失败: ${error.message}`);
        }
    }

    // 更新用户词汇学习记录
    async updateUserVocabularyRecord(userId, vocabularyId, status, isCorrect = null) {
        try {
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
            return record;
        } catch (error) {
            throw new Error(`更新学习记录失败: ${error.message}`);
        }
    }

    // 基于遗忘曲线计算下次复习时间
    calculateNextReviewDate(reviewCount, correctCount, incorrectCount) {
        // 简单的遗忘曲线算法
        const totalReviews = reviewCount;
        const accuracyRate = totalReviews > 0 ? correctCount / totalReviews : 1;
        
        // 根据准确率决定下次复习间隔
        let daysToAdd;
        if (accuracyRate >= 0.9) {
            // 高准确率：延长复习间隔
            daysToAdd = Math.pow(2, reviewCount); // 1, 2, 4, 8, 16... 天
        } else if (accuracyRate >= 0.7) {
            // 中等准确率：适度间隔
            daysToAdd = Math.max(1, Math.floor(reviewCount / 2));
        } else {
            // 低准确率：频繁复习
            daysToAdd = 0.5; // 半天后复习
        }
        
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + daysToAdd);
        return nextDate;
    }

    // 获取用户学习统计
    async getUserVocabularyStats(userId) {
        try {
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
            
            return {
                totalLearned,
                totalReviewing,
                totalNew,
                todayLearned
            };
        } catch (error) {
            throw new Error(`获取学习统计失败: ${error.message}`);
        }
    }

    // 获取所有词汇（带分页和过滤）
    async getAllVocabulary(page = 1, limit = 20, filters = {}) {
        try {
            const query = this.buildQueryFromFilters(filters);
            const skip = (page - 1) * limit;
            
            const vocabulary = await Vocabulary.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
                
            const total = await Vocabulary.countDocuments(query);
            
            return {
                vocabulary,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit
                }
            };
        } catch (error) {
            throw new Error(`获取词汇列表失败: ${error.message}`);
        }
    }

    // 添加单个词汇
    async addVocabulary(vocabularyData) {
        try {
            const vocab = new Vocabulary(vocabularyData);
            await vocab.save();
            return vocab;
        } catch (error) {
            throw new Error(`添加词汇失败: ${error.message}`);
        }
    }

    // 更新词汇
    async updateVocabulary(id, vocabularyData) {
        try {
            const vocab = await Vocabulary.findByIdAndUpdate(
                id,
                { ...vocabularyData, updatedAt: new Date() },
                { new: true }
            );
            return vocab;
        } catch (error) {
            throw new Error(`更新词汇失败: ${error.message}`);
        }
    }

    // 删除词汇
    async deleteVocabulary(id) {
        try {
            await Vocabulary.findByIdAndDelete(id);
            // 同时删除相关的用户记录
            await UserVocabularyRecord.deleteMany({ vocabularyId: id });
            return true;
        } catch (error) {
            throw new Error(`删除词汇失败: ${error.message}`);
        }
    }
}

module.exports = new VocabularyService();