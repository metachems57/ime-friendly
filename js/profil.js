const USERS_KEY = 'users';
const RESEAU_KEY = 'reseauposts';
const BLOG_KEY = 'blogposts';
const PROFILE_PHOTOS_KEY = 'profilePhotos';
const DEFAULT_PHOTO_URL = 'https://via.placeholder.com/150';
const IME_STATUS_OPTIONS = Object.freeze([
    { key: 'non_renseigne', label: 'Non renseigne' },
    { key: 'direction', label: 'Direction' },
    { key: 'secretariat', label: 'Secretariat' },
    { key: 'pedagogique', label: 'Equipe pedagogique' },
    { key: 'educateurs', label: 'Equipe educateurs' }
]);

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
    const safeArray = Array.isArray(value) ? value : [];

    if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
        window.dataStore.writeArray(key, safeArray);
        return;
    }

    localStorage.setItem(key, JSON.stringify(safeArray));
}

function readObject(key) {
    if (window.dataStore && typeof window.dataStore.readObject === 'function') {
        return window.dataStore.readObject(key);
    }

    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
}

function writeObject(key, value) {
    if (window.dataStore && typeof window.dataStore.writeObject === 'function') {
        window.dataStore.writeObject(key, value);
        return;
    }

    localStorage.setItem(key, JSON.stringify(value));
}

