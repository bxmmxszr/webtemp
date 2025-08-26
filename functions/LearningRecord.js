// models/LearningRecord.js
const mongoose = require('mongoose');

const learningRecordSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // 假设存储的是用户ID字符串
  content: String,
  duration: Number,
  score: Number,
  date: { type: Date, default: Date.now }
});

// 防止模型重复编译
const LearningRecord = mongoose.models.LearningRecord || mongoose.model('LearningRecord', learningRecordSchema);

module.exports = LearningRecord;