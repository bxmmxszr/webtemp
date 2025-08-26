// init-admin.js - 初始化管理员账户
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// 连接数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/english_learning', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// 用户模型
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

const User = mongoose.model('User', userSchema);

async function createAdminUser() {
    try {
        // 检查管理员是否已存在
        const existingAdmin = await User.findOne({ email: 'admin@example.com' });
        if (existingAdmin) {
            console.log('✅ 管理员账户已存在');
            process.exit(0);
        }

        // 创建管理员账户
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const adminUser = new User({
            email: 'admin@example.com',
            password: hashedPassword,
            name: '系统管理员',
            phone: '13800138000',
            bio: '系统管理员账户',
            createdAt: new Date(),
            isAdmin: true
        });

        await adminUser.save();
        console.log('✅ 管理员账户创建成功');
        console.log('📧 邮箱: admin@example.com');
        console.log('🔑 密码: admin123');
        console.log('⚠️  请及时修改默认密码');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ 创建管理员账户失败:', error);
        process.exit(1);
    }
}

// 执行创建
createAdminUser();