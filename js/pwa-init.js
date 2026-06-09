(function () {
    try {
        if (window.self !== window.top) return;
    } catch (error) {
        return;
    }

    let pushBridgeInitDone = false;
    let pageSwipeReady = false;
    let swipeNavigationInProgress = false;
    let swipeTransitionStylesReady = false;

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

    function prefersReducedMotion() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (error) {
            return false;
        }
    }

    function ensureSwipeTransitionStyles() {
        if (swipeTransitionStylesReady) return;
        swipeTransitionStylesReady = true;

        const style = document.createElement('style');
        style.setAttribute('data-ime-swipe-transition', '1');
        style.textContent = `
            body.ime-swipe-transitioning {
                background: #f4f7fb !important;
                overflow: hidden !important;
                touch-action: none !important;
                overscroll-behavior: none !important;
            }

            body.ime-swipe-transitioning > :not(.ime-page-swipe-preview) {
                transform: translate3d(var(--ime-swipe-current-x, 0px), 0, 0) !important;
                transition: none !important;
                will-change: transform !important;
            }

            body.ime-swipe-transitioning.ime-swipe-animating > :not(.ime-page-swipe-preview) {
                transition: transform 260ms cubic-bezier(.2,.82,.22,1) !important;
            }

            .ime-page-swipe-preview {
                position: fixed;
                inset: 0;
                z-index: 2147483000;
                display: block;
                width: 100%;
                height: 100%;
                border: 0;
                background: #f4f7fb;
                box-shadow: 0 0 28px rgba(15, 23, 42, .22);
                pointer-events: none;
                opacity: 0;
                visibility: hidden;
                transform: translate3d(120vw, 0, 0);
                transition: none;
                will-change: transform;
            }

            .ime-page-swipe-preview.is-active {
                opacity: 1;
                visibility: visible;
                transform: translate3d(var(--ime-swipe-preview-x, 100vw), 0, 0);
            }

            body.ime-swipe-transitioning.ime-swipe-animating > .ime-page-swipe-preview.is-active {
                transition: transform 260ms cubic-bezier(.2,.82,.22,1);
            }
        `;
        document.head.appendChild(style);
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
        let swipePreview = null;
        let swipePreviewDirection = 0;
        let swipeTargetUrl = '';
        const swipePreviewCache = new Map();

        function resetSwipe() {
            startX = 0;
            startY = 0;
            startTime = 0;
            tracking = false;
            horizontalIntent = false;
        }

        function cleanupSwipePreview() {
            if (swipePreview) {
                swipePreview.classList.remove('is-active');
            }
            swipePreview = null;
            swipePreviewDirection = 0;
            swipeTargetUrl = '';
            document.body.classList.remove('ime-swipe-transitioning', 'ime-swipe-animating');
            document.body.style.removeProperty('--ime-swipe-current-x');
            document.body.style.removeProperty('--ime-swipe-preview-x');
        }

        function getPreloadedSwipePreview(targetUrl) {
            if (swipePreviewCache.has(targetUrl)) {
                return swipePreviewCache.get(targetUrl);
            }

            ensureSwipeTransitionStyles();
            const preview = document.createElement('iframe');
            preview.className = 'ime-page-swipe-preview';
            preview.setAttribute('aria-hidden', 'true');
            preview.tabIndex = -1;
            preview.dataset.swipePreload = '1';
            preview.addEventListener('load', () => {
                preview.dataset.loaded = '1';
            });
            preview.src = targetUrl;
            document.body.appendChild(preview);
            swipePreviewCache.set(targetUrl, preview);
            return preview;
        }

        function preloadSwipePages() {
            ensureSwipeTransitionStyles();
            const urls = APP_SWIPE_PAGES
                .map(getSwipePageUrl)
                .filter((url, index, list) => list.indexOf(url) === index);

            urls.forEach((url) => {
                if (url !== getSwipePageUrl(currentPage)) {
                    getPreloadedSwipePreview(url);
                }
            });
        }

        function getSwipeTarget(deltaX) {
            const direction = deltaX < 0 ? 1 : -1;
            const targetIndex = (currentIndex + direction + APP_SWIPE_PAGES.length) % APP_SWIPE_PAGES.length;
            const targetPage = APP_SWIPE_PAGES[targetIndex];
            if (!targetPage) return null;
            return {
                direction,
                url: getSwipePageUrl(targetPage)
            };
        }

        function updateSwipePosition(deltaX) {
            if (swipeNavigationInProgress) return;
            const target = getSwipeTarget(deltaX);
            if (!target) return;

            if (swipePreviewDirection !== target.direction || swipeTargetUrl !== target.url) {
                if (swipePreview) {
                    swipePreview.classList.remove('is-active');
                }

                swipePreviewDirection = target.direction;
                swipeTargetUrl = target.url;
                swipePreview = getPreloadedSwipePreview(target.url);
                swipePreview.classList.add('is-active');
            }

            const width = Math.max(window.innerWidth || document.documentElement.clientWidth || 1, 1);
            const clampedDelta = Math.max(-width, Math.min(width, deltaX));
            const previewX = target.direction > 0 ? width + clampedDelta : -width + clampedDelta;

            document.body.style.setProperty('--ime-swipe-current-x', `${clampedDelta}px`);
            document.body.style.setProperty('--ime-swipe-preview-x', `${previewX}px`);
            document.body.classList.add('ime-swipe-transitioning');
        }

        function settleSwipe(deltaX, shouldNavigate) {
            if (!swipePreview || swipeNavigationInProgress) {
                cleanupSwipePreview();
                return;
            }

            if (prefersReducedMotion()) {
                if (shouldNavigate && swipeTargetUrl) {
                    window.location.href = swipeTargetUrl;
                } else {
                    cleanupSwipePreview();
                }
                return;
            }

            const width = Math.max(window.innerWidth || document.documentElement.clientWidth || 1, 1);
            const direction = swipePreviewDirection || (deltaX < 0 ? 1 : -1);

            document.body.classList.add('ime-swipe-animating');

            if (shouldNavigate && swipeTargetUrl) {
                swipeNavigationInProgress = true;
                document.body.style.setProperty('--ime-swipe-current-x', `${direction > 0 ? -width : width}px`);
                document.body.style.setProperty('--ime-swipe-preview-x', '0px');
                window.setTimeout(() => {
                    window.location.href = swipeTargetUrl;
                }, 270);
                return;
            }

            document.body.style.setProperty('--ime-swipe-current-x', '0px');
            document.body.style.setProperty('--ime-swipe-preview-x', `${direction > 0 ? width : -width}px`);
            window.setTimeout(cleanupSwipePreview, 280);
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
                ensureSwipeTransitionStyles();
                document.body.classList.add('ime-swipe-transitioning');
            }

            if (horizontalIntent) {
                event.preventDefault();
                updateSwipePosition(deltaX);
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
            const velocity = elapsed > 0 ? Math.abs(deltaX) / elapsed : 0;
            const shouldNavigate = horizontalIntent
                && Math.abs(deltaX) >= 72
                && Math.abs(deltaY) <= 95
                && Math.abs(deltaX) >= Math.abs(deltaY) * 1.35
                && (Math.abs(deltaX) >= window.innerWidth * 0.22 || velocity > 0.45);

            resetSwipe();

            if (horizontalIntent || swipePreview) {
                settleSwipe(deltaX, shouldNavigate);
            }
        }, { passive: true });

        document.addEventListener('touchcancel', () => {
            resetSwipe();
            settleSwipe(0, false);
        }, { passive: true });

        preloadSwipePages();
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
