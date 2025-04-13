import { App, PluginSettingTab, Setting, setIcon, Notice } from 'obsidian';
import MPPlugin from '../main'; // 修改插件名以匹配类名
import { CreateTemplateModal } from './CreateTemplateModal';
import { CreateFontModal } from './CreateFontModal';
import { ConfirmModal } from './ConfirmModal'; // 添加确认模态框导入

export class MPSettingTab extends PluginSettingTab {
    plugin: MPPlugin; // 修改插件类型以匹配类名
    private expandedSections: Set<string> = new Set();

    constructor(app: App, plugin: MPPlugin) { // 修改插件类型以匹配类名
        super(app, plugin);
        this.plugin = plugin;
    }

    private createSection(containerEl: HTMLElement, title: string, renderContent: (contentEl: HTMLElement) => void) {
        const section = containerEl.createDiv('settings-section');
        const header = section.createDiv('settings-section-header');
        
        const toggle = header.createSpan('settings-section-toggle');
        setIcon(toggle, 'chevron-right');
        
        header.createEl('h4', { text: title });
        
        const content = section.createDiv('settings-section-content');
        renderContent(content);
        
        header.addEventListener('click', () => {
            const isExpanded = !section.hasClass('is-expanded');
            section.toggleClass('is-expanded', isExpanded);
            setIcon(toggle, isExpanded ? 'chevron-down' : 'chevron-right');
            if (isExpanded) {
                this.expandedSections.add(title);
            } else {
                this.expandedSections.delete(title);
            }
        });
        
        if (this.expandedSections.has(title) || (!containerEl.querySelector('.settings-section'))) {
            section.addClass('is-expanded');
            setIcon(toggle, 'chevron-down');
            this.expandedSections.add(title);
        }
        
        return section;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('mp-settings');

        containerEl.createEl('h2', { text: 'MP Preview 设置' });

        this.createSection(containerEl, '基本设置', el => this.renderBasicSettings(el));
        this.createSection(containerEl, '模板设置', el => this.renderTemplateSettings(el));
    }

