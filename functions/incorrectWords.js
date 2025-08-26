// routes/incorrectWords.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const IncorrectWord = require('../models/IncorrectWord');

// @desc    获取当前用户的错误单词列表
// @route   GET /api/incorrect-words
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    // 根据用户ID查询
    const incorrectWords = await IncorrectWord.find({ user: req.user.id })
      .sort({ createdAt: -1 }); // 按创建时间倒序

    res.json({
      success: true,
      count: incorrectWords.length,
      words: incorrectWords
    });
  } catch (error) {
    console.error('获取错误单词失败:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// @desc    添加一个错误单词
// @route   POST /api/incorrect-words
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { vocabularyId, word, translation, partOfSpeech, source } = req.body;

    // 基本验证
    if (!word || !translation) {
      return res.status(400).json({ success: false, error: '单词和翻译是必需的' });
    }

    // 创建新的错误单词记录
    const newIncorrectWord = new IncorrectWord({
      user: req.user.id, // 从 auth 中间件获取
      vocabularyId: vocabularyId || undefined, // 如果有则关联核心词汇ID
      word: word.trim(),
      translation: translation.trim(),
      partOfSpeech: partOfSpeech || '',
      source: source || '词汇测试'
    });

    const savedWord = await newIncorrectWord.save();

    res.status(201).json({
      success: true,
      message: '错误单词记录成功',
      word: savedWord
    });
  } catch (error) {
    console.error('记录错误单词失败:', error);
    // Mongoose 验证错误处理
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ success: false, error: messages.join(', ') });
    }
    // 唯一索引冲突错误处理 (如果设置了唯一索引)
    if (error.code === 11000) {
        return res.status(400).json({ success: false, error: '该单词已存在于您的错误列表中' });
    }
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 可选：删除错误单词
// @desc    删除一个错误单词
// @route   DELETE /api/incorrect-words/:id
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const wordId = req.params.id;
    const deletedWord = await IncorrectWord.findOneAndDelete({ _id: wordId, user: req.user.id });

    if (!deletedWord) {
      return res.status(404).json({ success: false, error: '未找到该错误单词记录' });
    }

    res.json({ success: true, message: '错误单词删除成功' });
  } catch (error) {
    console.error('删除错误单词失败:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

module.exports = router;