function readValue(key, fallbackValue = null) {
    if (window.dataStore && typeof window.dataStore.readValue === 'function') {
        return window.dataStore.readValue(key, fallbackValue);
    }

    const value = localStorage.getItem(key);
    return value === null ? fallbackValue : value;
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

function writeValue(key, value) {
    if (window.dataStore && typeof window.dataStore.writeValue === 'function') {
        window.dataStore.writeValue(key, value);
        return;
    }

    localStorage.setItem(key, String(value));
}

function normalize(value) {
    return String(value || '').trim();
}

function normalizeKey(value) {
    return normalize(value).toLowerCase();
}

function isSameIdentityByEmail(a, b) {
    const left = normalizeKey(a);
    const right = normalizeKey(b);
    return !!left && !!right && left === right;
}

function computeIsOwnProfile(profileUser, displayName, currentUserName, currentUserEmail) {
    const profileEmail = normalize(profileUser?.email);
    if (isSameIdentityByEmail(profileEmail, currentUserEmail)) {
        return true;
    }

    return normalizeKey(displayName) === normalizeKey(currentUserName);
}

function normalizeImeStatus(value) {
    const key = normalizeKey(value);
    return IME_STATUS_OPTIONS.some((option) => option.key === key) ? key : 'non_renseigne';
}

function normalizeProfessionalTitle(value) {
    return normalize(value).replace(/\s+/g, ' ').slice(0, 80);
}

function getImeStatusLabel(value) {
    const key = normalizeImeStatus(value);
    const option = IME_STATUS_OPTIONS.find((item) => item.key === key);
    return option ? option.label : 'Non renseigne';
}

function isProfessionalRole(role) {
    return normalizeKey(role) === 'professionnel';
}

function formatRole(role) {
    const roleMap = {
        parent: 'Parent',
        professionnel: 'Professionnel',
        admin: 'Administrateur'
    };
    return roleMap[role] || 'Membre';
}

function getProfileRoleDisplay(user) {
    const normalizedRole = normalizeKey(user?.role);

    if (normalizedRole === 'professionnel') {
        return getImeStatusLabel(user?.imeStatus);
    }

    if (normalizedRole === 'parent') {
        return 'Parent';
    }

    return formatRole(normalizedRole);
}

function formatDate(dateValue) {
    if (!dateValue) return 'Inconnue';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleString('fr-FR');
}

function getUsers() {
    return readArray(USERS_KEY);
}

function findUserByName(userName) {
    const target = normalizeKey(userName);
    return getUsers().find((user) => normalizeKey(user.name) === target) || null;
}

function findUserByEmail(email) {
    const target = normalizeKey(email);
    if (!target) return null;
    return getUsers().find((user) => normalizeKey(user?.email) === target) || null;
}

function resolveProfileUser(targetUserName, requestedUserName, currentUserName, currentUserEmail) {
    const targetNameKey = normalizeKey(targetUserName);
    const requestedNameKey = normalizeKey(requestedUserName);
    const currentNameKey = normalizeKey(currentUserName);
    const currentEmail = normalize(currentUserEmail);

    const shouldPreferCurrentEmail = !!currentEmail && (
        !requestedNameKey ||
        requestedNameKey === currentNameKey ||
        targetNameKey === currentNameKey
    );

    if (shouldPreferCurrentEmail) {
        const byEmail = findUserByEmail(currentEmail);
        if (byEmail) return byEmail;
    }

    return findUserByName(targetUserName);
}

function getProfilePhoto(profileUser, userName) {
    const profilePhoto = normalize(profileUser?.profilePhoto);
    if (profilePhoto) return profilePhoto;

    const photos = readObject(PROFILE_PHOTOS_KEY);
    return photos[normalizeKey(userName)] || DEFAULT_PHOTO_URL;
}

function saveProfilePhoto(profileUser, userName, dataUrl) {
    const photos = readObject(PROFILE_PHOTOS_KEY);
    photos[normalizeKey(userName)] = dataUrl;
    writeObject(PROFILE_PHOTOS_KEY, photos);

    const users = getUsers();
    const targetSupabaseId = normalize(profileUser?.supabaseId);
    const targetEmail = normalizeKey(profileUser?.email);
    const targetName = normalizeKey(profileUser?.name || userName);

    const user = users.find((item) => {
        const itemSupabaseId = normalize(item?.supabaseId);
        const itemEmail = normalizeKey(item?.email);
        const itemName = normalizeKey(item?.name);

        if (targetSupabaseId && itemSupabaseId === targetSupabaseId) return true;
        if (targetEmail && itemEmail === targetEmail) return true;
        if (targetName && itemName === targetName) return true;
        return false;
    });

    if (user) {
        user.profilePhoto = String(dataUrl || '').trim();
        writeArray(USERS_KEY, users);
    }

    if (profileUser && typeof profileUser === 'object') {
        profileUser.profilePhoto = String(dataUrl || '').trim();
    }
}

function updateUserImeStatus(profileUser, imeStatus, fallbackName = '', fallbackEmail = '') {
    const users = getUsers();
    const targetSupabaseId = normalize(profileUser?.supabaseId);
    const targetEmail = normalizeKey(profileUser?.email || fallbackEmail);
    const targetName = normalizeKey(profileUser?.name || fallbackName);

    const user = users.find((item) => {
        const itemSupabaseId = normalize(item?.supabaseId);
        const itemEmail = normalizeKey(item?.email);
        const itemName = normalizeKey(item?.name);

        if (targetSupabaseId && itemSupabaseId === targetSupabaseId) return true;
        if (targetEmail && itemEmail === targetEmail) return true;
        if (targetName && itemName === targetName) return true;
        return false;
    });
    if (!user) return false;

    user.imeStatus = normalizeImeStatus(imeStatus);
    writeArray(USERS_KEY, users);
    return true;
}

function updateUserProfessionalTitle(profileUser, professionalTitle, fallbackName = '', fallbackEmail = '') {
    const users = getUsers();
    const targetSupabaseId = normalize(profileUser?.supabaseId);
    const targetEmail = normalizeKey(profileUser?.email || fallbackEmail);
    const targetName = normalizeKey(profileUser?.name || fallbackName);

    const user = users.find((item) => {
        const itemSupabaseId = normalize(item?.supabaseId);
        const itemEmail = normalizeKey(item?.email);
        const itemName = normalizeKey(item?.name);

        if (targetSupabaseId && itemSupabaseId === targetSupabaseId) return true;
        if (targetEmail && itemEmail === targetEmail) return true;
        if (targetName && itemName === targetName) return true;
        return false;
    });
    if (!user) return false;

    user.professionalTitle = normalizeProfessionalTitle(professionalTitle);
    writeArray(USERS_KEY, users);
    return true;
}

async function resolveSupabaseProfileId(profileUser, fallbackName = '', fallbackEmail = '') {
    const directId = normalize(profileUser?.supabaseId);
    if (directId) return directId;

    const supabase = getSupabaseClient();
    if (!supabase) return '';

    try {
        const { data } = await supabase.auth.getUser();
        const authId = normalize(data?.user?.id);
        if (authId) return authId;
    } catch (error) {
        // fallback queries below
    }

    const email = normalize(profileUser?.email || fallbackEmail);
    if (email) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        if (!error && data?.id) return String(data.id);
    }

    const name = normalize(profileUser?.name) || normalize(fallbackName);
    if (!name) return '';

    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('display_name', name)
        .limit(1);

    if (error || !Array.isArray(data) || !data[0]?.id) return '';
    return String(data[0].id);
}

async function updateProfileFieldInSupabase(profileUser, updates, fallbackName = '', fallbackEmail = '') {
    if (!isSupabaseReady()) {
        return { ok: false, reason: 'supabase_unavailable' };
    }

    const supabase = getSupabaseClient();
    const profileId = await resolveSupabaseProfileId(profileUser, fallbackName, fallbackEmail);
    if (!profileId) {
        return { ok: false, reason: 'profile_not_found' };
    }

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profileId);

    if (error) {
        return { ok: false, reason: 'update_failed' };
    }

    return { ok: true, profileId };
}

