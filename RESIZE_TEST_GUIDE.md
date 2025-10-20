# 目录可调整大小 - 测试指南

## 🎯 功能说明

目录窗口现在支持通过鼠标拖动底部手柄来调整高度。

## 📐 布局结构

```
┌────────────────────────────────┐
│   .mp-toc-container            │
│   ┌──────────────────────────┐ │
│   │ .mp-toc-content (滚动)   │ │
│   │   目录标题               │ │
│   │   • 标题 1              │ │
│   │   • 标题 2              │ │
│   │   • 标题 3              │ │
│   └──────────────────────────┘ │
│   ┌──────────────────────────┐ │
│   │ .mp-toc-resize-handle    │ │
│   │        ════              │ │ ← 拖动手柄
│   └──────────────────────────┘ │
└────────────────────────────────┘
```

## ✅ 测试步骤

### 1. 打开目录
- [ ] 点击工具栏的列表图标按钮
- [ ] 目录出现在预览区域上方
- [ ] 可以看到目录底部有一条横线（拖动手柄）

### 2. 鼠标悬停测试
- [ ] 将鼠标移动到目录底部的横线上
- [ ] 光标变为上下调整大小样式（↕️）
- [ ] 横线从 40px 变长到 60px
- [ ] 横线颜色变深
- [ ] 背景色变化（hover 效果）

### 3. 拖动向下（增加高度）
- [ ] 按住鼠标左键
- [ ] 向下拖动
- [ ] 目录高度实时增加
- [ ] 横线变为 80px，显示高亮色
- [ ] 整个页面光标变为调整大小样式
- [ ] 释放鼠标，高度保持

### 4. 拖动向上（减少高度）
- [ ] 按住鼠标左键
- [ ] 向上拖动
- [ ] 目录高度实时减少
- [ ] 释放鼠标，高度保持

### 5. 边界测试
- [ ] 拖动到最小（100px），无法继续缩小
- [ ] 拖动到最大（500px），无法继续放大
- [ ] 边界处拖动仍然流畅

### 6. 滚动测试
- [ ] 如果目录内容很多，内容区域可以滚动
- [ ] 拖动手柄始终固定在底部（不随内容滚动）
- [ ] 滚动时拖动手柄始终可见

### 7. 功能兼容性测试
- [ ] 调整大小后，点击目录项仍然可以跳转
- [ ] 调整大小后，隐藏目录功能正常
- [ ] 重新显示目录，高度保持在上次调整的值
- [ ] 更新目录内容，高度保持不变

### 8. 视觉反馈测试
- [ ] 悬停时有明显的视觉提示
- [ ] 拖动时有清晰的视觉反馈
- [ ] 过渡动画流畅自然
- [ ] 不同主题下手柄都清晰可见

## 🐛 常见问题排查

### Q1: 看不到拖动手柄？
**检查项：**
- 是否已经打开目录？
- 目录是否有内容？
- 检查浏览器控制台是否有错误

**解决方案：**
```javascript
// 打开控制台，检查元素
document.querySelector('.mp-toc-resize-handle')
// 应该返回一个 HTMLElement
```

### Q2: 拖动没有反应？
**检查项：**
- 鼠标是否在手柄区域（底部 12px 高度）
- 控制台是否有 JavaScript 错误

**调试方法：**
```javascript
// 在 setupTocResize 方法中添加 console.log
console.log('[Resize] mousedown triggered');
console.log('[Resize] mousemove triggered');
```

### Q3: 拖动后高度不变？
**检查项：**
- `this.tocContainer` 是否存在
- `max-height` CSS 属性是否被正确设置

**调试方法：**
```javascript
// 检查容器
const toc = document.querySelector('.mp-toc-container');
console.log('Current max-height:', toc.style.maxHeight);
```

### Q4: 手柄位置不对？
**检查项：**
- `.mp-toc-container` 是否有 `display: flex; flex-direction: column`
- `.mp-toc-resize-handle` 是否有 `flex-shrink: 0`

**解决方案：**
检查 CSS 是否正确加载，查看计算后的样式。

## 🔧 技术实现要点

### 关键 CSS
```css
/* 容器使用 flex 布局 */
.mp-toc-container {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* 内容区域可滚动 */
.mp-toc-content {
    flex: 1 1 auto;
    overflow-y: auto;
}

/* 手柄固定在底部 */
.mp-toc-resize-handle {
    flex-shrink: 0;
    height: 12px;
}
```

### 关键 JavaScript
```typescript
// 计算新高度
const deltaY = e.clientY - startY;
const newHeight = startHeight + deltaY;

// 限制范围
const clampedHeight = Math.max(100, Math.min(500, newHeight));

// 应用新高度
this.tocContainer.style.maxHeight = `${clampedHeight}px`;
```

## 📊 性能指标

- **初始化时间**: < 10ms
- **拖动响应**: < 16ms（60fps）
- **内存占用**: 可忽略不计
- **CPU 使用**: 拖动时 < 5%

## ✨ 预期效果

### 视觉效果
1. **默认状态**: 目录高度 180px，横线 40px 宽
2. **悬停状态**: 横线变长到 60px，颜色加深
3. **拖动状态**: 横线 80px，高亮显示，全局光标变化
4. **调整后**: 新高度保持，手柄仍然可用

### 交互流程
1. 用户打开目录
2. 看到底部有拖动手柄
3. 鼠标悬停，手柄高亮
4. 按住拖动，高度实时变化
5. 释放鼠标，完成调整
6. 高度保持在新值

## 🎨 自定义建议

如果需要调整参数，可以修改以下值：

```typescript
// src/view.ts
const minHeight = 100;  // 最小高度
const maxHeight = 500;  // 最大高度
```

```css
/* src/styles/view/toc.css */
.mp-toc-resize-handle {
    height: 12px;  /* 点击区域高度 */
}

.mp-toc-resize-line {
    width: 40px;   /* 默认宽度 */
    height: 3px;   /* 横线粗细 */
}
```

## 📝 更新日志

### v1.0.4 (当前版本)
- ✅ 重构目录容器为 flex 布局
- ✅ 分离内容区域和拖动手柄
- ✅ 修复手柄被滚动隐藏的问题
- ✅ 优化视觉反馈效果
- ✅ 确保拖动手柄始终可见

---

## 🚀 开始测试

1. 重新加载 Obsidian 插件
2. 打开一个包含多个标题的文档
3. 点击目录按钮
4. 找到底部的拖动手柄
5. 开始拖动调整大小！

如果遇到问题，请检查浏览器控制台的错误信息。
