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

async function getCurrentSupabaseUserId() {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data || !data.user) return null;
    return data.user.id || null;
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
        actor: actorName,
        type: 'like',
        source: 'reseau',
        postId: Number(post.id) || 0,
        postTitle: getPostNotificationTitle(post)
    });
}

function notifyCommentOnPost(post, actorName, existingCommentAuthors) {
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

function normalizeTextForMatch(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
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
    targetPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
});

// ==================== GESTION DES POSTS ====================

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

    const saved = await saveNewPost(newPost);
    if (!saved) {
        alert("Impossible de publier pour le moment.");
        return;
    }

    this.reset();
    imagePreview.style.display = 'none';
    imagePreview.src = '';

    await loadPosts();

});

// Crée et ajoute un post dans le stockage
async function saveNewPost(postData) {
    if (!isUserLoggedIn()) {
        return false;
    }

    if (isSupabaseReady()) {
        const supabase = getSupabaseClient();
        const authorId = await getCurrentSupabaseUserId();
        if (!supabase || !authorId) return false;

        const payload = {
            author_id: authorId,
            title: String(postData?.title || '').trim(),
            content: String(postData?.content || '').trim(),
            image_data: String(postData?.image || '').trim(),
            likes_count: 0
        };

        const { error } = await supabase.from('reseau_posts').insert(payload);
        if (error) {
            console.error('Erreur création post réseau (Supabase):', error.message);
            return false;
        }

        return true;
    }

    const posts = readPosts();
    posts.unshift(postData);
    writePosts(posts);
    return true;
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
    
    postsContainer.innerHTML = '';
    
    posts.forEach(postData => {
        const postElement = createPostElement(postData);
        if (postElement) {
            postsContainer.appendChild(postElement);
        }
    });

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
    const safeTitle = escapeHtml(postData.title || '');
    const safeContent = escapeHtml(postData.content || '');
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
        ${safeTitle ? `<span class="post-title">${safeTitle}</span>` : ''}
        ${safeImage ? `<img src="${safeImage}" class="post-image" alt="Image du post">` : ''}
        <div class="post-content">
            <p>${safeContent}</p>
        </div>
        <div class="post-actions">
            <button class="like-btn" onclick="toggleLike(${postId})" ${isGuest ? 'disabled title="Mode invité: likes désactivés"' : ''}>❤️ <span class="like-count">${postData.likes || 0}</span></button>
            <button class="comment-btn" onclick="toggleComments(${postId})">💬 Commenter (${commentCount})</button>
        </div>

    <div class="comments-section" style="display: none;">
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
            const previousAuthors = targetPost.comments.map((comment) => comment?.author).filter(Boolean);

            if (isSupabaseReady()) {
                const supabase = getSupabaseClient();
                const authorId = await getCurrentSupabaseUserId();
                if (!supabase || !authorId) {
                    alert("Impossible d'ajouter le commentaire pour le moment.");
                    return;
                }

                const { error } = await supabase.from('reseau_comments').insert({
                    post_id: Number(postId),
                    author_id: authorId,
                    content: commentText
                });

                if (error) {
                    alert("Impossible d'ajouter le commentaire pour le moment.");
                    return;
                }

                notifyCommentOnPost(targetPost, userName, previousAuthors);
                await loadPosts();
                input.value = '';
                return;
            }

            const newComment = { author: userName, text: commentText, date: new Date().toISOString() };
            targetPost.comments.push(newComment);
            writePosts(posts);
            notifyCommentOnPost(targetPost, userName, previousAuthors);
            
            await loadPosts();
            input.value = '';
        }
    }
}
// Crée un élément de commentaire (avec bouton de suppression)
function createCommentElement(comment, postId, commentIndex) {
    const canDeleteComment = canDeleteByAuthor(comment.author);
    const commentId = Number(comment?.id);
    const commentRef = Number.isFinite(commentId) ? `id:${commentId}` : `idx:${commentIndex}`;
    
    const deleteButton = canDeleteComment ? 
        `<button class="delete-comment-btn" onclick="deleteComment(${postId}, '${commentRef}')">Supprimer</button>` : '';

    return `
        <p class="comment-item">
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
            const supabase = getSupabaseClient();
            const targetPost = posts[postIndex];
            const nextLikes = (targetPost.likes || 0) + 1;

            const { error } = await supabase
                .from('reseau_posts')
                .update({ likes_count: nextLikes })
                .eq('id', Number(postId));

            if (error) {
                alert("Impossible d'ajouter un like pour le moment.");
                return;
            }

            targetPost.likes = nextLikes;
            writePosts(posts);
            notifyLikeOnPost(targetPost, getCurrentUserName());
            
            const postElement = document.querySelector(`.post[data-id="${postId}"]`);
            if (postElement) {
                const likeCount = postElement.querySelector('.like-count');
                if (likeCount) likeCount.textContent = targetPost.likes;
            }
            return;
        }

        posts[postIndex].likes = (posts[postIndex].likes || 0) + 1;
        writePosts(posts);
        notifyLikeOnPost(posts[postIndex], getCurrentUserName());
        
        const postElement = document.querySelector(`.post[data-id="${postId}"]`);
        if (postElement) {
            const likeCount = postElement.querySelector('.like-count');
            if (likeCount) likeCount.textContent = posts[postIndex].likes;
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
    initEmojiPicker();
    applyGuestRestrictions();
    await loadPosts();
});