async function updateProfessionalTitleInSupabase(profileUser, nextTitle, fallbackName = '', fallbackEmail = '') {
    const normalizedTitle = normalizeProfessionalTitle(nextTitle);
    const titleValue = normalizedTitle || null;

    // Compat schema: certaines bases ont professional_title, d'autres job_title.
    const attempts = [
        { professional_title: titleValue, job_title: titleValue },
        { professional_title: titleValue },
        { job_title: titleValue }
    ];

    let lastFailure = { ok: false, reason: 'update_failed' };
    for (const payload of attempts) {
        const result = await updateProfileFieldInSupabase(profileUser, payload, fallbackName, fallbackEmail);
        if (result.ok) return result;
        lastFailure = result;
    }

    return lastFailure;
}

async function updateProfilePhotoInSupabase(profileUser, dataUrl, fallbackName = '', fallbackEmail = '') {
    const nextPhoto = String(dataUrl || '').trim();
    if (!nextPhoto) return { ok: false, reason: 'invalid_photo' };

    const attempts = [
        { profile_photo: nextPhoto },
        { avatar_url: nextPhoto }
    ];

    let lastFailure = { ok: false, reason: 'update_failed' };
    for (const payload of attempts) {
        const result = await updateProfileFieldInSupabase(profileUser, payload, fallbackName, fallbackEmail);
        if (result.ok) return result;
        lastFailure = result;
    }

    return lastFailure;
}

function renameUserEverywhere(previousName, nextName, userEmail = '') {
    const oldName = normalize(previousName);
    const newName = normalize(nextName).replace(/\s+/g, ' ');
    const oldKey = normalizeKey(oldName);
    const nextKey = normalizeKey(newName);
    const emailKey = normalizeKey(userEmail);

    if (!newName) return { ok: false, reason: 'empty_name' };
    if (!oldKey) return { ok: false, reason: 'invalid_source' };

    const users = getUsers();

    const duplicate = users.find((user) => {
        const userNameKey = normalizeKey(user?.name);
        return userNameKey === nextKey && userNameKey !== oldKey;
    });
    if (duplicate) return { ok: false, reason: 'duplicate_name' };

    let user = null;
    if (emailKey) {
        user = users.find((item) => normalizeKey(item?.email) === emailKey) || null;
    }
    if (!user) {
        user = users.find((item) => normalizeKey(item?.name) === oldKey) || null;
    }
    if (!user) return { ok: false, reason: 'user_not_found' };

    const storedOldName = normalize(user.name);
    const storedOldKey = normalizeKey(storedOldName);
    if (!storedOldKey) return { ok: false, reason: 'user_not_found' };

    user.name = newName;
    writeArray(USERS_KEY, users);

    const photos = readObject(PROFILE_PHOTOS_KEY);
    if (storedOldKey !== nextKey && photos[storedOldKey]) {
        photos[nextKey] = photos[storedOldKey];
        delete photos[storedOldKey];
        writeObject(PROFILE_PHOTOS_KEY, photos);
    }

    const replaceAuthorNameInPosts = (posts) => {
        let changed = false;
        posts.forEach((post) => {
            if (normalizeKey(post?.author) === storedOldKey) {
                post.author = newName;
                changed = true;
            }

            if (!Array.isArray(post?.comments)) return;
            post.comments.forEach((comment) => {
                if (normalizeKey(comment?.author) === storedOldKey) {
                    comment.author = newName;
                    changed = true;
                }
            });
        });
        return changed;
    };

    const reseauPosts = readArray(RESEAU_KEY);
    if (replaceAuthorNameInPosts(reseauPosts)) {
        writeArray(RESEAU_KEY, reseauPosts);
    }

    const blogPosts = readArray(BLOG_KEY);
    if (replaceAuthorNameInPosts(blogPosts)) {
        writeArray(BLOG_KEY, blogPosts);
    }

    const messages = readArray('privateMessages');
    let messagesChanged = false;
    messages.forEach((message) => {
        if (normalizeKey(message?.from) === storedOldKey) {
            message.from = newName;
            messagesChanged = true;
        }
        if (normalizeKey(message?.to) === storedOldKey) {
            message.to = newName;
            messagesChanged = true;
        }
    });
    if (messagesChanged) {
        writeArray('privateMessages', messages);
    }

    const reports = readArray('messageReports');
    let reportsChanged = false;
    reports.forEach((report) => {
        if (normalizeKey(report?.reporter) === storedOldKey) {
            report.reporter = newName;
            reportsChanged = true;
        }
        if (normalizeKey(report?.reportedUser) === storedOldKey) {
            report.reportedUser = newName;
            reportsChanged = true;
        }
    });
    if (reportsChanged) {
        writeArray('messageReports', reports);
    }

    const blocks = readObject('messagingBlocks');
    let blocksChanged = false;
    Object.keys(blocks).forEach((key) => {
        const entry = blocks[key];
        if (normalizeKey(entry?.name) === storedOldKey) {
            entry.name = newName;
            blocksChanged = true;
        }
    });

    if (storedOldKey !== nextKey && blocks[storedOldKey]) {
        blocks[nextKey] = { ...blocks[storedOldKey], name: newName };
        delete blocks[storedOldKey];
        blocksChanged = true;
    }

    if (blocksChanged) {
        writeObject('messagingBlocks', blocks);
    }

    writeValue('userName', newName);

    return { ok: true, newName };
}

