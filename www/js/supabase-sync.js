(function () {
    const SYNC_STORAGE_KEY = 'supabaseLastSyncAt';
    const SYNC_MIN_DELAY_MS = 5000;
    const CROSS_PAGE_SYNC_MIN_DELAY_MS = 45000;
    let lastSyncRun = 0;
    let syncInFlight = null;

    function getSupabaseClient() {
        if (!window.supabaseClient || typeof window.supabaseClient.getClient !== 'function') {
            return null;
        }
        return window.supabaseClient.getClient();
    }

    function isSupabaseReady() {
        return !!getSupabaseClient();
    }

    function writeArray(key, value) {
        const safe = Array.isArray(value) ? value : [];
        if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
            window.dataStore.writeArray(key, safe);
            return;
        }
        localStorage.setItem(key, JSON.stringify(safe));
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

    function readLastSyncTimestamp() {
        const rawValue = localStorage.getItem(SYNC_STORAGE_KEY) || '';
        const timestamp = Date.parse(rawValue);
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function normalizeRoleFromSupabase(value) {
        const role = String(value || '').trim().toLowerCase();
        if (role === 'admin') return 'admin';
        if (role === 'pro') return 'professionnel';
        if (role === 'professionnel') return 'professionnel';
        return 'parent';
    }

    function normalizeKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    function sanitizeShadowUser(user) {
        if (!user || typeof user !== 'object') return {};
        const safe = { ...user };
        delete safe.password;
        delete safe.passwordHash;
        delete safe.passwordHashDev;
        return safe;
    }

    function formatPostDate(value) {
        const date = new Date(value || '');
        if (Number.isNaN(date.getTime())) return String(value || '');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${day}/${month}/${year}`;
    }

    function toAgendaDateKey(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return '';
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getAgendaDateForBlogPost(post) {
        return toAgendaDateKey(post?.eventDate);
    }

    async function fetchProfilesMapByIds(userIds) {
        const supabase = getSupabaseClient();
        const ids = Array.from(new Set((userIds || []).filter(Boolean)));
        const map = new Map();
        if (!supabase || !ids.length) return map;

        const { data, error } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', ids);

        if (error || !Array.isArray(data)) return map;

        data.forEach((row) => {
            if (!row || !row.id) return;
            map.set(row.id, String(row.display_name || '').trim());
        });

        return map;
    }

    async function fetchUsersPhotoMap(supabase) {
        const map = new Map();
        if (!supabase) return map;

        const candidates = ['avatar_url', 'profile_photo'];

        for (const field of candidates) {
            const { data, error } = await supabase
                .from('profiles')
                .select(`id, ${field}`);

            if (error || !Array.isArray(data)) continue;

            data.forEach((row) => {
                const id = String(row && row.id || '').trim();
                const value = String(row && row[field] || '').trim();
                if (!id || !value) return;
                map.set(id, value);
            });

            return map;
        }

        return map;
    }

    async function syncReseau() {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data: postsRows, error: postsError } = await supabase
            .from('reseau_posts')
            .select('id, author_id, title, content, image_data, likes_count, created_at')
            .order('created_at', { ascending: false });

        if (postsError) return;
        const posts = Array.isArray(postsRows) ? postsRows : [];
        if (!posts.length) {
            writeArray('reseauposts', []);
            return;
        }

        const postIds = posts.map((row) => Number(row.id)).filter(Number.isFinite);
        const { data: commentsRows } = await supabase
            .from('reseau_comments')
            .select('id, post_id, author_id, content, created_at')
            .in('post_id', postIds)
            .order('created_at', { ascending: true });

        const comments = Array.isArray(commentsRows) ? commentsRows : [];
        const authorIds = [
            ...posts.map((row) => row.author_id),
            ...comments.map((row) => row.author_id)
        ].filter(Boolean);

        const profilesMap = await fetchProfilesMapByIds(authorIds);
        const commentsByPostId = new Map();

        comments.forEach((row) => {
            const postId = Number(row.post_id);
            if (!Number.isFinite(postId)) return;
            if (!commentsByPostId.has(postId)) commentsByPostId.set(postId, []);
            commentsByPostId.get(postId).push({
                id: Number(row.id),
                authorId: row.author_id || null,
                author: profilesMap.get(row.author_id) || 'Anonyme',
                text: String(row.content || ''),
                date: row.created_at || new Date().toISOString()
            });
        });

        const mappedPosts = posts.map((row) => {
            const id = Number(row.id);
            return {
                id,
                authorId: row.author_id || null,
                title: String(row.title || ''),
                content: String(row.content || ''),
                image: String(row.image_data || ''),
                timestamp: row.created_at || new Date().toISOString(),
                author: profilesMap.get(row.author_id) || 'Anonyme',
                likes: Number(row.likes_count || 0),
                comments: commentsByPostId.get(id) || []
            };
        });

        writeArray('reseauposts', mappedPosts);
    }

    async function syncUsers() {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const queryVariants = [
            { select: 'id, email, display_name, role, is_validated, ime_status, professional_title', titleField: 'professional_title' },
            { select: 'id, email, display_name, role, is_validated, ime_status, job_title', titleField: 'job_title' },
            { select: 'id, display_name, role, is_validated, ime_status, professional_title', titleField: 'professional_title' },
            { select: 'id, display_name, role, is_validated, ime_status, job_title', titleField: 'job_title' },
            { select: 'id, display_name, role, is_validated, ime_status', titleField: '' }
        ];

        let data = null;
        let error = null;
        let titleField = 'professional_title';

        for (const variant of queryVariants) {
            const response = await supabase
                .from('profiles')
                .select(variant.select);

            if (!response.error) {
                data = response.data;
                error = null;
                titleField = variant.titleField;
                break;
            }

            error = response.error;
        }

        if (error || !Array.isArray(data)) return;

        const profilePhotos = await fetchUsersPhotoMap(supabase);

        const localUsers = readArray('users');
        const localBySupabaseId = new Map();
        const localByEmail = new Map();

        localUsers.forEach((user) => {
            if (!user || typeof user !== 'object') return;
            const supabaseId = String(user.supabaseId || '').trim();
            const emailKey = normalizeKey(user.email);
            if (supabaseId) localBySupabaseId.set(supabaseId, user);
            if (emailKey) localByEmail.set(emailKey, user);
        });

        const syncedUsers = [];
        const seenLocalUsers = new Set();

        data.forEach((row) => {
            if (!row || !row.id) return;

            const supabaseId = String(row.id).trim();
            const email = String(row.email || '').trim();
            const emailKey = normalizeKey(email);
            const localMatch = localBySupabaseId.get(supabaseId) || localByEmail.get(emailKey) || null;
            if (localMatch) {
                seenLocalUsers.add(localMatch);
            }

            const role = normalizeRoleFromSupabase(row.role);
            const nameFromProfile = String(row.display_name || '').trim();

            syncedUsers.push({
                ...sanitizeShadowUser(localMatch || {}),
                supabaseId,
                name: nameFromProfile || String(localMatch?.name || '').trim() || 'Membre',
                email: email || String(localMatch?.email || '').trim() || `${supabaseId}@supabase.local`,
                role,
                isValidated: !!row.is_validated,
                imeStatus: String(row.ime_status || localMatch?.imeStatus || '').trim(),
                professionalTitle: String(
                    (titleField ? row[titleField] : '')
                    || row.professional_title
                    || row.job_title
                    || localMatch?.professionalTitle
                    || ''
                ).trim(),
                profilePhoto: String(
                    profilePhotos.get(supabaseId)
                    || localMatch?.profilePhoto
                    || ''
                ).trim()
            });
        });

        const remoteSupabaseIds = new Set(
            data
                .map((row) => String(row && row.id || '').trim())
                .filter(Boolean)
        );
        const remoteEmailKeys = new Set(
            data
                .map((row) => normalizeKey(row && row.email))
                .filter(Boolean)
        );

        // Ne conserve en local que les comptes strictement "locaux" (sans supabaseId)
        // pour eviter le retour des comptes supprimes cote Supabase.
        const remainingLocalUsers = localUsers.filter((user) => {
            if (seenLocalUsers.has(user)) return false;

            const supabaseId = String(user && user.supabaseId || '').trim();
            const emailKey = normalizeKey(user && user.email);

            if (supabaseId) {
                return remoteSupabaseIds.has(supabaseId);
            }

            if (emailKey && remoteEmailKeys.has(emailKey)) {
                return false;
            }

            return true;
        }).map((user) => sanitizeShadowUser(user));

        writeArray('users', [...syncedUsers, ...remainingLocalUsers].map((user) => sanitizeShadowUser(user)));
    }

    async function syncBlog() {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data: postsRows, error: postsError } = await supabase
            .from('blog_posts')
            .select('id, author_id, title, content, category, event_date, created_at')
            .order('created_at', { ascending: false });

        if (postsError) return;
        const posts = Array.isArray(postsRows) ? postsRows : [];
        if (!posts.length) {
            writeArray('blogposts', []);
            return;
        }

        const postIds = posts.map((row) => Number(row.id)).filter(Number.isFinite);
        const { data: commentsRows } = await supabase
            .from('blog_comments')
            .select('id, post_id, author_id, content, created_at')
            .in('post_id', postIds)
            .order('created_at', { ascending: true });

        const comments = Array.isArray(commentsRows) ? commentsRows : [];
        const authorIds = [
            ...posts.map((row) => row.author_id),
            ...comments.map((row) => row.author_id)
        ].filter(Boolean);

        const profilesMap = await fetchProfilesMapByIds(authorIds);
        const commentsByPostId = new Map();

        comments.forEach((row) => {
            const postId = Number(row.post_id);
            if (!Number.isFinite(postId)) return;
            if (!commentsByPostId.has(postId)) commentsByPostId.set(postId, []);
            commentsByPostId.get(postId).push({
                id: Number(row.id),
                authorId: row.author_id || null,
                author: profilesMap.get(row.author_id) || 'Anonyme',
                text: String(row.content || ''),
                date: row.created_at || new Date().toISOString()
            });
        });

        const mappedPosts = posts.map((row) => {
            const createdAt = row.created_at || new Date().toISOString();
            const id = Number(row.id);
            return {
                id,
                authorId: row.author_id || null,
                title: String(row.title || ''),
                content: String(row.content || ''),
                category: String(row.category || 'general'),
                author: profilesMap.get(row.author_id) || 'Anonyme',
                date: formatPostDate(createdAt),
                createdAt,
                eventDate: toAgendaDateKey(row.event_date) || '',
                comments: commentsByPostId.get(id) || []
            };
        });

        writeArray('blogposts', mappedPosts);

        const baseEvents = readArray('agendaEvents').filter((item) => item && item.source !== 'blog');
        const blogEvents = mappedPosts
            .filter((post) => !!getAgendaDateForBlogPost(post))
            .map((post) => ({
                id: `blog-${Number(post.id) || 0}`,
                source: 'blog',
                sourcePostId: Number(post.id) || 0,
                date: getAgendaDateForBlogPost(post),
                title: String(post.title || 'Évènement IME').trim().slice(0, 120),
                author: String(post.author || '').trim(),
                createdAt: String(post.createdAt || new Date().toISOString())
            }));
        writeArray('agendaEvents', [...blogEvents, ...baseEvents]);
    }

    async function syncTools() {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data, error } = await supabase
            .from('tools')
            .select('id, author_id, name, age, steps_json, created_at')
            .order('created_at', { ascending: false });

        if (error) return;

        const rows = Array.isArray(data) ? data : [];
        if (!rows.length) {
            writeArray('tools', []);
            return;
        }

        const authorIds = rows.map((row) => row.author_id).filter(Boolean);
        const profilesMap = await fetchProfilesMapByIds(authorIds);

        const mappedTools = rows.map((row) => {
            let steps = [];
            if (Array.isArray(row.steps_json)) {
                steps = row.steps_json;
            } else if (typeof row.steps_json === 'string') {
                try {
                    const parsed = JSON.parse(row.steps_json);
                    steps = Array.isArray(parsed) ? parsed : [];
                } catch (error) {
                    steps = [];
                }
            }

            return {
                id: Number(row.id),
                authorId: row.author_id || null,
                author: profilesMap.get(row.author_id) || 'Anonyme',
                name: String(row.name || ''),
                age: String(row.age || ''),
                steps,
                createdAt: row.created_at || new Date().toISOString()
            };
        });

        writeArray('tools', mappedTools);
    }

    async function syncAll(options = {}) {
        const force = !!options.force;
        const maxAgeMs = Number(options.maxAgeMs);
        const effectiveMaxAgeMs = Number.isFinite(maxAgeMs) && maxAgeMs >= 0
            ? maxAgeMs
            : CROSS_PAGE_SYNC_MIN_DELAY_MS;
        if (!isSupabaseReady()) return false;

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
            lastSyncRun = now;
            const optionalSyncTasks = [];

            if (window.messagingCore && typeof window.messagingCore.syncAllFromSupabase === 'function') {
                optionalSyncTasks.push(window.messagingCore.syncAllFromSupabase({
                    force,
                    maxAgeMs: effectiveMaxAgeMs
                }));
            }

            if (window.activityNotifications && typeof window.activityNotifications.syncFromSupabase === 'function') {
                optionalSyncTasks.push(window.activityNotifications.syncFromSupabase({
                    force,
                    maxAgeMs: effectiveMaxAgeMs
                }));
            }

            if (window.userFavorites && typeof window.userFavorites.syncFromSupabase === 'function') {
                optionalSyncTasks.push(window.userFavorites.syncFromSupabase({
                    force,
                    maxAgeMs: effectiveMaxAgeMs
                }));
            }

            await Promise.allSettled([
                syncUsers(),
                syncReseau(),
                syncBlog(),
                syncTools(),
                ...optionalSyncTasks
            ]);

            const syncedAt = new Date().toISOString();
            localStorage.setItem(SYNC_STORAGE_KEY, syncedAt);

            try {
                window.dispatchEvent(new CustomEvent('supabase:sync-complete', {
                    detail: {
                        force,
                        syncedAt
                    }
                }));
            } catch (error) {
                // No-op: certains environnements ne supportent pas CustomEvent.
            }

            syncInFlight = null;
            return true;
        })();

        return syncInFlight;
    }

    window.supabaseSync = {
        syncAll,
        syncUsers,
        syncReseau,
        syncBlog,
        syncTools
    };

    document.addEventListener('DOMContentLoaded', () => {
        syncAll().catch(() => {});
    });

    window.addEventListener('focus', () => {
        syncAll().catch(() => {});
    });
})();
