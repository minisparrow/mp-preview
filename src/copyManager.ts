import { Notice } from 'obsidian';

export class CopyManager {
    private static cleanupHtml(element: HTMLElement): string {
        const clone = element.cloneNode(true) as HTMLElement;
        
        // 使用 DOM API 移除属性
        clone.querySelectorAll('*').forEach(el => {
            // 移除所有非样式属性
            Array.from(el.attributes)
                .filter(attr => !attr.name.startsWith('style'))
                .forEach(attr => el.removeAttribute(attr.name));
                
            // 检查并清理 style 属性中的潜在危险内容
            if (el.hasAttribute('style')) {
                const style = el.getAttribute('style');
                if (style?.includes('javascript:') || style?.includes('expression(')) {
                    el.removeAttribute('style');
                }
            }

            // 移除可能包含脚本的元素
            if (el.tagName.toLowerCase() === 'script' || el.tagName.toLowerCase() === 'iframe') {
                el.remove();
            }
        });

        const serializer = new XMLSerializer();
        return serializer.serializeToString(clone);
    }

    private static async processImages(container: HTMLElement): Promise<void> {
        const images = container.querySelectorAll('img');
        const imageArray = Array.from(images);
        
        for (const img of imageArray) {
            try {
                const response = await fetch(img.src);
                const blob = await response.blob();
                const reader = new FileReader();
                await new Promise((resolve, reject) => {
                    reader.onload = () => {
                        img.src = reader.result as string;
                        resolve(null);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error('图片转换失败:', error);
            }
        }
    }

    public static async copyToClipboard(element: HTMLElement): Promise<void> {
        try {
            const clone = element.cloneNode(true) as HTMLElement;
            await this.processImages(clone);

            // 使用新的 cleanupHtml 方法
            const cleanHtml = this.cleanupHtml(clone);
            
            const clipData = new ClipboardItem({
                'text/html': new Blob([cleanHtml], { type: 'text/html' }),
                'text/plain': new Blob([clone.textContent || ''], { type: 'text/plain' })
            });

            await navigator.clipboard.write([clipData]);
            new Notice('已复制到剪贴板');
        } catch (error) {
            new Notice('复制失败');
        }
    }
}