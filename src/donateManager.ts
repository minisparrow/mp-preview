export class DonateManager {
    private static overlay: HTMLElement;
    private static modal: HTMLElement;

    public static showDonateModal(container: HTMLElement) {
        this.overlay = container.createEl('div', {
            cls: 'mp-donate-overlay'
        });

        this.modal = this.overlay.createEl('div', {
            cls: 'mp-donate-modal'
        });

        const closeButton = this.modal.createEl('button', {
            cls: 'mp-donate-close',
            text: '×'
        });

        this.modal.createEl('h3', {
            text: '关注作者',
            cls: 'mp-donate-title'
        });

        const content = this.modal.createEl('div', {
            cls: 'mp-donate-content'
        });

        // 添加温馨提示
        content.createEl('p', {
            text: '如果你喜欢这个插件，欢迎关注我的公众号 ❤️',
            cls: 'mp-donate-desc'
        });

        // 创建二维码显示区域
        const qrContainer = content.createEl('div', {
            cls: 'mp-donate-qr-container'
        });

        const qrCode = qrContainer.createEl('div', {
            cls: 'mp-donate-qr active'
        });
        qrCode.createEl('img', {
            attr: {
                src: './assets/qrcode.png',
                alt: '公众号二维码'
            }
        });

        // 添加公众号名称
        content.createEl('p', {
            text: '公众号：夜半',
            cls: 'mp-donate-desc'
        });

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