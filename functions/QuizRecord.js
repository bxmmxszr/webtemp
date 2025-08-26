// models/QuizRecord.js
const mongoose = require('mongoose');

const quizRecordSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // 关联用户 (假设存储的是用户ID字符串)
  type: { // 测试类型
    type: String,
    required: true,
    enum: ['chinese-to-english', 'english-to-chinese', 'spelling']
  },
  score: { type: Number, required: true }, // 百分比得分 (0-100)
  questions: { type: Number, required: true }, // 总题目数
  correct: { type: Number, required: true }, // 答对题数
  timeTaken: { type: Number, required: true }, // 耗时（秒）
  date: { type: Date, default: Date.now } // 测试完成日期
});

// 防止模型重复编译
const QuizRecord = mongoose.models.QuizRecord || mongoose.model('QuizRecord', quizRecordSchema);

module.exports = QuizRecord;