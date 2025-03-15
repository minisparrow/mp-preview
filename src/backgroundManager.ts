import { backgrounds } from './backgrounds';

export interface Background {
    id: string;
    name: string;
    style: string;
}

export class BackgroundManager {
    private backgrounds: Background[];
    private currentBackground: Background | null = null;

    constructor() {
        this.backgrounds = backgrounds.backgrounds;
    }

    public getAllBackgrounds(): Background[] {
        return this.backgrounds;
    }

    public setBackground(id: string | null) {
        if (!id) {
            this.currentBackground = null;
            return;
        }
        const background = this.backgrounds.find(bg => bg.id === id);
        if (background) {
            this.currentBackground = background;
        }
    }

    public applyBackground(element: HTMLElement) {
        const section = element.querySelector('.mp-content-section');
        if (section) {
            if (!this.currentBackground) {
                section.setAttribute('style', '');  // 当没有背景时，清除样式
                return;
            }
            section.setAttribute('style', this.currentBackground.style);
        }
    }
}