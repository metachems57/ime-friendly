(function () {
    let pushBridgeInitDone = false;
    let pageSwipeReady = false;

    const APP_SWIPE_PAGES = [
        'index.html',
        'reseau.html',
        'outils.html',
        'blog.html',
        'teams.html'
    ];

    function isNativeAppRuntime() {
        try {
            if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
                return window.Capacitor.isNativePlatform();
            }
        } catch (error) {
            // ignore
        }

        const protocol = String(window.location.protocol || '');
        if (protocol === 'capacitor:' || protocol === 'file:') return true;

        try {
            return localStorage.getItem('imeNativeRuntime') === '1';
        } catch (error) {
            return false;
        }
    }

    function getCurrentPageName() {
        const pageName = String(window.location.pathname || '').split('/').pop();
        return (pageName || 'index.html').toLowerCase();
    }

    function getSwipePageUrl(pageName) {
        if (pageName === 'index.html') {
            return 'index.html?fromApp=1';
        }
        return pageName;
    }

    function shouldIgnoreSwipeTarget(target) {
        if (!target || typeof target.closest !== 'function') return true;

        const linkNode = target.closest('a');
        if (linkNode && !linkNode.closest('.tool-card, .service-card, .app-v2-card, .post-card, .blog-post, .reseau-post')) {
            return true;
        }

        return !!target.closest([
            'button',
            'input',
            'textarea',
            'select',
            'label',
            'video',
            'audio',
            '[contenteditable="true"]',
            '[role="button"]',
            '[role="dialog"]',
            '.app-native-drawer',
            '.app-native-reseau-drawer',
            '.app-native-blog-drawer',
            '.app-native-tools-drawer',
            '.app-native-auth-sheet',
            '.create-post',
            '.modal',
            '.admin-panel',
            '.accessibility-panel'
        ].join(','));
    }

    function initNativePageSwipe() {
        if (pageSwipeReady || !isNativeAppRuntime()) return;

        const currentPage = getCurrentPageName();
        const currentIndex = APP_SWIPE_PAGES.indexOf(currentPage);
        if (currentIndex === -1) return;

        pageSwipeReady = true;

        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let tracking = false;
        let horizontalIntent = false;

        function resetSwipe() {
            startX = 0;
            startY = 0;
            startTime = 0;
            tracking = false;
            horizontalIntent = false;
        }

        function navigateBySwipe(deltaX) {
            const direction = deltaX < 0 ? 1 : -1;
            const targetIndex = (currentIndex + direction + APP_SWIPE_PAGES.length) % APP_SWIPE_PAGES.length;
            const targetPage = APP_SWIPE_PAGES[targetIndex];
            if (!targetPage) return;

            window.location.href = getSwipePageUrl(targetPage);
        }

        document.addEventListener('touchstart', (event) => {
            if (!event.touches || event.touches.length !== 1) return;
            if (
                document.body.classList.contains('app-native-shell-drawer-open')
                || document.body.classList.contains('app-native-drawer-open')
                || document.body.classList.contains('app-native-reseau-drawer-open')
                || document.body.classList.contains('app-native-tools-drawer-open')
                || document.body.classList.contains('app-native-blog-drawer-open')
                || document.body.classList.contains('app-native-teams-drawer-open')
                || document.body.classList.contains('app-native-create-open')
                || document.body.classList.contains('app-native-tools-create-open')
                || document.body.classList.contains('app-native-blog-create-open')
            ) return;
            if (shouldIgnoreSwipeTarget(event.target)) return;

            const touch = event.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            startTime = Date.now();
            tracking = true;
            horizontalIntent = false;
        }, { passive: true });

        document.addEventListener('touchmove', (event) => {
            if (!tracking || !event.touches || event.touches.length !== 1) return;

            const touch = event.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            if (!horizontalIntent && Math.abs(deltaX) > 18 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
                horizontalIntent = true;
            }

            if (horizontalIntent) {
                event.preventDefault();
            }
        }, { passive: false });

        document.addEventListener('touchend', (event) => {
            if (!tracking) return;

            const touch = event.changedTouches && event.changedTouches[0];
            if (!touch) {
                resetSwipe();
                return;
            }

            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            const elapsed = Date.now() - startTime;

            resetSwipe();

            if (elapsed > 700) return;
            if (Math.abs(deltaX) < 85) return;
            if (Math.abs(deltaY) > 80) return;
            if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

            navigateBySwipe(deltaX);
        }, { passive: true });

        document.addEventListener('touchcancel', resetSwipe, { passive: true });
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
        initNativePageSwipe();

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