function toTimestamp(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 0;
    return date.getTime();
}

function truncate(text, maxLength) {
    const value = normalize(text);
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
}

function collectUserActivities(targetName) {
    const targetKey = normalizeKey(targetName);
    const activities = [];

    const reseauPosts = readArray(RESEAU_KEY);
    reseauPosts.forEach((post) => {
        if (normalizeKey(post.author) === targetKey) {
            activities.push({
                source: 'Réseau',
                kind: 'Post',
                content: truncate(post.content || post.title || 'Post sans contenu', 180),
                date: post.timestamp,
                href: 'reseau.html'
            });
        }

        (post.comments || []).forEach((comment) => {
            if (normalizeKey(comment.author) === targetKey) {
                activities.push({
                    source: 'Réseau',
                    kind: 'Commentaire',
                    content: truncate(comment.text || 'Commentaire', 180),
                    date: comment.date || post.timestamp,
                    href: 'reseau.html'
                });
            }
        });
    });

    const blogPosts = readArray(BLOG_KEY);
    blogPosts.forEach((post) => {
        if (normalizeKey(post.author) === targetKey) {
            activities.push({
                source: 'Blog',
                kind: 'Post',
                content: truncate(post.title || post.content || 'Post sans titre', 180),
                date: post.date,
                href: 'blog.html'
            });
        }

        (post.comments || []).forEach((comment) => {
            if (normalizeKey(comment.author) === targetKey) {
                activities.push({
                    source: 'Blog',
                    kind: 'Commentaire',
                    content: truncate(comment.text || 'Commentaire', 180),
                    date: comment.date || post.date,
                    href: 'blog.html'
                });
            }
        });
    });

    activities.sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
    return activities;
}

function renderActivities(targetName) {
    const container = document.getElementById('user-posts-container');
    if (!container) return;

    container.innerHTML = '';
    const activities = collectUserActivities(targetName);

    if (activities.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.textContent = "Aucune activité trouvée pour cet utilisateur.";
        container.appendChild(emptyState);
        return;
    }

    activities.forEach((activity) => {
        const card = document.createElement('article');
        card.className = 'post';

        const header = document.createElement('div');
        header.className = 'post-header';

        const title = document.createElement('strong');
        title.textContent = `${activity.kind} • ${activity.source}`;

        const date = document.createElement('span');
        date.className = 'post-time';
        date.textContent = formatDate(activity.date);

        header.appendChild(title);
        header.appendChild(date);

        const content = document.createElement('p');
        content.textContent = activity.content;

        const link = document.createElement('a');
        link.className = 'nav-link';
        link.href = activity.href;
        link.textContent = `Voir sur ${activity.source}`;

        card.appendChild(header);
        card.appendChild(content);
        card.appendChild(link);

        container.appendChild(card);
    });
}

function getFavoriteSourceLabel(source) {
    const key = normalizeKey(source);
    if (key === 'blog') return 'Blog';
    if (key === 'tool') return 'Outil';
    return 'Contenu';
}

