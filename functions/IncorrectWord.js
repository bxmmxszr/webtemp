// models/IncorrectWord.js
const mongoose = require('mongoose');

const incorrectWordSchema = new mongoose.Schema({
  user: { // 使用 userId 字符串存储，与现有模型保持一致
    type: String,
    required: true,
    index: true // 为用户查询优化
  },
  vocabularyId: { // 可选：关联核心词汇ID
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoreVocabulary',
    // required: false, // 允许记录非核心词汇的错误
  },
  word: {
    type: String,
    required: true,
    trim: true
  },
  translation: {
    type: String,
    required: true,
    trim: true
  },
  partOfSpeech: {
    type: String,
    default: ''
  },
  source: { // 记录来源，例如 "中译英测试 - 2024/1/1"
    type: String,
    default: '词汇测试'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 可选：为用户+单词组合创建唯一索引，防止重复记录（如果需要此逻辑）
// incorrectWordSchema.index({ user: 1, word: 1 }, { unique: true });

// 防止模型重复编译
const IncorrectWord = mongoose.models.IncorrectWord || mongoose.model('IncorrectWord', incorrectWordSchema);

module.exports = IncorrectWord;