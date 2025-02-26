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
            text: '请作者喝咖啡',
            cls: 'mp-donate-title'
        });

        const content = this.modal.createEl('div', {
            cls: 'mp-donate-content'
        });

        // 添加温馨提示
        content.createEl('p', {
            text: '您的支持是我持续更新的动力 ❤️',
            cls: 'mp-donate-desc'
        });

        // 创建支付方式选择
        const paymentTabs = content.createEl('div', {
            cls: 'mp-donate-tabs'
        });

        const wechatTab = paymentTabs.createEl('button', {
            text: '微信支付',
            cls: 'mp-donate-tab active'
        });

        const alipayTab = paymentTabs.createEl('button', {
            text: '支付宝',
            cls: 'mp-donate-tab'
        });

        // 创建二维码显示区域
        const qrContainer = content.createEl('div', {
            cls: 'mp-donate-qr-container'
        });

        const wechatQR = qrContainer.createEl('div', {
            cls: 'mp-donate-qr active',
            attr: {
                'data-type': 'wechat'
            }
        });
        wechatQR.createEl('img', {
            attr: {
                src: './assets/images/wechat-qr.png',
                alt: '微信支付'
            }
        });

        const alipayQR = qrContainer.createEl('div', {
            cls: 'mp-donate-qr',
            attr: {
                'data-type': 'alipay'
            }
        });
        alipayQR.createEl('img', {
            attr: {
                src: 'assets/images/alipay-qr.png',
                alt: '支付宝'
            }
        });

        // 添加标签切换事件
        wechatTab.addEventListener('click', () => this.switchTab('wechat', paymentTabs, qrContainer));
        alipayTab.addEventListener('click', () => this.switchTab('alipay', paymentTabs, qrContainer));

        // 添加关闭事件
        closeButton.addEventListener('click', () => this.closeDonateModal());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.closeDonateModal();
            }
        });
    }

    private static switchTab(type: string, tabsContainer: HTMLElement, qrContainer: HTMLElement) {
        // 更新标签状态
        tabsContainer.querySelectorAll('.mp-donate-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.textContent?.includes(type === 'wechat' ? '微信' : '支付宝')) {
                tab.classList.add('active');
            }
        });

        // 更新二维码显示
        qrContainer.querySelectorAll('.mp-donate-qr').forEach(qr => {
            qr.classList.remove('active');
            if (qr.getAttribute('data-type') === type) {
                qr.classList.add('active');
            }
        });
    }

    private static closeDonateModal() {
        if (this.overlay) {
            this.overlay.remove();
        }
    }
}