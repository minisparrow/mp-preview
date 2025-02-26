import { App } from 'obsidian';

interface Template {
    id: string;
    name: string;
    styles: {
        container: string;
        title: {
            h1: string;
            h2: string;
            h3: string;
            base: string;
        };
        paragraph: string;
        list: {
            container: string;
            item: string;
            taskList: string;
        };
        quote: string;
        code: {
            block: string;
            inline: string;
        };
        image: string;
        link: string;
        emphasis: {
            strong: string;
            em: string;
            del: string;
        };
        table: {
            container: string;
            header: string;
            cell: string;
        };
        hr: string;
        footnote: {
            ref: string;
            backref: string;
        };
    };
}

export class TemplateManager {
    private templates: Map<string, Template> = new Map();
    private currentTemplate: Template;
    private currentFont: string = '-apple-system';
    private currentFontSize: number = 16;
    private app: App;

    constructor(app: App) {
        this.app = app;
        this.loadTemplates(); // 加载模板
    }

    public async loadTemplates() {
        try {
            const configDir = this.app.vault.configDir;
            const templatesPath = `${configDir}/plugins/obsidian-to-mp/templates`;
            
            // 加载默认模板
            const defaultTemplate = JSON.parse(
                await this.app.vault.adapter.read(`${templatesPath}/default.json`)
            );
            this.templates.set(defaultTemplate.id, defaultTemplate);
            this.currentTemplate = defaultTemplate;

            // 加载极简主题
            const minimalTemplate = JSON.parse(
                await this.app.vault.adapter.read(`${templatesPath}/minimal.json`)
            );
            this.templates.set(minimalTemplate.id, minimalTemplate);

            // 加载优雅主题
            const elegantTemplate = JSON.parse(
                await this.app.vault.adapter.read(`${templatesPath}/elegant.json`)
            );
            this.templates.set(elegantTemplate.id, elegantTemplate);

            // 加载深色主题
            const darkTemplate = JSON.parse(
                await this.app.vault.adapter.read(`${templatesPath}/dark.json`)
            );
            this.templates.set(darkTemplate.id, darkTemplate);

            // 加载学术主题
            const academicTemplate = JSON.parse(
                await this.app.vault.adapter.read(`${templatesPath}/academic.json`)
            );
            this.templates.set(academicTemplate.id, academicTemplate);
            
        } catch (error) {
            console.error('加载模板失败:', error);
            throw new Error('无法加载模板文件');
        }
    }

    public getTemplate(id: string): Template | undefined {
        return this.templates.get(id);
    }

    public getCurrentTemplate(): Template {
        return this.currentTemplate;
    }

    public setCurrentTemplate(id: string): boolean {
        const template = this.templates.get(id);
        if (template) {
            this.currentTemplate = template;
            return true;
        }
        return false;
    }

    public getAllTemplates(): Template[] {
        return Array.from(this.templates.values());
    }

    public setFont(fontFamily: string) {
        this.currentFont = fontFamily;
    }

    public setFontSize(size: number) {
        this.currentFontSize = size;
    }

