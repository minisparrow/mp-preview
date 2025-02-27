
import { App, Plugin } from 'obsidian';

export class DonateManager {
    private static overlay: HTMLElement;
    private static modal: HTMLElement;
    private static app: App;
    private static plugin: Plugin;

    public static initialize(app: App, plugin: Plugin) {
        this.app = app;
        this.plugin = plugin;
    }

    public static showDonateModal(container: HTMLElement) {
        this.overlay = container.createEl('div', {
            cls: 'mp-donate-overlay'
        });

        this.modal = this.overlay.createEl('div', {
            cls: 'mp-about-modal'
        });

        // 添加关闭按钮
        const closeButton = this.modal.createEl('button', {
            cls: 'mp-donate-close',
            text: '×'
        });

        // 添加作者信息区域
        const authorSection = this.modal.createEl('div', {
            cls: 'mp-about-section mp-about-intro-section'
        });

        authorSection.createEl('h4', {
            text: '关于作者',
            cls: 'mp-about-title'
        });

        const introEl = authorSection.createEl('p', {
            cls: 'mp-about-intro'
        });
        introEl.innerHTML = '你好，我是<span class="mp-about-name">【夜半】</span>，一名<span class="mp-about-identity">全职写作与独立开发者</span>。';
        
        const roleList = authorSection.createEl('div', {
            cls: 'mp-about-roles'
        });

        const roleEl = roleList.createEl('p', {
            cls: 'mp-about-role'
        });
        roleEl.innerHTML = `这款插件是我为了在 Obsidian 写作后，<br>
                            无需繁琐排版一键即可发布到公众号而开发的工具，<br>
                            希望能让你的<span class="mp-about-highlight">排版更轻松</span>，
                            让你的<span class="mp-about-value">创作更高效</span>。`;

        // 添加插件介绍
        const descEl = authorSection.createEl('p', {
            cls: 'mp-about-desc'
        });
        descEl.innerHTML = `如果这款插件对你有帮助，<br>或者你愿意支持我的独立开发与写作，欢迎请我喝咖啡☕️。<br>
                            你的支持对我来说意义重大，它能让我更专注地开发、写作。`;

        // 添加打赏区域
        const donateSection = this.modal.createEl('div', {
            cls: 'mp-about-section mp-about-donate-section'
        });

        donateSection.createEl('h4', {
            text: '请我喝咖啡',
            cls: 'mp-about-subtitle'
        });

        const donateQR = donateSection.createEl('div', {
            cls: 'mp-about-qr'
        });
        donateQR.createEl('img', {
            attr: {
                src: this.app.vault.adapter.getResourcePath(`${this.plugin.manifest.dir}/assets/donate.png`),
                alt: '打赏二维码'
            }
        });

        // 添加公众号区域
        const mpSection = this.modal.createEl('div', {
            cls: 'mp-about-section mp-about-mp-section'
        });

        const mpDescEl = mpSection.createEl('p', {
            cls: 'mp-about-desc'
        });
        mpDescEl.innerHTML = `如果你想了解更多关于创作、效率工具的小技巧，<br>
                              或者关注我未来的写作动态，欢迎关注我的微信公众号。`;

        mpSection.createEl('h4', {
            text: '微信公众号',
            cls: 'mp-about-subtitle'
        });

        const mpQR = mpSection.createEl('div', {
            cls: 'mp-about-qr'
        });
        mpQR.createEl('img', {
            attr: {
                src: this.app.vault.adapter.getResourcePath(`${this.plugin.manifest.dir}/assets/qrcode.png`),
                alt: '公众号二维码'
            }
        });

        const footerEl = mpSection.createEl('p', {
            cls: 'mp-about-footer'
        });
        footerEl.innerHTML = '期待与你一起，在创作的世界里<strong>找到属于自己的意义</strong>。';

        // 添加关闭事件
        closeButton.addEventListener('click', () => this.closeDonateModal());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.closeDonateModal();
            }
        });
    }

    private static closeDonateModal() {
        if (this.overlay) {
            this.overlay.remove();
        }
    }
}