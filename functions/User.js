// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  phone: String,
  birthday: String,
  bio: String,
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date,
  isAdmin: { type: Boolean, default: false }
});

// 防止模型重复编译 (在开发环境热重载时有用)
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;