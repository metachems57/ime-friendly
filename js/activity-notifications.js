(function () {
    const STORAGE_KEY = 'activityNotifications';
    const MAX_NOTIFICATIONS = 800;

    const SYNC_STORAGE_KEY = 'activityNotificationsLastSyncAt';
    const SYNC_MIN_DELAY_MS = 3000;
    const CROSS_PAGE_SYNC_MIN_DELAY_MS = 45000;

    let lastSyncRun = 0;
    let syncInFlight = null;

    function normalizeName(value) {
        return String(value || '').trim();
    }

    function normalizeKey(value) {
        return normalizeName(value).toLowerCase();
    }

    function getSupabaseClient() {
        if (!window.supabaseClient || typeof window.supabaseClient.getClient !== 'function') {
            return null;
        }
        return window.supabaseClient.getClient();
    }

    function isSupabaseReady() {
        return !!getSupabaseClient();
    }

    function readLastSyncTimestamp() {
        const rawValue = localStorage.getItem(SYNC_STORAGE_KEY) || '';
        const timestamp = Date.parse(rawValue);
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function readArray(key) {
        if (window.dataStore && typeof window.dataStore.readArray === 'function') {
            return window.dataStore.readArray(key);
        }

        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function writeArray(key, value) {
        if (!Array.isArray(value)) return;

        if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
            window.dataStore.writeArray(key, value);
            return;
        }

        localStorage.setItem(key, JSON.stringify(value));
    }

    function getCurrentUser() {
        if (window.auth && typeof window.auth.getCurrentUser === 'function') {
            return window.auth.getCurrentUser() || null;
        }
        return null;
    }

    function readUsers() {
        if (window.auth && typeof window.auth.readUsers === 'function') {
            return window.auth.readUsers();
        }

        if (window.dataStore && typeof window.dataStore.readArray === 'function') {
            return window.dataStore.readArray('users');
        }

        try {
            const parsed = JSON.parse(localStorage.getItem('users') || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function findUserByName(userName) {
        const targetKey = normalizeKey(userName);
        if (!targetKey) return null;

        return readUsers().find((user) => normalizeKey(user && user.name) === targetKey) || null;
    }

    function findUserBySupabaseId(userId) {
        const id = String(userId || '').trim();
        if (!id) return null;

        return readUsers().find((user) => String(user && user.supabaseId || '').trim() === id) || null;
    }

    function getCurrentUserName() {
        const user = getCurrentUser();
        if (user && user.name) return normalizeName(user.name);

        const isConnected = localStorage.getItem('imeConnected') === 'true';
        if (!isConnected) return '';
        return normalizeName(localStorage.getItem('userName') || '');
    }

    function getCurrentUserId() {
        const user = getCurrentUser();
        if (user && user.supabaseId) return String(user.supabaseId);
        return '';
    }

    function getUserIdByName(userName) {
        const targetName = normalizeName(userName);
        if (!targetName) return '';

        const currentUser = getCurrentUser();
        if (
            currentUser &&
            normalizeKey(currentUser.name) === normalizeKey(targetName) &&
            currentUser.supabaseId
        ) {
            return String(currentUser.supabaseId);
        }

        const user = findUserByName(targetName);
        return String(user && user.supabaseId || '').trim();
    }

    function getUserNameById(userId) {
        const id = String(userId || '').trim();
        if (!id) return '';

        const currentUser = getCurrentUser();
        if (currentUser && String(currentUser.supabaseId || '').trim() === id) {
            return normalizeName(currentUser.name || '');
        }

        const user = findUserBySupabaseId(id);
        return normalizeName(user && user.name || '');
    }

    function sanitizeNotification(item) {
        if (!item || typeof item !== 'object') return null;

        const id = Number(item.id);
        const recipient = normalizeName(item.recipient);
        const recipientKey = normalizeKey(item.recipientKey || recipient);
        const actor = normalizeName(item.actor);
        const actorKey = normalizeKey(item.actorKey || actor);
        const type = normalizeName(item.type).toLowerCase() || 'comment';
        const source = normalizeName(item.source).toLowerCase() || '';
        const postId = Number(item.postId);
        const postTitle = normalizeName(item.postTitle || 'Publication');
        const createdAt = normalizeName(item.createdAt) || new Date().toISOString();
        const read = !!item.read;
        const link = normalizeName(item.link);

        if (!Number.isFinite(id) || !recipientKey || !recipient) return null;

        return {
            id,
            recipient,
            recipientKey,
            actor,
            actorKey,
            type,
            source,
            postId: Number.isFinite(postId) ? postId : 0,
            postTitle,
            createdAt,
            read,
            link
        };
    }

    function readNotifications() {
        return readArray(STORAGE_KEY)
            .map(sanitizeNotification)
            .filter(Boolean)
            .sort((a, b) => {
                const tsA = new Date(a.createdAt || 0).getTime() || 0;
                const tsB = new Date(b.createdAt || 0).getTime() || 0;
                return tsB - tsA;
            });
    }

    function writeNotifications(items) {
        const safeItems = Array.isArray(items) ? items.map(sanitizeNotification).filter(Boolean) : [];
        writeArray(STORAGE_KEY, safeItems.slice(0, MAX_NOTIFICATIONS));
    }

    function buildPostLink(notification) {
        if (notification.link) return notification.link;
        const rawPostId = Number(notification.postId);
        const safePostId = Number.isFinite(rawPostId) && rawPostId > 0
            ? encodeURIComponent(String(rawPostId))
            : '';
        const safeTitle = encodeURIComponent(String(notification.postTitle || '').trim().slice(0, 120));

        if (notification.source === 'blog' && safePostId) {
            if (safeTitle) {
                return `blog.html?highlightPost=${safePostId}&highlightTitle=${safeTitle}#post-${safePostId}`;
            }
            return `blog.html?highlightPost=${safePostId}#post-${safePostId}`;
        }

        if (notification.source === 'blog' && safeTitle) {
            return `blog.html?highlightTitle=${safeTitle}`;
        }

        if (notification.source === 'reseau' && safePostId) {
            if (safeTitle) {
                return `reseau.html?highlightPost=${safePostId}&highlightTitle=${safeTitle}#post-${safePostId}`;
            }
            return `reseau.html?highlightPost=${safePostId}#post-${safePostId}`;
        }

        if (notification.source === 'reseau' && safeTitle) {
            return `reseau.html?highlightTitle=${safeTitle}`;
        }

        return 'index.html';
    }

    function getNotificationMessage(notification) {
        const actor = notification.actor || "Quelqu'un";
        switch (notification.type) {
            case 'like':
                return `${actor} a aime votre post`;
            case 'reply':
                return `${actor} a repondu dans un post que vous suivez`;
            case 'comment':
            default:
                return `${actor} a commente votre post`;
        }
    }

    function hasPendingLikeDuplicate(items, notification) {
        if (notification.type !== 'like') return false;

        return items.some((item) => (
            !item.read &&
            item.type === 'like' &&
            item.recipientKey === notification.recipientKey &&
            item.actorKey === notification.actorKey &&
            item.source === notification.source &&
            Number(item.postId) === Number(notification.postId)
        ));
    }

    function addNotification(payload) {
        const recipient = normalizeName(payload && payload.recipient);
        const actor = normalizeName(payload && payload.actor);
        const recipientKey = normalizeKey(recipient);
        const actorKey = normalizeKey(actor);

        if (!recipient || !actor || !recipientKey || !actorKey) {
            return { ok: false, reason: 'invalid_users' };
        }

        if (recipientKey === actorKey) {
            return { ok: false, reason: 'self_notification' };
        }

        const source = normalizeName(payload && payload.source).toLowerCase();
        const postTitle = normalizeName(payload && payload.postTitle) || 'Publication';
        const postId = Number(payload && payload.postId);
        const type = normalizeName(payload && payload.type).toLowerCase() || 'comment';

        const tempId = Date.now() + Math.floor(Math.random() * 1000);
        const notification = sanitizeNotification({
            id: tempId,
            recipient,
            recipientKey,
            actor,
            actorKey,
            type,
            source,
            postId: Number.isFinite(postId) ? postId : 0,
            postTitle: postTitle.slice(0, 140),
            createdAt: new Date().toISOString(),
            read: false,
            link: normalizeName(payload && payload.link)
        });

        if (!notification) {
            return { ok: false, reason: 'invalid_payload' };
        }

        const notifications = readNotifications();
        if (hasPendingLikeDuplicate(notifications, notification)) {
            return { ok: false, reason: 'duplicate_like' };
        }

        notifications.unshift(notification);
        writeNotifications(notifications);

        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const recipientId = getUserIdByName(recipient);
            const actorId = getUserIdByName(actor) || getCurrentUserId();

            if (supabase && recipientId) {
                supabase
                    .from('activity_notifications')
                    .insert({
                        recipient_id: recipientId,
                        actor_id: actorId || null,
                        type: notification.type,
                        source: notification.source || 'reseau',
                        source_post_id: Number.isFinite(notification.postId) && notification.postId > 0
                            ? notification.postId
                            : null,
                        post_title: notification.postTitle,
                        message: getNotificationMessage(notification),
                        is_read: false
                    })
                    .select('id, created_at')
                    .single()
                    .then(({ data, error }) => {
                        if (error || !data) return;

                        const savedId = Number(data.id);
                        const nextNotifications = readNotifications();
                        const localNotification = nextNotifications.find((item) => Number(item.id) === tempId);
                        if (!localNotification) return;

                        if (Number.isFinite(savedId)) {
                            localNotification.id = savedId;
                        }
                        if (data.created_at) {
                            localNotification.createdAt = data.created_at;
                        }
                        writeNotifications(nextNotifications);
                    })
                    .catch(() => {});
            }
        }

        return { ok: true, notification };
    }

    function listForUser(userName, options = {}) {
        const userKey = normalizeKey(userName);
        if (!userKey) return [];

        queueBackgroundSync();

        const includeRead = options.includeRead !== false;
        const limit = Number(options.limit);
        let items = readNotifications().filter((item) => item.recipientKey === userKey);

        if (!includeRead) {
            items = items.filter((item) => !item.read);
        }

        if (Number.isFinite(limit) && limit > 0) {
            items = items.slice(0, limit);
        }

        return items.map((item) => ({
            ...item,
            link: buildPostLink(item),
            message: getNotificationMessage(item)
        }));
    }

    function getUnreadCount(userName) {
        return listForUser(userName, { includeRead: false }).length;
    }

    function markAllAsRead(userName) {
        const userKey = normalizeKey(userName);
        if (!userKey) return false;

        const notifications = readNotifications();
        let changed = false;

        notifications.forEach((item) => {
            if (item.recipientKey === userKey && !item.read) {
                item.read = true;
                changed = true;
            }
        });

        if (changed) {
            writeNotifications(notifications);
        }

        const userId = getUserIdByName(userName);
        if (changed && isSupabaseReady() && userId) {
            const supabase = getSupabaseClient();
            if (supabase) {
                supabase
                    .from('activity_notifications')
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .eq('recipient_id', userId)
                    .eq('is_read', false)
                    .then(() => {
                        queueBackgroundSync(true);
                    })
                    .catch(() => {});
            }
        }

        return changed;
    }

    function markAsRead(notificationId, userName) {
        const userKey = normalizeKey(userName);
        const id = Number(notificationId);
        if (!userKey || !Number.isFinite(id)) return false;

        const notifications = readNotifications();
        const target = notifications.find((item) => item.id === id && item.recipientKey === userKey);
        if (!target || target.read) return false;

        target.read = true;
        writeNotifications(notifications);

        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const userId = getUserIdByName(userName);
            if (supabase && userId) {
                supabase
                    .from('activity_notifications')
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .eq('id', id)
                    .eq('recipient_id', userId)
                    .then(() => {
                        queueBackgroundSync(true);
                    })
                    .catch(() => {});
            }
        }

        return true;
    }

    async function syncFromSupabase(options = {}) {
        const force = !!options.force;
        const maxAgeMs = Number(options.maxAgeMs);
        const effectiveMaxAgeMs = Number.isFinite(maxAgeMs) && maxAgeMs >= 0
            ? maxAgeMs
            : CROSS_PAGE_SYNC_MIN_DELAY_MS;

        const supabase = getSupabaseClient();
        const currentUserId = getCurrentUserId();
        const currentUserName = getCurrentUserName();
        if (!supabase || !currentUserId || !currentUserName) return false;

        const now = Date.now();
        if (!force && now - lastSyncRun < SYNC_MIN_DELAY_MS) {
            return false;
        }

        if (!force) {
            const lastGlobalSync = readLastSyncTimestamp();
            if (lastGlobalSync > 0 && (now - lastGlobalSync) < effectiveMaxAgeMs) {
                return false;
            }
        }

        if (syncInFlight) return syncInFlight;

        syncInFlight = (async () => {
            const { data, error } = await supabase
                .from('activity_notifications')
                .select('id, recipient_id, actor_id, type, source, source_post_id, post_title, message, is_read, created_at')
                .eq('recipient_id', currentUserId)
                .order('created_at', { ascending: false })
                .limit(MAX_NOTIFICATIONS);

            if (error || !Array.isArray(data)) {
                syncInFlight = null;
                return false;
            }

            const mapped = data
                .map((row) => sanitizeNotification({
                    id: Number(row.id),
                    recipient: getUserNameById(row.recipient_id) || currentUserName,
                    recipientKey: normalizeKey(getUserNameById(row.recipient_id) || currentUserName),
                    actor: getUserNameById(row.actor_id) || '',
                    actorKey: normalizeKey(getUserNameById(row.actor_id) || ''),
                    type: String(row.type || 'comment').toLowerCase(),
                    source: String(row.source || '').toLowerCase(),
                    postId: Number(row.source_post_id) || 0,
                    postTitle: String(row.post_title || 'Publication'),
                    createdAt: row.created_at || new Date().toISOString(),
                    read: !!row.is_read,
                    link: ''
                }))
                .filter(Boolean);

            const currentUserKey = normalizeKey(currentUserName);
            const otherUsersNotifications = readNotifications().filter((item) => item.recipientKey !== currentUserKey);
            writeNotifications([...mapped, ...otherUsersNotifications]);

            lastSyncRun = Date.now();
            localStorage.setItem(SYNC_STORAGE_KEY, new Date().toISOString());
            syncInFlight = null;
            return true;
        })();

        return syncInFlight;
    }

    function queueBackgroundSync(force = false) {
        syncFromSupabase({ force }).catch(() => {});
    }

    window.activityNotifications = {
        STORAGE_KEY,
        getCurrentUserName,
        addNotification,
        listForUser,
        getUnreadCount,
        markAllAsRead,
        markAsRead,
        getNotificationMessage,
        getNotificationLink: buildPostLink,
        syncFromSupabase
    };

    queueBackgroundSync();

    window.addEventListener('focus', () => {
        queueBackgroundSync();
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            queueBackgroundSync();
        }
    });
})();
