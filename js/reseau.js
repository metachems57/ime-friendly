// ==================== CONFIGURATION & ÉTATS ====================
const EMOJIS = [
    '💖', '✨', '🌟', '🎇', '🌠', '🎆', '💫', '🌌',
    '😊', '😍', '🥰', '😘', '😻', '💋', '👄', '👁️',
    '🎵', '🎶', '🎤', '🎧', '🎼', '🎷', '🎸', '🪩',
    '🌈', '🌞', '🌝', '🌛', '🌜', '☀️', '⭐', '⚡',
    '🎮', '👾', '🕹️', '🎯', '🎨', '🖌️', '🧸', '🎀',
    '🎉', '🎊', '🎁', '🎂', '🍰', '🥳', '🎈', '🎁',
    '✌️', '🤞', '🤟', '🤘', '👌', '👍', '👆', '👇',
    '🌸', '🌺', '🌷', '🌹', '💐', '🍀', '🌿', '🍄',
    '🍔', '🍕', '🍦', '🍩', '🍬', '🍭', '🍫', '🍎',
    '🐱', '🐶', '🐰', '🐻', '🐼', '🐨', '🦊', '🐯',
    '🚀', '🛸', '🌟', '🌠', '📱', '💻', '🎥', '📸',
    '💃', '🕺', '👯', '🎭', '🩰', '🎪', '🤹', '🎬',
    '🔥', '💥', '❄️', '💧', '🌊', '☔', '🌪️', '🌀'
];

let currentFieldTarget = null;
const postsKey = 'reseauposts'; // Clé unique pour le localStorage de cette page
let runtimePosts = [];
let runtimePostsLoaded = false;
let nativeReseauDrawerReady = false;
let nativeReseauRenderedCount = 0;
let nativeReseauScrollHandler = null;
const NATIVE_RESEAU_INITIAL_BATCH = 6;
const NATIVE_RESEAU_BATCH = 5;
const MAX_INLINE_IMAGE_DATA_URL_LENGTH = 260000;

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

function closeNativeReseauDrawer() {
    document.body.classList.remove('app-native-reseau-drawer-open');
    const backdropNode = document.getElementById('appNativeReseauDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeReseauDrawer');
    if (backdropNode) backdropNode.hidden = true;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'true');
}

function openNativeReseauDrawer() {
    document.body.classList.add('app-native-reseau-drawer-open');
    const backdropNode = document.getElementById('appNativeReseauDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeReseauDrawer');
    if (backdropNode) backdropNode.hidden = false;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'false');
}

function openNativeCreatePanel() {
    if (!isNativeAppRuntime()) return;
    document.body.classList.add('app-native-create-open');
}

function closeNativeCreatePanel() {
    if (!isNativeAppRuntime()) return;
    document.body.classList.remove('app-native-create-open');
}

function triggerLikeBurst(postElement) {
    if (!isNativeAppRuntime() || !postElement) return;
    const heart = document.createElement('span');
    heart.className = 'like-burst-heart';
    heart.textContent = '❤';
    postElement.appendChild(heart);
    window.setTimeout(() => {
        heart.remove();
    }, 680);
}

function updateNativeReseauDrawerLinks() {
    const profileNode = document.getElementById('appNativeDrawerProfile');
    const messagesNode = document.getElementById('appNativeDrawerMessages');
    const logoutNode = document.getElementById('appNativeReseauLogoutBtn');
    const resetNode = document.getElementById('appNativeReseauAdminResetLink');
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

function logoutFromNativeReseauDrawer() {
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

function initNativeReseauExperience() {
    if (!isNativeAppRuntime()) return;
    try {
        localStorage.setItem('imeNativeRuntime', '1');
    } catch (error) {
        // ignore
    }
    document.body.classList.add('is-native-app');
    document.documentElement.classList.remove('native-preload');
    updateNativeReseauDrawerLinks();

    if (nativeReseauDrawerReady) return;
    nativeReseauDrawerReady = true;

    const menuBtnNode = document.getElementById('appNativeReseauMenuBtn');
    const backdropNode = document.getElementById('appNativeReseauDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeReseauDrawer');
    const adminResetNode = document.getElementById('appNativeReseauAdminResetLink');
    const accessibilityNode = document.getElementById('appNativeReseauAccessibilityLink');
    const logoutNode = document.getElementById('appNativeReseauLogoutBtn');
    const publishBtn = document.getElementById('appNativePublishBtn');
    const cameraBtn = document.getElementById('appNativeCameraBtn');
    const closeCreateBtn = document.getElementById('appNativeCloseCreateBtn');

    if (menuBtnNode) {
        menuBtnNode.addEventListener('click', () => {
            if (document.body.classList.contains('app-native-reseau-drawer-open')) {
                closeNativeReseauDrawer();
            } else {
                openNativeReseauDrawer();
            }
        });
    }

    if (backdropNode) {
        backdropNode.addEventListener('click', closeNativeReseauDrawer);
    }

    if (drawerNode) {
        drawerNode.querySelectorAll('a').forEach((linkNode) => {
            linkNode.addEventListener('click', () => {
                closeNativeReseauDrawer();
            });
        });
    }

    if (adminResetNode) {
        adminResetNode.addEventListener('click', () => {
            closeNativeReseauDrawer();
            if (typeof window.showAdminResetPassword === 'function') {
                window.showAdminResetPassword();
            }
        });
    }

    if (accessibilityNode) {
        accessibilityNode.addEventListener('click', () => {
            closeNativeReseauDrawer();
            if (typeof window.openAccessibilityPanel === 'function') {
                window.openAccessibilityPanel();
                return;
            }
            if (window.imeAccessibilityPanel && typeof window.imeAccessibilityPanel.open === 'function') {
                window.imeAccessibilityPanel.open();
                return;
            }
            const toggleNode = document.getElementById('a11yToggleBtn');
            if (toggleNode) toggleNode.click();
        });
    }

    if (logoutNode) {
        logoutNode.addEventListener('click', () => {
            closeNativeReseauDrawer();
            logoutFromNativeReseauDrawer();
        });
    }

    if (publishBtn) {
        publishBtn.addEventListener('click', () => {
            if (!isUserLoggedIn()) {
                alert("Mode invité: connectez-vous pour publier.");
                return;
            }
            // Flux "Publier": la sélection de photo doit ouvrir la bibliothèque.
            prepareImageInputForLibrary();
            closeNativeReseauDrawer();
            openNativeCreatePanel();
        });
    }

    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => {
            closeNativeReseauDrawer();
            openCamera();
        });
    }

    if (closeCreateBtn) {
        closeCreateBtn.addEventListener('click', closeNativeCreatePanel);
    }
}

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