function renderFavoritesSection(isOwnProfile) {
    const sectionNode = document.getElementById('userFavoritesSection');
    const container = document.getElementById('user-favorites-container');
    if (!sectionNode || !container) return;

    if (!isOwnProfile) {
        sectionNode.hidden = true;
        container.innerHTML = '';
        return;
    }

    sectionNode.hidden = false;
    container.innerHTML = '';

    if (!window.userFavorites || typeof window.userFavorites.listForCurrentUser !== 'function') {
        const unavailable = document.createElement('p');
        unavailable.textContent = 'Module favoris indisponible.';
        container.appendChild(unavailable);
        return;
    }

    const favorites = window.userFavorites.listForCurrentUser();
    if (favorites.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.textContent = 'Aucun favori pour le moment.';
        container.appendChild(emptyState);
        return;
    }

    favorites.forEach((favorite) => {
        const card = document.createElement('article');
        card.className = 'post favorite-item';

        const header = document.createElement('div');
        header.className = 'post-header';

        const title = document.createElement('strong');
        title.textContent = favorite.title || 'Favori';

        const tag = document.createElement('span');
        tag.className = 'favorite-source';
        tag.textContent = getFavoriteSourceLabel(favorite.source);

        header.appendChild(title);
        header.appendChild(tag);

        const actions = document.createElement('div');
        actions.className = 'favorite-actions';

        const openLink = document.createElement('a');
        openLink.className = 'nav-link';
        openLink.href = favorite.href || '#';
        openLink.textContent = 'Ouvrir';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'favorite-remove-btn';
        removeBtn.textContent = 'Retirer';
        removeBtn.addEventListener('click', () => {
            if (!window.userFavorites || typeof window.userFavorites.removeFavoriteById !== 'function') {
                return;
            }
            const result = window.userFavorites.removeFavoriteById(favorite.id);
            if (!result.ok) return;
            renderFavoritesSection(true);
        });

        actions.appendChild(openLink);
        actions.appendChild(removeBtn);

        card.appendChild(header);
        card.appendChild(actions);
        container.appendChild(card);
    });
}

function initPhotoEditor(profileUser, profileName, isOwnProfile) {
    const editBtn = document.querySelector('.edit-btn');
    const profilePhoto = document.getElementById('profile-photo');

    if (!editBtn || !profilePhoto) return;

    if (!isOwnProfile) {
        editBtn.style.display = 'none';
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    editBtn.parentNode.appendChild(fileInput);

    editBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const [file] = event.target.files;
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const dataUrl = loadEvent.target.result;
            const img = new Image();
            img.onload = async function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_SIZE = 500;

                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

                if (isSupabaseReady() && isOwnProfile) {
                    const remoteResult = await updateProfilePhotoInSupabase(
                        profileUser,
                        resizedDataUrl,
                        profileName,
                        readValue('userEmail', '')
                    );

                    if (!remoteResult.ok) {
                        alert("Impossible d'enregistrer la photo sur le serveur.");
                        return;
                    }

                    profileUser.supabaseId = remoteResult.profileId || profileUser.supabaseId;
                }

                profilePhoto.src = resizedDataUrl;
                saveProfilePhoto(profileUser, profileName, resizedDataUrl);

                if (window.supabaseSync && typeof window.supabaseSync.syncUsers === 'function') {
                    try {
                        await window.supabaseSync.syncUsers();
                    } catch (error) {
                        // Fallback local deja mis a jour.
                    }
                }
            };

            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });
}

function initMessagingActions(profileName, isOwnProfile, isConnected) {
    const openMessagesLink = document.getElementById('openMessagesLink');
    const sendMessageLink = document.getElementById('sendMessageLink');

    if (openMessagesLink) {
        if (isConnected && isOwnProfile) {
            openMessagesLink.href = 'messagerie.html';
            openMessagesLink.hidden = false;
        } else {
            openMessagesLink.hidden = true;
        }
    }

    if (!sendMessageLink) return;

    if (!isConnected || isOwnProfile) {
        sendMessageLink.hidden = true;
        return;
    }

    const targetName = normalize(profileName);
    if (!targetName) {
        sendMessageLink.hidden = true;
        return;
    }

    sendMessageLink.href = `messagerie.html?to=${encodeURIComponent(targetName)}`;
    sendMessageLink.hidden = false;
}

