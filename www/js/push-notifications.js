(function () {
    let initialized = false;
    let currentToken = '';
    let runtimeConfigPromise = null;
    const PENDING_TOKEN_KEY = 'imePushPendingToken';

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

    function getPushPlugin() {
        return window.Capacitor?.Plugins?.PushNotifications || null;
    }

    function getSupabaseClient() {
        if (!window.supabaseClient || typeof window.supabaseClient.getClient !== 'function') {
            return null;
        }
        return window.supabaseClient.getClient();
    }

    function getCurrentUser() {
        if (!window.auth || typeof window.auth.getCurrentUser !== 'function') return null;
        return window.auth.getCurrentUser() || null;
    }

    async function getCurrentUserId() {
        const authUser = getCurrentUser();
        if (authUser && authUser.supabaseId) return String(authUser.supabaseId);

        const supabase = getSupabaseClient();
        if (!supabase) return '';
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) return '';
        return String(data.user.id);
    }

    function getPlatform() {
        try {
            if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
                const platform = String(window.Capacitor.getPlatform() || '').trim().toLowerCase();
                return platform || 'android';
            }
        } catch (error) {
            // ignore
        }
        return 'android';
    }

    async function getRuntimeConfig() {
        if (runtimeConfigPromise) return runtimeConfigPromise;

        runtimeConfigPromise = (async () => {
            try {
                const response = await fetch('app-runtime-config.json', { cache: 'no-store' });
                if (!response.ok) return {};
                const data = await response.json();
                return data && typeof data === 'object' ? data : {};
            } catch (error) {
                return {};
            }
        })();

        return runtimeConfigPromise;
    }

    async function isNativePushCapable() {
        const config = await getRuntimeConfig();
        return !!config.nativePushCapable;
    }

    function ensureHttpLink(link) {
        const value = String(link || '').trim();
        if (!value) return '';
        if (value.startsWith('http://') || value.startsWith('https://')) return value;
        return value;
    }

    async function upsertPushToken(token) {
        const cleanToken = String(token || '').trim();
        if (!cleanToken) return false;

        const userId = await getCurrentUserId();
        if (!userId) return false;

        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const payload = {
            user_id: userId,
            token: cleanToken,
            platform: getPlatform(),
            enabled: true,
            last_seen_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('user_push_tokens')
            .upsert(payload, { onConflict: 'token' });

        if (error) {
            console.warn('[push] token upsert failed:', error.message || error);
            return false;
        }

        currentToken = cleanToken;
        try {
            localStorage.removeItem(PENDING_TOKEN_KEY);
        } catch (error) {
            // ignore
        }
        return true;
    }

    async function flushPendingPushToken() {
        let pendingToken = '';
        try {
            pendingToken = String(localStorage.getItem(PENDING_TOKEN_KEY) || '').trim();
        } catch (error) {
            pendingToken = '';
        }

        if (!pendingToken) return false;
        return upsertPushToken(pendingToken);
    }

    async function disableCurrentPushToken() {
        const cleanToken = String(currentToken || '').trim();
        if (!cleanToken) return false;
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const { error } = await supabase
            .from('user_push_tokens')
            .update({
                enabled: false,
                updated_at: new Date().toISOString()
            })
            .eq('token', cleanToken);

        if (error) {
            return false;
        }

        return true;
    }

    async function markNotificationAsReadFromPayload(payloadData) {
        const source = String(payloadData?.source || '').trim().toLowerCase();
        const postId = Number(payloadData?.postId || payloadData?.source_post_id || 0);
        const title = String(payloadData?.title || payloadData?.post_title || '').trim();

        if (!window.activityNotifications || typeof window.activityNotifications.markAllAsRead !== 'function') {
            return;
        }

        const user = getCurrentUser();
        if (!user?.name) return;

        // Si on n'a pas de cible claire, on ne marque rien automatiquement.
        if (!source && !postId && !title) return;

        const entries = window.activityNotifications.listForUser(user.name, { includeRead: false, limit: 50 });
        const target = entries.find((item) => {
            const sameSource = source ? String(item.source || '').toLowerCase() === source : true;
            const sameId = postId > 0 ? Number(item.postId || 0) === postId : true;
            const sameTitle = title ? String(item.postTitle || '').trim() === title : true;
            return sameSource && sameId && sameTitle;
        });

        if (target && typeof window.activityNotifications.markAsRead === 'function') {
            window.activityNotifications.markAsRead(target.id, user.name);
        }
    }

    function buildTargetLink(payloadData) {
        const source = String(payloadData?.source || '').trim().toLowerCase();
        const postId = Number(payloadData?.postId || payloadData?.source_post_id || 0);
        const title = String(payloadData?.title || payloadData?.post_title || '').trim();
        const encodedTitle = encodeURIComponent(title.slice(0, 120));

        if (source === 'blog' && postId > 0) {
            if (title) return `blog.html?highlightPost=${postId}&highlightTitle=${encodedTitle}#post-${postId}`;
            return `blog.html?highlightPost=${postId}#post-${postId}`;
        }

        if (source === 'reseau' && postId > 0) {
            if (title) return `reseau.html?highlightPost=${postId}&highlightTitle=${encodedTitle}#post-${postId}`;
            return `reseau.html?highlightPost=${postId}#post-${postId}`;
        }

        if ((source === 'tools' || source === 'outils') && postId > 0) {
            return `detail-outil.html?id=${postId}`;
        }

        if (source === 'messagerie') return 'messagerie.html';
        return 'index.html';
    }

    function handleIncomingPush(notification) {
        const payload = notification?.data || {};
        const title = String(notification?.title || payload?.title || 'IME-Friendly').trim();
        const body = String(notification?.body || payload?.body || '').trim();
        const source = String(payload?.source || '').trim().toLowerCase() || 'system';
        const postTitle = String(payload?.post_title || payload?.title || 'Notification').trim();
        const postId = Number(payload?.postId || payload?.source_post_id || 0);
        const actor = String(payload?.actor || 'IME-Friendly').trim();

        if (window.activityNotifications && typeof window.activityNotifications.addNotification === 'function') {
            const user = getCurrentUser();
            if (user?.name) {
                window.activityNotifications.addNotification({
                    recipient: user.name,
                    actor,
                    type: String(payload?.type || 'system').toLowerCase(),
                    source,
                    postTitle: postTitle || title,
                    postId: Number.isFinite(postId) ? postId : 0,
                    link: buildTargetLink(payload)
                });
            }
        }

        if (window.messagesWidget && typeof window.messagesWidget.updateUnreadBadges === 'function') {
            window.messagesWidget.updateUnreadBadges();
        }

        console.info('[push] received:', title, body);
    }

    async function init() {
        if (initialized) return true;
        if (!isNativeAppRuntime()) return false;
        if (localStorage.getItem('imeConnected') !== 'true') return false;
        if (localStorage.getItem('imePushEnabled') === 'false') return false;
        localStorage.setItem('imePushEnabled', 'true');

        const pushCapable = await isNativePushCapable();
        if (!pushCapable) {
            console.warn('[push] native push disabled: Firebase config missing (google-services.json).');
            localStorage.setItem('imePushEnabled', 'false');
            return false;
        }

        const push = getPushPlugin();
        if (!push) return false;
        if (
            typeof push.addListener !== 'function' ||
            typeof push.checkPermissions !== 'function' ||
            typeof push.requestPermissions !== 'function' ||
            typeof push.register !== 'function'
        ) {
            console.warn('[push] plugin API incomplete, disabling native push');
            localStorage.setItem('imePushEnabled', 'false');
            return false;
        }

        initialized = true;

        push.addListener('registration', async (token) => {
            const tokenValue = String(token?.value || '').trim();
            if (!tokenValue) return;
            currentToken = tokenValue;
            try {
                localStorage.setItem(PENDING_TOKEN_KEY, tokenValue);
            } catch (error) {
                // ignore
            }
            await upsertPushToken(tokenValue);
        });

        push.addListener('registrationError', (error) => {
            console.warn('[push] registration error:', error);
        });

        push.addListener('pushNotificationReceived', (notification) => {
            handleIncomingPush(notification);
        });

        push.addListener('pushNotificationActionPerformed', async (action) => {
            const payload = action?.notification?.data || {};
            await markNotificationAsReadFromPayload(payload);
            const target = ensureHttpLink(buildTargetLink(payload));
            if (target) {
                window.location.href = target;
            }
        });

        try {
            let permission = await push.checkPermissions();
            if (permission?.receive === 'prompt') {
                permission = await push.requestPermissions();
            }

            if (permission?.receive === 'granted') {
                await push.register();
                await flushPendingPushToken();
            } else {
                console.warn('[push] permission not granted');
            }
        } catch (error) {
            console.warn('[push] registration flow failed:', error);
            return false;
        }

        window.addEventListener('storage', (event) => {
            if (event.key === 'imeConnected' || event.key === 'userName') {
                flushPendingPushToken().catch(() => {});
            }
        });

        return true;
    }

    function onLogout() {
        disableCurrentPushToken().catch(() => {});
    }

    window.pushNotifications = {
        init,
        upsertPushToken,
        disableCurrentPushToken,
        onLogout
    };
})();
