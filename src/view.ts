import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile, setIcon } from 'obsidian';
import { MPConverter } from './converter';
import { CopyManager } from './copyManager';
import type { TemplateManager } from './templateManager';
import { DonateManager } from './donateManager';
import type { SettingsManager } from './settings/settings';
import { BackgroundManager } from './backgroundManager';
export const VIEW_TYPE_MP = 'mp-preview';

export class MPView extends ItemView {
    private previewEl: HTMLElement;
    private currentFile: TFile | null = null;
    private updateTimer: NodeJS.Timeout | null = null;
    private isPreviewLocked: boolean = false;
    private lockButton: HTMLButtonElement;
    private copyButton: HTMLButtonElement;
    private templateManager: TemplateManager;
    private settingsManager: SettingsManager;
    private customTemplateSelect: HTMLElement;
    private customFontSelect: HTMLElement;
    private fontSizeSelect: HTMLInputElement;
    private backgroundManager: BackgroundManager;
    private customBackgroundSelect: HTMLElement;
    private scrollSyncEnabled: boolean = true;
    private editorScrollHandler: ((e: Event) => void) | null = null;
    private tocVisible: boolean = false;
    private tocContainer: HTMLElement | null = null;

    constructor(
        leaf: WorkspaceLeaf, 
        templateManager: TemplateManager,
        settingsManager: SettingsManager
    ) {
        super(leaf);
        this.templateManager = templateManager;
        this.settingsManager = settingsManager;
        this.backgroundManager = new BackgroundManager(this.settingsManager);
    }

    getViewType() {
        return VIEW_TYPE_MP;
    }

    getDisplayText() {
        return '公众号预览';
    }