function getCurrentUserName() {
    const user = getConnectedUser();
    return user && user.name ? user.name : '';
}

function isUserLoggedIn() {
    if (window.auth && typeof window.auth.isLoggedIn === 'function') {
        return window.auth.isLoggedIn();
    }

    return localStorage.getItem('imeConnected') === 'true';
}

function isAdminUser() {
    if (window.auth && typeof window.auth.isAdmin === 'function') {
        return window.auth.isAdmin();
    }

    const user = getConnectedUser();
    return !!(user && user.role === 'admin');
}

function canDeleteByAuthor(authorName) {
    if (window.auth && typeof window.auth.canDeleteAuthorContent === 'function') {
        return window.auth.canDeleteAuthorContent(authorName);
    }

    const currentUserName = getCurrentUserName();
    if (isAdminUser()) return true;
    if (!currentUserName || !authorName) return false;
    return currentUserName.toLowerCase() === String(authorName).toLowerCase();
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

function queueReseauAction(type, payload) {
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

function hasHighlightTargetInUrl() {
    const query = new URLSearchParams(window.location.search || '');
    return (
        query.has('highlightPost') ||
        query.has('highlightDate') ||
        query.has('highlightTitle') ||
        !!window.location.hash
    );
}

function renderReseauSkeleton(postsContainer, count = 3) {
    postsContainer.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
        const skeleton = document.createElement('div');
        skeleton.className = 'post reseau-skeleton';
        skeleton.innerHTML = `
            <div class="skeleton-line skeleton-line-lg"></div>
            <div class="skeleton-media"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line skeleton-line-sm"></div>
        `;
        postsContainer.appendChild(skeleton);
    }
}

function appendReseauPostsBatch(postsContainer, posts, startIndex, batchSize) {
    let index = startIndex;
    const limit = Math.min(posts.length, startIndex + batchSize);
    while (index < limit) {
        const postElement = createPostElement(posts[index]);
        if (postElement) postsContainer.appendChild(postElement);
        index += 1;
    }
    nativeReseauRenderedCount = index;
}

function clearReseauInfiniteScroll() {
    if (!nativeReseauScrollHandler) return;
    window.removeEventListener('scroll', nativeReseauScrollHandler);
    nativeReseauScrollHandler = null;
}

function setupReseauInfiniteScroll(postsContainer, posts) {
    clearReseauInfiniteScroll();

    const allowBatchMode = isNativeAppRuntime() && posts.length > NATIVE_RESEAU_INITIAL_BATCH && !hasHighlightTargetInUrl();
    if (!allowBatchMode) return;

    nativeReseauScrollHandler = () => {
        if (nativeReseauRenderedCount >= posts.length) {
            clearReseauInfiniteScroll();
            return;
        }

        const scrollBottom = window.scrollY + window.innerHeight;
        const pageBottom = document.documentElement.scrollHeight - 180;
        if (scrollBottom < pageBottom) return;

        appendReseauPostsBatch(postsContainer, posts, nativeReseauRenderedCount, NATIVE_RESEAU_BATCH);
    };

    window.addEventListener('scroll', nativeReseauScrollHandler, { passive: true });
}

function readPosts() {
    if (isSupabaseReady() && runtimePostsLoaded) {
        return runtimePosts;
    }

    if (Array.isArray(runtimePosts) && runtimePosts.length) {
        return runtimePosts;
    }

    if (window.dataStore && typeof window.dataStore.readArray === 'function') {
        return window.dataStore.readArray(postsKey);
    }

    try {
        const parsed = JSON.parse(localStorage.getItem(postsKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function writePosts(posts) {
    runtimePosts = Array.isArray(posts) ? posts : [];
    runtimePostsLoaded = true;

    if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
        window.dataStore.writeArray(postsKey, posts);
        return;
    }

    localStorage.setItem(postsKey, JSON.stringify(posts));
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

async function fetchSupabasePosts() {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data: postRows, error: postsError } = await supabase
        .from('reseau_posts')
        .select('id, author_id, title, content, image_data, likes_count, created_at')
        .order('created_at', { ascending: false });

    if (postsError) {
        console.error('Erreur chargement posts réseau (Supabase):', postsError.message);
        return [];
    }

    const safePostRows = Array.isArray(postRows) ? postRows : [];
    if (!safePostRows.length) return [];

    const postIds = safePostRows.map((row) => Number(row.id)).filter(Number.isFinite);

    const { data: commentRows, error: commentsError } = await supabase
        .from('reseau_comments')
        .select('id, post_id, author_id, content, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

    if (commentsError) {
        console.error('Erreur chargement commentaires réseau (Supabase):', commentsError.message);
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

    return safePostRows.map((row) => {
        const postId = Number(row.id);
        return {
            id: postId,
            authorId: row.author_id || null,
            title: String(row.title || ''),
            content: String(row.content || ''),
            image: String(row.image_data || ''),
            timestamp: row.created_at || new Date().toISOString(),
            author: profilesMap.get(row.author_id) || 'Anonyme',
            likes: Number(row.likes_count || 0),
            comments: commentsByPostId.get(postId) || []
        };
    });
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

function getCurrentSupabaseUserIdSync() {
    const currentUser = window.auth && typeof window.auth.getCurrentUser === 'function'
        ? window.auth.getCurrentUser()
        : null;
    return String(
        currentUser?.supabaseId ||
        localStorage.getItem('userSupabaseId') ||
        ''
    ).trim();
}

function getPostNotificationTitle(post) {
    const title = String(post?.title || '').trim();
    if (title) return title.slice(0, 120);

    const content = String(post?.content || '').trim();
    if (content) return content.slice(0, 120);

    return 'Post réseau';
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

function notifyLikeOnPost(post, actorName) {
    if (!post || !post.author || !actorName) return;

    addActivityNotification({
        recipient: post.author,
        recipientId: post.authorId || '',
        actor: actorName,
        actorId: getCurrentSupabaseUserIdSync(),
        type: 'like',
        source: 'reseau',
        postId: Number(post.id) || 0,
        postTitle: getPostNotificationTitle(post)
    });
}

function notifyCommentOnPost(post, actorName, existingCommentAuthors) {
    if (!post || !actorName) return;

    const actorKey = normalizeKey(actorName);
    const recipients = new Map();
    const authorKey = normalizeKey(post.author);
    if (post.author) {
        recipients.set(authorKey, {
            name: String(post.author).trim(),
            id: post.authorId || ''
        });
    }

    (existingCommentAuthors || []).forEach((name) => {
        const cleanName = String(name?.author || name?.name || name || '').trim();
        if (!cleanName) return;
        const cleanKey = normalizeKey(cleanName);
        recipients.set(cleanKey, {
            name: cleanName,
            id: name?.authorId || name?.id || ''
        });
    });

    recipients.forEach((recipient) => {
        const recipientName = recipient.name;
        const recipientKey = normalizeKey(recipientName);
        if (!recipientKey || recipientKey === actorKey) return;

        const notificationType = recipientKey === authorKey ? 'comment' : 'reply';
        addActivityNotification({
            recipient: recipientName,
            recipientId: recipient.id || '',
            actor: actorName,
            actorId: getCurrentSupabaseUserIdSync(),
            type: notificationType,
            source: 'reseau',
            postId: Number(post.id) || 0,
            postTitle: getPostNotificationTitle(post)
        });
    });
}

function sanitizeImageSrc(src) {
    const value = String(src || '').trim();
    if (!value) return '';
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('blob:') || value.startsWith('/')) {
        return value;
    }
    return '';
}

function isDataImageUrl(value) {
    return String(value || '').trim().startsWith('data:image/');
}

async function uploadReseauImageIfNeeded(imageValue) {
    const value = String(imageValue || '').trim();
    if (!value || !isDataImageUrl(value)) {
        return { imageData: value, warning: '' };
    }

    if (!window.supabaseStorage || typeof window.supabaseStorage.uploadDataUrl !== 'function') {
        return { imageData: value, warning: '' };
    }

    const uploadResult = await window.supabaseStorage.uploadDataUrl(value, {
        bucket: 'reseau-media',
        folder: 'posts',
        fileNamePrefix: 'reseau-post'
    });

    if (!uploadResult.ok) {
        const details = String(uploadResult.error || uploadResult.reason || 'unknown');
        console.warn('Upload image réseau échoué:', details);

        if (value.length <= MAX_INLINE_IMAGE_DATA_URL_LENGTH) {
            return {
                imageData: value,
                warning: `inline_fallback:${details}`
            };
        }

        return {
            imageData: '',
            warning: `image_dropped:${details}`
        };
    }

    return {
        imageData: String(uploadResult.url || '').trim() || value,
        warning: ''
    };
}

function getHighlightPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawId = params.get('highlightPost');
    if (!rawId) return null;
    const id = Number(rawId);
    return Number.isFinite(id) ? id : null;
}

function getHighlightTitleFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('highlightTitle') || '').trim();
}

function shouldShowCommentsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('showComments') === '1';
}

function getHighlightCommentAuthorFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('highlightCommentAuthor') || '').trim();
}

function normalizeTextForMatch(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function openPostCommentsForHighlight(postNode) {
    if (!postNode) return null;

    const commentsSection = postNode.querySelector('.comments-section');
    if (!commentsSection) return null;

    postNode.classList.add('comments-open');
    commentsSection.style.display = 'block';
    return commentsSection;
}

function highlightCommentInPost(postNode) {
    if (!postNode) return null;

    const author = getHighlightCommentAuthorFromUrl();
    if (!author) return null;

    const authorKey = normalizeKey(author);
    const matchingComments = Array.from(postNode.querySelectorAll('.comment-item'))
        .filter((commentNode) => commentNode.dataset.authorKey === authorKey);

    const targetComment = matchingComments[0] || null;
    if (!targetComment) return null;

    postNode.querySelectorAll('.comment-highlight').forEach((commentNode) => {
        commentNode.classList.remove('comment-highlight');
    });
    targetComment.classList.add('comment-highlight');
    return targetComment;
}

function highlightPostFromUrl() {
    const highlightPostId = getHighlightPostIdFromUrl();
    const highlightTitle = getHighlightTitleFromUrl();
    const allPosts = Array.from(document.querySelectorAll('.post'));
    if (!allPosts.length) return;

    allPosts.forEach((postNode) => postNode.classList.remove('post-highlight'));

    let targetPost = null;
    if (Number.isFinite(highlightPostId)) {
        targetPost = document.querySelector(`.post[data-id="${highlightPostId}"]`) ||
            document.getElementById(`post-${highlightPostId}`);
    }

    if (!targetPost && highlightTitle) {
        const titleNeedle = normalizeTextForMatch(highlightTitle);
        targetPost = allPosts.find((postNode) => {
            const titleText = normalizeTextForMatch(postNode.querySelector('.post-title')?.textContent || '');
            const contentText = normalizeTextForMatch(postNode.querySelector('.post-content')?.textContent || '');
            return titleText.includes(titleNeedle) || contentText.includes(titleNeedle);
        }) || null;
    }

    if (!targetPost && window.location.hash) {
        const hashId = window.location.hash.replace('#', '');
        if (hashId) {
            targetPost = document.getElementById(hashId);
        }
    }

    if (!targetPost) return;
    targetPost.classList.add('post-highlight');
    let scrollTarget = targetPost;
    if (shouldShowCommentsFromUrl()) {
        openPostCommentsForHighlight(targetPost);
        scrollTarget = highlightCommentInPost(targetPost) || targetPost;
    }
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function capturePostScrollAnchor(postId) {
    const postElement = document.querySelector(`.post[data-id="${Number(postId)}"]`);
    if (!postElement) return null;

    return {
        postId: Number(postId),
        offsetTop: postElement.getBoundingClientRect().top
    };
}

function restorePostScrollAnchor(anchor) {
    if (!anchor || !Number.isFinite(anchor.postId)) return;

    window.requestAnimationFrame(() => {
        const postElement = document.querySelector(`.post[data-id="${anchor.postId}"]`);
        if (!postElement) return;

        const nextTop = postElement.getBoundingClientRect().top;
        window.scrollBy(0, nextTop - anchor.offsetTop);
    });
}

function renderNewCommentInPost(postId, comment, commentIndex) {
    const postElement = document.querySelector(`.post[data-id="${Number(postId)}"]`);
    if (!postElement) return;

    const commentList = postElement.querySelector('.comment-list');
    if (commentList) {
        commentList.insertAdjacentHTML('afterbegin', createCommentElement(comment, postId, commentIndex));
    }

    const commentButton = postElement.querySelector('.comment-btn');
    if (commentButton) {
        const nextCount = postElement.querySelectorAll('.comment-item').length;
        commentButton.textContent = `💬 Commenter (${nextCount})`;
    }
}

// ==================== GESTION ÉMOJIS ====================
function initEmojiPicker() {
    const emojiPicker = document.querySelector('.emoji-picker');
    emojiPicker.innerHTML = EMOJIS.map(emoji => 
        `<button type="button" class="emoji-btn" onclick="insertEmoji('${emoji}')">${emoji}</button>`
    ).join('');
}

// Gère l'affichage du sélecteur d'émojis
function toggleEmojiPicker(targetId) {
    const picker = document.querySelector('.emoji-picker');
    const targetElement = document.getElementById(targetId);
    
    if (currentFieldTarget === targetId && picker.style.display === 'flex') {
        picker.style.display = 'none';
        currentFieldTarget = null;
    } else {
        currentFieldTarget = targetId;
        picker.style.display = 'flex';
        // Positionner le sélecteur d'émojis à côté de l'élément cliqué
        const rect = targetElement.getBoundingClientRect();
        picker.style.top = `${rect.bottom + window.scrollY}px`;
        picker.style.left = `${rect.left + window.scrollX}px`;
    }
}

// Fonction pour insérer l'émoji dans le bon champ
function insertEmoji(emoji) {
    if (currentFieldTarget) {
        const field = document.getElementById(currentFieldTarget);
        if (field) {
            const start = field.selectionStart;
            const end = field.selectionEnd;
            field.value = field.value.substring(0, start) + emoji + field.value.substring(end);
            field.selectionStart = field.selectionEnd = start + emoji.length;
            field.focus();
        }
    }
}
// ==================== APPAREIL PHOTO & IMAGES ====================
function initCamera() {
    // Réservé à une future intégration caméra native.
}

// Affiche l'aperçu de l'image et la redimensionne
function displayImagePreview(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('image-preview');
            const image = new Image();
            
            image.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 800; 

                let width = image.width;
                let height = image.height;

                // Redimensionne l'image si elle est trop grande
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, width, height);
                
                // Met à jour la source de l'aperçu avec l'image redimensionnée en Base64
                preview.src = canvas.toDataURL('image/jpeg');
                preview.style.display = 'block';
            };
            
            image.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function prepareImageInputForLibrary() {
    const fileInput = document.getElementById('post-image');
    if (!fileInput) return;
    fileInput.setAttribute('accept', 'image/*');
    fileInput.removeAttribute('capture');
}

function openCamera() {
    if (!isUserLoggedIn()) {
        alert("Mode invité: connectez-vous pour publier.");
        return;
    }

    const fileInput = document.getElementById('post-image');
    if (!fileInput) return;

    // Sur mobile: demande prioritaire d'ouverture directe de la caméra arrière.
    const userAgent = window.navigator.userAgent || '';
    const isMobile = /android|iphone|ipad|ipod/i.test(userAgent);
    if (isMobile) {
        fileInput.setAttribute('accept', 'image/*');
        fileInput.setAttribute('capture', 'environment');
    } else {
        fileInput.removeAttribute('capture');
    }

    // Permet de reprendre une photo même si le même fichier est re-sélectionné.
    fileInput.value = '';

    if (typeof fileInput.showPicker === 'function') {
        try {
            fileInput.showPicker();
            return;
        } catch (error) {
            // Fallback silencieux vers click()
        }
    }

    fileInput.click();
}

document.getElementById('post-image').addEventListener('change', function(event) {
    const file = event.target.files[0];
    displayImagePreview(file);
    if (file && isNativeAppRuntime()) {
        openNativeCreatePanel();
    }
});

// ==================== GESTION DES POSTS ====================

async function insertReseauPostToSupabase(postData) {
    const supabase = getSupabaseClient();
    const authorId = await getCurrentSupabaseUserId();
    if (!supabase || !authorId) {
        throw new Error('auth_unavailable');
    }

    const imageResult = await uploadReseauImageIfNeeded(postData?.image);
    const payload = {
        author_id: authorId,
        title: String(postData?.title || '').trim(),
        content: String(postData?.content || '').trim(),
        image_data: String(imageResult?.imageData || '').trim(),
        likes_count: 0
    };

    const { error } = await supabase.from('reseau_posts').insert(payload);
    if (error) {
        throw new Error(error.message || 'insert_failed');
    }
    return {
        ok: true,
        warning: String(imageResult?.warning || '')
    };
}

async function insertReseauCommentToSupabase(postId, commentText) {
    const supabase = getSupabaseClient();
    const authorId = await getCurrentSupabaseUserId();
    if (!supabase || !authorId) {
        throw new Error('auth_unavailable');
    }

    const { data, error } = await supabase.from('reseau_comments')
        .insert({
            post_id: Number(postId),
            author_id: authorId,
            content: String(commentText || '').trim()
        })
        .select('id, author_id, content, created_at')
        .single();

    if (error) {
        throw new Error(error.message || 'insert_comment_failed');
    }
    return {
        id: Number(data?.id),
        authorId: String(data?.author_id || authorId),
        author: getCurrentUserName(),
        text: String(data?.content || commentText || ''),
        date: data?.created_at || new Date().toISOString()
    };
}

async function incrementReseauLikeInSupabase(postId) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        throw new Error('supabase_unavailable');
    }

    const posts = readPosts();
    const targetPost = posts.find((item) => Number(item.id) === Number(postId));
    const nextLikes = Number(targetPost?.likes || 0) + 1;

    const { error } = await supabase
        .from('reseau_posts')
        .update({ likes_count: nextLikes })
        .eq('id', Number(postId));

    if (error) {
        throw new Error(error.message || 'update_like_failed');
    }

    return nextLikes;
}

