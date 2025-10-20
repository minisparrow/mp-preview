import { App } from 'obsidian';
import { mmlToSvg, texToSvg } from './math/svgMath';

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

    // 将数学公式统一转换为内联 SVG，避免依赖页面样式（参考 WeWrite）
    this.renderMathToSvg(section);
    }

    private static processElements(container: HTMLElement | null): void {
        if (!container) return;
        // 处理列表项内部元素，用section包裹
        container.querySelectorAll('li').forEach(li => {
            // 创建section元素
            const section = document.createElement('section');
            // 将li的所有子元素移动到section中
            while (li.firstChild) {
                section.appendChild(li.firstChild);
            }
            // 将section添加到li中
            li.appendChild(section);
        });

        // 处理代码块
        container.querySelectorAll('pre').forEach(pre => {
            // 过滤掉 frontmatter
            if (pre.classList.contains('frontmatter')) {
                // 如果是 frontmatter，直接移除整个元素
                pre.remove();
                return;
            }
            
            const codeEl = pre.querySelector('code');
            if (codeEl) {
                // 添加 macOS 风格的窗口按钮
                const header = document.createElement('div');
                header.className = 'mp-code-header';

                // 添加三个窗口按钮
                for (let i = 0; i < 3; i++) {
                    const dot = document.createElement('span');
                    dot.className = 'mp-code-dot';
                    header.appendChild(dot);
                }

                pre.insertBefore(header, pre.firstChild);
                
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
                const linktext = src.split('|')[0];
                const file = this.app.metadataCache.getFirstLinkpathDest(linktext, '');
                if (file) {
                    const absolutePath = this.app.vault.adapter.getResourcePath(file.path);
                    const newImg = document.createElement('img');
                    newImg.src = absolutePath;
                    if (alt) newImg.alt = alt;
                    originalSpan.parentNode?.replaceChild(newImg, originalSpan);
                }
            } catch (error) {
                console.error('图片处理失败:', error);
            }
        });
    }

    // 将 MathJax/KaTeX 渲染结果替换为内联 SVG
    private static renderMathToSvg(container: HTMLElement) {
        const candidates = new Set<HTMLElement>();
        container.querySelectorAll('.math, .math-block, .katex, .katex-display, .MathJax, mjx-container, mjx-math').forEach(el => candidates.add(el as HTMLElement));
        console.log('[MP Converter] Found math candidates:', candidates.size);
        if (candidates.size === 0) return;

        const toOuterSvg = (el: HTMLElement): { svg?: string; display: boolean; tex?: string; mml?: string } => {
            // 判断是否块级数学
            const display = el.classList.contains('katex-display') || el.classList.contains('math-block') || el.tagName.toLowerCase() === 'mjx-container';

            console.log('[MP Converter] Analyzing element:', {
                tag: el.tagName,
                classes: Array.from(el.classList),
                innerHTML: el.innerHTML.substring(0, 300)
            });

            // 1) MathJax CHTML 的辅助 MathML
            const mml1 = el.querySelector('mjx-assistive-mml > math') as HTMLElement | null;
            if (mml1) {
                console.log('[MP Converter] Found mjx-assistive-mml > math');
                try { return { svg: mmlToSvg(mml1.outerHTML, display), display, mml: mml1.outerHTML }; } catch {}
            }
            // 2) KaTeX 的 MathML
            const mml2 = el.querySelector('.katex-mathml > math') as HTMLElement | null;
            if (mml2) {
                console.log('[MP Converter] Found .katex-mathml > math');
                try { return { svg: mmlToSvg(mml2.outerHTML, display), display, mml: mml2.outerHTML }; } catch {}
            }
            // 3) KaTeX annotation 中的 TeX
            const ann = el.querySelector('.katex-mathml annotation[encoding="application/x-tex"]') as HTMLElement | null;
            if (ann && ann.textContent) {
                console.log('[MP Converter] Found KaTeX annotation');
                try { return { svg: texToSvg(ann.textContent, display), display, tex: ann.textContent }; } catch {}
            }
            // 4) 已有内联 SVG
            const innerSvg = el.querySelector('svg');
            if (innerSvg) {
                console.log('[MP Converter] Found inline SVG');
                return { svg: innerSvg.outerHTML, display };
            }
            
            // 5) 尝试从 script[type="math/tex"] 提取（Obsidian 可能保存原始 TeX）
            const texScript = el.querySelector('script[type="math/tex"]') as HTMLElement | null;
            if (texScript && texScript.textContent) {
                console.log('[MP Converter] Found script[type="math/tex"]:', texScript.textContent.substring(0, 50));
                try { return { svg: texToSvg(texScript.textContent, display), display, tex: texScript.textContent }; } catch {}
            }
            
            console.warn('[MP Converter] No formula source found in element');
            return { display };
        };        // 仅替换外层容器，避免重复
        const list = Array.from(candidates).filter(el => !Array.from(candidates).some(other => other !== el && other.contains(el)));
        console.log('[MP Converter] Math elements to convert (deduplicated):', list.length);
        list.forEach(el => {
            const { svg, display, tex, mml } = toOuterSvg(el);
            console.log('[MP Converter] Converting:', {
                tag: el.tagName,
                classes: Array.from(el.classList),
                hasSvg: !!svg,
                hasTex: !!tex,
                hasMml: !!mml,
                display
            });
            if (svg) {
                const wrapper = document.createElement(display ? 'section' : 'span');
                wrapper.className = display ? 'mp-math-svg block-math' : 'mp-math-svg inline-math';
                if (tex) { 
                    wrapper.setAttribute('data-formula', tex); 
                    wrapper.setAttribute('data-encoding', 'tex'); 
                    console.log('[MP Converter] Set TeX formula:', tex.substring(0, 50));
                }
                else if (mml) { 
                    wrapper.setAttribute('data-formula', mml); 
                    wrapper.setAttribute('data-encoding', 'mml'); 
                    console.log('[MP Converter] Set MathML formula:', mml.substring(0, 50));
                }
                wrapper.innerHTML = svg;
                // 清理原节点，替换为纯 SVG
                el.parentElement?.replaceChild(wrapper, el);
                console.log('[MP Converter] Replaced with wrapper:', wrapper.className);
            }
        });
    }
}