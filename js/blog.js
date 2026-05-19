const BLOG_POSTS_KEY = 'blogposts';
let runtimeBlogPosts = [];
let runtimeBlogPostsLoaded = false;
let nativeBlogDrawerReady = false;
let nativeBlogRenderedCount = 0;
let nativeBlogScrollHandler = null;
const NATIVE_BLOG_INITIAL_BATCH = 10;
const NATIVE_BLOG_BATCH = 8;

function isNativeAppRuntime() {
    const ua = String(window.navigator && window.navigator.userAgent || '');
    try {
        if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
            return window.Capacitor.isNativePlatform();
        }
    } catch (error) {
        // ignore
    }

    const protocol = String(window.location.protocol || '');
    if (protocol === 'capacitor:' || protocol === 'file:') return true;
    if (/capacitor/i.test(ua)) return true;

    try {
        const params = new URLSearchParams(window.location.search || '');
        if (params.get('fromApp') === '1' || params.get('fromOpen') === '1') return true;
    } catch (error) {
        // ignore
    }

    return false;
}

function closeNativeBlogDrawer() {
    document.body.classList.remove('app-native-blog-drawer-open');
    const backdropNode = document.getElementById('appNativeBlogDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeBlogDrawer');
    if (backdropNode) backdropNode.hidden = true;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'true');
}

function openNativeBlogDrawer() {
    document.body.classList.add('app-native-blog-drawer-open');
    const backdropNode = document.getElementById('appNativeBlogDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeBlogDrawer');
    if (backdropNode) backdropNode.hidden = false;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'false');
}

function openNativeBlogCreatePanel() {
    if (!isNativeAppRuntime()) return;
    document.body.classList.add('app-native-blog-create-open');
}

function closeNativeBlogCreatePanel() {
    if (!isNativeAppRuntime()) return;
    document.body.classList.remove('app-native-blog-create-open');
}

function updateNativeBlogDrawerLinks() {
    const profileNode = document.getElementById('appNativeBlogProfileLink');
    const messagesNode = document.getElementById('appNativeBlogMessagesLink');
    const logoutNode = document.getElementById('appNativeBlogLogoutBtn');
    const resetNode = document.getElementById('appNativeBlogAdminResetLink');
    const user = getConnectedUser();
    const isLogged = !!user;

    if (profileNode) {
        const userName = user && user.name ? String(user.name).trim() : '';
        profileNode.href = userName ? `profil.html?user=${encodeURIComponent(userName)}` : 'profil.html';
        profileNode.style.display = isLogged ? 'block' : 'none';
    }

    if (messagesNode) {
        messagesNode.style.display = isLogged ? 'block' : 'none';
    }

    if (logoutNode) {
        logoutNode.style.display = isLogged ? 'block' : 'none';
    }

    if (resetNode) {
        resetNode.style.display = isAdminUser() ? 'block' : 'none';
    }
}

function logoutFromNativeBlogDrawer() {
    if (window.auth && typeof window.auth.logout === 'function') {
        window.auth.logout();
    } else {
        localStorage.removeItem('imeConnected');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
    }

    localStorage.setItem('imeGuestMode', 'false');
    window.location.href = 'ouverture.html';
}

function initNativeBlogExperience() {
    if (!isNativeAppRuntime()) return;
    try {
        localStorage.setItem('imeNativeRuntime', '1');
    } catch (error) {
        // ignore
    }
    document.body.classList.add('is-native-app');
    document.documentElement.classList.remove('native-preload');
    updateNativeBlogDrawerLinks();

    if (nativeBlogDrawerReady) return;
    nativeBlogDrawerReady = true;

    const menuBtnNode = document.getElementById('appNativeBlogMenuBtn');
    const backdropNode = document.getElementById('appNativeBlogDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeBlogDrawer');
    const publishBtnNode = document.getElementById('appNativeBlogPublishBtn');
    const closeCreateBtn = document.getElementById('appNativeBlogCloseCreateBtn');
    const accessibilityNode = document.getElementById('appNativeBlogAccessibilityLink');
    const adminResetNode = document.getElementById('appNativeBlogAdminResetLink');
    const logoutNode = document.getElementById('appNativeBlogLogoutBtn');

    if (menuBtnNode) {
        menuBtnNode.addEventListener('click', () => {
            if (document.body.classList.contains('app-native-blog-drawer-open')) {
                closeNativeBlogDrawer();
            } else {
                openNativeBlogDrawer();
            }
        });
    }

    if (backdropNode) {
        backdropNode.addEventListener('click', closeNativeBlogDrawer);
    }

    if (drawerNode) {
        drawerNode.querySelectorAll('a').forEach((linkNode) => {
            linkNode.addEventListener('click', () => {
                closeNativeBlogDrawer();
            });
        });
    }

    if (publishBtnNode) {
        publishBtnNode.addEventListener('click', () => {
            if (!isUserLoggedIn()) {
                alert("Mode invité: connectez-vous pour publier.");
                return;
            }
            closeNativeBlogDrawer();
            openNativeBlogCreatePanel();
        });
    }

    if (closeCreateBtn) {
        closeCreateBtn.addEventListener('click', closeNativeBlogCreatePanel);
    }

    if (accessibilityNode) {
        accessibilityNode.addEventListener('click', () => {
            closeNativeBlogDrawer();
            const toggleNode = document.getElementById('a11yToggleBtn');
            if (toggleNode) toggleNode.click();
        });
    }

    if (adminResetNode) {
        adminResetNode.addEventListener('click', () => {
            closeNativeBlogDrawer();
            if (isAdminUser() && typeof window.showAdminResetPassword === 'function') {
                window.showAdminResetPassword();
            }
        });
    }

    if (logoutNode) {
        logoutNode.addEventListener('click', () => {
            closeNativeBlogDrawer();
            logoutFromNativeBlogDrawer();
        });
    }
}

    // =========================================================================
    // CONTRÔLE DE L'ÉTAT DE L'UTILISATEUR ET DE LA SÉCURITÉ
    // =========================================================================