function registerReseauOfflineProcessors() {
    const queue = getOfflineQueue();
    if (!queue || typeof queue.registerProcessor !== 'function') return;

    queue.registerProcessor('reseau.createPost', async (item) => {
        if (!isQueueActionForCurrentUser(item)) return { retry: true };
        await insertReseauPostToSupabase(item?.payload || {});
        return { ok: true };
    });

    queue.registerProcessor('reseau.addComment', async (item) => {
        if (!isQueueActionForCurrentUser(item)) return { retry: true };
        const payload = item?.payload || {};
        await insertReseauCommentToSupabase(payload.postId, payload.commentText);
        return { ok: true };
    });

    queue.registerProcessor('reseau.likePost', async (item) => {
        if (!isQueueActionForCurrentUser(item)) return { retry: true };
        const payload = item?.payload || {};
        await incrementReseauLikeInSupabase(payload.postId);
        return { ok: true };
    });
}

// Fonction de soumission du formulaire
document.getElementById('postForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const userName = getCurrentUserName();
    
    if (!userName) {
        alert("Vous devez être connecté pour publier un post.");
        return;
    }

    const formData = new FormData(this);
    const imagePreview = document.getElementById('image-preview');
    const imageBase64 = imagePreview.style.display !== 'none' ? imagePreview.src : '';
    
    const newPost = {
        title: formData.get('post-title'),
        content: formData.get('post-content'),
        image: imageBase64,
        timestamp: new Date().toISOString(),
        author: userName,
        likes: 0,
        comments: []
    };

    const saveResult = await saveNewPost(newPost);
    if (!saveResult.ok) {
        alert("Impossible de publier pour le moment.");
        return;
    }

    this.reset();
    imagePreview.style.display = 'none';
    imagePreview.src = '';

    if (!saveResult.queued) {
        await loadPosts();
        if (saveResult.warning.startsWith('image_dropped:')) {
            alert("Post publié, mais la photo n'a pas pu être envoyée (vérifie les buckets/policies Supabase Storage).");
        } else if (saveResult.warning.startsWith('inline_fallback:')) {
            alert("Post publié avec une image compressée en fallback. Vérifie la configuration Supabase Storage pour un upload normal.");
        }
    } else {
        alert("Pas de réseau: votre post est en file d'attente et sera envoyé automatiquement.");
    }
    if (isNativeAppRuntime()) {
        closeNativeCreatePanel();
    }

});

