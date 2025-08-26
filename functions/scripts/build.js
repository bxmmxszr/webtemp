// scripts/build.js
const fs = require('fs');
const path = require('path');

function copyFiles() {
  const srcDir = path.join(__dirname, 'src');
  const destDir = path.join(__dirname, 'public');
  
  // 创建 public 目录
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
  }
  
  // 复制 HTML 文件
  if (fs.existsSync(path.join(srcDir, 'index.html'))) {
    fs.copyFileSync(path.join(srcDir, 'index.html'), path.join(destDir, 'index.html'));
  }
  
  // 复制 CSS 文件
  const cssSrc = path.join(srcDir, 'css');
  const cssDest = path.join(destDir, 'css');
  if (fs.existsSync(cssSrc)) {
    fs.mkdirSync(cssDest, { recursive: true });
    fs.readdirSync(cssSrc).forEach(file => {
      fs.copyFileSync(path.join(cssSrc, file), path.join(cssDest, file));
    });
  }
  
  // 复制 JS 文件
  const jsSrc = path.join(srcDir, 'js');
  const jsDest = path.join(destDir, 'js');
  if (fs.existsSync(jsSrc)) {
    fs.mkdirSync(jsDest, { recursive: true });
    fs.readdirSync(jsSrc).forEach(file => {
      fs.copyFileSync(path.join(jsSrc, file), path.join(jsDest, file));
    });
  }
}

copyFiles();