// models/UserVocabularyRecord.js
const mongoose = require('mongoose');

const userVocabularyRecordSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // 假设存储的是用户ID字符串
  vocabularyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoreVocabulary',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['new', 'learning', 'reviewing', 'mastered', 'forgotten'],
    default: 'new'
  },
  // 遗忘曲线相关字段
  firstLearnedAt: { type: Date },
  lastReviewedAt: { type: Date },
  reviewCount: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  nextReviewDate: { type: Date },
  // SM-2 算法相关字段 (可选，用于更精确计算)
  interval: { type: Number, default: 1 }, // 复习间隔（天）
  repetition: { type: Number, default: 0 }, // 重复次数
  easeFactor: { type: Number, default: 2.5 }, // 简易因子

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 防止模型重复编译
const UserVocabularyRecord = mongoose.models.UserVocabularyRecord || mongoose.model('UserVocabularyRecord', userVocabularyRecordSchema);

module.exports = UserVocabularyRecord;