// Crée et ajoute un post dans le stockage
async function saveNewPost(postData) {
    if (!isUserLoggedIn()) {
        return { ok: false, queued: false };
    }

    if (isSupabaseReady()) {
        try {
            const remoteResult = await insertReseauPostToSupabase(postData);
            return {
                ok: true,
                queued: false,
                warning: String(remoteResult?.warning || '')
            };
        } catch (error) {
            if (shouldQueueOfflineAction(error)) {
                const queued = queueReseauAction('reseau.createPost', {
                    title: String(postData?.title || ''),
                    content: String(postData?.content || ''),
                    image: String(postData?.image || '')
                });
                if (queued) {
                    return { ok: true, queued: true };
                }
            }
            console.error('Erreur création post réseau (Supabase):', error.message || error);
            return { ok: false, queued: false, warning: '' };
        }
    }

    const posts = readPosts();
    posts.unshift(postData);
    writePosts(posts);
    return { ok: true, queued: false, warning: '' };
}

// Charge les posts depuis le localStorage et les affiche
async function loadPosts() {
    let posts = [];
    if (isSupabaseReady()) {
        posts = await fetchSupabasePosts();
        writePosts(posts); // miroir local pour les aperçus des autres pages
    } else {
        posts = readPosts();
    }

    const postsContainer = document.querySelector('.posts-container');
    if (!postsContainer) return;

    renderReseauSkeleton(postsContainer, isNativeAppRuntime() ? 4 : 3);
    await Promise.resolve();

    postsContainer.innerHTML = '';
    nativeReseauRenderedCount = 0;

    if (isNativeAppRuntime() && posts.length > NATIVE_RESEAU_INITIAL_BATCH && !hasHighlightTargetInUrl()) {
        appendReseauPostsBatch(postsContainer, posts, 0, NATIVE_RESEAU_INITIAL_BATCH);
        setupReseauInfiniteScroll(postsContainer, posts);
    } else {
        clearReseauInfiniteScroll();
        appendReseauPostsBatch(postsContainer, posts, 0, posts.length);
    }

    highlightPostFromUrl();
}