document.addEventListener('DOMContentLoaded', async function() {
    registerBlogOfflineProcessors();
    initNativeBlogExperience();
    applyGuestRestrictions();
    initEventDateFieldVisibility();
    initSearchControls();
    await loadPosts();
    updateNativeBlogDrawerLinks();
    const queue = getOfflineQueue();
    if (queue && typeof queue.flush === 'function') {
        queue.flush().catch(() => {});
    }
});

function getConnectedUser() {
    if (window.auth && typeof window.auth.getCurrentUser === 'function') {
        const authUser = window.auth.getCurrentUser();
        if (authUser) return authUser;
    }

    const isConnected = localStorage.getItem('imeConnected') === 'true';
    if (!isConnected) return null;

    return {
        name: localStorage.getItem('userName') || '',
        role: localStorage.getItem('userRole') || '',
        email: localStorage.getItem('userEmail') || ''
    };
}

function getOfflineQueue() {
    return window.offlineActionQueue || null;
}

function shouldQueueOfflineAction(error) {
    const queue = getOfflineQueue();
    if (navigator.onLine === false) return true;
    if (!queue || typeof queue.isLikelyNetworkError !== 'function') return false;
    return queue.isLikelyNetworkError(error);
}

function queueBlogAction(type, payload) {
    const queue = getOfflineQueue();
    if (!queue || typeof queue.enqueue !== 'function') return false;
    const user = getConnectedUser();
    queue.enqueue({
        type,
        payload,
        meta: {
            userEmail: String(user?.email || '').trim().toLowerCase(),
            userName: String(user?.name || '').trim()
        }
    });
    return true;
}

function isQueueActionForCurrentUser(item) {
    const itemEmail = String(item?.meta?.userEmail || '').trim().toLowerCase();
    if (!itemEmail) return true;
    const currentEmail = String(getConnectedUser()?.email || '').trim().toLowerCase();
    return !!currentEmail && currentEmail === itemEmail;
}

function isUserLoggedIn() {
    if (window.auth && typeof window.auth.isLoggedIn === 'function') {
        return window.auth.isLoggedIn();
    }

    return localStorage.getItem('imeConnected') === 'true';
}

function getCurrentUserName() {
    const user = getConnectedUser();
    return user && user.name ? user.name : '';
}

function isAdminUser() {
    if (window.auth && typeof window.auth.isAdmin === 'function') {
        return window.auth.isAdmin();
    }

    const user = getConnectedUser();
    return !!(user && user.role === 'admin');
}

function isProfessionalUser() {
    const user = getConnectedUser();
    if (!user) return false;
    return String(user.role || '').trim().toLowerCase() === 'professionnel';
}

function isProfessionalOrAdminUser() {
    const user = getConnectedUser();
    if (!user) return false;
    const role = String(user.role || '').trim().toLowerCase();
    return role === 'professionnel' || role === 'admin';
}

