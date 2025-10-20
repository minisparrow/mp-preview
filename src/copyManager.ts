import { Notice, normalizePath } from 'obsidian';
import { nanoid } from './utils/nanoid';
import { mmlToSvg, texToSvg } from './math/svgMath';

export class CopyManager {
    // 将 SVG 字符串栅格化为 PNG data URL
    private static async svgToPngDataUrl(svgContent: string, sizeReference?: HTMLElement): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            try {
                // 使用 3x 缩放以获得高清图片（类似 Retina 屏幕）
                const scale = 3;
                
                // 计算栅格化尺寸
                let targetW = 300;
                let targetH = 100;
                
                if (sizeReference) {
                    const rect = sizeReference.getBoundingClientRect();
                    if (rect.width && rect.height) {
                        targetW = Math.ceil(rect.width);
                        targetH = Math.ceil(rect.height);
                    }
                }
                
                // 从 SVG 内容解析 viewBox
                if (!targetW || targetW < 10 || !targetH || targetH < 10) {
                    const m = /viewBox\s*=\s*"[\d\.\s-]+\s+[\d\.\s-]+\s+([\d\.]+)\s+([\d\.]+)"/i.exec(svgContent);
                    if (m) {
                        const vw = parseFloat(m[1]);
                        const vh = parseFloat(m[2]);
                        if (vw && vh) { targetW = Math.ceil(vw); targetH = Math.ceil(vh); }
                    }
                }
                
                // 确保最小尺寸
                targetW = Math.max(10, targetW);
                targetH = Math.max(10, targetH);
                
                // 应用缩放比例
                const canvasW = targetW * scale;
                const canvasH = targetH * scale;
                
                console.log(`[MP] Rasterizing SVG to PNG, display size: ${targetW}x${targetH}, canvas size: ${canvasW}x${canvasH} (${scale}x scale)`);
                
                // 通过 data: URI 加载 SVG
                const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgContent)));
                const img = new Image();
                
                img.onload = () => {
                    console.log('[MP] SVG loaded, drawing to canvas...');
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = canvasW;
                        canvas.height = canvasH;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            reject(new Error('Canvas context unavailable'));
                            return;
                        }
                        
                        // 启用高质量渲染
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        
                        // 白色背景
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvasW, canvasH);
                        
                        // 绘制 SVG（缩放到 canvas 尺寸）
                        ctx.drawImage(img, 0, 0, canvasW, canvasH);
                        
                        // 导出为 PNG，质量设为最高
                        const pngDataUrl = canvas.toDataURL('image/png');
                        console.log('[MP] High-resolution PNG generated, length:', pngDataUrl.length);
                        resolve(pngDataUrl);
                    } catch (e) {
                        console.error('[MP] Canvas draw failed:', e);
                        reject(e);
                    }
                };
                
                img.onerror = (e) => {
                    console.error('[MP] SVG load error:', e);
                    reject(new Error('Failed to load SVG'));
                };
                
                img.src = svgDataUrl;
            } catch (e) {
                console.error('[MP] svgToPngDataUrl error:', e);
                reject(e);
            }
        });
    }

    // 从 Markdown 源码中提取所有数学公式
    private static extractFormulasFromMarkdown(markdown: string): string[] {
        const formulas: string[] = [];
        
        // 提取块级公式 $$...$$
        const blockRegex = /\$\$([\s\S]+?)\$\$/g;
        let match;
        while ((match = blockRegex.exec(markdown)) !== null) {
            formulas.push(match[1].trim());
        }
        
        // 提取行内公式 $...$（但不包括 $$）
        const inlineRegex = /(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g;
        const lines = markdown.split('\n');
        for (const line of lines) {
            // 跳过代码块
            if (line.trim().startsWith('```') || line.trim().startsWith('~~~')) continue;
            
            let inlineMatch;
            while ((inlineMatch = inlineRegex.exec(line)) !== null) {
                formulas.push(inlineMatch[1].trim());
            }
        }
        
        console.log('[MP] Extracted formulas from markdown:', formulas.length, formulas);
        return formulas;
    }

    private static async cleanupHtml(element: HTMLElement, renderMathAsImage: boolean = true, formulas: string[] = []): Promise<string> {
        // 创建克隆以避免修改原始元素
        const clone = element.cloneNode(true) as HTMLElement;

        // 移除所有的 data-* 属性，但保留 data-formula 和 data-encoding 以便后续插入原公式文本
        clone.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('data-')) {
                    const n = attr.name.toLowerCase();
                    if (n === 'data-formula' || n === 'data-encoding') return;
                    el.removeAttribute(attr.name);
                }
            });
        });

        // 处理 class/id 属性：保留与数学渲染相关的 class（KaTeX/MathJax 等），移除其它 class
        const allowedClasses = new Set([
            'katex', 'katex-display', 'katex-html', 'katex-mathml',
            'math', 'math-inline', 'math-display', 'MathJax', 'mp-math-svg', 'inline-math', 'block-math'
        ]);
        const allowedPrefixes = ['katex', 'math', 'mjx', 'MathJax', 'mp-'];

        clone.querySelectorAll('*').forEach(el => {
            // 处理 class
            if (el.hasAttribute('class')) {
                const classes = Array.from(el.classList) as string[];
                const keep = classes.filter((c: string) => {
                    if (allowedClasses.has(c)) return true;
                    return allowedPrefixes.some(prefix => c.startsWith(prefix));
                });

                if (keep.length > 0) {
                    el.setAttribute('class', keep.join(' '));
                } else {
                    el.removeAttribute('class');
                }
            }

            // 移除 id
            if (el.hasAttribute('id')) {
                el.removeAttribute('id');
            }
        });

    // 为保留的数学渲染相关元素内联计算样式（避免粘贴到目标编辑器时缺少 KaTeX/MathJax 的 CSS）
    // 准备一个外部变量以便后续注入 debug 信息（确保在任何分支都可访问）
    let mathElsForDebug: HTMLElement[] = [];

    // 将 clone 放到隐藏容器中，保证后续计算样式与尺寸、渲染为图片时有布局环境
    let tempContainer: HTMLDivElement | null = null;
    try {
            // 把 clone 放入一个不可见但可计算样式的临时容器
            tempContainer = document.createElement('div');
            tempContainer.style.position = 'fixed';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '0';
            tempContainer.style.visibility = 'hidden';
            document.body.appendChild(tempContainer);
            tempContainer.appendChild(clone);

            // 只为 class 名称匹配允许前缀的元素或特殊标签（如 MathJax 的 mjx-* 元素、svg、math）拷贝计算样式
            const mathElements = Array.from(clone.querySelectorAll('*')).filter(el => {
                const classes = Array.from(el.classList || []);
                const tag = (el.tagName || '').toLowerCase();
                const isMathTag = tag.startsWith('mjx') || tag === 'svg' || tag === 'math';
                return classes.some(c => allowedPrefixes.some(p => c.startsWith(p)) || allowedClasses.has(c)) || isMathTag;
            }) as HTMLElement[];

            // 记录匹配到的数学节点（用于后续 debug）
            mathElsForDebug = Array.from(mathElements);

            mathElements.forEach(el => {
                const cs = window.getComputedStyle(el);
                // 将所有计算得到的样式内联
                for (let i = 0; i < cs.length; i++) {
                    const prop = cs[i];
                    const val = cs.getPropertyValue(prop);
                    try {
                        el.style.setProperty(prop, val);
                    } catch (e) {
                        // 忽略不能设置的属性
                    }
                }
            });

            // 注意：不要在这里移除临时容器，后面还需要计算数学元素尺寸并渲染为图片
        } catch (e) {
            // 如果在无 DOM 环境失败，静默忽略（保留原有类以供目标端处理）
            console.error('Inline math styles failed:', e);
        }

            // 已在 converter 阶段生成内联 SVG，此处通常不再转图片
            console.log('[MP] renderMathAsImage:', renderMathAsImage);
            if (renderMathAsImage) {
        try {
            // 仅查找常见的数学容器（避免误伤整段文字）：
            // - Obsidian/Markdown 渲染包装：.math, .math-block
            // - KaTeX 容器：.katex, .katex-display
            // - MathJax 容器：.MathJax, mjx-container, mjx-math
            const selectors = [
                '.math', '.math-block', '.katex', '.katex-display', '.MathJax',
                'mjx-container', 'mjx-math', '.mp-math-svg'
            ];

            const found = new Set<HTMLElement>();
            selectors.forEach(s => {
                const els = clone.querySelectorAll(s);
                console.log(`[MP] Selector "${s}" found ${els.length} elements`);
                els.forEach(el => found.add(el as HTMLElement));
            });

            const candidates = Array.from(found) as HTMLElement[];
            console.log('[MP] Total math candidates found:', candidates.length);

            // 仅选择外层数学包装元素，避免重复/嵌套转换（例如 span.math 包含 mjx-container 时，只转换 span.math）
            const mathEls: HTMLElement[] = candidates.filter(el => 
                !candidates.some(other => other !== el && other.contains(el))
            );
            
            console.log('[MP] Math elements to convert (after dedup):', mathEls.length);
            mathEls.forEach((el, i) => {
                console.log(`[MP] Math #${i}:`, {
                    tag: el.tagName,
                    classes: Array.from(el.classList),
                    hasFormula: !!el.getAttribute('data-formula'),
                    formula: el.getAttribute('data-formula')?.substring(0, 50),
                    encoding: el.getAttribute('data-encoding')
                });
            });

            // 尝试把外部字体 / 资源内联到这些元素中以减少 canvas 被污染的概率
            try {
                await CopyManager.inlineFontsForElements(mathEls);
            } catch (e) {
                // inline fonts 非关键路径，继续即可
                console.warn('Inline fonts failed (continuing):', e);
            }

        // 并行转换并替换为图片，同时收集每个元素的转换结果用于调试
            const debugResults: Array<{ tag: string; classes: string[]; outerBefore: string; convertedTo: string; imgSrc?: string; error?: string }> = [];
            let formulaIndex = 0; // 用于跟踪当前使用的公式索引
            await Promise.all(mathEls.map(async (el) => {
                const before = { tag: el.tagName, classes: Array.from(el.classList || []), outer: el.outerHTML };
                try {
            // 在渲染为图片前，对该数学元素及所有子元素内联计算样式，确保 foreignObject 渲染不依赖外部 CSS
            try { CopyManager.inlineComputedStylesDeep(el); } catch {}
                    // 若为 MathJax CHTML，::before 伪元素承载字符，需转为真实文本节点以避免样式缺失导致空白
                    try { CopyManager.inlineMathJaxCHTMLGlyphs(el); } catch {}
                    
                    // 直接从原始 MathJax/KaTeX DOM 中提取公式源码
                    let formula = '';
                    let encoding = 'tex'; // 默认 TeX
                    let formulaSvg: string | null = null;
                    
                    // 优先：如果传入了 Markdown 源中提取的公式列表，直接使用并转换为 SVG
                    if (formulas.length > formulaIndex) {
                        formula = formulas[formulaIndex];
                        encoding = 'tex';
                        console.log(`[MP] Using formula from markdown source [${formulaIndex}]:`, formula.substring(0, 80));
                        
                        // 判断是否块级（检查原始类名）
                        const isBlock = before.classes.includes('math-block') || before.classes.includes('katex-display') || before.tag.toUpperCase() === 'MJX-CONTAINER';
                        
                        // 用 headless MathJax 转为 SVG
                        try {
                            formulaSvg = texToSvg(formula, isBlock);
                            console.log(`[MP] Converted TeX to SVG (${isBlock ? 'block' : 'inline'}), length:`, formulaSvg.length);
                        } catch (e) {
                            console.error('[MP] Failed to convert TeX to SVG:', e);
                        }
                        
                        formulaIndex++;
                    } else {
                        // 回退：尝试从 DOM 提取
                        console.log('[MP] No markdown formula available, trying DOM extraction...');
                        
                        // 优先从 data 属性读取（如果 converter 已经设置）
                        formula = (el.getAttribute('data-formula') || (el.querySelector('[data-formula]') as HTMLElement | null)?.getAttribute('data-formula')) || '';
                        encoding = (el.getAttribute('data-encoding') || (el.querySelector('[data-encoding]') as HTMLElement | null)?.getAttribute('data-encoding')) || 'tex';
                        
                        // 如果没有 data 属性，从 MathJax/KaTeX 的内部结构提取
                        if (!formula) {
                            // MathJax CHTML: 从辅助 MathML 提取（更多选择器）
                            const mmlSelectors = [
                                'mjx-assistive-mml > math',
                                'mjx-container mjx-assistive-mml > math',
                                '.MathJax mjx-assistive-mml > math',
                                'mjx-assistive-mml math',
                                '.MathJax_MathML > math',
                                'script[type="math/mml"]'
                            ];
                            
                            for (const sel of mmlSelectors) {
                                const mmlEl = el.querySelector(sel) as HTMLElement | null;
                                if (mmlEl) {
                                    if (mmlEl.tagName.toLowerCase() === 'script') {
                                        formula = mmlEl.textContent || '';
                                    } else {
                                        formula = mmlEl.outerHTML;
                                    }
                                    encoding = 'mml';
                                    console.log(`[MP] Extracted MathML using selector "${sel}":`, formula.substring(0, 80));
                                    break;
                                }
                            }
                            
                            // KaTeX: 从 annotation 提取 TeX
                            if (!formula) {
                                const ann = el.querySelector('.katex-mathml annotation[encoding="application/x-tex"]') as HTMLElement | null;
                                if (ann && ann.textContent) {
                                    formula = ann.textContent;
                                    encoding = 'tex';
                                    console.log('[MP] Extracted TeX from KaTeX:', formula.substring(0, 80));
                                }
                            }
                            
                            // KaTeX: 从 MathML 提取
                            if (!formula) {
                                const katexMml = el.querySelector('.katex-mathml > math') as HTMLElement | null;
                                if (katexMml) {
                                    formula = katexMml.outerHTML;
                                    encoding = 'mml';
                                    console.log('[MP] Extracted MathML from KaTeX:', formula.substring(0, 80));
                                }
                            }
                            
                            // 尝试查找任何 <math> 标签
                            if (!formula) {
                                const anyMath = el.querySelector('math') as HTMLElement | null;
                                if (anyMath) {
                                    formula = anyMath.outerHTML;
                                    encoding = 'mml';
                                    console.log('[MP] Extracted MathML from any <math> tag:', formula.substring(0, 80));
                                }
                            }
                        }
                    }
                    
                    // 生成图片：优先使用 SVG（矢量格式，无限清晰），回退到 PNG
                    let dataUrl: string;
                    let useSvg = true; // 默认使用 SVG
                    
                    if (formulaSvg) {
                        console.log('[MP] Using formula SVG directly (vector format, infinitely sharp)');
                        // 直接使用 SVG base64
                        dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(formulaSvg)));
                    } else {
                        // 回退：从 DOM 提取并尝试转 PNG
                        useSvg = false;
                        dataUrl = await CopyManager.elementToPngDataUrl(el);
                    }
                    console.log(`[MP] Generated image for math #${mathEls.indexOf(el)} (${useSvg ? 'SVG' : 'PNG'}):`, dataUrl.substring(0, 100));
                    
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    img.alt = formula || el.textContent || '';
                    
                    // 设置为行内样式，与周围文字大小一致
                    try {
                        const cs = window.getComputedStyle(el);
                        img.style.display = 'inline';
                        img.style.verticalAlign = 'middle';
                        img.style.margin = '0 2px';
                        
                        // 尺寸控制：优先外接矩形；若为 0 则回退到 scrollWidth/Height
                        let w = 0, h = 0;
                        const r = el.getBoundingClientRect();
                        if (r.width && r.height) { w = r.width; h = r.height; }
                        if (!w || !h) {
                            const sw = (el as HTMLElement).scrollWidth;
                            const sh = (el as HTMLElement).scrollHeight;
                            if (sw && sh) { w = sw; h = sh; }
                        }
                        w = Math.max(1, Math.round(w));
                        h = Math.max(1, Math.round(h));
                        if (w && h) {
                            img.style.width = w + 'px';
                            img.style.height = h + 'px';
                            console.log(`[MP] Set image display size: ${w}x${h}px`);
                        }
                    } catch (e) { /* ignore */ }
                    
                    el.parentNode?.replaceChild(img, el);
                    console.log(`[MP] Replaced math element with inline SVG img, src length: ${dataUrl.length}`);
                    const convertedTo = dataUrl.startsWith('data:image/png') ? 'png' : dataUrl.startsWith('data:image/svg+xml') ? 'svg' : 'data';
                    debugResults.push({ tag: before.tag, classes: before.classes, outerBefore: before.outer, convertedTo, imgSrc: dataUrl });
                } catch (err: any) {
                    // 转换失败则保持原元素
                    console.error('Math-to-image conversion failed:', err);
                    debugResults.push({ tag: before.tag, classes: before.classes, outerBefore: before.outer, convertedTo: 'none', error: String(err && err.message ? err.message : err) });
                }
            }));

            // 不再将 debugResults 暴露到全局，避免意外被复制或泄露
        } catch (e) {
            console.error('Math element replacement failed:', e);
        }

            }

        // 清理临时容器（若存在）
        if (tempContainer && tempContainer.parentElement) {
            try { tempContainer.parentElement.removeChild(tempContainer); } catch {}
            tempContainer = null;
        }

        // 将匹配到的数学节点信息注入到 clone 中的注释，便于调试（不会影响页面渲染）
        try {
            const debugInfo = mathElsForDebug.map((el: HTMLElement) => ({
                tag: el.tagName,
                classes: Array.from(el.classList || []),
                outer: el.outerHTML
            }));
            const debugPayload = { matched: debugInfo, conversions: (typeof (window as any).__mp_preview_debug_results !== 'undefined') ? (window as any).__mp_preview_debug_results : undefined };
            // 如果我们在本次运行中收集到了 debugResults，则将它临时放到 window 上以便控制台打印（便于开发者检查）
            try {
                if (typeof debugPayload.conversions === 'undefined') {
                    // try to read a local variable 'debugResults' if present
                    // (we can't directly capture closure variable here reliably after transpile, so we attach it earlier)
                }
                // 使用 console.group 让输出更好读
                console.group && console.group('MP_PREVIEW_MATH_DEBUG');
                console.log(debugPayload);
                console.groupEnd && console.groupEnd();
            } catch (e) {
                // ignore
            }
            // NOTE: do not append debug info into the cloned HTML (would be pasted into editors).
            // We keep console logging above, but avoid injecting comments into the final HTML.
        } catch (e) {
            // 忽略序列化 debug 信息的错误
            console.error('Attach debug info failed:', e);
        }

        // 使用 XMLSerializer 安全地转换为字符串
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

    // 递归内联一个元素及其所有子元素的计算样式（仅复制已计算的 CSS 属性值）
    private static inlineComputedStylesDeep(root: Element) {
        const stack: Element[] = [root];
        while (stack.length) {
            const el = stack.pop()!;
            if (el instanceof HTMLElement) {
                const cs = window.getComputedStyle(el);
                for (let i = 0; i < cs.length; i++) {
                    const prop = cs[i];
                    const val = cs.getPropertyValue(prop);
                    try { (el as HTMLElement).style.setProperty(prop, val); } catch {}
                }
            }
            el.childNodes.forEach(n => { if (n.nodeType === Node.ELEMENT_NODE) stack.push(n as Element); });
        }
    }

    // 收集与目标元素相关联的 @font-face 并内联为 data: URI 样式文本
    private static async buildFontFaceStyleForElement(el: HTMLElement): Promise<string> {
        try {
            const families = new Set<string>();
            const collect = (node: Element) => {
                const cs = window.getComputedStyle(node as Element);
                const ff = cs.getPropertyValue('font-family');
                if (ff) ff.split(',').map(s => s.trim().replace(/^"|"$/g, '')).forEach(f => f && families.add(f));
                node.childNodes.forEach(n => { if (n.nodeType === Node.ELEMENT_NODE) collect(n as Element); });
            };
            collect(el);
            if (families.size === 0) return '';

            const styleTexts: string[] = [];
            const sheets: CSSStyleSheet[] = Array.from(document.styleSheets) as CSSStyleSheet[];
            for (const sheet of sheets) {
                let rules: CSSRuleList | null = null;
                try { rules = sheet.cssRules; } catch { continue; }
                if (!rules) continue;
                for (let i = 0; i < rules.length; i++) {
                    const r = rules[i];
                    if (r.type === CSSRule.FONT_FACE_RULE) {
                        const fr = r as CSSFontFaceRule;
                        const fam = fr.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
                        if (!families.has(fam)) continue;
                        const src = fr.style.getPropertyValue('src');
                        if (!src) continue;
                        const m = /url\(["']?([^"')]+)["']?\)/.exec(src);
                        if (!m || !m[1]) continue;
                        try {
                            const resp = await fetch(m[1]);
                            const blob = await resp.blob();
                            const reader = new FileReader();
                            const dataUrl: string = await new Promise((resolve, reject) => {
                                reader.onload = () => resolve(reader.result as string);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                            const newSrc = src.replace(m[1], dataUrl);
                            styleTexts.push(`@font-face { font-family: '${fam}'; src: ${newSrc}; font-style: ${fr.style.getPropertyValue('font-style') || 'normal'}; font-weight: ${fr.style.getPropertyValue('font-weight') || 'normal'}; }`);
                        } catch { /* ignore */ }
                    }
                }
            }
            return styleTexts.join('\n');
        } catch {
            return '';
        }
    }

    // 将 MathJax CHTML 中通过 ::before content 渲染的伪元素字符，转写为真实文本节点
    private static inlineMathJaxCHTMLGlyphs(root: Element) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        const targets: HTMLElement[] = [];
        while (walker.nextNode()) {
            const el = walker.currentNode as HTMLElement;
            // 识别常见 CHTML 元素，mjx-* 标签或包含 data-mjx 字段的元素
            const tag = el.tagName.toLowerCase();
            if (tag.startsWith('mjx-') || el.getAttribute('data-mjx') !== null) {
                targets.push(el);
            }
        }
            for (const el of targets) {
                const applyContent = (pseudo: '::before'|'::after') => {
                    const cs = window.getComputedStyle(el, pseudo);
                    let content = cs && cs.getPropertyValue('content');
                    if (!content || content === 'none' || content === 'normal') return;
                    // 去掉包裹引号
                    content = content.replace(/^\"|\"$/g, '').replace(/^'|'$/g, '');
                    if (!content) return;
                    const text = document.createTextNode(content);
                    if (pseudo === '::before') el.insertBefore(text, el.firstChild);
                    else el.appendChild(text);
                };
                applyContent('::before');
                applyContent('::after');
            }
    }

    // 从 DOM 数学节点中提取 MathML 或 LaTeX，并用 headless MathJax 转为 SVG 字符串
    private static toSvgFromMathNode(el: HTMLElement): string | null {
        // MathJax CHTML: assistive MathML
        const mml1 = el.querySelector('mjx-assistive-mml > math') as HTMLElement | null;
        if (mml1) {
            try { return mmlToSvg(mml1.outerHTML, true); } catch {}
        }
        // KaTeX: embedded MathML
        const mml2 = el.querySelector('.katex-mathml > math') as HTMLElement | null;
        if (mml2) {
            try { return mmlToSvg(mml2.outerHTML, true); } catch {}
        }
        // KaTeX: annotation carries LaTeX
        const ann = el.querySelector('.katex-mathml annotation[encoding="application/x-tex"]') as HTMLElement | null;
        if (ann && ann.textContent) {
            try { return texToSvg(ann.textContent, true); } catch {}
        }
        return null;
    }

    // 将 DOM 元素渲染为图片 data URL。优先尝试直接生成 SVG 数据 URL（若元素包含独立 <svg>），
    // 否则使用 SVG foreignObject 渲染并尝试导出为 PNG；若 canvas 导出因跨域资源被污染而失败，
    // 回退为返回 SVG base64 数据 URL，避免 toDataURL 导出时报 SecurityError。
    private static async elementToPngDataUrl(el: HTMLElement): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                // 优先：获取可序列化的 SVG 字符串（来自 MathML/TeX 或已有的 <svg>），随后统一栅格化为 PNG
                let svgContent: string | null = null;
                try {
                    const svgStr = CopyManager.toSvgFromMathNode(el);
                    if (svgStr) svgContent = svgStr;
                } catch {}
                if (!svgContent) {
                    const innerSvg = el.querySelector('svg');
                    if (innerSvg) {
                        const cloned = innerSvg.cloneNode(true) as SVGElement;
                        if (!cloned.getAttribute('xmlns')) cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        svgContent = new XMLSerializer().serializeToString(cloned);
                    }
                }
                if (svgContent) {
                    try {
                        // 计算栅格化尺寸：优先使用原元素的布局尺寸，其次解析 SVG viewBox，最后使用默认尺寸
                        const rect = el.getBoundingClientRect();
                        let targetW = Math.ceil(rect.width);
                        let targetH = Math.ceil(rect.height);
                        if (!targetW || !targetH) {
                            const m = /viewBox\s*=\s*"[\d\.\s-]+\s+[\d\.\s-]+\s+([\d\.]+)\s+([\d\.]+)"/i.exec(svgContent);
                            if (m) {
                                const vw = parseFloat(m[1]);
                                const vh = parseFloat(m[2]);
                                if (vw && vh) { targetW = Math.ceil(vw); targetH = Math.ceil(vh); }
                            }
                        }
                        if (!targetW || !targetH) { targetW = 300; targetH = 100; }

                        // 通过 data:svg 加载到 Image 再绘制到 canvas，得到 PNG，避免目标编辑器不支持内联 SVG 的问题
                        console.log(`[MP] Rasterizing SVG to PNG, size: ${targetW}x${targetH}`);
                        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                        const url = URL.createObjectURL(svgBlob);
                        const img = new Image();
                        img.onload = () => {
                            console.log('[MP] SVG image loaded successfully, converting to PNG...');
                            try {
                                const w = Math.max(1, targetW);
                                const h = Math.max(1, targetH);
                                const canvas = document.createElement('canvas');
                                canvas.width = w; canvas.height = h;
                                const ctx = canvas.getContext('2d');
                                if (!ctx) throw new Error('Canvas context unavailable');
                                ctx.fillStyle = 'white';
                                ctx.fillRect(0, 0, w, h);
                                ctx.drawImage(img, 0, 0, w, h);
                                const dataUrl = canvas.toDataURL('image/png');
                                console.log('[MP] PNG conversion successful, length:', dataUrl.length);
                                URL.revokeObjectURL(url);
                                resolve(dataUrl);
                            } catch (e) {
                                console.error('[MP] Canvas draw error:', e);
                                URL.revokeObjectURL(url);
                                // 回退：返回 SVG base64，至少不为空
                                try {
                                    const b64 = btoa(unescape(encodeURIComponent(svgContent!)));
                                    console.warn('[MP] Fallback to SVG base64');
                                    resolve(`data:image/svg+xml;base64,${b64}`);
                                } catch (e2) {
                                    reject(e);
                                }
                            }
                        };
                        img.onerror = (e) => {
                            console.error('[MP] SVG image load error:', e);
                            URL.revokeObjectURL(url);
                            try {
                                const b64 = btoa(unescape(encodeURIComponent(svgContent!)));
                                console.warn('[MP] Fallback to SVG base64 due to load error');
                                resolve(`data:image/svg+xml;base64,${b64}`);
                            } catch (e2) {
                                reject(new Error('SVG image load error'));
                            }
                        };
                        img.src = url;
                        return;
                    } catch (e) {
                        // 继续走 foreignObject 路线
                    }
                }

                // 尝试从 MathJax 的辅助 MathML 中生成 SVG（适用于 CHTML 输出场景）
                try {
                    const mmlEl = el.querySelector('mjx-assistive-mml > math, mjx-container mjx-assistive-mml > math') as HTMLElement | null;
                    if (mmlEl && (window as any).MathJax) {
                        const MJ = (window as any).MathJax;
                        // 确保 SVG 输出模块可用
                        if (typeof MJ.mathml2svg !== 'function' && MJ.loader && typeof MJ.loader.load === 'function') {
                            try {
                                await MJ.loader.load('input/mml', 'output/svg');
                                if (MJ.startup && MJ.startup.promise) { await MJ.startup.promise; }
                            } catch {}
                        }
                        if (typeof MJ.mathml2svg === 'function') {
                            const mmlStr = mmlEl.outerHTML;
                            const svgNode = MJ.mathml2svg(mmlStr, { display: true });
                            const svgEl: SVGElement | null = svgNode && (svgNode.querySelector ? svgNode.querySelector('svg') : null) || (svgNode as any);
                            if (svgEl) {
                                if (!svgEl.getAttribute('xmlns')) svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                                const serializedSvg2 = new XMLSerializer().serializeToString(svgEl);
                                const b64_2 = btoa(unescape(encodeURIComponent(serializedSvg2)));
                                resolve(`data:image/svg+xml;base64,${b64_2}`);
                                return;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('MathJax mathml2svg fallback failed:', e);
                }

                const rect = el.getBoundingClientRect();
                let width = Math.ceil(rect.width);
                let height = Math.ceil(rect.height);
                if (!width || !height) {
                    const sw = (el as HTMLElement).scrollWidth;
                    const sh = (el as HTMLElement).scrollHeight;
                    width = Math.ceil(sw) || 200;
                    height = Math.ceil(sh) || 50;
                }

                // 序列化节点为 XHTML 放入 foreignObject，并内联所需 @font-face 样式表
                // 对 KaTeX：优先取 .katex/.katex-display 中的 .katex-html 作为可视内容
                let serialized = '';
                const katexHtml = el.matches('.katex, .katex-display') ? el.querySelector('.katex-html') : el.querySelector('.katex-html');
                if (katexHtml) {
                    serialized = (katexHtml as HTMLElement).outerHTML;
                } else {
                    serialized = new XMLSerializer().serializeToString(el);
                }
                let fontCss = '';
                try { fontCss = await CopyManager.buildFontFaceStyleForElement(el); } catch {}
                const svg = `<?xml version="1.0" encoding="utf-8"?>\n` +
                    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>` +
                    `<rect width='100%' height='100%' fill='white'/>` +
                    `<foreignObject width='100%' height='100%'>` +
                    `<div xmlns='http://www.w3.org/1999/xhtml' style='display:inline-block;padding:0;margin:0;background:white;color:inherit;'>` +
                    `${fontCss ? `<style>${fontCss}</style>` : ''}` +
                    `${serialized}</div>` +
                    `</foreignObject></svg>`;

                // 尝试把 SVG 渲染到 Image，再 draw 到 canvas，最后导出 PNG
                const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                const img = new Image();
                // 尝试使用 anonymous CORS（如果外部资源允许）
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) throw new Error('Canvas context unavailable');
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                        try {
                            const dataUrl = canvas.toDataURL('image/png');
                            URL.revokeObjectURL(url);
                            resolve(dataUrl);
                            return;
                        } catch (err) {
                            // Canvas 被污染（跨域资源）；回退为返回 SVG 的 base64 数据 URL
                            URL.revokeObjectURL(url);
                            try {
                                const b64 = btoa(unescape(encodeURIComponent(svg)));
                                resolve(`data:image/svg+xml;base64,${b64}`);
                                return;
                            } catch (e2) {
                                reject(err);
                                return;
                            }
                        }
                    } catch (e) {
                        URL.revokeObjectURL(url);
                        reject(e);
                    }
                };
                img.onerror = (e) => {
                    URL.revokeObjectURL(url);
                    // 不能加载为图片，直接返回 SVG base64
                    try {
                        const b64 = btoa(unescape(encodeURIComponent(svg)));
                        resolve(`data:image/svg+xml;base64,${b64}`);
                    } catch (e2) {
                        // 最后兜底：使用 HTMLCanvas 直接绘制 foreignObject 序列化的节点
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            if (!ctx) throw new Error('Canvas context unavailable');
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, width, height);
                            // drawImage fallback failed as well; return white PNG of correct size to avoid 0 output
                            const dataUrl = canvas.toDataURL('image/png');
                            resolve(dataUrl);
                        } catch (e3) {
                            reject(new Error('Image load error'));
                        }
                    }
                };
                img.src = url;
            } catch (e) {
                reject(e);
            }
        });
    }

    // 尝试内联 math 元素可能依赖的外部字体（@font-face）或外部资源，减少 canvas 渲染时被 taint 的概率。
    // 这个实现尽量安全且非破坏性：仅尝试抓取样式表中使用的 font-family 对应的 @font-face src，
    // 并把可获取到的 URL 替换为 data: URI。若无法获取或解析，略过。
    private static async inlineFontsForElements(elements: HTMLElement[]): Promise<void> {
        try {
            const docStyles: CSSStyleSheet[] = Array.from(document.styleSheets) as CSSStyleSheet[];
            // 收集所有可能需要的 font-family 名称
            const families = new Set<string>();
            elements.forEach(el => {
                const cs = window.getComputedStyle(el);
                const ff = cs.getPropertyValue('font-family');
                if (ff) {
                    ff.split(',').map(s => s.trim().replace(/^"|"$/g, '')).forEach(f => families.add(f));
                }
            });

            if (families.size === 0) return;

            // 遍历样式表，查找 @font-face 规则并尝试替换其 src 为 data: URI
            for (const sheet of docStyles) {
                let rules: CSSRuleList | null = null;
                try {
                    rules = sheet.cssRules;
                } catch (e) {
                    // 跨域样式表无法访问，跳过
                    continue;
                }
                if (!rules) continue;

                for (let i = 0; i < rules.length; i++) {
                    const r = rules[i];
                    if (r.type === CSSRule.FONT_FACE_RULE) {
                        const fr = r as CSSFontFaceRule;
                        const ffamily = fr.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
                        if (!families.has(ffamily)) continue;
                        const src = fr.style.getPropertyValue('src');
                        if (!src) continue;
                        // 提取第一个 url(...) 的地址
                        const m = /url\(["']?([^"')]+)["']?\)/.exec(src);
                        if (m && m[1]) {
                            const url = m[1];
                            try {
                                const resp = await fetch(url);
                                const blob = await resp.blob();
                                const reader = new FileReader();
                                const dataUrl: string = await new Promise((resolve, reject) => {
                                    reader.onload = () => resolve(reader.result as string);
                                    reader.onerror = reject;
                                    reader.readAsDataURL(blob);
                                });
                                // 将样式表中该 src 的 url(...) 替换为 data URI
                                const newSrc = src.replace(url, dataUrl);
                                try {
                                    // 通过 insertRule 修改样式表可能报错，故我们通过在页面头部插入一个替代的 style 来覆盖原有 font-face
                                    const styleEl = document.createElement('style');
                                    styleEl.textContent = `@font-face { font-family: ${ffamily}; src: ${newSrc}; }`;
                                    document.head.appendChild(styleEl);
                                } catch (e) {
                                    // 忽略无法注入的情况
                                }
                            } catch (e) {
                                // fetch 失败，可能跨域或不存在，忽略
                                continue;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // 不应阻塞主流程
            console.warn('inlineFontsForElements error:', e);
        }
    }

    public static async copyToClipboard(element: HTMLElement, options?: { renderMathAsImage?: boolean; uploadToSmMs?: boolean; smMsToken?: string; saveImagesToVault?: boolean; imagesVaultFolder?: string; app?: any; markdownSource?: string }): Promise<void> {
        try {
            // 等待短暂时间，让 MathJax/KaTeX 等渲染流程有机会完成（若存在延迟渲染）
            await CopyManager.waitForMathReady(element, 800);
            const clone = element.cloneNode(true) as HTMLElement;

            const contentSection = clone.querySelector('.mp-content-section');
            if (!contentSection) {
                throw new Error('找不到内容区域');
            }
            // 使用新的 cleanupHtml 方法
            // 为确保目标编辑器（如公众号）稳定显示，复制前将数学节点统一转换为 PNG 图片
            const renderMathAsImage = true;
            
            // 从 Markdown 源中提取公式
            const formulas = options?.markdownSource ? this.extractFormulasFromMarkdown(options.markdownSource) : [];
            
            const cleanHtml = await this.cleanupHtml(contentSection as HTMLElement, renderMathAsImage, formulas);
            // 把最终的 cleanHtml 转为 DOM，再对其中的图片做同样的处理（把外部图片转换为 data: URI），
            // 这样通过 cleanupHtml 新生成的 <img>（公式转换）也能按项目现有方式被处理。
            const temp = document.createElement('div');
            temp.innerHTML = cleanHtml;
            try {
                await this.processImages(temp);
            } catch (e) {
                console.warn('processImages on final HTML failed (continuing):', e);
            }

            const finalHtml = temp.innerHTML;

            // Debug HTML download disabled to avoid interfering with copy/paste in target editors.

            // 收集 HTML 中的 data:image 并转换为 Blob 列表，以便把图片独立写入剪贴板
            const imgs = Array.from(temp.querySelectorAll('img')) as HTMLImageElement[];
            const imageBlobs: { img: HTMLImageElement; blob: Blob }[] = [];
            for (const img of imgs) {
                const src = img.src || '';
                if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) {
                    try {
                        const resp = await fetch(src);
                        const b = await resp.blob();
                        imageBlobs.push({ img, blob: b });
                    } catch (e) {
                        console.error('Fetch image for clipboard failed:', e);
                    }
                }
            }

            // 如果启用了“保存图片到 Vault”，先将所有图片写入 Vault 并把 src 替换为可用的资源路径
            if (options?.saveImagesToVault && options?.app?.vault) {
                try {
                    const folderPath = options.imagesVaultFolder?.trim() || 'MP Preview Images';
                    await CopyManager.ensureFolderExists(options.app, folderPath);
                    for (const it of imageBlobs) {
                        try {
                            const resource = await CopyManager.saveBlobToVault(options.app, folderPath, it.blob);
                            if (resource) {
                                // 保留原始 src（通常为 data: URI）以保证在外部网页编辑器中可见；
                                // 将 Vault 资源路径记录到 data 属性，便于后续使用（如导出/记录）
                                (it.img as HTMLElement).setAttribute('data-vault-resource', resource);
                            }
                        } catch (e) {
                            console.error('Save image to vault failed:', e);
                        }
                    }
                } catch (e) {
                    console.error('Save images to vault failed:', e);
                }
            }

            // 如果启用了上传到 sm.ms，则逐个上传并替换 img.src（使用原先收集的 blob，不依赖当前 img.src）
            if (options?.uploadToSmMs) {
                try {
                    for (const it of imageBlobs) {
                        try {
                            const url = await CopyManager.uploadImageToSmMs(it.blob, options?.smMsToken);
                            if (url) {
                                it.img.src = url;
                            }
                        } catch (e) {
                            console.error('Upload to sm.ms failed for one image:', e);
                        }
                    }
                } catch (e) {
                    console.error('Upload to sm.ms failed:', e);
                }
            }
            // 上传/替换完成后，重新生成最终 HTML（以包含可能替换为外链的 img.src）
            const finalHtmlAfterUpload = temp.innerHTML;

            // 构建 ClipboardItem 数组：先放 HTML/text，然后每个图片单独一项
            const items: ClipboardItem[] = [];
            items.push(new ClipboardItem({
                'text/html': new Blob([finalHtmlAfterUpload], { type: 'text/html' }),
                'text/plain': new Blob([clone.textContent || ''], { type: 'text/plain' })
            }));

            for (const item of imageBlobs) {
                const b = item.blob;
                const type = b.type || 'image/png';
                const map: Record<string, Blob> = {};
                map[type] = b;
                try {
                    items.push(new ClipboardItem(map));
                } catch (e) {
                    console.error('Create ClipboardItem for image failed:', e);
                }
            }

            // 写入剪贴板（包含 HTML 和单独的图片条目）
            try {
                await navigator.clipboard.write(items);
                new Notice('已复制到剪贴板');
                // 额外的兼容性复制：部分编辑器（含公众号）更依赖当前选区的富文本
                // 在成功写入后，再用一个隐藏 contenteditable，把 HTML 设为选区并 execCommand('copy') 一次
                try {
                    const div = document.createElement('div');
                    div.contentEditable = 'true';
                    div.style.position = 'fixed';
                    div.style.left = '-9999px';
                    div.style.top = '0';
                    div.style.opacity = '0';
                    div.innerHTML = finalHtmlAfterUpload;
                    document.body.appendChild(div);
                    const range = document.createRange();
                    range.selectNodeContents(div);
                    const sel = window.getSelection();
                    sel && sel.removeAllRanges();
                    sel && sel.addRange(range);
                    try { document.execCommand('copy'); } catch {}
                    sel && sel.removeAllRanges();
                    div.remove();
                } catch {}
            } catch (e: any) {
                console.warn('clipboard.write failed, attempting single-item fallback or text fallbacks:', e);
                // If platform doesn't support multiple ClipboardItems, retry with a single HTML/text ClipboardItem
                const msg = String(e && (e.message || e));
                const isMultipleNotSupported = /multiple ClipboardItems|not implemented|NotAllowedError/i.test(msg);
                if (isMultipleNotSupported) {
                    try {
                        const single = new ClipboardItem({
                            'text/html': new Blob([finalHtmlAfterUpload], { type: 'text/html' }),
                            'text/plain': new Blob([clone.textContent || ''], { type: 'text/plain' })
                        });
                        await navigator.clipboard.write([single]);
                        new Notice('已复制到剪贴板（HTML 单项回退）');
                        return;
                    } catch (eSingle) {
                        console.warn('Single-item clipboard.write also failed, falling back to writeText/execCommand:', eSingle);
                    }

                    // 如果单项回退也失败，并且用户没有显式开启 sm.ms 上传，尝试自动上传图片并重试一次（尽量保证可见）
                    if (!options?.uploadToSmMs && imageBlobs.length > 0) {
                        try {
                            for (const it of imageBlobs) {
                                try {
                                    const url = await CopyManager.uploadImageToSmMs(it.blob, options?.smMsToken);
                                    if (url) it.img.src = url;
                                } catch (ue) {
                                    console.warn('Auto upload one image failed:', ue);
                                }
                            }
                            // 更新 final HTML
                            const finalAfterAutoUpload = temp.innerHTML;
                            try {
                                const single2 = new ClipboardItem({
                                    'text/html': new Blob([finalAfterAutoUpload], { type: 'text/html' }),
                                    'text/plain': new Blob([clone.textContent || ''], { type: 'text/plain' })
                                });
                                await navigator.clipboard.write([single2]);
                                new Notice('已上传图片并复制到剪贴板（外链形式）');
                                return;
                            } catch (eRetry) {
                                console.warn('Retry clipboard.write after auto-upload failed:', eRetry);
                                // fall through to execCommand fallback below
                            }
                        } catch (eAuto) {
                            console.warn('Auto upload attempt failed:', eAuto);
                        }
                    }
                }

                // 先尝试使用一个隐藏的 contenteditable 元素并复制其 HTML 内容（rich-html fallback）
                try {
                    const div = document.createElement('div');
                    div.contentEditable = 'true';
                    div.style.position = 'fixed';
                    div.style.left = '-9999px';
                    div.style.top = '0';
                    div.style.opacity = '0';
                    div.innerHTML = finalHtmlAfterUpload;
                    document.body.appendChild(div);
                    const range = document.createRange();
                    range.selectNodeContents(div);
                    const sel = window.getSelection();
                    sel && sel.removeAllRanges();
                    sel && sel.addRange(range);
                    try {
                        const ok = document.execCommand('copy');
                        if (ok) {
                            new Notice('已复制到剪贴板（兼容 HTML 模式）');
                        } else {
                            throw new Error('execCommand copy returned false');
                        }
                    } catch (e3) {
                        throw e3;
                    } finally {
                        sel && sel.removeAllRanges();
                        div.remove();
                    }
                    // 如果上面成功，直接返回
                    return;
                } catch (e2) {
                    console.warn('execCommand HTML copy failed, falling back to writeText:', e2);
                    try {
                        // 尝试将 HTML 文本写入剪贴板（纯文本备选）
                        await navigator.clipboard.writeText(finalHtmlAfterUpload);
                        new Notice('已复制 HTML 文本到剪贴板（备用方式）');
                    } catch (e4) {
                        console.error('All clipboard fallback methods failed:', e4);
                        new Notice('复制失败（请检查环境或权限）');
                    }
                }
            }
        } catch (error) {
            new Notice('复制失败');
        }
    }

    // 确保 Vault 内的多级文件夹存在（逐级创建）
    private static async ensureFolderExists(app: any, folderPath: string): Promise<void> {
        const norm = normalizePath(folderPath);
        const parts = norm.split('/').filter(Boolean);
        let current = '';
        for (const p of parts) {
            current = current ? `${current}/${p}` : p;
            const exists = app.vault.getAbstractFileByPath(current);
            if (!exists) {
                try {
                    await app.vault.createFolder(current);
                } catch (e) {
                    // 可能被并发创建或已存在，忽略
                }
            }
        }
    }

    // 将 Blob 保存到 Vault 指定文件夹下，返回可用于 <img src> 的资源路径（app.vault.getResourcePath）
    private static async saveBlobToVault(app: any, folderPath: string, blob: Blob): Promise<string | undefined> {
        const ext = CopyManager.extFromMime(blob.type);
        const ts = CopyManager.timestampId();
        const name = `mp-preview-${ts}-${nanoid(6)}.${ext}`;
        const filePath = normalizePath(`${folderPath}/${name}`);
        const buf = await blob.arrayBuffer();
        try {
            if (typeof app.vault.createBinary === 'function') {
                await app.vault.createBinary(filePath, buf);
            } else if (app.vault.adapter && typeof app.vault.adapter.writeBinary === 'function') {
                await app.vault.adapter.writeBinary(filePath, buf);
            } else {
                // 退化：base64 写入（不推荐），尽量避免
                const base64 = await CopyManager.arrayBufferToBase64(buf);
                await app.vault.create(filePath, base64);
            }
            const f = app.vault.getAbstractFileByPath(filePath);
            if (f) {
                return app.vault.getResourcePath(f);
            }
        } catch (e) {
            console.error('write image to vault failed:', e);
        }
        return undefined;
    }

    private static extFromMime(mime: string): string {
        if (!mime) return 'png';
        if (/svg\+xml/i.test(mime)) return 'svg';
        if (/png/i.test(mime)) return 'png';
        if (/jpe?g/i.test(mime)) return 'jpg';
        if (/gif/i.test(mime)) return 'gif';
        if (/webp/i.test(mime)) return 'webp';
        return 'png';
    }

    private static timestampId(): string {
        const d = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    }

    private static async arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
        let binary = '';
        const bytes = new Uint8Array(buf);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // 等待页面上 MathJax/KaTeX/mjx 渲染节点出现或超时
    private static async waitForMathReady(root: HTMLElement, timeoutMs: number = 500): Promise<void> {
        const start = Date.now();
        const check = () => {
            // 常见的 math 渲染标识
            return !!root.querySelector('mjx-container, mjx-math, .katex, .MathJax, svg, math');
        };

        if (check()) return;

        return new Promise((resolve) => {
            const iv = setInterval(() => {
                if (check() || Date.now() - start > timeoutMs) {
                    clearInterval(iv);
                    resolve(undefined);
                }
            }, 50);
        });
    }

    // 上传单个图片到 sm.ms（返回可访问的外链 URL）
    private static async uploadImageToSmMs(blob: Blob, token?: string): Promise<string | undefined> {
        try {
            if (!token || !token.trim()) {
                console.error('sm.ms upload requires token. Please set token in settings.');
                return undefined;
            }

            const form = new FormData();
            form.append('smfile', blob, 'image.png');

            const tryOnce = async (authHeaderVal: string) => {
                const headers: Record<string, string> = { 'Authorization': authHeaderVal };
                const resp = await fetch('https://sm.ms/api/v2/upload', {
                    method: 'POST',
                    body: form,
                    headers
                });
                const text = await resp.text();
                let data: any = undefined;
                try { data = JSON.parse(text); } catch { /* not json */ }
                if (!resp.ok) {
                    throw { status: resp.status, text, data };
                }
                // success shapes
                if (data && (data.success === true || data.code === 'success') && data.data && data.data.url) {
                    return data.data.url as string;
                }
                // sm.ms 特定错误
                if (data && (data.code === 'unauthorized' || data.message)) {
                    throw { status: resp.status, data };
                }
                // other unexpected
                throw { status: resp.status, data };
            };

            // 依次尝试不同的 Authorization 头格式
            const candidates = [
                token.trim(),
                `Bearer ${token.trim()}`,
                `Basic ${token.trim()}`
            ];
            for (const h of candidates) {
                try {
                    const url = await tryOnce(h);
                    if (url) return url;
                } catch (err: any) {
                    // unauthorized -> 尝试下一个格式
                    if (err && err.data && (err.data.code === 'unauthorized' || /unauthorized/i.test(JSON.stringify(err)))) {
                        console.warn('sm.ms unauthorized with header:', h);
                        continue;
                    }
                    console.error('sm.ms upload attempt failed:', err);
                    // 对于其它错误直接中止
                    break;
                }
            }
            console.error('sm.ms upload failed: all Authorization header variants were rejected.');
            return undefined;
        } catch (e) {
            console.error('sm.ms upload error:', e);
            return undefined;
        }
    }
}