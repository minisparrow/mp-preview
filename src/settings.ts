interface MPSettings {
    templateId: string;
    fontFamily: string;
    fontSize: number;
}

const DEFAULT_SETTINGS: MPSettings = {
    templateId: 'default',
    fontFamily: '-apple-system',
    fontSize: 16
};

export class SettingsManager {
    private plugin: any;
    private settings: MPSettings;

    constructor(plugin: any) {
        this.plugin = plugin;
        this.settings = DEFAULT_SETTINGS;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.plugin.loadData());
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
}