function isAgendaEligibleCategory(category) {
    const normalized = String(category || '').trim().toLowerCase();
    return normalized === 'activities' || normalized === 'announcements' || normalized === 'education';
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

function getAgendaDateForPost(post) {
    return toAgendaDateKey(post?.eventDate);
}

function formatEventDate(value) {
    const key = toAgendaDateKey(value);
    if (!key) return '';

    const parsed = new Date(`${key}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return key;
    return parsed.toLocaleDateString('fr-FR');
}

function parsePostDate(value) {
    if (!value && value !== 0) return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
        const fromNumber = new Date(value);
        return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const fromIsoDate = new Date(`${raw}T00:00:00`);
        return Number.isNaN(fromIsoDate.getTime()) ? null : fromIsoDate;
    }

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
        const [first, second, year] = raw.split('/').map((part) => Number(part));
        const day = first;
        const month = second;
        const fromFrench = new Date(year, month - 1, day);
        return Number.isNaN(fromFrench.getTime()) ? null : fromFrench;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPostDate(value) {
    const parsed = parsePostDate(value);
    if (!parsed) return String(value || '');
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = String(parsed.getFullYear());
    return `${day}/${month}/${year}`;
}

function resolvePostDate(post) {
    const fromDate = parsePostDate(post?.date);
    const fromCreatedAt = parsePostDate(post?.createdAt);
    const postIdNumber = Number(post?.id);
    const fromId = Number.isFinite(postIdNumber) ? parsePostDate(postIdNumber) : null;

    if (fromDate) {
        if (fromCreatedAt) {
            const diffMs = Math.abs(fromDate.getTime() - fromCreatedAt.getTime());
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays > 90) return fromCreatedAt;
            return fromDate;
        }

        if (fromId) {
            const diffMs = Math.abs(fromDate.getTime() - fromId.getTime());
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays > 90) return fromId;
            return fromDate;
        }

        return fromDate;
    }

    return fromCreatedAt || fromId || null;
}

function getPostSortTimestamp(post) {
    const resolved = resolvePostDate(post);
    if (resolved) return resolved.getTime();
    return 0;
}

function getHighlightPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawId = params.get('highlightPost');
    if (!rawId) return null;

    const id = Number(rawId);
    return Number.isFinite(id) ? id : null;
}

function getHighlightDateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawDate = params.get('highlightDate');
    const cleanDate = toAgendaDateKey(rawDate);
    return cleanDate || null;
}

function getHighlightTitleFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('highlightTitle') || '').trim();
}

function canDeleteByAuthor(authorName) {
    if (window.auth && typeof window.auth.canDeleteAuthorContent === 'function') {
        return window.auth.canDeleteAuthorContent(authorName);
    }

    const user = getConnectedUser();
    if (!user || !user.name) return false;
    if (user.role === 'admin') return true;
    if (!authorName) return false;
    return user.name.toLowerCase() === String(authorName).toLowerCase();
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function profileLinkHtml(authorName) {
    const safeAuthor = escapeHtml(authorName || 'Anonyme');
    const profileUrl = `profil.html?user=${encodeURIComponent(authorName || 'Anonyme')}`;
    return `<a class="profile-link" href="${profileUrl}">${safeAuthor}</a>`;
}

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
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

function persistResolvedSupabaseUserId(userId) {
    const cleanId = String(userId || '').trim();
    if (!cleanId) return;
    try {
        if (window.dataStore && typeof window.dataStore.writeValue === 'function') {
            window.dataStore.writeValue('userSupabaseId', cleanId);
            return;
        }
        localStorage.setItem('userSupabaseId', cleanId);
    } catch (error) {
        // ignore storage issues
    }
}

async function getCurrentSupabaseUserId() {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    if (window.auth && typeof window.auth.getCurrentUserSupabaseId === 'function') {
        const fromSession = String(window.auth.getCurrentUserSupabaseId() || '').trim();
        if (fromSession) return fromSession;
    }

    try {
        const fromStorage = String(localStorage.getItem('userSupabaseId') || '').trim();
        if (fromStorage) return fromStorage;
    } catch (error) {
        // ignore
    }

    try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data && data.user && data.user.id) {
            const userId = String(data.user.id).trim();
            if (userId) {
                persistResolvedSupabaseUserId(userId);
                return userId;
            }
        }
    } catch (error) {
        // fallback below
    }

    try {
        const { data, error } = await supabase.auth.getSession();
        const userId = String(data?.session?.user?.id || '').trim();
        if (!error && userId) {
            persistResolvedSupabaseUserId(userId);
            return userId;
        }
    } catch (error) {
        // fallback below
    }

    try {
        const currentUser = window.auth && typeof window.auth.getCurrentUser === 'function'
            ? window.auth.getCurrentUser()
            : null;
        const email = String(currentUser && currentUser.email || '').trim().toLowerCase();
        if (!email) return null;
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        if (!error && data && data.id) {
            const resolvedId = String(data.id).trim();
            persistResolvedSupabaseUserId(resolvedId);
            return resolvedId;
        }
    } catch (error) {
        // ignore
    }

    try {
        const currentUser = window.auth && typeof window.auth.getCurrentUser === 'function'
            ? window.auth.getCurrentUser()
            : null;
        const displayName = String(currentUser && currentUser.name || '').trim();
        if (!displayName) return null;
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('display_name', displayName)
            .limit(1);
        if (!error && Array.isArray(data) && data[0] && data[0].id) {
            const resolvedId = String(data[0].id).trim();
            persistResolvedSupabaseUserId(resolvedId);
            return resolvedId;
        }
    } catch (error) {
        // ignore
    }

    return null;
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

async function fetchSupabaseBlogPosts() {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, posts: [] };

    const { data: postRows, error: postsError } = await supabase
        .from('blog_posts')
        .select('id, author_id, title, content, category, event_date, created_at')
        .order('created_at', { ascending: false });

    if (postsError) {
        console.error('Erreur chargement posts blog (Supabase):', postsError.message);
        return { ok: false, posts: [] };
    }

    const safePostRows = Array.isArray(postRows) ? postRows : [];
    if (!safePostRows.length) return { ok: true, posts: [] };

    const postIds = safePostRows
        .map((row) => Number(row.id))
        .filter(Number.isFinite);

    const { data: commentRows, error: commentsError } = await supabase
        .from('blog_comments')
        .select('id, post_id, author_id, content, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

    if (commentsError) {
        console.error('Erreur chargement commentaires blog (Supabase):', commentsError.message);
    }

    const safeComments = Array.isArray(commentRows) ? commentRows : [];
    const authorIds = [
        ...safePostRows.map((row) => row.author_id),
        ...safeComments.map((row) => row.author_id)
    ].filter(Boolean);

    const profilesMap = await fetchProfilesMapByIds(authorIds);
    const commentsByPostId = new Map();

    safeComments.forEach((row) => {
        const postId = Number(row.post_id);
        if (!Number.isFinite(postId)) return;
        if (!commentsByPostId.has(postId)) {
            commentsByPostId.set(postId, []);
        }

        commentsByPostId.get(postId).push({
            id: Number(row.id),
            authorId: row.author_id || null,
            author: profilesMap.get(row.author_id) || 'Anonyme',
            text: String(row.content || ''),
            date: row.created_at || new Date().toISOString()
        });
    });

    const posts = safePostRows.map((row) => {
        const createdAt = row.created_at || new Date().toISOString();
        const postId = Number(row.id);
        const eventDate = row.event_date ? toAgendaDateKey(row.event_date) : '';
        return {
            id: postId,
            authorId: row.author_id || null,
            title: String(row.title || ''),
            content: String(row.content || ''),
            category: String(row.category || 'general'),
            author: profilesMap.get(row.author_id) || 'Anonyme',
            date: formatPostDate(createdAt),
            createdAt,
            eventDate: eventDate || '',
            comments: commentsByPostId.get(postId) || []
        };
    });

    return { ok: true, posts };
}

async function insertBlogPostToSupabase(postData) {
    const supabase = getSupabaseClient();
    const authorId = await getCurrentSupabaseUserId();
    if (!supabase || !authorId) {
        throw new Error('auth_unavailable');
    }

    const payload = {
        author_id: authorId,
        title: String(postData?.title || '').trim(),
        content: String(postData?.content || '').trim(),
        category: String(postData?.category || 'general').trim().toLowerCase(),
        event_date: postData?.eventDate || null
    };

    const { data, error } = await supabase
        .from('blog_posts')
        .insert(payload)
        .select('id, created_at')
        .single();

    if (error) {
        throw new Error(error.message || 'insert_blog_post_failed');
    }

    return {
        id: Number(data?.id) || Date.now(),
        createdAt: data?.created_at || new Date().toISOString()
    };
}

async function insertBlogCommentToSupabase(postId, commentText) {
    const supabase = getSupabaseClient();
    const authorId = await getCurrentSupabaseUserId();
    if (!supabase || !authorId) {
        throw new Error('auth_unavailable');
    }

    const { error } = await supabase.from('blog_comments').insert({
        post_id: Number(postId),
        author_id: authorId,
        content: String(commentText || '').trim()
    });

    if (error) {
        throw new Error(error.message || 'insert_blog_comment_failed');
    }

    return true;
}

function registerBlogOfflineProcessors() {
    const queue = getOfflineQueue();
    if (!queue || typeof queue.registerProcessor !== 'function') return;

    queue.registerProcessor('blog.createPost', async (item) => {
        if (!isQueueActionForCurrentUser(item)) return { retry: true };
        const payload = item?.payload || {};
        const saveResult = await insertBlogPostToSupabase(payload);
        if (payload?.eventDate) {
            upsertAgendaEventFromBlogPost({
                id: saveResult.id,
                title: payload.title || '',
                category: payload.category || '',
                eventDate: payload.eventDate
            });
        }
        return { ok: true };
    });

    queue.registerProcessor('blog.addComment', async (item) => {
        if (!isQueueActionForCurrentUser(item)) return { retry: true };
        const payload = item?.payload || {};
        await insertBlogCommentToSupabase(payload.postId, payload.commentText);
        return { ok: true };
    });
}

function getPostNotificationTitle(post) {
    const title = String(post?.title || '').trim();
    if (title) return title.slice(0, 120);

    const content = String(post?.content || '').trim();
    if (content) return content.slice(0, 120);

    return 'Sujet blog';
}

function addActivityNotification(payload) {
    if (!window.activityNotifications || typeof window.activityNotifications.addNotification !== 'function') {
        return;
    }

    const result = window.activityNotifications.addNotification(payload);
    if (!result.ok) return;

    if (window.messagesWidget && typeof window.messagesWidget.updateUnreadBadges === 'function') {
        window.messagesWidget.updateUnreadBadges();
    }
}

function notifyCommentOnBlogPost(post, actorName, existingCommentAuthors) {
    if (!post || !actorName) return;

    const actorKey = normalizeKey(actorName);
    const recipients = new Set();
    const authorKey = normalizeKey(post.author);

    if (post.author) {
        recipients.add(String(post.author).trim());
    }

    (existingCommentAuthors || []).forEach((name) => {
        const cleanName = String(name || '').trim();
        if (!cleanName) return;
        recipients.add(cleanName);
    });

    recipients.forEach((recipientName) => {
        const recipientKey = normalizeKey(recipientName);
        if (!recipientKey || recipientKey === actorKey) return;

        const notificationType = recipientKey === authorKey ? 'comment' : 'reply';
        addActivityNotification({
            recipient: recipientName,
            actor: actorName,
            type: notificationType,
            source: 'blog',
            postId: Number(post.id) || 0,
            postTitle: getPostNotificationTitle(post)
        });
    });
}

function getBlogPostById(postId) {
    const id = Number(postId);
    if (!Number.isFinite(id)) return null;

    const posts = readBlogPosts();
    return posts.find((post) => Number(post?.id) === id) || null;
}

function getBlogFavoritePayload(post) {
    const postId = Number(post?.id);
    if (!Number.isFinite(postId)) return null;

    const title = getPostNotificationTitle(post);
    return {
        source: 'blog',
        itemId: String(postId),
        title,
        href: `blog.html?highlightPost=${encodeURIComponent(postId)}#post-${encodeURIComponent(postId)}`
    };
}

function getBlogFavoriteButtonLabel(isFavorited) {
    return isFavorited ? '★ Retirer des favoris' : '☆ Ajouter aux favoris';
}

function printBlogPost(postId) {
    const post = getBlogPostById(postId);
    if (!post) {
        alert("Impossible d'imprimer: post introuvable.");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=960,height=760');
    if (!printWindow) {
        alert("L'ouverture de la fenêtre d'impression a été bloquée.");
        return;
    }

    const safeTitle = escapeHtml(post.title || 'Sans titre');
    const safeCategory = escapeHtml(getCategoryLabel(post.category));
    const safeAuthor = escapeHtml(post.author || 'Anonyme');
    const safeDate = escapeHtml(formatPostDate(resolvePostDate(post)));
    const safeContent = escapeHtml(post.content || '');
    const safeEventDate = formatEventDate(post.eventDate);

    const commentsHtml = Array.isArray(post.comments) && post.comments.length > 0
        ? post.comments.map((comment) => `
            <li>
                <strong>${escapeHtml(comment?.author || 'Anonyme')}</strong>
                <span>${escapeHtml(comment?.date ? formatPostDate(comment.date) : '')}</span>
                <p>${escapeHtml(comment?.text || '')}</p>
            </li>
        `).join('')
        : '<li><p>Aucun commentaire.</p></li>';

    printWindow.document.write(`
        <!doctype html>
        <html lang="fr">
        <head>
            <meta charset="utf-8">
            <title>Impression - ${safeTitle}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
                h1 { margin: 0 0 10px; font-size: 24px; }
                .meta { color: #4b5563; margin-bottom: 12px; font-size: 14px; }
                .content { white-space: pre-wrap; line-height: 1.55; margin: 12px 0; }
                .event { color: #174a84; font-weight: 700; margin-bottom: 12px; }
                h2 { margin: 18px 0 8px; font-size: 18px; }
                ul { margin: 0; padding-left: 18px; }
                li { margin-bottom: 10px; }
                li span { color: #6b7280; font-size: 12px; margin-left: 6px; }
                li p { margin: 4px 0 0; white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <h1>${safeTitle}</h1>
            <div class="meta">${safeCategory} • Publié le ${safeDate} • Par ${safeAuthor}</div>
            ${safeEventDate ? `<div class="event">Évènement prévu le ${escapeHtml(safeEventDate)}</div>` : ''}
            <div class="content">${safeContent}</div>
            <h2>Commentaires</h2>
            <ul>${commentsHtml}</ul>
            <script>
                window.addEventListener('load', function () {
                    setTimeout(function () { window.print(); }, 100);
                });
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function toggleBlogFavorite(postId, buttonEl) {
    if (!window.userFavorites || typeof window.userFavorites.toggleFavorite !== 'function') {
        return;
    }

    if (!isUserLoggedIn()) {
        alert('Connectez-vous pour ajouter ce post aux favoris.');
        return;
    }

    const post = getBlogPostById(postId);
    if (!post) return;

    const payload = getBlogFavoritePayload(post);
    if (!payload) return;

    const result = window.userFavorites.toggleFavorite(payload);
    if (!result.ok) return;

    const isFavorited = !!result.favorited;
    if (buttonEl) {
        buttonEl.textContent = getBlogFavoriteButtonLabel(isFavorited);
        buttonEl.classList.toggle('is-active', isFavorited);
    }
}

function getCategoryLabel(category) {
    const map = {
        general: 'Général',
        education: 'Éducation',
        activities: 'Activités',
        resources: 'Ressources',
        announcements: 'Annonces'
    };

    const key = String(category || '').trim().toLowerCase();
    return map[key] || 'Général';
}

function getCategoryStyleKey(category) {
    const normalized = String(category || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (normalized === 'announcements' || normalized === 'annonces' || normalized === 'annonce') {
        return 'announcements';
    }
    if (normalized === 'activities' || normalized === 'activites' || normalized === 'activite') {
        return 'activities';
    }
    if (normalized === 'education') {
        return 'education';
    }
    if (normalized === 'resources' || normalized === 'ressources' || normalized === 'ressource') {
        return 'resources';
    }
    return 'general';
}

function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function getActiveSearchFilters() {
    const themeNode = document.getElementById('searchTheme');
    const queryNode = document.getElementById('searchQuery');

    return {
        theme: String(themeNode?.value || 'all').trim().toLowerCase(),
        query: normalizeSearchText(queryNode?.value || '')
    };
}

function filterBlogPosts(posts) {
    const safePosts = Array.isArray(posts) ? posts : [];
    const filters = getActiveSearchFilters();

    return safePosts.filter((post) => {
        const postCategory = String(post?.category || '').trim().toLowerCase();
        const themeMatches = filters.theme === 'all' || postCategory === filters.theme;
        if (!themeMatches) return false;

        if (!filters.query) return true;

        const commentTexts = Array.isArray(post?.comments)
            ? post.comments.map((comment) => comment?.text || '')
            : [];

        const searchableParts = [
            post?.title,
            post?.content,
            post?.author,
            getCategoryLabel(post?.category),
            post?.date,
            formatEventDate(post?.eventDate),
            ...commentTexts
        ];

        return searchableParts.some((part) => normalizeSearchText(part).includes(filters.query));
    });
}

function initSearchControls() {
    const themeNode = document.getElementById('searchTheme');
    const queryNode = document.getElementById('searchQuery');
    const resetNode = document.getElementById('searchResetBtn');

    if (!themeNode || !queryNode || !resetNode) return;

    themeNode.addEventListener('change', loadPosts);
    queryNode.addEventListener('input', loadPosts);
    resetNode.addEventListener('click', () => {
        themeNode.value = 'all';
        queryNode.value = '';
        loadPosts();
    });
}

function readBlogPosts() {
    if (isSupabaseReady() && runtimeBlogPostsLoaded) {
        return runtimeBlogPosts;
    }

    if (Array.isArray(runtimeBlogPosts) && runtimeBlogPosts.length) {
        return runtimeBlogPosts;
    }

    if (window.dataStore && typeof window.dataStore.readArray === 'function') {
        return window.dataStore.readArray('blogposts');
    }

    try {
        const parsed = JSON.parse(localStorage.getItem('blogposts') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function writeBlogPosts(posts) {
    runtimeBlogPosts = Array.isArray(posts) ? posts : [];
    runtimeBlogPostsLoaded = true;

    if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
        window.dataStore.writeArray('blogposts', posts);
        return;
    }

    localStorage.setItem('blogposts', JSON.stringify(posts));
}

function readAgendaEvents() {
    if (window.dataStore && typeof window.dataStore.readArray === 'function') {
        return window.dataStore.readArray('agendaEvents');
    }

    try {
        const parsed = JSON.parse(localStorage.getItem('agendaEvents') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function writeAgendaEvents(events) {
    if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
        window.dataStore.writeArray('agendaEvents', events);
        return;
    }

    localStorage.setItem('agendaEvents', JSON.stringify(events));
}

function upsertAgendaEventFromBlogPost(post) {
    if (!post || !post.id) return;

    const cleanDate = getAgendaDateForPost(post);
    if (!cleanDate) return;

    const sourcePostId = Number(post.id);
    const agendaEvents = readAgendaEvents().filter((item) => {
        if (!item || typeof item !== 'object') return false;
        return !(item.source === 'blog' && Number(item.sourcePostId) === sourcePostId);
    });

    agendaEvents.unshift({
        id: `blog-${sourcePostId}`,
        source: 'blog',
        sourcePostId,
        date: cleanDate,
        title: String(post.title || 'Évènement IME').trim().slice(0, 120),
        author: String(post.author || '').trim(),
        createdAt: new Date().toISOString()
    });

    writeAgendaEvents(agendaEvents);
}

function removeAgendaEventForBlogPost(postId) {
    const sourcePostId = Number(postId);
    const nextEvents = readAgendaEvents().filter((item) => {
        if (!item || typeof item !== 'object') return false;
        return !(item.source === 'blog' && Number(item.sourcePostId) === sourcePostId);
    });
    writeAgendaEvents(nextEvents);
}

function updateEventDateFieldVisibility() {
    const categoryField = document.getElementById('postCategory');
    const dateGroup = document.getElementById('eventDateFieldGroup');
    const dateInput = document.getElementById('eventDateInput');
    if (!categoryField || !dateGroup || !dateInput) return;

    const shouldShow = isProfessionalOrAdminUser() && isAgendaEligibleCategory(categoryField.value);
    dateGroup.hidden = !shouldShow;
    dateInput.required = shouldShow;

    if (shouldShow) {
        const today = new Date();
        const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        dateInput.min = minDate;
        return;
    }

    dateInput.value = '';
}

function initEventDateFieldVisibility() {
    const categoryField = document.getElementById('postCategory');
    if (!categoryField) return;
    categoryField.addEventListener('change', updateEventDateFieldVisibility);
    updateEventDateFieldVisibility();
}

function highlightPostsFromUrl() {
    const highlightPostId = getHighlightPostIdFromUrl();
    const highlightDate = getHighlightDateFromUrl();
    const highlightTitle = getHighlightTitleFromUrl();
    const allPosts = Array.from(document.querySelectorAll('.post'));
    if (allPosts.length === 0) return;

    allPosts.forEach((postNode) => postNode.classList.remove('post-highlight'));

    if (Number.isFinite(highlightPostId)) {
        const targetPost = document.querySelector(`.post[data-id="${highlightPostId}"]`) ||
            document.getElementById(`post-${highlightPostId}`);
        if (!targetPost) {
            // Continue with fallback title/hash.
        } else {
            targetPost.classList.add('post-highlight');
            targetPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    if (highlightTitle) {
        const titleNeedle = normalizeSearchText(highlightTitle);
        const matchingByTitle = allPosts.find((postNode) => {
            const titleText = normalizeSearchText(postNode.querySelector('.post-header h3')?.textContent || '');
            const contentText = normalizeSearchText(postNode.querySelector('.post-content')?.textContent || '');
            return titleText.includes(titleNeedle) || contentText.includes(titleNeedle);
        });

        if (matchingByTitle) {
            matchingByTitle.classList.add('post-highlight');
            matchingByTitle.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    if (window.location.hash) {
        const hashId = window.location.hash.replace('#', '');
        const hashTarget = hashId ? document.getElementById(hashId) : null;
        if (hashTarget) {
            hashTarget.classList.add('post-highlight');
            hashTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    if (!highlightDate) return;
    const matchingPosts = allPosts.filter((postNode) => postNode.dataset.eventDate === highlightDate);
    if (matchingPosts.length === 0) return;

    matchingPosts.forEach((postNode) => postNode.classList.add('post-highlight'));
    matchingPosts[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function applyGuestRestrictions() {
    const nativePublishBtn = document.getElementById('appNativeBlogPublishBtn');

    if (isUserLoggedIn()) return;

    const postForm = document.getElementById('postForm');
    const createSection = document.querySelector('.create-post');
    if (!postForm) return;

    postForm.querySelectorAll('input, textarea, select, button').forEach((field) => {
        field.disabled = true;
    });

    if (createSection && !document.getElementById('guestNoticeBlog')) {
        const notice = document.createElement('p');
        notice.id = 'guestNoticeBlog';
        notice.textContent = 'Mode invité: consultation uniquement (publication et commentaires désactivés).';
        notice.style.marginTop = '0.8rem';
        notice.style.fontWeight = '700';
        notice.style.color = '#7a3f00';
        createSection.appendChild(notice);
    }

    if (nativePublishBtn) {
        nativePublishBtn.disabled = true;
        nativePublishBtn.style.opacity = '0.6';
    }
}

function hasBlogHighlightTargetInUrl() {
    const query = new URLSearchParams(window.location.search || '');
    return (
        query.has('highlightPost') ||
        query.has('highlightDate') ||
        query.has('highlightTitle') ||
        !!window.location.hash
    );
}

function renderBlogSkeleton(postsContainer, count = 3) {
    postsContainer.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
        const skeleton = document.createElement('div');
        skeleton.className = 'post blog-skeleton';
        skeleton.innerHTML = `
            <div class="skeleton-line skeleton-line-lg"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line skeleton-line-sm"></div>
        `;
        postsContainer.appendChild(skeleton);
    }
}

function appendBlogPostsBatch(postsContainer, posts, startIndex, batchSize) {
    let index = startIndex;
    const limit = Math.min(posts.length, startIndex + batchSize);
    while (index < limit) {
        const postElement = createPostElement(posts[index]);
        if (postElement) postsContainer.appendChild(postElement);
        index += 1;
    }
    nativeBlogRenderedCount = index;
}

function clearBlogInfiniteScroll() {
    if (!nativeBlogScrollHandler) return;
    window.removeEventListener('scroll', nativeBlogScrollHandler);
    nativeBlogScrollHandler = null;
}

function setupBlogInfiniteScroll(postsContainer, posts) {
    clearBlogInfiniteScroll();

    const allowBatchMode = isNativeAppRuntime() && posts.length > NATIVE_BLOG_INITIAL_BATCH && !hasBlogHighlightTargetInUrl();
    if (!allowBatchMode) return;

    nativeBlogScrollHandler = () => {
        if (nativeBlogRenderedCount >= posts.length) {
            clearBlogInfiniteScroll();
            return;
        }

        const scrollBottom = window.scrollY + window.innerHeight;
        const pageBottom = document.documentElement.scrollHeight - 200;
        if (scrollBottom < pageBottom) return;

        appendBlogPostsBatch(postsContainer, posts, nativeBlogRenderedCount, NATIVE_BLOG_BATCH);
    };

    window.addEventListener('scroll', nativeBlogScrollHandler, { passive: true });
}

    // =========================================================================
    // GESTION DES POSTS (CRÉATION, AFFICHAGE, SUPPRESSION)
    // =========================================================================

    // Fonction pour charger et afficher les posts
    async function loadPosts() {
        const postsContainer = document.getElementById('postsContainer');
        if (!postsContainer) return;

        renderBlogSkeleton(postsContainer, isNativeAppRuntime() ? 4 : 3);
        await Promise.resolve();

        let posts = [];
        if (isSupabaseReady()) {
            const supabaseResult = await fetchSupabaseBlogPosts();
            if (supabaseResult.ok) {
                posts = supabaseResult.posts;
                writeBlogPosts(posts);

                // Miroir agenda derive du blog (sans toucher les autres sources éventuelles).
                const baseEvents = readAgendaEvents().filter((item) => item && item.source !== 'blog');
                const blogEvents = posts
                    .filter((post) => !!getAgendaDateForPost(post))
                    .map((post) => ({
                        id: `blog-${Number(post.id) || 0}`,
                        source: 'blog',
                        sourcePostId: Number(post.id) || 0,
                        date: getAgendaDateForPost(post),
                        title: String(post.title || 'Évènement IME').trim().slice(0, 120),
                        author: String(post.author || '').trim(),
                        createdAt: String(post.createdAt || new Date().toISOString())
                    }));

                writeAgendaEvents([...blogEvents, ...baseEvents]);
            } else {
                posts = readBlogPosts();
            }
        } else {
            posts = readBlogPosts();
        }

        posts.sort((a, b) => getPostSortTimestamp(b) - getPostSortTimestamp(a));
        posts = filterBlogPosts(posts);

        postsContainer.innerHTML = '';
        nativeBlogRenderedCount = 0;

        if (posts.length === 0) {
            clearBlogInfiniteScroll();
            const emptyNode = document.createElement('p');
            emptyNode.className = 'posts-empty';
            emptyNode.textContent = 'Aucun sujet ne correspond à votre recherche.';
            postsContainer.appendChild(emptyNode);
            return;
        }

        if (isNativeAppRuntime() && posts.length > NATIVE_BLOG_INITIAL_BATCH && !hasBlogHighlightTargetInUrl()) {
            appendBlogPostsBatch(postsContainer, posts, 0, NATIVE_BLOG_INITIAL_BATCH);
            setupBlogInfiniteScroll(postsContainer, posts);
        } else {
            clearBlogInfiniteScroll();
            appendBlogPostsBatch(postsContainer, posts, 0, posts.length);
        }

        highlightPostsFromUrl();
    }

    // Fonction pour créer un élément HTML de post
function createPostElement(post) {
    const postId = Number(post.id);
    if (!Number.isFinite(postId)) {
        return null;
    }

    const postDiv = document.createElement('div');
    const categoryStyleKey = getCategoryStyleKey(post.category);
    postDiv.className = `post post-cat-${categoryStyleKey}`;
    postDiv.dataset.id = postId;
    postDiv.id = `post-${postId}`;
    const normalizedEventDate = toAgendaDateKey(post.eventDate);
    if (normalizedEventDate) {
        postDiv.dataset.eventDate = normalizedEventDate;
    }

    // Vérifie si l'utilisateur est un admin OU si c'est l'auteur du post
    const canDelete = canDeleteByAuthor(post.author);
    const deleteButton = canDelete ? `<button class="delete-btn" onclick="deletePost(${postId})">Supprimer</button>` : '';
    const safeTitle = escapeHtml(post.title || 'Sans titre');
    const safeCategory = escapeHtml(getCategoryLabel(post.category));
    const safeContent = escapeHtml(post.content || '');
    const safeDate = escapeHtml(formatPostDate(resolvePostDate(post)));
    const safeEventDate = formatEventDate(post.eventDate);
    const favoritePayload = getBlogFavoritePayload(post);
    const isFavorited = favoritePayload && window.userFavorites && typeof window.userFavorites.isFavorite === 'function'
        ? window.userFavorites.isFavorite(favoritePayload.source, favoritePayload.itemId)
        : false;
    const favoriteLabel = getBlogFavoriteButtonLabel(isFavorited);
    const favoriteStateClass = isFavorited ? 'is-active' : '';

    const isGuest = !isUserLoggedIn();

    postDiv.innerHTML = `
        <div class="post-header">
            <div class="post-title-wrap">
                <h3>${safeTitle}</h3>
                <div class="post-meta-row">
                    <span class="post-category">${safeCategory}</span>
                    <span class="post-date">Publié le ${safeDate}</span>
                </div>
            </div>
            ${deleteButton}
        </div>
        <p class="post-content">${safeContent}</p>
        ${safeEventDate ? `<p class="post-event-date">Évènement prévu le ${escapeHtml(safeEventDate)}</p>` : ''}
        <span class="post-author">Par ${profileLinkHtml(post.author)}</span>
        <div class="post-actions">
            <button class="post-action-btn post-favorite-btn ${favoriteStateClass}" onclick="toggleBlogFavorite(${postId}, this)">
                ${favoriteLabel}
            </button>
            <button class="post-action-btn post-print-btn" onclick="printBlogPost(${postId})">
                🖨️ Imprimer
            </button>
        </div>
        
        <div class="comments-section">
            <div class="comment-list">
                ${post.comments ? post.comments.map((comment, index) => createCommentElement(comment, postId, index)).join('') : ''}
            </div>
            <div class="add-comment">
                <input type="text" placeholder="${isGuest ? 'Mode invité: commentaires désactivés' : 'Ajouter un commentaire...'}" onkeydown="addComment(event, ${postId})" ${isGuest ? 'disabled' : ''}>
            </div>
        </div>
    `;
    return postDiv;
}

// Fonction pour supprimer un post
async function deletePost(postId) {
    // 2. Trouver le post à supprimer en utilisant son ID
    let posts = readBlogPosts();
    const postToDelete = posts.find(post => Number(post.id) === Number(postId));

    if (!postToDelete) {
        alert("Ce post n'existe plus.");
        return;
    }

    // 3. Vérifier les droits de l'utilisateur
    // Si l'utilisateur n'est PAS un admin ET n'est PAS le propriétaire, on affiche une alerte
    if (!canDeleteByAuthor(postToDelete.author)) {
        alert("Vous n'avez pas les autorisations pour supprimer ce post.");
        return; // Stoppe l'exécution de la fonction
    }
    
    // 4. Si l'utilisateur a les droits, on procède à la suppression
    if (confirm("Êtes-vous sûr de vouloir supprimer ce post ?")) {
        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const { error } = await supabase
                .from('blog_posts')
                .delete()
                .eq('id', Number(postId));

            if (error) {
                alert("Suppression impossible pour le moment.");
                return;
            }

            removeAgendaEventForBlogPost(postId);
            await loadPosts();
            return;
        }

        // Filtrer le tableau pour retirer le post avec l'ID correspondant
        posts = posts.filter(post => Number(post.id) !== Number(postId));
        
        // Mettre à jour le localStorage avec la nouvelle liste
        writeBlogPosts(posts);
        removeAgendaEventForBlogPost(postId);
        
        // Supprimer l'élément de la page
        const postElement = document.querySelector(`.post[data-id="${postId}"]`);
        if (postElement) {
            postElement.remove();
        }
    }
}
    // =========================================================================
    // GESTION DES COMMENTAIRES (CRÉATION, AFFICHAGE, SUPPRESSION)
    // =========================================================================

    // Fonction pour créer un élément de commentaire
    function createCommentElement(comment, postId, commentIndex) {
        const canDeleteComment = isAdminUser() || canDeleteByAuthor(comment?.author);
        const commentId = Number(comment?.id);
        const commentRef = Number.isFinite(commentId) ? `id:${commentId}` : `idx:${commentIndex}`;
        const deleteButton = canDeleteComment
            ? `<button class="delete-comment-btn" onclick="deleteComment(${postId}, '${commentRef}')">X</button>`
            : '';

        return `
            <p class="comment-item">
                <strong>${profileLinkHtml(comment.author)}</strong>: ${escapeHtml(comment.text)}
                ${deleteButton}
            </p>
        `;
    }

    // Fonction pour ajouter un commentaire
    async function addComment(event, postId) {
        if (event.key === 'Enter') {
            const input = event.target;
            const commentText = input.value.trim();
            const author = getCurrentUserName();
            const date = new Date().toISOString();

            if (!author) {
                alert("Vous devez être connecté pour commenter.");
                return;
            }

            if (commentText) {
                const posts = readBlogPosts();
                const postIndex = posts.findIndex(p => Number(p.id) === Number(postId));
                if (postIndex === -1) return;

                const targetPost = posts[postIndex];
                if (!targetPost.comments) {
                    targetPost.comments = [];
                }
                const previousAuthors = targetPost.comments.map((comment) => comment?.author).filter(Boolean);

                if (isSupabaseReady()) {
                    try {
                        await insertBlogCommentToSupabase(postId, commentText);
                        notifyCommentOnBlogPost(targetPost, author, previousAuthors);
                        await loadPosts();
                        input.value = '';
                        return;
                    } catch (error) {
                        if (shouldQueueOfflineAction(error)) {
                            const queued = queueBlogAction('blog.addComment', {
                                postId: Number(postId),
                                commentText: String(commentText || '')
                            });
                            if (queued) {
                                input.value = '';
                                alert("Pas de réseau: commentaire mis en file d'attente.");
                                return;
                            }
                        }
                        alert("Impossible d'ajouter le commentaire pour le moment.");
                        return;
                    }
                }

                const newComment = { author, text: commentText, date: date };
                targetPost.comments.push(newComment);
                writeBlogPosts(posts);
                notifyCommentOnBlogPost(targetPost, author, previousAuthors);
                await loadPosts();
                input.value = '';
            }
        }
    }

    // Fonction pour supprimer un commentaire (réservé aux admins)
    async function deleteComment(postId, commentRef) {
        const posts = readBlogPosts();
        const post = posts.find(p => Number(p.id) === Number(postId));
        const ref = String(commentRef || '');

        if (!post || !post.comments) {
            alert("Ce commentaire n'existe plus.");
            return;
        }

        let commentToDelete = null;
        let localCommentIndex = -1;
        if (ref.startsWith('id:')) {
            const commentId = Number(ref.slice(3));
            commentToDelete = post.comments.find((item) => Number(item?.id) === commentId) || null;
            localCommentIndex = post.comments.findIndex((item) => Number(item?.id) === commentId);
        } else if (ref.startsWith('idx:')) {
            localCommentIndex = Number(ref.slice(4));
            commentToDelete = post.comments[localCommentIndex] || null;
        } else {
            localCommentIndex = Number(commentRef);
            commentToDelete = post.comments[localCommentIndex] || null;
        }

        const canDeleteComment = isAdminUser() || canDeleteByAuthor(commentToDelete?.author);
        if (!canDeleteComment) {
            alert("Vous n'avez pas les droits pour effectuer cette action.");
            return;
        }

        if (confirm("Êtes-vous sûr de vouloir supprimer ce commentaire ?")) {
            if (isSupabaseReady() && ref.startsWith('id:')) {
                const supabase = getSupabaseClient();
                const commentId = Number(ref.slice(3));
                const { error } = await supabase
                    .from('blog_comments')
                    .delete()
                    .eq('id', commentId);

                if (error) {
                    alert("Suppression impossible pour le moment.");
                    return;
                }
                await loadPosts();
                return;
            }

            if (!commentToDelete || localCommentIndex < 0) {
                alert("Ce commentaire n'existe plus.");
                return;
            }

            post.comments.splice(localCommentIndex, 1);
            writeBlogPosts(posts);
            await loadPosts();
        }
    }

    // Gérer la soumission du formulaire de création de post
    document.getElementById('postForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const postTitle = document.getElementById('postTitle').value;
        const postContent = document.getElementById('postContent').value;
        const postCategory = document.getElementById('postCategory').value;
        const rawEventDate = document.getElementById('eventDateInput')?.value || '';
        const author = getCurrentUserName();

        if (!author) {
            alert("Vous devez être connecté pour publier.");
            return;
        }

        const canAttachEvent = isProfessionalOrAdminUser() && isAgendaEligibleCategory(postCategory);
        const eventDate = canAttachEvent ? toAgendaDateKey(rawEventDate) : '';
        if (canAttachEvent && !eventDate) {
            alert("Veuillez renseigner la date de l'évènement.");
            return;
        }
        
        const nowIso = new Date().toISOString();

        const newPost = {
            title: postTitle,
            content: postContent,
            category: postCategory,
            author: author,
            date: formatPostDate(nowIso),
            createdAt: nowIso,
            eventDate: eventDate || '',
            comments: []
        };
        
        if (isSupabaseReady()) {
            try {
                const saved = await insertBlogPostToSupabase(newPost);
                newPost.id = saved.id;
                newPost.createdAt = saved.createdAt;
                newPost.date = formatPostDate(newPost.createdAt);

                if (newPost.eventDate) {
                    upsertAgendaEventFromBlogPost(newPost);
                }

                await loadPosts();
                this.reset();
                updateEventDateFieldVisibility();
                if (isNativeAppRuntime()) closeNativeBlogCreatePanel();
                return;
            } catch (error) {
                if (shouldQueueOfflineAction(error)) {
                    const queued = queueBlogAction('blog.createPost', {
                        title: String(newPost.title || ''),
                        content: String(newPost.content || ''),
                        category: String(newPost.category || 'general'),
                        eventDate: newPost.eventDate || ''
                    });

                    if (queued) {
                        this.reset();
                        updateEventDateFieldVisibility();
                        if (isNativeAppRuntime()) closeNativeBlogCreatePanel();
                        alert("Pas de réseau: publication mise en file d'attente.");
                        return;
                    }
                }
                alert("Publication impossible pour le moment.");
                return;
            }
        }

        newPost.id = Date.now();
        let posts = readBlogPosts();
        posts.push(newPost);
        writeBlogPosts(posts);
        if (newPost.eventDate) {
            upsertAgendaEventFromBlogPost(newPost);
        }

        await loadPosts();
        
        this.reset();
        updateEventDateFieldVisibility();
        if (isNativeAppRuntime()) closeNativeBlogCreatePanel();
    });