function initPasswordActions(isOwnProfile, isConnected) {
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const modalNode = document.getElementById('changePasswordModal');
    const formNode = document.getElementById('changePasswordForm');
    const closeButton = document.querySelector('[data-close-change-password]');

    if (!changePasswordBtn || !modalNode || !formNode || !closeButton) return;

    const canChangePassword = isConnected && isOwnProfile;
    changePasswordBtn.hidden = !canChangePassword;
    modalNode.hidden = true;

    if (!canChangePassword) {
        return;
    }

    const openModal = () => {
        modalNode.hidden = false;
    };

    const closeModal = () => {
        modalNode.hidden = true;
        formNode.reset();
    };

    changePasswordBtn.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);

    modalNode.addEventListener('click', (event) => {
        if (event.target === modalNode) {
            closeModal();
        }
    });

    formNode.addEventListener('submit', async (event) => {
        event.preventDefault();

        const currentPassword = normalize(document.getElementById('currentPasswordInput')?.value);
        const newPassword = normalize(document.getElementById('newPasswordInput')?.value);
        const confirmPassword = normalize(document.getElementById('confirmNewPasswordInput')?.value);

        if (!currentPassword || !newPassword || !confirmPassword) {
            alert('Tous les champs sont obligatoires.');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('La confirmation du nouveau mot de passe ne correspond pas.');
            return;
        }

        const result = window.auth
            ? await window.auth.changeOwnPassword(currentPassword, newPassword)
            : { ok: false, reason: 'auth_unavailable' };

        if (result.ok) {
            alert('Mot de passe mis à jour avec succès.');
            closeModal();
            return;
        }

        if (result.reason === 'invalid_current_password') {
            alert('Mot de passe actuel incorrect.');
            return;
        }

        if (result.reason === 'weak_password') {
            alert('Le nouveau mot de passe doit contenir au moins 8 caractères.');
            return;
        }

        if (result.reason === 'crypto_unavailable') {
            alert('Votre navigateur ne supporte pas la sécurité requise (Web Crypto).');
            return;
        }

        if (result.reason === 'not_logged_in') {
            alert('Vous devez être connecté pour changer votre mot de passe.');
            return;
        }

        alert('Le service de changement de mot de passe est indisponible.');
    });

}

function initAdminHelpSection(profileUser) {
    const helpSection = document.getElementById('adminHelpSection');
    if (!helpSection) return;

    const isAdminProfile = normalizeKey(profileUser?.role) === 'admin';
    helpSection.hidden = !isAdminProfile;
}

function initAdminManagementButton(profileUser, isOwnProfile, isConnected, currentUserEmail = '') {
    const adminManagementBtn = document.getElementById('adminManagementBtn');
    if (!adminManagementBtn) return;

    let isAdminSession = false;
    if (window.auth && typeof window.auth.isAdmin === 'function') {
        isAdminSession = window.auth.isAdmin();
    } else {
        isAdminSession = normalizeKey(readValue('userRole', '')) === 'admin';
    }

    const profileIsAdmin = normalizeKey(profileUser?.role) === 'admin' || (isOwnProfile && isAdminSession);
    const ownProfileByEmail = isSameIdentityByEmail(profileUser?.email, currentUserEmail);
    const canShow = !!(isConnected && isAdminSession && profileIsAdmin && (isOwnProfile || ownProfileByEmail));

    adminManagementBtn.hidden = !canShow;
    adminManagementBtn.style.display = canShow ? 'inline-flex' : 'none';
}

function initImeStatusEditor(profileUser, profileName, isOwnProfile) {
    const statusNode = document.getElementById('profile-ime-status');
    const statusRow = statusNode ? statusNode.closest('p') : null;
    const roleNode = document.getElementById('profile-role');
    const editorNode = document.getElementById('imeStatusEditor');
    const selectNode = document.getElementById('imeStatusSelect');
    const saveButton = document.getElementById('imeStatusSaveBtn');

    if (!statusNode || !editorNode || !selectNode || !saveButton) return;

    const normalizedRole = normalizeKey(profileUser?.role);
    const shouldShowStatus = normalizedRole === 'professionnel' || normalizedRole === 'admin';
    if (!shouldShowStatus) {
        if (statusRow) statusRow.hidden = true;
        statusNode.hidden = true;
        editorNode.hidden = true;
        return;
    }

    if (statusRow) statusRow.hidden = false;
    statusNode.hidden = false;

    const currentStatus = normalizeImeStatus(profileUser?.imeStatus);
    statusNode.textContent = getImeStatusLabel(currentStatus);

    const canEdit = isOwnProfile && isProfessionalRole(profileUser?.role);
    if (!canEdit) {
        editorNode.hidden = true;
        return;
    }

    editorNode.hidden = false;
    selectNode.value = currentStatus;

    saveButton.addEventListener('click', async () => {
        const nextStatus = normalizeImeStatus(selectNode.value);

        if (isSupabaseReady() && isOwnProfile) {
            const remoteResult = await updateProfileFieldInSupabase(
                profileUser,
                { ime_status: nextStatus },
                profileName,
                readValue('userEmail', '')
            );

            if (!remoteResult.ok) {
                alert("Impossible d'enregistrer votre statut IME sur le serveur.");
                return;
            }

            profileUser.supabaseId = remoteResult.profileId || profileUser.supabaseId;
        }

        const updated = updateUserImeStatus(profileUser, nextStatus, profileName, readValue('userEmail', ''));
        if (!updated) {
            alert("Impossible d'enregistrer votre statut IME.");
            return;
        }

        statusNode.textContent = getImeStatusLabel(nextStatus);
        profileUser.imeStatus = nextStatus;
        if (roleNode) {
            roleNode.textContent = getProfileRoleDisplay(profileUser);
        }

        if (window.supabaseSync && typeof window.supabaseSync.syncUsers === 'function') {
            try {
                await window.supabaseSync.syncUsers();
            } catch (error) {
                // fallback local deja mis a jour
            }
        }

        alert('Statut IME mis a jour.');
    });
}