    public applyTemplate(element: HTMLElement): void {
        const styles = this.currentTemplate.styles;
        const table = element.querySelector('table');
        const td = element.querySelector('td');
        
        if (!table || !td) return;

        // 应用容器样式到表格
        table.setAttribute('style', styles.container);
        table.setAttribute('cellpadding', '0');
        table.setAttribute('cellspacing', '0');
        
        // 应用基础样式到单元格
        td.style.cssText = `
            word-break: break-all;
            padding: 0;
            margin: 0;
            line-height: 1.7;
            overflow-wrap: break-word;
            white-space: normal;
            border: none;
            font-family: ${this.currentFont};
        `;
        
        // 应用标题样式
        td.querySelectorAll('h1').forEach(el => {
            el.setAttribute('style', `${styles.title.h1}; font-family: ${this.currentFont};`);
        });
        td.querySelectorAll('h2').forEach(el => {
            el.setAttribute('style', `${styles.title.h2}; font-family: ${this.currentFont};`);
        });
        td.querySelectorAll('h3').forEach(el => {
            el.setAttribute('style', `${styles.title.h3}; font-family: ${this.currentFont};`);
        });
        td.querySelectorAll('h4, h5, h6').forEach(el => {
            el.setAttribute('style', `${styles.title.base}; font-family: ${this.currentFont};`);
        });

        // 应用段落样式
        td.querySelectorAll('p').forEach(el => {
            // 检查是否为最外层段落
            if (!el.parentElement?.closest('p') && !el.parentElement?.closest('blockquote')) {
                el.setAttribute('style', `${styles.paragraph}; font-family: ${this.currentFont}; font-size: ${this.currentFontSize}px;`);
            }
        });

        // 应用列表样式
        td.querySelectorAll('ul, ol').forEach(el => {
            el.setAttribute('style', styles.list.container);
        });
        td.querySelectorAll('li').forEach(el => {
            el.setAttribute('style', `${styles.list.item}; font-family: ${this.currentFont}; font-size: ${this.currentFontSize}px;`);
        });
        td.querySelectorAll('.task-list-item').forEach(el => {
            el.setAttribute('style', `${styles.list.taskList}; font-family: ${this.currentFont}; font-size: ${this.currentFontSize}px;`);
        });

        // 应用引用样式
        td.querySelectorAll('blockquote').forEach(el => {
            el.setAttribute('style', `${styles.quote}; font-family: ${this.currentFont}; font-size: ${this.currentFontSize}px;`);
        });

        // 应用代码样式
        td.querySelectorAll('pre').forEach(el => {
            el.setAttribute('style', `${styles.code.block}; font-size: ${this.currentFontSize}px;`);
        });
        td.querySelectorAll('code:not(pre code)').forEach(el => {
            el.setAttribute('style', `${styles.code.inline}; font-size: ${this.currentFontSize}px;`);
        });

        // 应用链接样式
        td.querySelectorAll('a').forEach(el => {
            el.setAttribute('style', styles.link);
        });

        // 应用强调样式
        td.querySelectorAll('strong').forEach(el => {
            el.setAttribute('style', styles.emphasis.strong);
        });
        td.querySelectorAll('em').forEach(el => {
            el.setAttribute('style', styles.emphasis.em);
        });
        td.querySelectorAll('del').forEach(el => {
            el.setAttribute('style', styles.emphasis.del);
        });

        // 应用表格样式
        td.querySelectorAll('table').forEach(el => {
            if (el === table) return; // 跳过包裹表格
            el.setAttribute('style', styles.table.container);
        });
        td.querySelectorAll('th').forEach(el => {
            el.setAttribute('style', `${styles.table.header}; font-family: ${this.currentFont}; font-size: ${this.currentFontSize}px;`);
        });
        td.querySelectorAll('td').forEach(el => {
            if (el === td) return; // 跳过包裹单元格
            el.setAttribute('style', `${styles.table.cell}; font-family: ${this.currentFont}; font-size: ${this.currentFontSize}px;`);
        });

        // 应用分割线样式
        td.querySelectorAll('hr').forEach(el => {
            el.setAttribute('style', styles.hr);
        });

        // 应用脚注样式
        td.querySelectorAll('.footnote-ref').forEach(el => {
            el.setAttribute('style', styles.footnote.ref);
        });
        td.querySelectorAll('.footnote-backref').forEach(el => {
            el.setAttribute('style', styles.footnote.backref);
        });

        // 应用图片样式
        td.querySelectorAll('img').forEach(el => {
            const img = el as HTMLImageElement;
            // 应用基础样式
            el.setAttribute('style', `${styles.image}; font-family: ${this.currentFont};`);
            
            // 如果图片是段落中唯一的元素，才设置居中
            const parent = img.parentElement;
            if (parent && parent.tagName.toLowerCase() === 'p') {
                if (parent.childNodes.length === 1) {
                    parent.style.textAlign = 'center';
                    parent.style.margin = '1em 0';
                }
            }
        });

        // 更新代码块样式应用
        td.querySelectorAll('pre').forEach(el => {
            el.setAttribute('style', `${styles.code.block};`);
        });

        // 更新引用块样式应用
        td.querySelectorAll('blockquote').forEach(el => {
            el.setAttribute('style', `${styles.quote};`);
        });

        // 更新列表样式应用
        td.querySelectorAll('ul, ol').forEach(el => {
            el.setAttribute('style', `${styles.list.container}; font-family: ${this.currentFont};`);
        });
        td.querySelectorAll('li').forEach(el => {
            el.setAttribute('style', `${styles.list.item}; font-family: ${this.currentFont}; font-size: ${this.currentFontSize}px;`);
        });
    }
}

export const templateManager = (app: App) => new TemplateManager(app);
