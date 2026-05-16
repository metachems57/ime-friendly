(function () {
    let nativeBackBridgeReady = false;

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

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js').catch((error) => {
                console.warn('Service worker non enregistre:', error);
            });

            initNativeBackBridge();
        });
        return;
    }

    initNativeBackBridge();
})();