// Crée l'élément HTML pour un post
function createPostElement(postData) {
    const postId = Number(postData.id);
    if (!Number.isFinite(postId)) {
        return null;
    }

    const postElement = document.createElement('div');
    postElement.className = 'post';
    postElement.dataset.id = postId;
    postElement.id = `post-${postId}`;

    const canDelete = canDeleteByAuthor(postData.author);
    const deleteButton = canDelete ? `<button class="delete-btn" onclick="deletePost(${postId})">🗑️</button>` : '';
    const safeContent = escapeHtml(postData.content || '');
    const overlayRaw = String(postData.content || '').trim() || String(postData.title || '').trim();
    const overlayText = escapeHtml(
        overlayRaw.length > 120 ? `${overlayRaw.slice(0, 117)}...` : overlayRaw
    );
    const safeImage = sanitizeImageSrc(postData.image);
    const postDate = new Date(postData.timestamp);
    const safeDate = Number.isNaN(postDate.getTime()) ? '' : postDate.toLocaleDateString('fr-FR');

    const isGuest = !isUserLoggedIn();
    const commentCount = postData.comments ? postData.comments.length : 0;
    const commentsWithIndex = (postData.comments || [])
        .map((comment, originalIndex) => ({ comment, originalIndex }))
        .reverse();
    
    postElement.innerHTML = `
        <div class="post-header">
            <span class="post-author">${profileLinkHtml(postData.author)}</span>
            <span class="post-time">${escapeHtml(safeDate)}</span>
            ${deleteButton}
        </div>
        ${overlayText ? `<span class="post-title">${overlayText}</span>` : ''}
        ${safeImage ? `<img src="${safeImage}" class="post-image" alt="Image du post" loading="lazy" decoding="async" fetchpriority="low">` : ''}
        <div class="post-content">
            <p>${safeContent}</p>
        </div>
        <div class="post-actions">
            <button class="like-btn" onclick="toggleLike(${postId})" ${isGuest ? 'disabled title="Mode invité: likes désactivés"' : ''}>❤️ <span class="like-count">${postData.likes || 0}</span></button>
            <button class="comment-btn" onclick="toggleComments(${postId})">💬 Commenter (${commentCount})</button>
        </div>

    <div class="comments-section" style="display: none;">
        <div class="native-comments-header">
            <span>Commentaires</span>
            <button type="button" class="native-comments-close" onclick="toggleComments(${postId})">Fermer</button>
        </div>
        <div class="add-comment">
            <input type="text" id="comment-input-${postId}" placeholder="${isGuest ? 'Mode invité: commentaires désactivés' : 'Ajouter un commentaire...'}" onkeypress="addComment(event, ${postId})" ${isGuest ? 'disabled' : ''}>
            <button type="button" class="emoji-toggle" onclick="toggleEmojiPicker('comment-input-${postId}')" ${isGuest ? 'disabled' : ''}>😊</button>
        </div>
        <div class="comment-list">
            ${commentsWithIndex.map(({ comment, originalIndex }) => createCommentElement(comment, postId, originalIndex)).join('')}
        </div>
    </div>
    
    `;
    
    return postElement;
}

