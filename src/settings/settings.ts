import { Template } from '../templateManager';
import { Background } from '../backgroundManager';

interface MPSettings {
    backgroundId: string;
    templateId: string;
    fontFamily: string;
    fontSize: number;
    renderMathAsImage?: boolean;
    uploadToSmMs?: boolean;
    smMsToken?: string;
    saveImagesToVault?: boolean;
    imagesVaultFolder?: string;
    templates: Template[];
    customTemplates: Template[];
    backgrounds: Background[];
    customBackgrounds: Background[];
    customFonts: { value: string; label: string; isPreset?: boolean }[];
}

const DEFAULT_SETTINGS: MPSettings = {
    backgroundId: 'default',
    templateId: 'default',
    fontFamily: '-apple-system',
    fontSize: 16,
    renderMathAsImage: true,
    uploadToSmMs: false,
    smMsToken: '',
    saveImagesToVault: false,
    imagesVaultFolder: 'MP Preview Images',
    templates: [],
    customTemplates: [],
    backgrounds: [],
    customBackgrounds: [],
    customFonts: [
        {
            value: 'Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, "PingFang SC", Cambria, Cochin, Georgia, Times, "Times New Roman", serif',
            label: '默认字体',
            isPreset: true 
        },
        { value: 'SimSun, "宋体", serif', label: '宋体', isPreset: true },
        { value: 'SimHei, "黑体", sans-serif', label: '黑体', isPreset: true },
        { value: 'KaiTi, "楷体", serif', label: '楷体', isPreset: true },
        { value: '"Microsoft YaHei", "微软雅黑", sans-serif', label: '雅黑', isPreset: true }
    ],
};

export class SettingsManager {
    private plugin: any;
    private settings: MPSettings;

    constructor(plugin: any) {
        this.plugin = plugin;
        this.settings = DEFAULT_SETTINGS;
    }

    async loadSettings() {
        let savedData = await this.plugin.loadData();
        if (!savedData) {
            savedData = {};
        }
        if (!savedData.templates || savedData.templates.length === 0) {
            const { templates } = await import('../templates');
            savedData.templates = Object.values(templates).map(template => ({
                ...template,
                isPreset: true,
                isVisible: true  // 默认可见
            }));
        }
        if (!savedData.customTemplates) {
            savedData.customTemplates = [];
        }
        if (!savedData.customFonts) {
            savedData.customFonts = DEFAULT_SETTINGS.customFonts;
        }
        // 加载背景设置
        if (!savedData.backgrounds || savedData.backgrounds.length === 0) {
            const { backgrounds } = await import('../backgrounds');
            savedData.backgrounds = backgrounds.backgrounds.map(background => ({
                ...background,
                isPreset: true,
                isVisible: true
            }));
        }
        if (!savedData.customBackgrounds) {
            savedData.customBackgrounds = [];
        }
        if (!savedData.customFonts) {
            savedData.customFonts = DEFAULT_SETTINGS.customFonts;
        }
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
    }

    getAllTemplates(): Template[] {
        return [...this.settings.templates, ...this.settings.customTemplates];
    }

    getVisibleTemplates(): Template[] {
        return this.getAllTemplates().filter(template => template.isVisible !== false);
    }

    getTemplate(templateId: string): Template | undefined {
        return this.settings.templates.find(template => template.id === templateId)
            || this.settings.customTemplates.find(template => template.id === templateId);
    }

    async addCustomTemplate(template: Template) {
        template.isPreset = false;
        template.isVisible = true;  // 默认可见
        this.settings.customTemplates.push(template);
        await this.saveSettings();
    }

