// config/database.js
const mongoose = require('mongoose');

// 数据库连接配置
const dbConfig = {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/english_learning',
    options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // useCreateIndex: true, // 已废弃，由MongoDB驱动自动处理
        // useFindAndModify: false, // 已废弃，由MongoDB驱动自动处理
        serverSelectionTimeoutMS: 5000, // 服务器选择超时时间
        socketTimeoutMS: 45000, // Socket超时时间
        family: 4 // 使用IPv4，跳过IPv6
    }
};

// 连接状态监听
const connection = mongoose.connection;

// 连接成功
connection.on('connected', () => {
    console.log('✅ MongoDB数据库连接成功');
    console.log(`🔗 连接地址: ${dbConfig.uri}`);
});

// 连接错误
connection.on('error', (err) => {
    console.error('❌ MongoDB数据库连接错误:', err);
});

// 连接断开
connection.on('disconnected', () => {
    console.log('⚠️ MongoDB数据库连接已断开');
});

// 重新连接
connection.on('reconnected', () => {
    console.log('🔄 MongoDB数据库已重新连接');
});

// 连接失败
connection.on('close', () => {
    console.log('🔒 MongoDB数据库连接已关闭');
});

// 数据库连接函数
const connectDatabase = async () => {
    try {
        // 连接数据库
        await mongoose.connect(dbConfig.uri, dbConfig.options);
        console.log('🚀 数据库初始化完成');
        
        // 检查连接状态
        const state = mongoose.connection.readyState;
        const states = {
            0: '断开连接',
            1: '已连接',
            2: '正在连接',
            3: '正在断开连接'
        };
        
        console.log(`📊 数据库连接状态: ${states[state]} (${state})`);
        
    } catch (error) {
        console.error('💥 数据库连接失败:', error);
        process.exit(1); // 连接失败时退出进程
    }
};

// 断开数据库连接
const disconnectDatabase = async () => {
    try {
        await mongoose.disconnect();
        console.log('👋 数据库连接已安全断开');
    } catch (error) {
        console.error('❌ 断开数据库连接时出错:', error);
    }
};

// 处理应用关闭信号
process.on('SIGINT', async () => {
    console.log('\n🛑 收到关闭信号，正在断开数据库连接...');
    await disconnectDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 收到终止信号，正在断开数据库连接...');
    await disconnectDatabase();
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error('💥 未捕获的异常:', error);
    await disconnectDatabase();
    process.exit(1);
});

// 数据库健康检查
const checkDatabaseHealth = async () => {
    try {
        // 检查连接状态
        if (mongoose.connection.readyState !== 1) {
            throw new Error('数据库未连接');
        }
        
        // 执行简单查询测试
        await mongoose.connection.db.admin().ping();
        
        return {
            status: 'healthy',
            message: '数据库连接正常',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: '数据库连接异常',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

// 获取数据库统计信息
const getDatabaseStats = async () => {
    try {
        const db = mongoose.connection.db;
        const adminDb = db.admin();
        
        // 获取数据库状态
        const status = await adminDb.serverStatus();
        
        // 获取数据库列表
        const databases = await adminDb.listDatabases();
        
        return {
            serverStatus: {
                version: status.version,
                uptime: status.uptime,
                connections: status.connections
            },
            databases: databases.databases,
            currentDatabase: db.databaseName
        };
    } catch (error) {
        throw new Error(`获取数据库统计信息失败: ${error.message}`);
    }
};

module.exports = {
    connectDatabase,
    disconnectDatabase,
    checkDatabaseHealth,
    getDatabaseStats,
    dbConfig
};
