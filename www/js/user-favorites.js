(function () {
    const STORAGE_KEY = 'userFavorites';

    const SYNC_STORAGE_KEY = 'userFavoritesLastSyncAt';
    const SYNC_MIN_DELAY_MS = 3000;
    const CROSS_PAGE_SYNC_MIN_DELAY_MS = 45000;

    let lastSyncRun = 0;
    let syncInFlight = null;

    function normalize(value) {
        return String(value || '').trim();
    }

    function normalizeKey(value) {
        return normalize(value).toLowerCase();
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

    function readFavorites() {
        if (window.dataStore && typeof window.dataStore.readArray === 'function') {
            return window.dataStore.readArray(STORAGE_KEY);
        }

        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function writeFavorites(favorites) {
        const safeFavorites = Array.isArray(favorites) ? favorites : [];

        if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
            window.dataStore.writeArray(STORAGE_KEY, safeFavorites);
            return;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(safeFavorites));
    }

    function getCurrentUser() {
        if (window.auth && typeof window.auth.getCurrentUser === 'function') {
            return window.auth.getCurrentUser() || null;
        }
        return null;
    }

    function getCurrentUserId() {
        const user = getCurrentUser();
        if (user && user.supabaseId) return String(user.supabaseId);
        return '';
    }

    function getCurrentUserKey() {
        const user = getCurrentUser();
        if (user) {
            const userName = normalize(user.name);
            if (userName) return normalizeKey(userName);
            const userEmail = normalize(user.email);
            if (userEmail) return normalizeKey(userEmail);
        }

        const connected = localStorage.getItem('imeConnected') === 'true';
        if (!connected) return '';

        const userName = normalize(localStorage.getItem('userName'));
        if (userName) return normalizeKey(userName);

        const userEmail = normalize(localStorage.getItem('userEmail'));
        if (userEmail) return normalizeKey(userEmail);

        return '';
    }

    function ensureId(source, itemId) {
        return `${normalizeKey(source)}:${normalize(itemId)}`;
    }

    function splitFavoriteId(favoriteId) {
        const value = normalize(favoriteId);
        if (!value || !value.includes(':')) return null;

        const splitIndex = value.indexOf(':');
        const source = normalizeKey(value.slice(0, splitIndex));
        const itemId = normalize(value.slice(splitIndex + 1));
        if (!source || !itemId) return null;

        return { source, itemId };
    }

    function listForCurrentUser() {
        const userKey = getCurrentUserKey();
        if (!userKey) return [];

        queueBackgroundSync();

        return readFavorites()
            .filter((item) => normalizeKey(item && item.userKey) === userKey)
            .sort((a, b) => {
                const aTime = new Date(a && a.createdAt || 0).getTime() || 0;
                const bTime = new Date(b && b.createdAt || 0).getTime() || 0;
                return bTime - aTime;
            });
    }

    function isFavorite(source, itemId) {
        const userKey = getCurrentUserKey();
        if (!userKey) return false;

        const id = ensureId(source, itemId);
        return readFavorites().some(
            (item) => normalizeKey(item && item.userKey) === userKey && normalize(item && item.id) === id
        );
    }

    function toggleFavorite(payload) {
        const userKey = getCurrentUserKey();
        if (!userKey) {
            return { ok: false, reason: 'not_logged_in' };
        }

        const source = normalize(payload && payload.source);
        const itemId = normalize(payload && payload.itemId);
        if (!source || !itemId) {
            return { ok: false, reason: 'invalid_payload' };
        }

        const normalizedSource = normalizeKey(source);
        const id = ensureId(source, itemId);
        const favorites = readFavorites();
        const existingIndex = favorites.findIndex(
            (item) => normalizeKey(item && item.userKey) === userKey && normalize(item && item.id) === id
        );

        if (existingIndex >= 0) {
            favorites.splice(existingIndex, 1);
            writeFavorites(favorites);

            if (isSupabaseReady()) {
                const supabase = getSupabaseClient();
                const userId = getCurrentUserId();
                if (supabase && userId) {
                    supabase
                        .from('user_favorites')
                        .delete()
                        .eq('user_id', userId)
                        .eq('source', normalizedSource)
                        .eq('item_id', itemId)
                        .then(() => {
                            queueBackgroundSync(true);
                        })
                        .catch(() => {});
                }
            }

            return { ok: true, favorited: false };
        }

        const nextItem = {
            id,
            userKey,
            source: normalizedSource,
            itemId,
            title: normalize(payload && payload.title) || 'Element favori',
            href: normalize(payload && payload.href) || '',
            createdAt: new Date().toISOString()
        };

        favorites.unshift(nextItem);
        writeFavorites(favorites);

        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const userId = getCurrentUserId();
            if (supabase && userId) {
                supabase
                    .from('user_favorites')
                    .upsert({
                        user_id: userId,
                        source: normalizedSource,
                        item_id: itemId,
                        title: nextItem.title,
                        href: nextItem.href,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id,source,item_id' })
                    .then(() => {
                        queueBackgroundSync(true);
                    })
                    .catch(() => {});
            }
        }

        return { ok: true, favorited: true, item: nextItem };
    }

    function removeFavoriteById(favoriteId) {
        const userKey = getCurrentUserKey();
        if (!userKey) return { ok: false, reason: 'not_logged_in' };

        const id = normalize(favoriteId);
        if (!id) return { ok: false, reason: 'invalid_id' };

        const favorites = readFavorites();
        const nextFavorites = favorites.filter(
            (item) => !(normalizeKey(item && item.userKey) === userKey && normalize(item && item.id) === id)
        );

        if (nextFavorites.length === favorites.length) {
            return { ok: false, reason: 'not_found' };
        }

        writeFavorites(nextFavorites);

        const parsed = splitFavoriteId(id);
        if (parsed && isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const userId = getCurrentUserId();
            if (supabase && userId) {
                supabase
                    .from('user_favorites')
                    .delete()
                    .eq('user_id', userId)
                    .eq('source', parsed.source)
                    .eq('item_id', parsed.itemId)
                    .then(() => {
                        queueBackgroundSync(true);
                    })
                    .catch(() => {});
            }
        }

        return { ok: true };
    }

    async function syncFromSupabase(options = {}) {
        const force = !!options.force;
        const maxAgeMs = Number(options.maxAgeMs);
        const effectiveMaxAgeMs = Number.isFinite(maxAgeMs) && maxAgeMs >= 0
            ? maxAgeMs
            : CROSS_PAGE_SYNC_MIN_DELAY_MS;

        const supabase = getSupabaseClient();
        const userId = getCurrentUserId();
        const userKey = getCurrentUserKey();
        if (!supabase || !userId || !userKey) return false;

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
                .from('user_favorites')
                .select('id, source, item_id, title, href, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(500);

            if (error || !Array.isArray(data)) {
                syncInFlight = null;
                return false;
            }

            const syncedCurrentUser = data.map((row) => {
                const source = normalizeKey(row && row.source || '');
                const itemId = normalize(row && row.item_id || '');
                const id = ensureId(source, itemId);
                return {
                    id,
                    userKey,
                    source,
                    itemId,
                    title: normalize(row && row.title) || 'Element favori',
                    href: normalize(row && row.href) || '',
                    createdAt: row && row.created_at ? row.created_at : new Date().toISOString()
                };
            });

            const otherUsersFavorites = readFavorites().filter((item) => normalizeKey(item && item.userKey) !== userKey);
            writeFavorites([...syncedCurrentUser, ...otherUsersFavorites]);

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

    window.userFavorites = {
        STORAGE_KEY,
        getCurrentUserKey,
        listForCurrentUser,
        isFavorite,
        toggleFavorite,
        removeFavoriteById,
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