    async updateTemplate(templateId: string, updatedTemplate: Partial<Template>) {
        const presetTemplateIndex = this.settings.templates.findIndex(t => t.id === templateId);
        if (presetTemplateIndex !== -1) {
            this.settings.templates[presetTemplateIndex] = {
                ...this.settings.templates[presetTemplateIndex],
                ...updatedTemplate
            };
            await this.saveSettings();
            return true;
        }

        const customTemplateIndex = this.settings.customTemplates.findIndex(t => t.id === templateId);
        if (customTemplateIndex !== -1) {
            this.settings.customTemplates[customTemplateIndex] = {
                ...this.settings.customTemplates[customTemplateIndex],
                ...updatedTemplate
            };
            await this.saveSettings();
            return true;
        }

        return false;
    }

    async removeTemplate(templateId: string): Promise<boolean> {
        const template = this.getTemplate(templateId);
        if (template && !template.isPreset) {
            this.settings.customTemplates = this.settings.customTemplates.filter(t => t.id !== templateId);
            if (this.settings.templateId === templateId) {
                this.settings.templateId = 'default';
            }
            await this.saveSettings();
            return true;
        }
        return false;
    }

    async saveSettings() {
        await this.plugin.saveData(this.settings);
    }

    getSettings(): MPSettings {
        return this.settings;
    }

    async updateSettings(settings: Partial<MPSettings>) {
        this.settings = { ...this.settings, ...settings };
        await this.saveSettings();
    }

    getFontOptions() {
        return this.settings.customFonts;
    }

    async addCustomFont(font: { value: string; label: string }) {
        this.settings.customFonts.push({ ...font, isPreset: false });
        await this.saveSettings();
    }

    async removeFont(value: string) {
        const font = this.settings.customFonts.find(f => f.value === value);
        if (font && !font.isPreset) {
            this.settings.customFonts = this.settings.customFonts.filter(f => f.value !== value);
            await this.saveSettings();
        }
    }

    async updateFont(oldValue: string, newFont: { value: string; label: string }) {
        const index = this.settings.customFonts.findIndex(f => f.value === oldValue);
        if (index !== -1 && !this.settings.customFonts[index].isPreset) {
            this.settings.customFonts[index] = { ...newFont, isPreset: false };
            await this.saveSettings();
        }
    }

    // 背景相关方法
    getAllBackgrounds(): Background[] {
        return [...this.settings.backgrounds, ...this.settings.customBackgrounds];
    }

    getVisibleBackgrounds(): Background[] {
        return this.getAllBackgrounds().filter(background => background.isVisible !== false);
    }

    getBackground(backgroundId: string): Background | undefined {
        return this.settings.backgrounds.find(background => background.id === backgroundId)
            || this.settings.customBackgrounds.find(background => background.id === backgroundId);
    }

    async addCustomBackground(background: Background) {
        background.isPreset = false;
        background.isVisible = true;  // 默认可见
        this.settings.customBackgrounds.push(background);
        await this.saveSettings();
    }

    async updateBackground(backgroundId: string, updatedBackground: Partial<Background>) {
        const presetBackgroundIndex = this.settings.backgrounds.findIndex(b => b.id === backgroundId);
        if (presetBackgroundIndex !== -1) {
            this.settings.backgrounds[presetBackgroundIndex] = {
                ...this.settings.backgrounds[presetBackgroundIndex],
                ...updatedBackground
            };
            await this.saveSettings();
            return true;
        }

        const customBackgroundIndex = this.settings.customBackgrounds.findIndex(b => b.id === backgroundId);
        if (customBackgroundIndex !== -1) {
            this.settings.customBackgrounds[customBackgroundIndex] = {
                ...this.settings.customBackgrounds[customBackgroundIndex],
                ...updatedBackground
            };
            await this.saveSettings();
            return true;
        }

        return false;
    }

    async removeBackground(backgroundId: string): Promise<boolean> {
        const background = this.getBackground(backgroundId);
        if (background && !background.isPreset) {
            this.settings.customBackgrounds = this.settings.customBackgrounds.filter(b => b.id !== backgroundId);
            if (this.settings.backgroundId === backgroundId) {
                this.settings.backgroundId = 'default';
            }
            await this.saveSettings();
            return true;
        }
        return false;
    }
}