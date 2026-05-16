(function () {
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

    function getCurrentPageKey() {
        const path = String(window.location.pathname || '');
        const page = path.split('/').pop() || 'index.html';
        return `${page}${window.location.search || ''}${window.location.hash || ''}`;
    }

    function getCurrentPageName() {
        const path = String(window.location.pathname || '');
        return path.split('/').pop() || 'index.html';
    }

    function readNativeStack() {
        try {
            const parsed = JSON.parse(sessionStorage.getItem('imeNativeNavStack') || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function writeNativeStack(stack) {
        try {
            sessionStorage.setItem('imeNativeNavStack', JSON.stringify(Array.isArray(stack) ? stack : []));
        } catch (error) {
            // ignore
        }
    }

    function syncCurrentPageInNativeStack() {
        if (!isNativeAppRuntime()) return;

        const current = getCurrentPageKey();
        let stack = readNativeStack();
        const last = stack[stack.length - 1];

        if (last === current) return;

        const previous = stack[stack.length - 2];
        if (previous === current) {
            stack.pop();
            writeNativeStack(stack);
            return;
        }

        const existingIndex = stack.lastIndexOf(current);
        if (existingIndex >= 0) {
            stack = stack.slice(0, existingIndex + 1);
            writeNativeStack(stack);
            return;
        }

        stack.push(current);
        if (stack.length > 40) {
            stack = stack.slice(stack.length - 40);
        }
        writeNativeStack(stack);
    }

    function initNativeBackNavigation() {
        if (!isNativeAppRuntime()) return;

        syncCurrentPageInNativeStack();

        const appPlugin = window.Capacitor && window.Capacitor.Plugins
            ? window.Capacitor.Plugins.App
            : null;

        if (!appPlugin || typeof appPlugin.addListener !== 'function') {
            return;
        }

        appPlugin.addListener('backButton', () => {
            const pageName = getCurrentPageName().toLowerCase();
            let stack = readNativeStack();

            if (stack.length > 1) {
                stack.pop();
                const previousPage = stack[stack.length - 1];
                writeNativeStack(stack);
                window.location.href = previousPage;
                return;
            }

            if (pageName === 'detail-outil.html') {
                writeNativeStack(['outils.html?fromApp=1']);
                window.location.href = 'outils.html?fromApp=1';
                return;
            }

            if (pageName !== 'index.html' && pageName !== 'ouverture.html') {
                writeNativeStack(['index.html?fromApp=1']);
                window.location.href = 'index.html?fromApp=1';
                return;
            }

            if (typeof appPlugin.exitApp === 'function') {
                appPlugin.exitApp();
            }
        });
    }

    if (!('serviceWorker' in navigator)) {
        initNativeBackNavigation();
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch((error) => {
            console.warn('Service worker non enregistre:', error);
        });

        initNativeBackNavigation();
    });
})();
