import { App } from 'obsidian';

export class MPConverter {
    private static app: App;

    static initialize(app: App) {
        this.app = app;
    }

    static formatContent(element: HTMLElement): void {
        // 创建 section 容器
        const section = document.createElement('section');
        section.className = 'mp-content-section';
        // 移动原有内容到 section 中
        while (element.firstChild) {
            section.appendChild(element.firstChild);
        }
        element.appendChild(section);

        // 处理元素
        this.processElements(section);
    }

    private static processElements(container: HTMLElement | null): void {
        if (!container) return;

        // 处理强调文本
        container.querySelectorAll('strong, em').forEach(el => {
            (el as HTMLElement).style.display = 'inline';
        });

        // 处理链接
        container.querySelectorAll('a').forEach(el => {
            (el as HTMLElement).style.color = '#576b95';
            (el as HTMLElement).style.textDecoration = 'none';
        });

        // 处理表格
        container.querySelectorAll('table').forEach(el => {
            if (el === container.closest('table')) return;
            (el as HTMLTableElement).style.borderCollapse = 'collapse';
            (el as HTMLTableElement).style.margin = '1em 0';
            (el as HTMLTableElement).style.width = '100%';
        });

        // 处理表格单元格
        container.querySelectorAll('th, td').forEach(el => {
            if (el === container.closest('td')) return;
            (el as HTMLTableCellElement).style.border = '1px solid #dfdfdf';
            (el as HTMLTableCellElement).style.padding = '8px';
        });

        // 处理分割线
        container.querySelectorAll('hr').forEach(el => {
            (el as HTMLElement).style.border = 'none';
            (el as HTMLElement).style.borderTop = '1px solid #dfdfdf';
            (el as HTMLElement).style.margin = '20px 0';
        });

        // 处理删除线
        container.querySelectorAll('del').forEach(el => {
            (el as HTMLElement).style.textDecoration = 'line-through';
        });

        // 处理任务列表
        container.querySelectorAll('.task-list-item').forEach(el => {
            (el as HTMLElement).style.listStyle = 'none';
            const checkbox = el.querySelector('input[type="checkbox"]');
            if (checkbox) {
                (checkbox as HTMLElement).style.marginRight = '6px';
            }
        });

        // 处理脚注
        container.querySelectorAll('.footnote-ref, .footnote-backref').forEach(el => {
            (el as HTMLElement).style.color = '#576b95';
            (el as HTMLElement).style.textDecoration = 'none';
        });

        // 处理代码块
        container.querySelectorAll('pre code').forEach(el => {
            const pre = el.parentElement;
            if (pre) {
                // 添加 macOS 风格的窗口按钮
                const dots = document.createElement('div');
                dots.style.cssText = `
                    margin: 8px 0 12px 0;
                    display: flex;
                    gap: 6px;
                `;

                const colors = ['#ff5f56', '#ffbd2e', '#27c93f'];
                colors.forEach(color => {
                    const dot = document.createElement('span');
                    dot.style.cssText = `
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        background-color: ${color};
                    `;
                    dots.appendChild(dot);
                });

                // 将红绿灯插入到代码块的最前面
                pre.insertBefore(dots, pre.firstChild);
                pre.style.paddingTop = '32px';
                
                // 移除原有的复制按钮
                const copyButton = pre.querySelector('.copy-code-button');
                if (copyButton) {
                    copyButton.remove();
                }
            }
        });

        // 处理图片
        container.querySelectorAll('span.internal-embed[alt][src]').forEach(async el => {
            const originalSpan = el as HTMLElement;
            const src = originalSpan.getAttribute('src');
            const alt = originalSpan.getAttribute('alt');
            
            if (!src) return;
            
            try {
                // 获取文件的元数据
                const linktext = src.split('|')[0];  // 处理可能带有别名的链接
                const file = this.app.metadataCache.getFirstLinkpathDest(linktext, '');
                if (file) {
                    const absolutePath = this.app.vault.adapter.getResourcePath(file.path);
                    const newImg = document.createElement('img');
                    newImg.src = absolutePath;
                    if (alt) newImg.alt = alt;
                    
                    // 应用样式
                    newImg.style.maxWidth = '100%';
                    newImg.style.height = 'auto';
                    newImg.style.display = 'block';
                    newImg.style.margin = '1em auto';
                    
                    // 直接替换 span 元素，保留段落中的其他内容
                    originalSpan.parentNode?.replaceChild(newImg, originalSpan);
                }
            } catch (error) {
                console.error('图片处理失败:', error);
            }
        });

        // 处理引用块
        container.querySelectorAll('blockquote').forEach(el => {
            // 清理引用块内部段落的样式
            el.querySelectorAll('p').forEach(p => {
                p.style.margin = '0';
                p.style.padding = '0';
                p.style.lineHeight = 'inherit';
            });
        });
    }
}