function initProfessionalTitleEditor(profileUser, profileName, isOwnProfile) {
    const titleNode = document.getElementById('profile-function-title');
    const editorNode = document.getElementById('profileFunctionEditor');
    const inputNode = document.getElementById('profileFunctionInput');
    const saveButton = document.getElementById('profileFunctionSaveBtn');

    if (!titleNode || !editorNode || !inputNode || !saveButton) return;

    const isProfessional = isProfessionalRole(profileUser?.role);
    const currentTitle = normalizeProfessionalTitle(profileUser?.professionalTitle);

    if (!isProfessional) {
        titleNode.hidden = true;
        editorNode.hidden = true;
        return;
    }

    titleNode.hidden = false;
    titleNode.textContent = currentTitle
        ? `Fonction : ${currentTitle}`
        : 'Fonction : non renseignée';

    const canEdit = isOwnProfile;
    editorNode.hidden = !canEdit;
    if (!canEdit) {
        return;
    }

    inputNode.value = currentTitle;

    saveButton.addEventListener('click', async () => {
        const nextTitle = normalizeProfessionalTitle(inputNode.value);

        if (isSupabaseReady() && isOwnProfile) {
            const remoteResult = await updateProfessionalTitleInSupabase(
                profileUser,
                nextTitle,
                profileName,
                readValue('userEmail', '')
            );

            if (!remoteResult.ok) {
                alert("Impossible d'enregistrer la fonction sur le serveur.");
                return;
            }

            profileUser.supabaseId = remoteResult.profileId || profileUser.supabaseId;
        }

        const updated = updateUserProfessionalTitle(profileUser, nextTitle, profileName, readValue('userEmail', ''));
        if (!updated) {
            alert("Impossible d'enregistrer la fonction.");
            return;
        }

        titleNode.textContent = nextTitle
            ? `Fonction : ${nextTitle}`
            : 'Fonction : non renseignée';

        profileUser.professionalTitle = nextTitle;

        if (window.supabaseSync && typeof window.supabaseSync.syncUsers === 'function') {
            try {
                await window.supabaseSync.syncUsers();
            } catch (error) {
                // fallback local deja mis a jour
            }
        }

        alert('Fonction mise à jour.');
    });
}

function initProfileNameEditor(profileUser, displayName, isOwnProfile) {
    const profileNameNode = document.getElementById('profile-name');
    if (!profileNameNode || !isOwnProfile) return;

    profileNameNode.classList.add('profile-name-editable');
    profileNameNode.setAttribute('title', 'Cliquez pour modifier votre nom');
    profileNameNode.setAttribute('role', 'button');
    profileNameNode.setAttribute('tabindex', '0');

    const openEditor = () => {
        const currentName = normalize(profileNameNode.textContent || displayName);
        const proposed = window.prompt('Modifier votre nom :', currentName);
        if (proposed === null) return;

        const nextName = normalize(proposed).replace(/\s+/g, ' ');
        if (!nextName) {
            alert('Le nom ne peut pas être vide.');
            return;
        }

        const result = renameUserEverywhere(currentName, nextName, profileUser?.email || readValue('userEmail', ''));
        if (!result.ok) {
            if (result.reason === 'duplicate_name') {
                alert('Ce nom est déjà utilisé par un autre compte.');
                return;
            }

            if (result.reason === 'empty_name') {
                alert('Le nom ne peut pas être vide.');
                return;
            }

            alert('Impossible de modifier votre nom pour le moment.');
            return;
        }

        alert('Nom mis à jour.');
        window.location.href = `profil.html?user=${encodeURIComponent(result.newName)}`;
    };

    profileNameNode.addEventListener('click', openEditor);
    profileNameNode.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openEditor();
        }
    });
}


