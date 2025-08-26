// models/Passage.js
const mongoose = require('mongoose');

const passageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  grade: { type: String, required: true, index: true }, // 例如 'grade4', 'grade5'
  category: { type: String }, // 可选分类
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 防止模型重复编译
const Passage = mongoose.models.Passage || mongoose.model('Passage', passageSchema);

module.exports = Passage;