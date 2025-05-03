import { App, Modal } from 'obsidian';
import { TemplateManager } from '../templateManager';

export class TemplatePreviewModal extends Modal {
    private template: any;
    private templateManager: TemplateManager;

    constructor(app: App, template: any, templateManager: TemplateManager) {
        super(app);
        this.template = template;
        this.templateManager = templateManager;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('template-preview-modal');

        // 添加标题
        contentEl.createEl('h2', { text: `模板预览: ${this.template.name}`, cls: 'mp-template-title' });

        // 添加预览区域
        const container = contentEl.createDiv('tp-mp-preview-area');
        const content = container.createDiv('tp-mp-content-section');

        // 标题样式
        content.createEl('h2', { text: '探索夜半插件的无限可能'});
        content.createEl('h3', { text: '探索我的插件，让您的笔记发布变得更加轻松！'});

        // 段落样式
        const paragraph1 = content.createEl('p');
        paragraph1.createEl('span', { text: '插件为您提供各种' });
        paragraph1.createEl('strong', { text: '优雅的操作，' });
        paragraph1.createEl('span', { text: '助您轻松发布笔记。' });

        const paragraph2 = content.createEl('p');
        paragraph2.createEl('span', { text: '通过插件，您可以快速组织内容，' });
        paragraph2.createEl('em', { text: '提升工作效率。' });

        content.createEl('hr');

        // 列表样式
        const list = content.createEl('ol');
        list.createEl('li', { text: '轻松定制模板样式' });
        list.createEl('li', { text: '实时预览模板效果' });

        // 引用样式
        const quote = content.createEl('blockquote');
        quote.createEl('p', { text: '“让笔记发帖变得如此简单。”' });

        // 代码样式
        const codeBlock = content.createEl('pre');
        const header = codeBlock.createDiv('mp-code-header'); // 添加窗口按钮
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.className = 'mp-code-dot';
            header.appendChild(dot);
        }
        codeBlock.insertBefore(header, codeBlock.firstChild);
        codeBlock.createEl('code', { text: 'console.log("欢迎使用夜半插件！");' });

        // 添加打赏引导文案
        content.createEl('strong', { text: '如果您觉得我的插件对您有帮助，请打赏支持我。'});

        // 分隔线样式
        content.createEl('hr');

        this.templateManager.applyTemplate(container, this.template);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}