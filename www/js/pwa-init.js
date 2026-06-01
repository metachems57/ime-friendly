(function () {
    let pushBridgeInitDone = false;

    async function initNativePushBridge() {
        if (pushBridgeInitDone) return;
        pushBridgeInitDone = true;

        try {
            if (!window.pushNotifications || typeof window.pushNotifications.init !== 'function') {
                await new Promise((resolve) => {
                    const existing = document.querySelector('script[data-push-bridge="1"]');
                    if (existing) {
                        existing.addEventListener('load', () => resolve(), { once: true });
                        existing.addEventListener('error', () => resolve(), { once: true });
                        if ((window.pushNotifications && typeof window.pushNotifications.init === 'function') || existing.getAttribute('data-loaded') === '1') {
                            resolve();
                        }
                        return;
                    }

                    const script = document.createElement('script');
                    script.src = 'js/push-notifications.js';
                    script.setAttribute('data-push-bridge', '1');
                    script.addEventListener('load', () => {
                        script.setAttribute('data-loaded', '1');
                        resolve();
                    }, { once: true });
                    script.addEventListener('error', () => resolve(), { once: true });
                    document.head.appendChild(script);
                });
            }

            if (!window.pushNotifications || typeof window.pushNotifications.init !== 'function') {
                return;
            }
            await window.pushNotifications.init();
        } catch (error) {
            console.warn('Push bridge init failed:', error);
        }
    }

    function shouldAutoInitPush() {
        try {
            return true;
        } catch (error) {
            return false;
        }
    }

    function boot() {
        if (shouldAutoInitPush()) {
            initNativePushBridge();
        }
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js').catch((error) => {
                console.warn('Service worker non enregistre:', error);
            });

            boot();
        });
        return;
    }

    boot();
})();
