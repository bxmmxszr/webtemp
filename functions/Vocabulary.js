// models/Vocabulary.js
const mongoose = require('mongoose');

const vocabularySchema = new mongoose.Schema({
  userId: { type: String, required: true }, // 假设存储的是用户ID字符串
  word: { type: String, required: true },
  translation: { type: String, required: true },
  partOfSpeech: String,
  source: String, // 可选：记录来源，例如 "核心词汇-遗忘曲线"
  createdAt: { type: Date, default: Date.now }
});

// 防止模型重复编译
const Vocabulary = mongoose.models.Vocabulary || mongoose.model('Vocabulary', vocabularySchema);

module.exports = Vocabulary;