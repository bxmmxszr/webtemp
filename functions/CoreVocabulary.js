// models/CoreVocabulary.js
const mongoose = require('mongoose');

const coreVocabularySchema = new mongoose.Schema({
  word: { type: String, required: true, unique: true },
  pronunciation: String,
  translation: { type: String, required: true },
  partOfSpeech: String,
  example: String,
  exampleTranslation: String,
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  category: { type: String, required: true }, // 用于年级分类，如 'grade7', 'grade8'
  tags: [String],
  frequency: { type: Number, default: 0 }, // 词频，用于排序
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  nextReviewDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 防止模型重复编译
const CoreVocabulary = mongoose.models.CoreVocabulary || mongoose.model('CoreVocabulary', coreVocabularySchema);

module.exports = CoreVocabulary;