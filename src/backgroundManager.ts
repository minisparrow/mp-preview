import { SettingsManager } from "./settings/settings";

export interface Background {
    id: string;
    name: string;
    style: string;
    isPreset?: boolean;
    isVisible?: boolean;
}

export class BackgroundManager {
    private currentBackground: Background | null = null;
    private settingsManager: SettingsManager;

    constructor(settingsManager: SettingsManager) {
        this.settingsManager = settingsManager;
    }

    public setBackground(id: string | null): boolean {
        if (!id) {
            this.currentBackground = null;
            return true;
        }
        
        const background = this.settingsManager.getBackground(id);
        if (background) {
            // 检查背景是否可见
            if (background.isVisible === false) {
                console.warn(`尝试设置不可见的背景: ${id}`);
                return false;
            }
            
            this.currentBackground = background;
            return true;
        }
        
        console.warn(`未找到背景: ${id}`);
        return false;
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