// ==================== GESTION DES INTERACTIONS ====================

// Supprime un post après vérification des autorisations
async function deletePost(postId) {
    const posts = readPosts();
    const postToDelete = posts.find(p => Number(p.id) === Number(postId));

    if (!postToDelete) {
        alert("Ce post n'existe plus.");
        return;
    }
    
    const canDelete = canDeleteByAuthor(postToDelete.author);

    if (!canDelete) {
        alert("Vous n'avez pas les autorisations pour supprimer ce post.");
        return;
    }
    
    if (confirm("Êtes-vous sûr de vouloir supprimer ce post ?")) {
        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const { error } = await supabase
                .from('reseau_posts')
                .delete()
                .eq('id', Number(postId));

            if (error) {
                alert("Suppression impossible pour le moment.");
                return;
            }

            await loadPosts();
            return;
        }

        const updatedPosts = posts.filter(post => Number(post.id) !== Number(postId));
        writePosts(updatedPosts);
        await loadPosts();
    }
}

// Ajoute un nouveau commentaire
async function addComment(event, postId) {
    if (event.key === 'Enter') {
        const input = document.getElementById(`comment-input-${postId}`);
        const commentText = input.value.trim();
        const userName = getCurrentUserName();
        
        if (!userName) {
            alert("Vous devez être connecté pour commenter.");
            return;
        }

        if (commentText) {
            const posts = readPosts();
            const postIndex = posts.findIndex(p => Number(p.id) === Number(postId));
            if (postIndex === -1) return;

            const targetPost = posts[postIndex];
            if (!targetPost.comments) {
                targetPost.comments = [];
            }
            const previousAuthors = targetPost.comments
                .map((comment) => ({
                    author: comment?.author,
                    authorId: comment?.authorId || ''
                }))
                .filter((item) => item.author);

            if (isSupabaseReady()) {
                try {
                    const newComment = await insertReseauCommentToSupabase(postId, commentText);
                    targetPost.comments.push(newComment);
                    writePosts(posts);
                    renderNewCommentInPost(postId, newComment, targetPost.comments.length - 1);
                    input.value = '';
                    return;
                } catch (error) {
                    if (shouldQueueOfflineAction(error)) {
                        const queued = queueReseauAction('reseau.addComment', {
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

            const newComment = { author: userName, text: commentText, date: new Date().toISOString() };
            targetPost.comments.push(newComment);
            writePosts(posts);
            notifyCommentOnPost(targetPost, userName, previousAuthors);
            renderNewCommentInPost(postId, newComment, targetPost.comments.length - 1);
            input.value = '';
        }
    }
}
// Crée un élément de commentaire (avec bouton de suppression)
function createCommentElement(comment, postId, commentIndex) {
    const canDeleteComment = canDeleteByAuthor(comment.author);
    const commentId = Number(comment?.id);
    const commentRef = Number.isFinite(commentId) ? `id:${commentId}` : `idx:${commentIndex}`;
    const safeCommentId = Number.isFinite(commentId) ? String(commentId) : '';
    const safeAuthorKey = escapeHtml(normalizeKey(comment.author));
    
    const deleteButton = canDeleteComment ? 
        `<button class="delete-comment-btn" onclick="deleteComment(${postId}, '${commentRef}')">Supprimer</button>` : '';

    return `
        <p class="comment-item" data-comment-id="${safeCommentId}" data-author-key="${safeAuthorKey}">
            <strong>${profileLinkHtml(comment.author)}</strong>: ${escapeHtml(comment.text)}
            ${deleteButton}
        </p>
    `;
}

// Supprime un commentaire après vérification des autorisations
async function deleteComment(postId, commentRef) {
    const posts = readPosts();
    const postToUpdate = posts.find(post => Number(post.id) === Number(postId));
    const ref = String(commentRef || '');

    if (!postToUpdate || !postToUpdate.comments) {
        alert("Ce commentaire n'existe plus.");
        return;
    }

    let commentToDelete = null;
    let localCommentIndex = -1;
    if (ref.startsWith('id:')) {
        const commentId = Number(ref.slice(3));
        commentToDelete = postToUpdate.comments.find((item) => Number(item?.id) === commentId) || null;
        localCommentIndex = postToUpdate.comments.findIndex((item) => Number(item?.id) === commentId);
    } else if (ref.startsWith('idx:')) {
        localCommentIndex = Number(ref.slice(4));
        commentToDelete = postToUpdate.comments[localCommentIndex] || null;
    } else {
        localCommentIndex = Number(commentRef);
        commentToDelete = postToUpdate.comments[localCommentIndex] || null;
    }

    if (!commentToDelete) {
        alert("Ce commentaire n'existe plus.");
        return;
    }

    const canDeleteComment = canDeleteByAuthor(commentToDelete.author);

    if (!canDeleteComment) {
        alert("Vous n'avez pas les autorisations pour supprimer ce commentaire.");
        return;
    }
    
    if (confirm("Êtes-vous sûr de vouloir supprimer ce commentaire ?")) {
        if (isSupabaseReady() && ref.startsWith('id:')) {
            const commentId = Number(ref.slice(3));
            const supabase = getSupabaseClient();
            const { error } = await supabase
                .from('reseau_comments')
                .delete()
                .eq('id', commentId);
            if (error) {
                alert("Suppression impossible pour le moment.");
                return;
            }
            await loadPosts();
            return;
        }

        postToUpdate.comments.splice(localCommentIndex, 1);
        writePosts(posts);
        await loadPosts();
    }
}


// Affiche/masque la section des commentaires
function toggleComments(postId) {
    const postElement = document.querySelector(`.post[data-id="${postId}"]`);
    if (postElement) {
        const commentsSection = postElement.querySelector('.comments-section');
        if (!commentsSection) return;
        if (isNativeAppRuntime()) {
            const allOpen = document.querySelectorAll('.post.comments-open');
            allOpen.forEach((node) => {
                if (node !== postElement) node.classList.remove('comments-open');
            });
            postElement.classList.toggle('comments-open');
            return;
        }
        commentsSection.style.display = commentsSection.style.display === 'block' ? 'none' : 'block';
    }
}

// Gère l'ajout d'un like
async function toggleLike(postId) {
    if (!isUserLoggedIn()) {
        alert("Mode invité: les likes sont réservés aux utilisateurs connectés.");
        return;
    }

    const posts = readPosts();
    const postIndex = posts.findIndex(p => Number(p.id) === Number(postId));

    if (postIndex !== -1) {
        if (isSupabaseReady()) {
            const targetPost = posts[postIndex];
            try {
                const nextLikes = await incrementReseauLikeInSupabase(postId);
                targetPost.likes = nextLikes;
                writePosts(posts);
                notifyLikeOnPost(targetPost, getCurrentUserName());

                const postElement = document.querySelector(`.post[data-id="${postId}"]`);
                if (postElement) {
                    const likeCount = postElement.querySelector('.like-count');
                    if (likeCount) likeCount.textContent = targetPost.likes;
                    triggerLikeBurst(postElement);
                }
                return;
            } catch (error) {
                if (shouldQueueOfflineAction(error)) {
                    const queued = queueReseauAction('reseau.likePost', {
                        postId: Number(postId)
                    });
                    if (queued) {
                        targetPost.likes = (targetPost.likes || 0) + 1;
                        writePosts(posts);
                        const postElement = document.querySelector(`.post[data-id="${postId}"]`);
                        if (postElement) {
                            const likeCount = postElement.querySelector('.like-count');
                            if (likeCount) likeCount.textContent = targetPost.likes;
                            triggerLikeBurst(postElement);
                        }
                        return;
                    }
                }
                alert("Impossible d'ajouter un like pour le moment.");
            }
        }

        posts[postIndex].likes = (posts[postIndex].likes || 0) + 1;
        writePosts(posts);
        notifyLikeOnPost(posts[postIndex], getCurrentUserName());
        
        const postElement = document.querySelector(`.post[data-id="${postId}"]`);
        if (postElement) {
            const likeCount = postElement.querySelector('.like-count');
            if (likeCount) likeCount.textContent = posts[postIndex].likes;
            triggerLikeBurst(postElement);
        }
    }
}

function applyGuestRestrictions() {
    if (isUserLoggedIn()) return;

    const createPostSection = document.querySelector('.create-post');
    const postForm = document.getElementById('postForm');
    const submitButton = postForm ? postForm.querySelector('.submit-btn') : null;
    const cameraButton = document.querySelector('.camera-btn');
    const titleInput = document.getElementById('post-title');
    const fileInput = document.getElementById('post-image');
    const contentInput = document.getElementById('post-content');
    const emojiButtons = postForm ? postForm.querySelectorAll('.emoji-toggle') : [];

    if (titleInput) titleInput.disabled = true;
    if (fileInput) fileInput.disabled = true;
    if (contentInput) contentInput.disabled = true;
    if (submitButton) submitButton.disabled = true;
    if (cameraButton) cameraButton.disabled = true;
    emojiButtons.forEach((button) => {
        button.disabled = true;
    });

    if (createPostSection && !document.getElementById('guestNoticeReseau')) {
        const notice = document.createElement('p');
        notice.id = 'guestNoticeReseau';
        notice.textContent = 'Mode invité: vous pouvez consulter les publications, mais pas publier, liker ou commenter.';
        notice.style.marginTop = '1rem';
        notice.style.fontWeight = '700';
        notice.style.color = '#8a2b56';
        createPostSection.appendChild(notice);
    }
}

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    registerReseauOfflineProcessors();
    initNativeReseauExperience();
    initEmojiPicker();
    applyGuestRestrictions();
    await loadPosts();
    updateNativeReseauDrawerLinks();
    const queue = getOfflineQueue();
    if (queue && typeof queue.flush === 'function') {
        queue.flush().catch(() => {});
    }
});
