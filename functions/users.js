// users.js - 用户数据管理模块
const express = require('express');
const router = express.Router();
const User = require('./User');

router.get('/', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

module.exports = router;

class UserManager {
    constructor() {
        this.usersKey = 'registered_users';
        this.currentUserKey = 'lixin_user';
        this.initUsers();
    }

    // 初始化用户存储
    initUsers() {
        if (!localStorage.getItem(this.usersKey)) {
            localStorage.setItem(this.usersKey, JSON.stringify([]));
        }
    }

    // 获取所有用户
    getAllUsers() {
        try {
            const users = localStorage.getItem(this.usersKey);
            return users ? JSON.parse(users) : [];
        } catch (error) {
            console.error('获取用户数据失败:', error);
            return [];
        }
    }

    // 保存用户数据
    saveUsers(users) {
        try {
            localStorage.setItem(this.usersKey, JSON.stringify(users));
            return true;
        } catch (error) {
            console.error('保存用户数据失败:', error);
            return false;
        }
    }

    // 检查邮箱是否已存在
    isEmailExists(email) {
        const users = this.getAllUsers();
        return users.some(user => user.email === email);
    }

    // 注册新用户
    registerUser(email, password, name = '') {
        // 检查邮箱是否已存在
        if (this.isEmailExists(email)) {
            throw new Error('该邮箱已被注册');
        }

        // 创建新用户对象
        const newUser = {
            id: Date.now().toString(), // 简单的ID生成
            email: email,
            password: btoa(password), // 简单的base64编码（实际项目中应该使用哈希）
            name: name || email.split('@')[0],
            registerDate: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        };

        // 获取现有用户并添加新用户
        const users = this.getAllUsers();
        users.push(newUser);
        
        // 保存用户数据
        if (this.saveUsers(users)) {
            return newUser;
        } else {
            throw new Error('注册失败，请重试');
        }
    }

    // 用户登录
    loginUser(email, password) {
        const users = this.getAllUsers();
        const user = users.find(u => u.email === email);
        
        if (!user) {
            throw new Error('用户不存在');
        }

        // 检查密码（简单比较，实际项目中应该使用哈希比较）
        if (user.password !== btoa(password)) {
            throw new Error('密码错误');
        }

        if (!user.isActive) {
            throw new Error('账户已被禁用');
        }

        // 更新最后登录时间
        user.lastLogin = new Date().toISOString();
        this.saveUsers(users);

        // 保存当前用户信息到本地存储
        localStorage.setItem(this.currentUserKey, JSON.stringify({
            email: user.email,
            name: user.name,
            loginTime: new Date().toISOString()
        }));

        return {
            email: user.email,
            name: user.name
        };
    }

    // 用户登出
    logoutUser() {
        localStorage.removeItem(this.currentUserKey);
    }

    // 获取当前登录用户
    getCurrentUser() {
        try {
            const currentUser = localStorage.getItem(this.currentUserKey);
            return currentUser ? JSON.parse(currentUser) : null;
        } catch (error) {
            console.error('获取当前用户失败:', error);
            return null;
        }
    }

    // 更新用户信息
    updateUser(userId, updateData) {
        const users = this.getAllUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            throw new Error('用户不存在');
        }

        // 更新用户信息
        users[userIndex] = { ...users[userIndex], ...updateData };
        
        return this.saveUsers(users);
    }

    // 删除用户
    deleteUser(userId) {
        const users = this.getAllUsers();
        const filteredUsers = users.filter(u => u.id !== userId);
        
        return this.saveUsers(filteredUsers);
    }

    // 禁用/启用用户
    toggleUserStatus(userId) {
        const users = this.getAllUsers();
        const user = users.find(u => u.id === userId);
        
        if (user) {
            user.isActive = !user.isActive;
            return this.saveUsers(users);
        }
        
        return false;
    }
}

// 创建全局用户管理实例
const userManager = new UserManager();