    getIcon() {
       return 'eye';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.classList.remove('view-content');
        container.classList.add('mp-view-content');
        
        // 顶部工具栏
        const toolbar = container.createEl('div', { cls: 'mp-toolbar' });
        const controlsGroup = toolbar.createEl('div', { cls: 'mp-controls-group' });
        
        // 锁定按钮
        this.lockButton = controlsGroup.createEl('button', {
            cls: 'mp-lock-button',
            attr: { 'aria-label': '关闭实时预览状态' }
        });
        setIcon(this.lockButton, 'lock');
        this.lockButton.setAttribute('aria-label', '开启实时预览状态');
        this.lockButton.addEventListener('click', () => this.togglePreviewLock());
        
        // 目录切换按钮
        const tocButton = controlsGroup.createEl('button', {
            cls: 'mp-toc-button',
            attr: { 'aria-label': '显示/隐藏目录' }
        });
        setIcon(tocButton, 'list');
        tocButton.addEventListener('click', () => {
            this.toggleToc();
            // 切换按钮激活状态
            tocButton.classList.toggle('active', this.tocVisible);
        });
        
        // 添加背景选择器
        const backgroundOptions = [
            { value: '', label: '无背景' },
            ...(this.settingsManager.getVisibleBackgrounds()?.map(bg => ({
                value: bg.id,
                label: bg.name
            })) || [])
        ];
        
        this.customBackgroundSelect = this.createCustomSelect(
            controlsGroup,
            'mp-background-select',
            backgroundOptions
        );
        
        // 添加背景选择器的事件监听
        this.customBackgroundSelect.querySelector('.custom-select')?.addEventListener('change', async (e: any) => {
            const value = e.detail.value;
            this.backgroundManager.setBackground(value);
            await this.settingsManager.updateSettings({
                backgroundId: value
            });
            this.backgroundManager.applyBackground(this.previewEl);
        });
        
        // 创建自定义下拉选择器
        this.customTemplateSelect = this.createCustomSelect(
            controlsGroup,
            'mp-template-select',
            await this.getTemplateOptions()
        );
        this.customTemplateSelect.id = 'template-select';
        
        // 添加模板选择器的 change 事件监听
        this.customTemplateSelect.querySelector('.custom-select')?.addEventListener('change', async (e: any) => {
            const value = e.detail.value;
            this.templateManager.setCurrentTemplate(value);
            await this.settingsManager.updateSettings({
                templateId: value
            });
            this.templateManager.applyTemplate(this.previewEl);
        });
    
        this.customFontSelect = this.createCustomSelect(
            controlsGroup,
            'mp-font-select',
            this.getFontOptions()
        );

        // 添加字体选择器的 change 事件监听
        this.customFontSelect.querySelector('.custom-select')?.addEventListener('change', async (e: any) => {
            const value = e.detail.value;
            this.templateManager.setFont(value);
            await this.settingsManager.updateSettings({
                fontFamily: value
            });
            this.templateManager.applyTemplate(this.previewEl);
        });
        this.customFontSelect.id = 'font-select';

        // 字号调整
        const fontSizeGroup = controlsGroup.createEl('div', { cls: 'mp-font-size-group' });
        const decreaseButton = fontSizeGroup.createEl('button', { 
            cls: 'mp-font-size-btn',
            text: '-'
        });
        this.fontSizeSelect = fontSizeGroup.createEl('input', { 
            cls: 'mp-font-size-input',
            type: 'text',
            value: '16',
            attr: {
                style: 'border: none; outline: none; background: transparent;'
            }
        });
        const increaseButton = fontSizeGroup.createEl('button', { 
            cls: 'mp-font-size-btn',
            text: '+'
        });

        // 从设置中恢复上次的选择
        const settings = this.settingsManager.getSettings();
        
        // 恢复背景设置
        if (settings.backgroundId) {
            const backgroundSelect = this.customBackgroundSelect.querySelector('.selected-text');
            const backgroundDropdown = this.customBackgroundSelect.querySelector('.select-dropdown');
            if (backgroundSelect && backgroundDropdown) {
                const option = backgroundOptions.find(o => o.value === settings.backgroundId);
                if (option) {
                    backgroundSelect.textContent = option.label;
                    this.customBackgroundSelect.querySelector('.custom-select')?.setAttribute('data-value', option.value);
                    backgroundDropdown.querySelectorAll('.select-item').forEach(el => {
                        if (el.getAttribute('data-value') === option.value) {
                            el.classList.add('selected');
                        } else {
                            el.classList.remove('selected');
                        }
                    });
                }
            }
            this.backgroundManager.setBackground(settings.backgroundId);
        }

        // 恢复设置
        if (settings.templateId) {
            const templateSelect = this.customTemplateSelect.querySelector('.selected-text');
            const templateDropdown = this.customTemplateSelect.querySelector('.select-dropdown');
            if (templateSelect && templateDropdown) {
                const option = await this.getTemplateOptions();
                const selected = option.find(o => o.value === settings.templateId);
                if (selected) {
                    templateSelect.textContent = selected.label;
                    this.customTemplateSelect.querySelector('.custom-select')?.setAttribute('data-value', selected.value);
                    templateDropdown.querySelectorAll('.select-item').forEach(el => {
                        if (el.getAttribute('data-value') === selected.value) {
                            el.classList.add('selected');
                        } else {
                            el.classList.remove('selected');
                        }
                    });
                }
            }
            this.templateManager.setCurrentTemplate(settings.templateId);
        }

        if (settings.fontFamily) {
            const fontSelect = this.customFontSelect.querySelector('.selected-text');
            const fontDropdown = this.customFontSelect.querySelector('.select-dropdown');
            if (fontSelect && fontDropdown) {
                const option = this.getFontOptions();
                const selected = option.find(o => o.value === settings.fontFamily);
                if (selected) {
                    fontSelect.textContent = selected.label;
                    this.customFontSelect.querySelector('.custom-select')?.setAttribute('data-value', selected.value);
                    fontDropdown.querySelectorAll('.select-item').forEach(el => {
                        if (el.getAttribute('data-value') === selected.value) {
                            el.classList.add('selected');
                        } else {
                            el.classList.remove('selected');
                        }
                    });
                }
            }
            this.templateManager.setFont(settings.fontFamily);
        }

        if (settings.fontSize) {
            this.fontSizeSelect.value = settings.fontSize.toString();
            this.templateManager.setFontSize(settings.fontSize);
        }

        // 更新字号调整事件
        const updateFontSize = async () => {
            const size = parseInt(this.fontSizeSelect.value);
            this.templateManager.setFontSize(size);
            await this.settingsManager.updateSettings({
                fontSize: size
            });
            this.templateManager.applyTemplate(this.previewEl);
        };

        // 字号调整按钮事件
        decreaseButton.addEventListener('click', () => {
            const currentSize = parseInt(this.fontSizeSelect.value);
            if (currentSize > 12) {
                this.fontSizeSelect.value = (currentSize - 1).toString();
                updateFontSize();
            }
        });

        increaseButton.addEventListener('click', () => {
            const currentSize = parseInt(this.fontSizeSelect.value);
            if (currentSize < 30) {
                this.fontSizeSelect.value = (currentSize + 1).toString();
                updateFontSize();
            }
        });

        this.fontSizeSelect.addEventListener('change', updateFontSize);
        
        // 创建主内容区域容器
        const contentArea = container.createEl('div', { cls: 'mp-content-area' });
        
        // 目录容器（默认隐藏，显示在上方）
        this.tocContainer = contentArea.createEl('div', { cls: 'mp-toc-container mp-toc-hidden' });
        
        // 预览区域
        this.previewEl = contentArea.createEl('div', { cls: 'mp-preview-area' });

        // 底部工具栏
        const bottomBar = container.createEl('div', { cls: 'mp-bottom-bar' });
        // 创建中间控件容器
        const bottomControlsGroup = bottomBar.createEl('div', { cls: 'mp-controls-group' });
        // 帮助按钮
        const helpButton = bottomControlsGroup.createEl('button', {
            cls: 'mp-help-button',
            attr: { 'aria-label': '使用指南' }
        });
        setIcon(helpButton, 'help');
        // 帮助提示框
        bottomControlsGroup.createEl('div', {
            cls: 'mp-help-tooltip',
            text: `使用指南：
                1. 选择喜欢的主题模板
                2. 调整字体和字号
                3. 实时预览效果
                4. 点击【复制按钮】即可粘贴到公众号
                5. 编辑实时查看效果，点🔓关闭实时刷新
                6. 如果你喜欢这个插件，欢迎关注打赏`
        });

        
        
        // 关于作者按钮
        const likeButton = bottomControlsGroup.createEl('button', { 
            cls: 'mp-like-button'
        });
        const heartSpan = likeButton.createEl('span', {
            text: '❤️',
            attr: { style: 'margin-right: 4px' }
        });
        likeButton.createSpan({ text: '关于作者' });
        
        likeButton.addEventListener('click', () => {
            DonateManager.showDonateModal(this.containerEl);
        });

        // 复制按钮
        this.copyButton = bottomControlsGroup.createEl('button', { 
            text: '复制到公众号',
            cls: 'mp-copy-button'
        });
        //新功能按钮
        const newButton = bottomControlsGroup.createEl('button', { 
            text: '敬请期待',
            cls: 'mp-new-button'
        });

        // 添加复制按钮点击事件
        this.copyButton.addEventListener('click', async () => {
            if (this.previewEl) {
                this.copyButton.disabled = true;
                this.copyButton.setText('复制中...');
                
                try {
                    const settings = this.settingsManager.getSettings();
                    const renderMathAsImage = settings.renderMathAsImage ?? true;
                    const smMsToken = settings.smMsToken ?? '';
                    // 如果配置了 token，且未显式关闭上传，则默认开启上传，避免部分编辑器屏蔽 data: URI
                    const uploadToSmMs = (settings.uploadToSmMs ?? undefined) !== undefined
                        ? settings.uploadToSmMs
                        : (!!smMsToken);
                    const saveImagesToVault = settings.saveImagesToVault ?? false;
                    const imagesVaultFolder = settings.imagesVaultFolder ?? 'MP Preview Images';
                    
                    // 读取当前文件的 Markdown 源码，用于提取公式
                    let markdownSource = '';
                    if (this.currentFile) {
                        try {
                            markdownSource = await this.app.vault.cachedRead(this.currentFile);
                        } catch (e) {
                            console.warn('[MP] Failed to read markdown source:', e);
                        }
                    }
                    
                    // 传递 app 和 vault 相关上下文 via any
                    await CopyManager.copyToClipboard(this.previewEl, { renderMathAsImage, uploadToSmMs, smMsToken, saveImagesToVault, imagesVaultFolder, app: (this as any).app, markdownSource });
                    this.copyButton.setText('复制成功');
                    
                    setTimeout(() => {
                        this.copyButton.disabled = false;
                        this.copyButton.setText('复制为公众号格式');
                    }, 2000);
                } catch (error) {
                    this.copyButton.setText('复制失败');
                    setTimeout(() => {
                        this.copyButton.disabled = false;
                        this.copyButton.setText('复制为公众号格式');
                    }, 2000);
                }
            }
        });

        // 监听文档变化
        this.registerEvent(
            this.app.workspace.on('file-open', this.onFileOpen.bind(this))
        );

        // 监听文档内容变化
        this.registerEvent(
            this.app.vault.on('modify', this.onFileModify.bind(this))
        );

        // 监听活动 leaf 的变化，用于滚动同步
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.setupScrollSync();
            })
        );

        // 检查当前打开的文件
        const currentFile = this.app.workspace.getActiveFile();
        await this.onFileOpen(currentFile);
        
        // 初始化滚动同步
        this.setupScrollSync();
    }

    private updateControlsState(enabled: boolean) {
        this.lockButton.disabled = !enabled;
        // 更新所有自定义选择器的禁用状态
        const templateSelect = this.customTemplateSelect.querySelector('.custom-select');
        const fontSelect = this.customFontSelect.querySelector('.custom-select');
        const backgroundSelect = this.customBackgroundSelect.querySelector('.custom-select');
        
        [templateSelect, fontSelect, backgroundSelect].forEach(select => {
            if (select) {
                select.classList.toggle('disabled', !enabled);
                select.setAttribute('style', `pointer-events: ${enabled ? 'auto' : 'none'}`);
            }
        });
        
        this.fontSizeSelect.disabled = !enabled;
        this.copyButton.disabled = !enabled;
        
        // 字号调节按钮的状态控制
        const fontSizeButtons = this.containerEl.querySelectorAll('.mp-font-size-btn');
        fontSizeButtons.forEach(button => {
            (button as HTMLButtonElement).disabled = !enabled;
        });
    }

    async onFileOpen(file: TFile | null) {
        this.currentFile = file;
        if (!file || file.extension !== 'md') {
            this.previewEl.empty();
            this.previewEl.createEl('div', {
                text: '只能预览 markdown 文本文档',
                cls: 'mp-empty-message'
            });
            this.updateControlsState(false);
            return;
        }

        this.updateControlsState(true);
        this.isPreviewLocked = false;
        setIcon(this.lockButton, 'unlock');
        await this.updatePreview();
        
        // 重新设置滚动同步
        setTimeout(() => this.setupScrollSync(), 100);
    }

    private async togglePreviewLock() {
        this.isPreviewLocked = !this.isPreviewLocked;
        const lockIcon = this.isPreviewLocked ? 'lock' : 'unlock';
        const lockStatus = this.isPreviewLocked ? '开启实时预览状态' : '关闭实时预览状态';
        setIcon(this.lockButton, lockIcon);
        this.lockButton.setAttribute('aria-label', lockStatus);
        
        if (!this.isPreviewLocked) {
            await this.updatePreview();
        }
    }

    async onFileModify(file: TFile) {
        if (file === this.currentFile && !this.isPreviewLocked) {
            if (this.updateTimer) {
                clearTimeout(this.updateTimer);
            }
            
            this.updateTimer = setTimeout(() => {
                this.updatePreview();
            }, 500);
        }
    }

    async updatePreview() {
        if (!this.currentFile) return;

        // 保存当前滚动位置和内容高度
        const scrollPosition = this.previewEl.scrollTop;
        const prevHeight = this.previewEl.scrollHeight;
        const isAtBottom = (this.previewEl.scrollHeight - this.previewEl.scrollTop) <= (this.previewEl.clientHeight + 100);

        this.previewEl.empty();
        const content = await this.app.vault.cachedRead(this.currentFile);
        
        await MarkdownRenderer.render(
            this.app,
            content,
            this.previewEl,
            this.currentFile.path,
            this
        );

        MPConverter.formatContent(this.previewEl);
        this.templateManager.applyTemplate(this.previewEl);
        this.backgroundManager.applyBackground(this.previewEl);

        // 更新目录
        if (this.tocVisible) {
            this.updateToc();
        }

        // 根据滚动位置决定是否自动滚动（仅在未启用滚动同步时）
        if (!this.scrollSyncEnabled) {
            if (isAtBottom) {
                // 如果用户在底部附近，自动滚动到底部
                requestAnimationFrame(() => {
                    this.previewEl.scrollTop = this.previewEl.scrollHeight;
                });
            } else {
                // 否则保持原来的滚动位置
                const heightDiff = this.previewEl.scrollHeight - prevHeight;
                this.previewEl.scrollTop = scrollPosition + heightDiff;
            }
        }
        
        // 预览更新后重新设置滚动同步
        setTimeout(() => this.setupScrollSync(), 50);
    }

    // 添加自定义下拉选择器创建方法
    private createCustomSelect(
        parent: HTMLElement,
        className: string,
        options: { value: string; label: string }[]
    ) {
        const container = parent.createEl('div', { cls: 'custom-select-container' });
        const select = container.createEl('div', { cls: 'custom-select' });
        const selectedText = select.createEl('span', { cls: 'selected-text' });
        const arrow = select.createEl('span', { cls: 'select-arrow', text: '▾' });
        
        const dropdown = container.createEl('div', { cls: 'select-dropdown' });
        
        options.forEach(option => {
            const item = dropdown.createEl('div', {
                cls: 'select-item',
                text: option.label
            });
            
            item.dataset.value = option.value;
            item.addEventListener('click', () => {
                // 移除其他项的选中状态
                dropdown.querySelectorAll('.select-item').forEach(el => 
                    el.classList.remove('selected'));
                // 添加当前项的选中状态
                item.classList.add('selected');
                selectedText.textContent = option.label;
                select.dataset.value = option.value;
                dropdown.classList.remove('show');
                select.dispatchEvent(new CustomEvent('change', {
                    detail: { value: option.value }
                }));
            });
        });
        
        // 设置默认值和选中状态
        if (options.length > 0) {
            selectedText.textContent = options[0].label;
            select.dataset.value = options[0].value;
            dropdown.querySelector('.select-item')?.classList.add('selected');
        }
        
        // 点击显示/隐藏下拉列表
        select.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        
        // 点击其他地方关闭下拉列表
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });
        
        return container;
    }

    // 获取模板选项
    private async getTemplateOptions() {

        const templates = this.settingsManager.getVisibleTemplates();
        
        return templates.length > 0
            ? templates.map(t => ({ value: t.id, label: t.name }))
            : [{ value: 'default', label: '默认模板' }];
    }

    // 获取字体选项
    private getFontOptions() {
        return this.settingsManager.getFontOptions();
    }

    // 设置目录拖动调整大小功能
    private setupTocResize(handle: HTMLElement) {
        console.log('[Resize] Setting up resize handler', handle);
        
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;

        const onMouseDown = (e: MouseEvent) => {
            console.log('[Resize] Mouse down', e.clientY);
            if (!this.tocContainer) {
                console.log('[Resize] No tocContainer!');
                return;
            }
            
            isResizing = true;
            startY = e.clientY;
            startHeight = this.tocContainer.offsetHeight;
            
            console.log('[Resize] Start height:', startHeight);
            
            // 添加拖动时的样式
            document.body.classList.add('mp-resizing');
            handle.classList.add('mp-resizing');
            
            e.preventDefault();
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isResizing || !this.tocContainer) return;
            
            const deltaY = e.clientY - startY;
            const newHeight = startHeight + deltaY;
            
            // 限制最小和最大高度
            const minHeight = 100;
            const maxHeight = 800;  // 增加到 800px
            const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            
            console.log('[Resize] Moving:', { 
                startY, 
                currentY: e.clientY, 
                deltaY, 
                startHeight,
                newHeight, 
                clampedHeight,
                minHeight,
                maxHeight,
                isAtMax: newHeight >= maxHeight,
                isAtMin: newHeight <= minHeight
            });
            
            // 设置新高度 - 使用 setProperty 和 important 优先级
            this.tocContainer.style.setProperty('max-height', `${clampedHeight}px`, 'important');
            this.tocContainer.style.setProperty('height', `${clampedHeight}px`, 'important');
            
            console.log('[Resize] Applied styles:', {
                maxHeight: this.tocContainer.style.maxHeight,
                height: this.tocContainer.style.height,
                computedHeight: window.getComputedStyle(this.tocContainer).height
            });
            
            e.preventDefault();
        };

        const onMouseUp = () => {
            if (!isResizing) return;
            
            console.log('[Resize] Mouse up');
            isResizing = false;
            document.body.classList.remove('mp-resizing');
            handle.classList.remove('mp-resizing');
        };

        // 绑定事件
        console.log('[Resize] Binding events to handle');
        handle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        // 清理函数（在组件销毁时调用）
        this.register(() => {
            console.log('[Resize] Cleaning up');
            handle.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        });
    }

    // 切换目录显示/隐藏
    private toggleToc() {
        this.tocVisible = !this.tocVisible;
        
        if (this.tocContainer) {
            if (this.tocVisible) {
                this.tocContainer.removeClass('mp-toc-hidden');
                this.tocContainer.addClass('mp-toc-visible');
            } else {
                this.tocContainer.removeClass('mp-toc-visible');
                this.tocContainer.addClass('mp-toc-hidden');
            }
        }
        
        // 显示目录时更新内容
        if (this.tocVisible) {
            this.updateToc();
        }
    }

    // 更新目录内容
    private updateToc() {
        if (!this.tocContainer || !this.previewEl) return;
        
        this.tocContainer.empty();
        
        // 创建可滚动的内容区域
        const tocContent = this.tocContainer.createEl('div', { cls: 'mp-toc-content' });
        
        // 添加标题
        const tocTitle = tocContent.createEl('div', { 
            cls: 'mp-toc-title',
            text: '目录'
        });
        
        // 获取所有标题
        const headings = this.previewEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        if (headings.length === 0) {
            tocContent.createEl('div', {
                cls: 'mp-toc-empty',
                text: '文档中没有标题'
            });
            // 仍然添加拖动手柄
            const resizeHandle = this.tocContainer.createEl('div', { cls: 'mp-toc-resize-handle' });
            resizeHandle.createEl('div', { cls: 'mp-toc-resize-line' });
            this.setupTocResize(resizeHandle);
            return;
        }
        
        // 创建目录列表
        const tocList = tocContent.createEl('div', { cls: 'mp-toc-list' });
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1)); // h1 -> 1, h2 -> 2, etc.
            const text = heading.textContent || '';
            
            const tocItem = tocList.createEl('div', {
                cls: `mp-toc-item mp-toc-level-${level}`,
                text: text
            });
            
            // 添加点击事件，滚动到对应标题
            tocItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const targetElement = heading as HTMLElement;
                
                if (!this.previewEl || !targetElement) {
                    console.log('[TOC] Missing elements:', { 
                        previewEl: !!this.previewEl, 
                        targetElement: !!targetElement 
                    });
                    return;
                }
                
                console.log('[TOC] Clicking on:', text, 'Element:', targetElement);
                
                // 计算目标元素相对于previewEl的位置
                const previewTop = this.previewEl.scrollTop;
                const previewRect = this.previewEl.getBoundingClientRect();
                const targetRect = targetElement.getBoundingClientRect();
                
                // 目标位置 = 当前滚动位置 + 目标相对位置
                const targetScrollTop = previewTop + (targetRect.top - previewRect.top);
                
                console.log('[TOC] Scroll info:', {
                    previewTop,
                    previewRect: { top: previewRect.top, height: previewRect.height },
                    targetRect: { top: targetRect.top, height: targetRect.height },
                    targetScrollTop,
                    offset: targetScrollTop - 30
                });
                
                // 滚动到目标位置，留出30px的顶部空间
                this.previewEl.scrollTo({
                    top: Math.max(0, targetScrollTop - 30),
                    behavior: 'smooth'
                });
                
                // 高亮当前项
                tocList.querySelectorAll('.mp-toc-item').forEach(item => {
                    item.classList.remove('active');
                });
                tocItem.classList.add('active');
            });
        });
        
        // 添加拖动手柄到目录容器底部
        const resizeHandle = this.tocContainer.createEl('div', { cls: 'mp-toc-resize-handle' });
        resizeHandle.createEl('div', { cls: 'mp-toc-resize-line' });
        this.setupTocResize(resizeHandle);
    }

    // 设置滚动同步
    private setupScrollSync() {
        // 移除之前的滚动监听器
        if (this.editorScrollHandler) {
            const activeView = this.app.workspace.getActiveViewOfType(ItemView);
            if (activeView && 'editor' in activeView) {
                const editorView = activeView as any;
                const cm = editorView.editor?.cm;
                if (cm?.scrollDOM) {
                    cm.scrollDOM.removeEventListener('scroll', this.editorScrollHandler);
                }
            }
            this.editorScrollHandler = null;
        }

        if (!this.scrollSyncEnabled) return;

        // 获取当前活动的编辑器视图
        const activeView = this.app.workspace.getActiveViewOfType(ItemView);
        if (!activeView || !('editor' in activeView)) return;

        const editorView = activeView as any;
        const editor = editorView.editor;
        const cm = editor?.cm;
        if (!cm?.scrollDOM) return;

        // 创建编辑器滚动处理器
        this.editorScrollHandler = () => {
            if (!this.scrollSyncEnabled || !this.previewEl) return;

            try {
                // 获取编辑器滚动信息
                const scrollTop = cm.scrollDOM.scrollTop;
                const scrollHeight = cm.scrollDOM.scrollHeight;
                const clientHeight = cm.scrollDOM.clientHeight;

                // 计算滚动百分比
                const scrollPercentage = scrollHeight > clientHeight 
                    ? scrollTop / (scrollHeight - clientHeight) 
                    : 0;

                // 同步到预览窗口
                const previewScrollHeight = this.previewEl.scrollHeight;
                const previewClientHeight = this.previewEl.clientHeight;
                const targetScrollTop = scrollPercentage * (previewScrollHeight - previewClientHeight);

                requestAnimationFrame(() => {
                    if (this.previewEl) {
                        this.previewEl.scrollTop = targetScrollTop;
                    }
                });
            } catch (e) {
                console.error('[Scroll Sync] Error:', e);
            }
        };

        // 添加滚动监听
        cm.scrollDOM.addEventListener('scroll', this.editorScrollHandler, { passive: true });
    }

    // 清理资源
    async onClose() {
        // 移除编辑器滚动监听器
        if (this.editorScrollHandler) {
            const activeView = this.app.workspace.getActiveViewOfType(ItemView);
            if (activeView && 'editor' in activeView) {
                const editorView = activeView as any;
                const cm = editorView.editor?.cm;
                if (cm?.scrollDOM) {
                    cm.scrollDOM.removeEventListener('scroll', this.editorScrollHandler);
                }
            }
        }
    }
}