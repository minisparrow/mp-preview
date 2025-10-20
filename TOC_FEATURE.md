# 目录功能实现说明

## 功能特性

### 1. 固定布局
- **工具栏固定**：顶部工具栏始终可见，不随内容滚动
- **目录固定**：显示目录时，目录栏固定在内容区域上方
- **底部栏固定**：底部工具栏始终可见
- **仅预览区滚动**：只有预览内容区域可以滚动

### 2. 目录跳转
- **准确定位**：点击目录项会滚动到对应标题位置
- **平滑滚动**：使用 smooth 行为，提供流畅的滚动动画
- **顶部留白**：跳转后标题距离顶部 30px，避免贴边
- **高亮显示**：点击的目录项会高亮显示

### 3. 用户交互
- **切换显示**：点击目录按钮（列表图标）显示/隐藏目录
- **按钮状态**：目录可见时，按钮显示激活状态
- **自动更新**：预览内容更新时，目录自动重新生成

## 技术实现

### CSS 布局结构
```
.mp-view-content (flex column, overflow: hidden)
  ├── .mp-toolbar (固定，flex-shrink: 0)
  ├── .mp-content-area (flex: 1, flex column)
  │   ├── .mp-toc-container (固定，max-height: 180px，可滚动)
  │   └── .mp-preview-area (flex: 1，可滚动) ← 主滚动区域
  └── .mp-bottom-bar (固定，flex-shrink: 0)
```

### 跳转算法
```javascript
// 计算目标元素相对于previewEl的位置
const previewTop = this.previewEl.scrollTop;  // 当前滚动位置
const previewRect = this.previewEl.getBoundingClientRect();  // 容器位置
const targetRect = targetElement.getBoundingClientRect();  // 目标位置

// 目标滚动位置 = 当前滚动 + (目标top - 容器top) - 留白
const targetScrollTop = previewTop + (targetRect.top - previewRect.top) - 30;

this.previewEl.scrollTo({
    top: Math.max(0, targetScrollTop),
    behavior: 'smooth'
});
```

### 调试日志
点击目录时会在控制台输出以下信息：
- 点击的标题文本和 DOM 元素
- 当前滚动位置
- 预览容器和目标元素的位置信息
- 计算出的目标滚动位置

## 测试步骤

1. **打开预览窗口**
   - 在 Obsidian 中打开一个包含多个标题的 Markdown 文件
   - 点击命令面板，选择"打开微信公众号预览"

2. **显示目录**
   - 点击工具栏中的列表图标按钮
   - 目录应该出现在预览区域上方
   - 按钮应显示激活状态（蓝色背景）

3. **测试固定布局**
   - 滚动预览内容
   - 验证：工具栏、目录、底部栏都保持固定
   - 验证：只有预览内容在滚动

4. **测试目录跳转**
   - 点击任意目录项
   - 验证：预览区域平滑滚动到对应标题
   - 验证：标题位置距离顶部约 30px
   - 验证：点击的目录项高亮显示

5. **查看调试日志**
   - 打开浏览器控制台（Ctrl+Shift+I 或 Cmd+Option+I）
   - 点击目录项
   - 检查 `[TOC]` 开头的日志信息

## 常见问题

### Q: 点击目录没有反应？
A: 打开控制台查看日志，检查：
- 是否输出了 `[TOC] Clicking on:` 日志
- `previewEl` 和 `targetElement` 是否都存在
- 滚动计算是否正确

### Q: 滚动位置不准确？
A: 检查：
- 预览区域是否有 CSS transform 或 position 影响
- 控制台日志中的位置计算是否合理
- 尝试调整留白值（当前是 30px）

### Q: 目录不显示？
A: 检查：
- 文档中是否有标题（h1-h6）
- CSS 类 `mp-toc-visible` 是否正确应用
- 控制台是否有错误信息

## 文件清单

修改的文件：
- `src/view.ts` - 添加目录跳转逻辑和调试日志
- `src/styles/view/layout.css` - 修改基础布局为固定头尾
- `src/styles/view/toc.css` - 设置目录样式和位置

## 版本历史

### v1.0.3 (当前版本)
- ✅ 实现固定工具栏和目录
- ✅ 实现准确的目录跳转
- ✅ 添加调试日志
- ✅ 优化滚动体验
