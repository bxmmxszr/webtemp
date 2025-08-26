// api.js - API调用封装
class ApiService {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
        this.token = localStorage.getItem('token');
    }
    
    // 设置token
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }
    
    // 清除token
    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('lixin_user');
    }
    
    // 通用请求方法
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}: 请求失败`);
            }
            
            return data;
        } catch (error) {
            console.error('API请求错误:', error);
            throw error;
        }
    }
    
    // 用户注册
    async register(email, password, name) {
        return this.request('/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        });
    }
    
    // 用户登录
    async login(email, password) {
        const data = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        this.setToken(data.token);
        localStorage.setItem('lixin_user', JSON.stringify(data.user));
        return data;
    }
    
    // 获取用户信息
    async getUserInfo() {
        return this.request('/user');
    }
    
    // 更新用户信息
    async updateUserInfo(userData) {
        return this.request('/user', {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }
    
    // 修改密码
    async changePassword(currentPassword, newPassword) {
        return this.request('/user/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }
    
    // 用户登出
    logout() {
        this.clearToken();
    }
    
    // 添加学习记录
    async addLearningRecord(recordData) {
        return this.request('/learning-records', {
            method: 'POST',
            body: JSON.stringify(recordData)
        });
    }
    
    // 获取学习记录
    async getLearningRecords() {
        return this.request('/learning-records');
    }
    
    // 添加生词
    async addVocabulary(vocabularyData) {
        return this.request('/vocabulary', {
            method: 'POST',
            body: JSON.stringify(vocabularyData)
        });
    }
    
    // 获取生词表
    async getVocabulary() {
        return this.request('/vocabulary');
    }
    
    // 删除生词
    async deleteVocabulary(wordId) {
        return this.request(`/vocabulary/${wordId}`, {
            method: 'DELETE'
        });
    }
    
    // 获取每日核心词汇
    async getDailyVocabulary(count = 12) {
        return this.request(`/core-vocabulary/daily?count=${count}`);
    }
    
    // 获取复习词汇
    async getReviewVocabulary(count = 5) {
        return this.request(`/core-vocabulary/review?count=${count}`);
    }
    
    // 更新词汇学习记录
    async updateVocabularyRecord(vocabularyId, status, isCorrect = null) {
        return this.request('/core-vocabulary/record', {
            method: 'POST',
            body: JSON.stringify({ vocabularyId, status, isCorrect })
        });
    }
    
    // 获取学习统计
    async getVocabularyStats() {
        return this.request('/core-vocabulary/stats');
    }
    
    // 导入CSV词汇文件
    async importVocabularyCSV(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return this.request('/core-vocabulary/import', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${this.token}`
                // 注意：不要设置Content-Type，让浏览器自动设置multipart/form-data
            }
        });
    }
    
    // 导出词汇为CSV
    async exportVocabularyCSV(filters = {}) {
        const queryParams = new URLSearchParams(filters);
        return this.request(`/core-vocabulary/export?${queryParams}`);
    }
    
    // 获取词汇列表
    async getVocabularyList(page = 1, limit = 20, filters = {}) {
        const queryParams = new URLSearchParams({
            page: page,
            limit: limit,
            ...filters
        });
        return this.request(`/core-vocabulary/list?${queryParams}`);
    }
    
    // 添加词汇
    async addCoreVocabulary(vocabularyData) {
        return this.request('/core-vocabulary', {
            method: 'POST',
            body: JSON.stringify(vocabularyData)
        });
    }
    
    // 更新词汇
    async updateCoreVocabulary(id, vocabularyData) {
        return this.request(`/core-vocabulary/${id}`, {
            method: 'PUT',
            body: JSON.stringify(vocabularyData)
        });
    }
    
    // 删除词汇
    async deleteCoreVocabulary(id) {
        return this.request(`/core-vocabulary/${id}`, {
            method: 'DELETE'
        });
    }
}

// 创建全局API实例
const apiService = new ApiService();