    private renderTemplateSettings(containerEl: HTMLElement): void {    
        // 模板管理区域
        const templateList = containerEl.createDiv('template-management');
        // 渲染自定义模板
        templateList.createEl('h4', { text: '自定义模板', cls: 'template-custom-header' });
        this.plugin.settingsManager.getAllTemplates()
            .filter(template => !template.isPreset)
            .forEach(template => {
                const templateItem = templateList.createDiv('template-item');
                new Setting(templateItem)
                    .setName(template.name)
                    .setDesc(template.description)
                    .addExtraButton(btn => 
                        btn.setIcon('pencil')
                            .setTooltip('编辑')
                            .onClick(() => {
                                new CreateTemplateModal(
                                    this.app,
                                    (updatedTemplate) => {
                                        this.plugin.settingsManager.updateTemplate(template.id, updatedTemplate);
                                        this.display();
                                        new Notice('请重启 Obsidian 或重新加载以使更改生效');
                                    },
                                    template
                                ).open();
                            }))
                    .addExtraButton(btn => 
                        btn.setIcon('trash')
                            .setTooltip('删除')
                            .onClick(() => {
                                // 新增确认模态框
                                new ConfirmModal(
                                    this.app,
                                    '确认删除模板',
                                    `确定要删除「${template.name}」模板吗？此操作不可恢复。`,
                                    async () => {
                                        await this.plugin.settingsManager.removeTemplate(template.id);
                                        this.display();
                                        new Notice('请重启 Obsidian 或重新加载以使更改生效');
                                    }
                                ).open();
                            }));
            });
    
        // 添加新模板按钮
        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('+ 新建模板')
                .setCta()
                .onClick(() => {
                    new CreateTemplateModal(
                        this.app,
                        async (newTemplate) => {
                            await this.plugin.settingsManager.addCustomTemplate(newTemplate);
                            this.display();
                            new Notice('请重启 Obsidian 或重新加载以使更改生效');
                        }
                    ).open();
                }));
    }

    private renderBasicSettings(containerEl: HTMLElement): void {
        // 模板显示设置部分
        const templateVisibilitySection = containerEl.createDiv('mp-settings-subsection');
        const templateVisibilityHeader = templateVisibilitySection.createDiv('mp-settings-subsection-header');
        
        const templateVisibilityToggle = templateVisibilityHeader.createSpan('mp-settings-subsection-toggle');
        setIcon(templateVisibilityToggle, 'chevron-right');
        
        templateVisibilityHeader.createEl('h3', { text: '模板显示设置' });
        
        const templateVisibilityContent = templateVisibilitySection.createDiv('mp-settings-subsection-content');
        
        // 折叠/展开逻辑
        templateVisibilityHeader.addEventListener('click', () => {
            const isExpanded = !templateVisibilitySection.hasClass('is-expanded');
            templateVisibilitySection.toggleClass('is-expanded', isExpanded);
            setIcon(templateVisibilityToggle, isExpanded ? 'chevron-down' : 'chevron-right');
        });
    
        // 模板选择容器
        const templateSelectionContainer = templateVisibilityContent.createDiv('template-selection-container');
        
        // 左侧：所有模板列表
        const allTemplatesContainer = templateSelectionContainer.createDiv('all-templates-container');
        allTemplatesContainer.createEl('h4', { text: '隐藏模板' });
        const allTemplatesList = allTemplatesContainer.createDiv('templates-list');
        
        // 中间：控制按钮
        const controlButtonsContainer = templateSelectionContainer.createDiv('control-buttons-container');
        const addButton = controlButtonsContainer.createEl('button', { text: '>' });
        const removeButton = controlButtonsContainer.createEl('button', { text: '<' });
    
        // 右侧：显示的模板列表
        const visibleTemplatesContainer = templateSelectionContainer.createDiv('visible-templates-container');
        visibleTemplatesContainer.createEl('h4', { text: '显示模板' });
        const visibleTemplatesList = visibleTemplatesContainer.createDiv('templates-list');
        
        // 获取所有模板
        const allTemplates = this.plugin.settingsManager.getAllTemplates();
        
        // 渲染模板列表
        const renderTemplateLists = () => {
            // 清空列表
            allTemplatesList.empty();
            visibleTemplatesList.empty();
        
            // 填充左侧列表（所有未显示的模板）
            allTemplates
                .filter(template => template.isVisible === false)
                .forEach(template => {
                    const templateItem = allTemplatesList.createDiv('template-list-item');
                    templateItem.textContent = template.name;
                    templateItem.dataset.templateId = template.id;
                    
                    // 点击选中/取消选中
                    templateItem.addEventListener('click', () => {
                        templateItem.toggleClass('selected', !templateItem.hasClass('selected'));
                    });
                });
            
            // 填充右侧列表（所有显示的模板）
            allTemplates
                .filter(template => template.isVisible !== false) // 默认显示
                .forEach(template => {
                    const templateItem = visibleTemplatesList.createDiv('template-list-item');
                    templateItem.textContent = template.name;
                    templateItem.dataset.templateId = template.id;
                    
                    // 点击选中/取消选中
                    templateItem.addEventListener('click', () => {
                        templateItem.toggleClass('selected', !templateItem.hasClass('selected'));
                    });
                });
        };
        
        // 初始渲染
        renderTemplateLists();
        
        // 添加按钮事件
        addButton.addEventListener('click', async () => {
            const selectedItems = Array.from(allTemplatesList.querySelectorAll('.template-list-item.selected'));
            if (selectedItems.length === 0) return;
            
            for (const item of selectedItems) {
                const templateId = (item as HTMLElement).dataset.templateId;
                if (!templateId) continue;
                
                const template = allTemplates.find(t => t.id === templateId);
                if (template) {
                    template.isVisible = true;
                    await this.plugin.settingsManager.updateTemplate(templateId, template);
                }
            }
            
            renderTemplateLists();
            new Notice('请重启 Obsidian 或重新加载以使更改生效');
        });
        
        // 移除按钮事件
        removeButton.addEventListener('click', async () => {
            const selectedItems = Array.from(visibleTemplatesList.querySelectorAll('.template-list-item.selected'));
            if (selectedItems.length === 0) return;
            
            for (const item of selectedItems) {
                const templateId = (item as HTMLElement).dataset.templateId;
                if (!templateId) continue;
                
                const template = allTemplates.find(t => t.id === templateId);
                if (template) {
                    template.isVisible = false;
                    await this.plugin.settingsManager.updateTemplate(templateId, template);
                }
            }
            
            renderTemplateLists();
            new Notice('请重启 Obsidian 或重新加载以使更改生效');
        });
    
    
        // 字体管理区域
        const fontSection = containerEl.createDiv('mp-settings-subsection');
        const fontHeader = fontSection.createDiv('mp-settings-subsection-header');
        const fontToggle = fontHeader.createSpan('mp-settings-subsection-toggle');
        setIcon(fontToggle, 'chevron-right');
        
        fontHeader.createEl('h3', { text: '字体管理' });
        
        const fontContent = fontSection.createDiv('mp-settings-subsection-content');
        
        // 折叠/展开逻辑
        fontHeader.addEventListener('click', () => {
            const isExpanded = !fontSection.hasClass('is-expanded');
            fontSection.toggleClass('is-expanded', isExpanded);
            setIcon(fontToggle, isExpanded ? 'chevron-down' : 'chevron-right');
        });
    
        // 字体列表
        const fontList = fontContent.createDiv('font-management');
        this.plugin.settingsManager.getFontOptions().forEach(font => {
            const fontItem = fontList.createDiv('font-item');
            const setting = new Setting(fontItem)
                .setName(font.label)
                .setDesc(font.value);
    
            // 只为非预设字体添加编辑和删除按钮
            if (!font.isPreset) {
                setting
                    .addExtraButton(btn => 
                        btn.setIcon('pencil')
                            .setTooltip('编辑')
                            .onClick(() => {
                                new CreateFontModal(
                                    this.app,
                                    async (updatedFont) => {
                                        await this.plugin.settingsManager.updateFont(font.value, updatedFont);
                                        this.display();
                                        new Notice('请重启 Obsidian 或重新加载以使更改生效');
                                    },
                                    font
                                ).open();
                            }))
                    .addExtraButton(btn => 
                        btn.setIcon('trash')
                            .setTooltip('删除')
                            .onClick(() => {
                                // 新增确认模态框
                                new ConfirmModal(
                                    this.app,
                                    '确认删除字体',
                                    `确定要删除「${font.label}」字体配置吗？`,
                                    async () => {
                                        await this.plugin.settingsManager.removeFont(font.value);
                                        this.display();
                                        new Notice('请重启 Obsidian 或重新加载以使更改生效');
                                    }
                                ).open();
                            }));
            }
        });
    
        // 添加新字体按钮
        new Setting(fontContent)
            .addButton(btn => btn
                .setButtonText('+ 添加字体')
                .setCta()
                .onClick(() => {
                    new CreateFontModal(
                        this.app,
                        async (newFont) => {
                            await this.plugin.settingsManager.addCustomFont(newFont);
                            this.display();
                            new Notice('请重启 Obsidian 或重新加载以使更改生效');
                        }
                    ).open();
                }));
    }
}