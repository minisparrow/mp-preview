import { Plugin, Notice } from 'obsidian';
import { MPView, VIEW_TYPE_MP } from './view';
import { TemplateManager } from './templateManager';
import { SettingsManager } from './settings';
import { MPConverter } from './converter';
import { DonateManager } from './donateManager';
export default class MPPlugin extends Plugin {
    private settingsManager: SettingsManager;

    async onload() {
        // 初始化设置管理器
        this.settingsManager = new SettingsManager(this);
        await this.settingsManager.loadSettings();

        // 初始化模板管理器
        const templateManager = new TemplateManager(this.app);
        
        // 初始化转换器
        MPConverter.initialize(this.app);
        
        DonateManager.initialize(this.app, this);

        // 注册视图
        this.registerView(
            VIEW_TYPE_MP,
            (leaf) => new MPView(leaf, templateManager, this.settingsManager)
        );

        // 自动打开视图但不聚焦
        this.app.workspace.onLayoutReady(() => {
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MP);
            if (leaves.length === 0) {
                const rightLeaf = this.app.workspace.getRightLeaf(false);
                if (rightLeaf) {
                    rightLeaf.setViewState({
                        type: VIEW_TYPE_MP,
                        active: false,
                    });
                }
            }
        });

        // 添加命令到命令面板
        this.addCommand({
            id: 'open-mp-preview',
            name: '打开公众号预览插件',
            callback: async () => {
                await this.activateView();
            }
        });
    }

    async activateView() {
        // 如果视图已经存在，激活它
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MP);
        if (leaves.length > 0) {
            this.app.workspace.revealLeaf(leaves[0]);
            return;
        }

        // 创建新视图
        const rightLeaf = this.app.workspace.getRightLeaf(false);
        if (rightLeaf) {
            await rightLeaf.setViewState({
                type: VIEW_TYPE_MP,
                active: true,
            });
        } else {
            // 如果无法获取右侧面板，显示错误提示
            new Notice('无法创建视图面板');
        }
    }
}