document.addEventListener('DOMContentLoaded', async () => {
    if (window.supabaseSync && typeof window.supabaseSync.syncAll === 'function') {
        try {
            await Promise.race([
                window.supabaseSync.syncAll({ maxAgeMs: 45000 }),
                new Promise((resolve) => setTimeout(resolve, 400))
            ]);
        } catch (error) {
            // Fallback local silencieux.
        }
    }

    if (window.supabaseSync && typeof window.supabaseSync.syncUsers === 'function') {
        try {
            await Promise.race([
                window.supabaseSync.syncUsers(),
                new Promise((resolve) => setTimeout(resolve, 700))
            ]);
        } catch (error) {
            // Fallback local silencieux.
        }
    }

    const isConnected = readValue('imeConnected') === 'true';
    const currentUserName = normalize(readValue('userName', ''));
    const currentUserEmail = normalize(readValue('userEmail', ''));
    const requestedUserName = normalize(new URLSearchParams(window.location.search).get('user'));
    const targetUserName = requestedUserName || currentUserName;

    if (!targetUserName) {
        const profileNameNode = document.getElementById('profile-name');
        const profileRoleNode = document.getElementById('profile-role');
        const profileFunctionTitleNode = document.getElementById('profile-function-title');
        const profileEmailNode = document.getElementById('profile-email');
        const profileLastLoginNode = document.getElementById('profile-last-login');
        const profileImeStatusNode = document.getElementById('profile-ime-status');
        const postsContainer = document.getElementById('user-posts-container');

        if (profileNameNode) profileNameNode.textContent = 'Profil invité';
        if (profileRoleNode) profileRoleNode.textContent = 'Visiteur';
        if (profileFunctionTitleNode) profileFunctionTitleNode.hidden = true;
        if (profileEmailNode) profileEmailNode.textContent = 'Connexion requise';
        if (profileLastLoginNode) profileLastLoginNode.textContent = 'Connexion requise';
        if (profileImeStatusNode) profileImeStatusNode.textContent = 'Connexion requise';
        if (postsContainer) postsContainer.textContent = 'Aucune activité à afficher.';
        initPhotoEditor(null, '', false);
        initMessagingActions('', false, isConnected);
        return;
    }

    let profileUser = resolveProfileUser(targetUserName, requestedUserName, currentUserName, currentUserEmail);
    if (!profileUser && window.supabaseSync && typeof window.supabaseSync.syncUsers === 'function') {
        try {
            await window.supabaseSync.syncUsers();
            profileUser = resolveProfileUser(targetUserName, requestedUserName, currentUserName, currentUserEmail);
        } catch (error) {
            // fallback local silencieux
        }
    }
    const displayName = profileUser?.name || targetUserName;
    const isOwnProfile = computeIsOwnProfile(profileUser, displayName, currentUserName, currentUserEmail);

    const profileNameNode = document.getElementById('profile-name');
    const profileRoleNode = document.getElementById('profile-role');
    const profileEmailNode = document.getElementById('profile-email');
    const profileLastLoginNode = document.getElementById('profile-last-login');
    const profilePhotoNode = document.getElementById('profile-photo');
    const profileEmailRow = profileEmailNode ? profileEmailNode.closest('p') : null;

    if (profileNameNode) profileNameNode.textContent = displayName;
    if (profileRoleNode) profileRoleNode.textContent = getProfileRoleDisplay(profileUser);
    if (profileEmailRow) {
        profileEmailRow.hidden = !isOwnProfile;
    }
    if (profileEmailNode && isOwnProfile) {
        profileEmailNode.textContent = readValue('userEmail', '') || profileUser?.email || 'Non renseigné';
    }
    if (profileLastLoginNode) {
        const fallbackLastLogin = isOwnProfile ? readValue('userLastLogin') : null;
        profileLastLoginNode.textContent = formatDate(profileUser?.lastLogin || fallbackLastLogin);
    }
    if (profilePhotoNode) {
        profilePhotoNode.src = getProfilePhoto(profileUser, displayName);
    }

    initProfileNameEditor(profileUser, displayName, isOwnProfile);
    initImeStatusEditor(profileUser, displayName, isOwnProfile);
    initProfessionalTitleEditor(profileUser, displayName, isOwnProfile);
    initAdminHelpSection(profileUser);
    initAdminManagementButton(profileUser, isOwnProfile, isConnected, currentUserEmail);
    renderActivities(displayName);
    renderFavoritesSection(isOwnProfile);
    initPhotoEditor(profileUser, displayName, isOwnProfile);
    initMessagingActions(displayName, isOwnProfile, isConnected);
    initPasswordActions(isOwnProfile, isConnected);
});

window.addEventListener('storage', (event) => {
    if (event.key && event.key !== 'userFavorites') return;

    const currentUserName = normalize(readValue('userName', ''));
    const requestedUserName = normalize(new URLSearchParams(window.location.search).get('user'));
    const targetUserName = requestedUserName || currentUserName;
    if (!targetUserName) return;

    const isOwnProfile = normalizeKey(targetUserName) === normalizeKey(currentUserName);
    renderFavoritesSection(isOwnProfile);
});
