(function () {
    let nativeBackBridgeReady = false;
    let pushBridgeInitDone = false;

    function isNativeAppRuntime() {
        try {
            if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
                return window.Capacitor.isNativePlatform();
            }
        } catch (error) {
            // ignore
        }

        const protocol = String(window.location.protocol || '');
        return protocol === 'capacitor:' || protocol === 'file:';
    }

    function getCurrentPageName() {
        const path = String(window.location.pathname || '');
        return (path.split('/').pop() || 'index.html').toLowerCase();
    }

    function initNativeBackBridge() {
        if (!isNativeAppRuntime() || nativeBackBridgeReady) return;
        nativeBackBridgeReady = true;

        const appPlugin = window.Capacitor && window.Capacitor.Plugins
            ? window.Capacitor.Plugins.App
            : null;

        if (!appPlugin || typeof appPlugin.addListener !== 'function') {
            return;
        }

        // Règle globale demandée:
        // retour téléphone = retour navigateur (page précédente).
        appPlugin.addListener('backButton', () => {
            if (window.history.length > 1) {
                window.history.back();
                return;
            }

            // Fallback si aucune page précédente dans l'historique.
            const pageName = getCurrentPageName();
            if (pageName !== 'index.html' && pageName !== 'ouverture.html') {
                window.location.href = 'index.html?fromApp=1';
                return;
            }

            if (typeof appPlugin.exitApp === 'function') {
                appPlugin.exitApp();
            }
        });
    }

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
                        // si deja chargé:
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
        // Mode stable: push natif OFF par defaut pour eviter crash startup.
        // Les notifications in-app (badges + centre notifications) restent actives.
        // Pour retester le push natif explicitement:
        // localStorage.setItem('imePushEnabled', 'true')
        try {
            return true;
        } catch (error) {
            return false;
        }
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js').catch((error) => {
                console.warn('Service worker non enregistre:', error);
            });

            initNativeBackBridge();
            if (shouldAutoInitPush()) {
                initNativePushBridge();
            }
        });
        return;
    }

    initNativeBackBridge();
    if (shouldAutoInitPush()) {
        initNativePushBridge();
    }
})();
