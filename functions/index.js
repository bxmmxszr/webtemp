// functions/index.js
const express = require('express');
const serverless = require('serverless-http');
const app = express();

// 加载所有路由
const authRoutes = require('./authRoutes');
const passageRoutes = require('./passageRoutes');
const quizRecordRoutes = require('./quizRecordRoutes');

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/passage', passageRoutes);
app.use('/api/quiz', quizRecordRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

exports.handler = serverless(app);