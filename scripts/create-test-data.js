// create-test-data.js
const mongoose = require('mongoose');
const CoreVocabulary = require('./models/CoreVocabulary');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/english_learning');

// 创建测试数据
async function createTestData() {
    try {
        const testData = [
            {
                word: "hello",
                pronunciation: "/həˈləʊ/",
                translation: "你好",
                partOfSpeech: "感叹词",
                example: "Hello, how are you?",
                exampleTranslation: "你好，你好吗？",
                difficulty: "beginner",
                category: "greeting",
                tags: ["基础问候", "高频词汇"]
            },
            {
                word: "welcome",
                pronunciation: "/ˈwelkəm/",
                translation: "欢迎",
                partOfSpeech: "动词/形容词",
                example: "Welcome to our school!",
                exampleTranslation: "欢迎来到我们学校！",
                difficulty: "beginner",
                category: "school",
                tags: ["高频词汇", "基础词汇"]
            }
        ];

        // 插入测试数据
        for (const vocab of testData) {
            const existing = await CoreVocabulary.findOne({ word: vocab.word });
            if (!existing) {
                const newVocab = new CoreVocabulary(vocab);
                await newVocab.save();
                console.log(`已创建词汇: ${vocab.word}`);
            } else {
                console.log(`词汇已存在: ${vocab.word}`);
            }
        }

        console.log('测试数据创建完成！');
        process.exit(0);
    } catch (error) {
        console.error('创建测试数据失败:', error);
        process.exit(1);
    }
}

createTestData();