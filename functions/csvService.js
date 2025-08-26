// services/csvService.js
const fs = require('fs');
const csv = require('csv-parser');
const parse = require('csv-parse');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');

class CSVService {
    // 解析CSV文件
    static parseCSV(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            const errors = [];
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    resolve({ results, errors });
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // 验证词汇数据格式
    static validateVocabularyData(data) {
        const errors = [];
        
        data.forEach((row, index) => {
            if (!row.word) {
                errors.push(`第${index + 1}行: 缺少英文单词`);
            }
            if (!row.translation) {
                errors.push(`第${index + 1}行: 缺少中文翻译`);
            }
        });
        
        return errors;
    }

    // 生成CSV文件
    static async generateCSV(data, outputPath) {
        const csvWriter = createObjectCsvWriter({
            path: outputPath,
            header: [
                { id: 'word', title: 'word' },
                { id: 'pronunciation', title: 'pronunciation' },
                { id: 'translation', title: 'translation' },
                { id: 'partOfSpeech', title: 'partOfSpeech' },
                { id: 'example', title: 'example' },
                { id: 'exampleTranslation', title: 'exampleTranslation' },
                { id: 'difficulty', title: 'difficulty' },
                { id: 'category', title: 'category' },
                { id: 'tags', title: 'tags' }
            ]
        });

        const records = data.map(vocab => ({
            word: vocab.word,
            pronunciation: vocab.pronunciation,
            translation: vocab.translation,
            partOfSpeech: vocab.partOfSpeech,
            example: vocab.example,
            exampleTranslation: vocab.exampleTranslation,
            difficulty: vocab.difficulty,
            category: vocab.category,
            tags: Array.isArray(vocab.tags) ? vocab.tags.join(',') : ''
        }));

        await csvWriter.writeRecords(records);
        return outputPath;
    }

    // 创建示例CSV模板
    static createSampleCSV() {
        const sampleData = [
            {
                word: 'welcome',
                pronunciation: '/ˈwelkəm/',
                translation: '欢迎',
                partOfSpeech: '感叹词',
                example: 'Welcome to our school!',
                exampleTranslation: '欢迎来到我们学校！',
                difficulty: 'beginner',
                category: 'school',
                tags: '高频词汇,基础问候'
            },
            {
                word: 'introduce',
                pronunciation: '/ˌɪntrəˈduːs/',
                translation: '介绍',
                partOfSpeech: '动词',
                example: 'Let me introduce myself.',
                exampleTranslation: '让我介绍一下自己。',
                difficulty: 'intermediate',
                category: 'communication',
                tags: '考试重点'
            },
            {
                word: 'comfortable',
                pronunciation: '/ˈkʌmfətəbl/',
                translation: '舒适的，舒服的',
                partOfSpeech: '形容词',
                example: 'Make yourself comfortable.',
                exampleTranslation: '请随便坐。',
                difficulty: 'intermediate',
                category: 'daily',
                tags: '日常生活'
            }
        ];

        const outputPath = path.join('templates', 'vocabulary_sample.csv');
        if (!fs.existsSync('templates')) {
            fs.mkdirSync('templates', { recursive: true });
        }

        this.generateCSV(sampleData, outputPath);
        return outputPath;
    }
}

module.exports = CSVService;