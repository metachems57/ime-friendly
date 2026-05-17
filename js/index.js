// ==================== GESTION ÉTAT DE CONNEXION ====================
let deferredInstallPrompt = null;
let lastHomeSyncRefreshAt = 0;
let nativeIntroTouchStartY = null;
let nativeDrawerReady = false;
let nativeVieTooltipTouchStart = null;

function refreshHomeAfterSupabaseSync() {
    const now = Date.now();
    if (now - lastHomeSyncRefreshAt < 900) return;
    lastHomeSyncRefreshAt = now;

    checkLoginState();
    renderHomepagePreviews();
    renderImeProfileAvatars();
    renderNativeVieAvatars();
    renderNativeVieCalendar();
    initImeProfileCarousel();
}

// Vérifier l'état de connexion au chargement de la page
document.addEventListener('DOMContentLoaded', async function() {
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
                new Promise((resolve) => setTimeout(resolve, 1200))
            ]);
        } catch (error) {
            // Fallback local silencieux.
        }
    }

    checkLoginState();
    initNativeAppExperience();
    initHomeAgendaNavigation();
    renderHomepagePreviews();
    initHomeResourcesCarousel();
    initInstallAppButton();
    renderImeProfileAvatars();
    renderNativeVieAvatars();
    renderNativeVieCalendar();
    initImeProfileCarousel();

    window.addEventListener('supabase:sync-complete', refreshHomeAfterSupabaseSync);
});

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
    return false;
}

function setGuestMode(enabled) {
    const value = enabled ? 'true' : 'false';
    if (window.dataStore && typeof window.dataStore.writeValue === 'function') {
        window.dataStore.writeValue('imeGuestMode', value);
    } else {
        localStorage.setItem('imeGuestMode', value);
    }
}

function isGuestModeEnabled() {
    const fallback = localStorage.getItem('imeGuestMode');
    if (window.dataStore && typeof window.dataStore.readValue === 'function') {
        const value = window.dataStore.readValue('imeGuestMode', fallback);
        return String(value || '').toLowerCase() === 'true';
    }
    return String(fallback || '').toLowerCase() === 'true';
}

function hideNativeIntro() {
    const introNode = document.getElementById('appNativeIntro');
    if (!introNode) return;
    document.body.classList.remove('app-native-gate-active', 'app-native-auth-open');
    introNode.setAttribute('aria-hidden', 'true');
}

function showNativeIntro() {
    const introNode = document.getElementById('appNativeIntro');
    if (!introNode) return;
    document.body.classList.add('app-native-gate-active');
    document.body.classList.remove('app-native-auth-open');
    introNode.setAttribute('aria-hidden', 'false');
}

function openNativeAuthSheet() {
    const sheetNode = document.getElementById('appNativeAuthSheet');
    if (!sheetNode) return;
    document.body.classList.add('app-native-auth-open');
    sheetNode.setAttribute('aria-hidden', 'false');
}

function closeNativeDrawer() {
    document.body.classList.remove('app-native-drawer-open');
    const backdropNode = document.getElementById('appNativeDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeDrawer');
    if (backdropNode) backdropNode.hidden = true;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'true');
}

function openNativeDrawer() {
    document.body.classList.add('app-native-drawer-open');
    const backdropNode = document.getElementById('appNativeDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeDrawer');
    if (backdropNode) backdropNode.hidden = false;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'false');
}

function updateNativeDrawerLinks() {
    if (!isNativeAppRuntime()) return;
    const user = getConnectedUser();
    const profileNode = document.getElementById('appNativeDrawerProfile');
    const messagesNode = document.getElementById('appNativeDrawerMessages');
    const logoutNode = document.getElementById('appNativeLogoutLink');
    const resetNode = document.getElementById('appNativeAdminResetLink');
    const isLogged = !!user;

    if (profileNode) {
        const userName = user ? user.name : '';
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
        resetNode.style.display = isCurrentUserAdmin() ? 'block' : 'none';
    }
}

function applyNativeCardLabels() {
    if (!isNativeAppRuntime()) return;
    const labels = document.querySelectorAll('[data-native-label]');
    labels.forEach((node) => {
        const label = String(node.getAttribute('data-native-label') || '').trim();
        if (label) node.textContent = label;
    });
}

function initNativeHomeChrome() {
    if (nativeDrawerReady || !isNativeAppRuntime()) {
        updateNativeDrawerLinks();
        applyNativeCardLabels();
        return;
    }

    nativeDrawerReady = true;
    const chromeNode = document.getElementById('appNativeHomeChrome');
    const menuBtnNode = document.getElementById('appNativeMenuBtn');
    const backdropNode = document.getElementById('appNativeDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeDrawer');
    const adminResetNode = document.getElementById('appNativeAdminResetLink');
    const accessibilityNode = document.getElementById('appNativeAccessibilityLink');
    const logoutNode = document.getElementById('appNativeLogoutLink');

    if (chromeNode) chromeNode.setAttribute('aria-hidden', 'false');
    if (menuBtnNode) {
        menuBtnNode.addEventListener('click', () => {
            if (document.body.classList.contains('app-native-drawer-open')) {
                closeNativeDrawer();
            } else {
                openNativeDrawer();
            }
        });
    }

    if (backdropNode) {
        backdropNode.addEventListener('click', closeNativeDrawer);
    }

    if (drawerNode) {
        drawerNode.querySelectorAll('a').forEach((linkNode) => {
            linkNode.addEventListener('click', () => {
                closeNativeDrawer();
            });
        });
    }

    if (adminResetNode) {
        adminResetNode.addEventListener('click', () => {
            closeNativeDrawer();
            if (typeof window.showAdminResetPassword === 'function' && isCurrentUserAdmin()) {
                window.showAdminResetPassword();
            }
        });
    }

    if (accessibilityNode) {
        accessibilityNode.addEventListener('click', () => {
            closeNativeDrawer();
            const toggleNode = document.getElementById('a11yToggleBtn');
            if (toggleNode) toggleNode.click();
        });
    }

    if (logoutNode) {
        logoutNode.addEventListener('click', () => {
            closeNativeDrawer();
            logout();
        });
    }

    applyNativeCardLabels();
    updateNativeDrawerLinks();
}

function handleNativeLoginResult(result) {
    if (result.ok) return true;

    if (result.reason === 'not_validated') {
        alert("Votre compte est en attente de validation par un administrateur.");
        return false;
    }

    if (result.reason === 'invalid_credentials') {
        alert("Compte inexistant ou mot de passe incorrect.");
        return false;
    }

    if (result.reason === 'crypto_unavailable') {
        alert("Votre navigateur ne supporte pas la sécurité requise (Web Crypto).");
        return false;
    }

    alert("Le service de connexion est indisponible.");
    return false;
}

function initNativeAppExperience() {
    if (!isNativeAppRuntime()) return;

    document.documentElement.classList.remove('native-preload');
    document.body.classList.add('is-native-app');
    initNativeHomeChrome();

    const introNode = document.getElementById('appNativeIntro');
    const swipeHintNode = document.getElementById('appSwipeHint');
    const authSheetNode = document.getElementById('appNativeAuthSheet');
    const loginFormNode = document.getElementById('appNativeLoginForm');
    const signupLinkNode = document.getElementById('appNativeSignupLink');
    const guestLinkNode = document.getElementById('appNativeGuestLink');

    if (!introNode || !swipeHintNode || !authSheetNode || !loginFormNode || !signupLinkNode || !guestLinkNode) {
        return;
    }

    const query = new URLSearchParams(window.location.search);
    const fromOpenPage = query.get('fromOpen') === '1';
    const fromAppNavigation = query.get('fromApp') === '1' || fromOpenPage;
    if (fromAppNavigation && window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState({}, '', 'index.html');
    }

    const connectedUser = getConnectedUser();
    const hasConnectedIdentity = !!(connectedUser && (connectedUser.email || connectedUser.name));
    const guestMode = isGuestModeEnabled();

    if (!hasConnectedIdentity && !fromAppNavigation) {
        window.location.href = 'ouverture.html';
        return;
    }

    if (hasConnectedIdentity) {
        hideNativeIntro();
    } else if (fromAppNavigation || guestMode) {
        hideNativeIntro();
    } else {
        showNativeIntro();
    }

    if (introNode.dataset.nativeReady === '1') return;
    introNode.dataset.nativeReady = '1';

    const onSwipeOpen = () => {
        openNativeAuthSheet();
    };

    swipeHintNode.addEventListener('click', onSwipeOpen);

    introNode.addEventListener('touchstart', (event) => {
        const touch = event.touches && event.touches[0];
        nativeIntroTouchStartY = touch ? touch.clientY : null;
    }, { passive: true });

    introNode.addEventListener('touchend', (event) => {
        if (nativeIntroTouchStartY === null) return;
        const touch = event.changedTouches && event.changedTouches[0];
        if (!touch) {
            nativeIntroTouchStartY = null;
            return;
        }

        const deltaY = nativeIntroTouchStartY - touch.clientY;
        nativeIntroTouchStartY = null;
        if (deltaY > 64) {
            onSwipeOpen();
        }
    }, { passive: true });

    loginFormNode.addEventListener('submit', async (event) => {
        event.preventDefault();
        const emailNode = document.getElementById('appNativeEmail');
        const passwordNode = document.getElementById('appNativePassword');
        if (!emailNode || !passwordNode) return;

        const email = emailNode.value;
        const password = passwordNode.value;
        const result = window.auth
            ? await window.auth.login(email, password)
            : { ok: false, reason: 'auth_unavailable' };

        if (!handleNativeLoginResult(result)) return;

        setGuestMode(false);
        showConnectedState(result.user.email);
        hideNativeIntro();
        updateNativeDrawerLinks();
    });

    signupLinkNode.addEventListener('click', (event) => {
        event.preventDefault();
        showSignup();
    });

    guestLinkNode.addEventListener('click', (event) => {
        event.preventDefault();
        setGuestMode(true);
        showNotConnectedState();
        hideNativeIntro();
        updateNativeDrawerLinks();
    });
}

function getStorageObject(key) {
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

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function initialsFromName(value) {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 0) return '?';
    return parts.map((part) => part[0].toUpperCase()).join('');
}

function isSafeProfileImage(value) {
    const src = String(value || '').trim();
    return src.startsWith('data:image/') || src.startsWith('https://') || src.startsWith('http://') || src.startsWith('blob:') || src.startsWith('/');
}

function createProfileAvatarLink(userName, profileImageSrc, professionalTitle = '') {
    const avatarLink = document.createElement('a');
    avatarLink.className = 'ime-profile-avatar';
    avatarLink.href = `profil.html?user=${encodeURIComponent(userName)}`;
    const normalizedTitle = String(professionalTitle || '').trim();
    avatarLink.title = normalizedTitle ? `${userName} — ${normalizedTitle}` : userName;
    avatarLink.setAttribute('aria-label', `Profil de ${userName}`);

    if (isSafeProfileImage(profileImageSrc)) {
        const image = document.createElement('img');
        image.src = profileImageSrc;
        image.alt = `Photo de ${userName}`;
        image.loading = 'lazy';
        avatarLink.appendChild(image);
    } else {
        avatarLink.classList.add('has-initials');
        avatarLink.setAttribute('data-initials', initialsFromName(userName));
    }

    return avatarLink;
}

function createEmptyAvatarPlaceholder() {
    const placeholder = document.createElement('a');
    placeholder.className = 'ime-profile-avatar is-empty';
    placeholder.href = 'profil.html';
    placeholder.setAttribute('aria-label', 'Profil intervenant vide');
    return placeholder;
}

function renderImeProfileAvatars() {
    const trackNode = document.getElementById('imeProfileTrack');
    if (!trackNode) return;

    const users = getStorageArray('users');
    const profilePhotos = getStorageObject('profilePhotos');
    const uniqueUsers = [];
    const seen = new Set();

    users.forEach((user) => {
        const name = String(user && user.name || '').trim();
        const role = String(user && user.role || '').trim().toLowerCase();
        const professionalTitle = String(user && user.professionalTitle || '').trim();
        const profilePhoto = String(user && user.profilePhoto || '').trim();
        const key = normalizeKey(name);
        const isIntervenant = role === 'professionnel' || role === 'pro';
        if (!name || !isIntervenant || seen.has(key)) return;
        seen.add(key);
        uniqueUsers.push({ name, key, professionalTitle, profilePhoto });
    });

    trackNode.innerHTML = '';

    if (uniqueUsers.length === 0) {
        for (let index = 0; index < 12; index += 1) {
            trackNode.appendChild(createEmptyAvatarPlaceholder());
        }
        return;
    }

    uniqueUsers
        .slice(0, 12)
        .forEach((user) => {
            const photo = user.profilePhoto || profilePhotos[user.key] || '';
            trackNode.appendChild(createProfileAvatarLink(user.name, photo, user.professionalTitle));
        });
}

function renderNativeVieAvatars() {
    const containerNode = document.getElementById('nativeVieAvatars');
    if (!containerNode) return;

    const users = getStorageArray('users');
    const profilePhotos = getStorageObject('profilePhotos');
    const uniqueUsers = [];
    const seen = new Set();

    users.forEach((user) => {
        const name = String(user && user.name || '').trim();
        const role = String(user && user.role || '').trim().toLowerCase();
        const isIntervenant = role === 'professionnel' || role === 'pro';
        const key = normalizeKey(name);
        if (!name || !isIntervenant || seen.has(key)) return;
        seen.add(key);
        uniqueUsers.push({
            name,
            photo: String(user?.profilePhoto || profilePhotos[key] || '').trim()
        });
    });

    containerNode.innerHTML = '';

    const maxAvatars = 5;
    for (let index = 0; index < maxAvatars; index += 1) {
        const user = uniqueUsers[index];
        const avatarNode = document.createElement('a');
        avatarNode.className = 'native-vie-avatar';

        if (user) {
            avatarNode.href = `profil.html?user=${encodeURIComponent(user.name)}`;
            avatarNode.setAttribute('aria-label', `Profil de ${user.name}`);
            if (isSafeProfileImage(user.photo)) {
                const imgNode = document.createElement('img');
                imgNode.src = user.photo;
                imgNode.alt = `Photo de ${user.name}`;
                avatarNode.appendChild(imgNode);
            } else {
                const initialsNode = document.createElement('span');
                initialsNode.textContent = initialsFromName(user.name);
                avatarNode.appendChild(initialsNode);
            }
        } else {
            avatarNode.href = 'profil.html';
            avatarNode.setAttribute('aria-label', 'Profil intervenant');
            const emptyNode = document.createElement('span');
            emptyNode.textContent = '';
            avatarNode.appendChild(emptyNode);
        }

        containerNode.appendChild(avatarNode);
    }
}

function renderNativeVieCalendar(referenceDate = new Date()) {
    const monthNode = document.getElementById('nativeVieCalendarMonthLabel');
    const gridNode = document.getElementById('nativeVieCalendarGrid');
    const calendarNode = gridNode ? gridNode.closest('.native-vie-calendar') : null;
    const tooltipNode = document.getElementById('nativeVieTooltip');
    const tooltipLinkNode = document.getElementById('nativeVieTooltipLink');
    if (!monthNode || !gridNode || !calendarNode || !tooltipNode || !tooltipLinkNode) return;

    const year = referenceDate.getFullYear();
    const monthIndex = referenceDate.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayMondayBased = (firstDay.getDay() + 6) % 7;
    const eventsByDay = getAgendaEventsByDay(year, monthIndex);

    const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(firstDay);
    monthNode.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    gridNode.innerHTML = '';
    tooltipNode.hidden = true;
    tooltipLinkNode.textContent = '';
    tooltipLinkNode.removeAttribute('href');

    const hideTooltip = () => {
        tooltipNode.hidden = true;
        tooltipLinkNode.textContent = '';
        tooltipLinkNode.removeAttribute('href');
    };

    const showTooltip = (title, href, anchorNode) => {
        const cleanTitle = String(title || 'Voir l’activité').trim();
        const cleanHref = String(href || 'blog.html').trim();
        tooltipLinkNode.textContent = cleanTitle;
        tooltipLinkNode.href = cleanHref;
        tooltipNode.hidden = false;

        const calendarRect = calendarNode.getBoundingClientRect();
        const anchorRect = anchorNode.getBoundingClientRect();
        const topPreferred = anchorRect.top - calendarRect.top - 42;
        const topFallback = anchorRect.bottom - calendarRect.top + 4;
        const top = topPreferred < 2 ? topFallback : topPreferred;
        const leftCenter = anchorRect.left - calendarRect.left + (anchorRect.width / 2);
        const maxLeft = Math.max(4, calendarNode.clientWidth - tooltipNode.offsetWidth - 4);
        const left = Math.min(maxLeft, Math.max(4, leftCenter - (tooltipNode.offsetWidth / 2)));
        tooltipNode.style.top = `${Math.round(top)}px`;
        tooltipNode.style.left = `${Math.round(left)}px`;
    };

    for (let i = 0; i < firstDayMondayBased; i += 1) {
        const emptyNode = document.createElement('span');
        emptyNode.className = 'native-vie-day is-empty';
        emptyNode.textContent = '';
        gridNode.appendChild(emptyNode);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const dayEvents = eventsByDay.get(day) || [];
        const hasEvent = dayEvents.length > 0;
        const dayNode = document.createElement(hasEvent ? 'button' : 'span');
        dayNode.className = 'native-vie-day';
        dayNode.textContent = String(day);

        if (hasEvent) {
            dayNode.classList.add('has-event');
            if (dayNode instanceof HTMLButtonElement) {
                dayNode.type = 'button';
                const currentDateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const blogEvent = dayEvents.find((item) => item.source === 'blog' && Number.isFinite(item.sourcePostId));
                const eventHref = blogEvent && Number.isFinite(blogEvent.sourcePostId)
                    ? `blog.html?highlightPost=${encodeURIComponent(String(blogEvent.sourcePostId))}`
                    : `blog.html?highlightDate=${encodeURIComponent(currentDateKey)}`;
                const eventTitle = String(dayEvents[0]?.text || 'Voir l’activité');
                dayNode.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    showTooltip(eventTitle, eventHref, dayNode);
                });
            }
        }
        gridNode.appendChild(dayNode);
    }

    if (calendarNode.dataset.nativeTooltipBound !== '1') {
        calendarNode.dataset.nativeTooltipBound = '1';

        calendarNode.addEventListener('click', (event) => {
            const clickedDay = event.target instanceof Element ? event.target.closest('.native-vie-day.has-event') : null;
            const clickedTooltip = event.target instanceof Element ? event.target.closest('#nativeVieTooltip') : null;
            if (!clickedDay && !clickedTooltip) {
                hideTooltip();
            }
        });

        calendarNode.addEventListener('touchstart', (event) => {
            const touch = event.touches && event.touches[0];
            nativeVieTooltipTouchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }, { passive: true });

        calendarNode.addEventListener('touchmove', (event) => {
            if (!nativeVieTooltipTouchStart) return;
            const touch = event.touches && event.touches[0];
            if (!touch) return;
            const deltaX = Math.abs(touch.clientX - nativeVieTooltipTouchStart.x);
            const deltaY = Math.abs(touch.clientY - nativeVieTooltipTouchStart.y);
            if (deltaX > 10 || deltaY > 10) {
                hideTooltip();
            }
        }, { passive: true });

        calendarNode.addEventListener('touchend', () => {
            nativeVieTooltipTouchStart = null;
        }, { passive: true });
    }
}

function initImeProfileCarousel() {
    const windowNode = document.getElementById('imeProfileWindow');
    const trackNode = document.getElementById('imeProfileTrack');
    const prevNode = document.getElementById('imeProfilePrev');
    const nextNode = document.getElementById('imeProfileNext');

    if (!windowNode || !trackNode || !prevNode || !nextNode) return;

    const getAvatars = () => Array.from(trackNode.children);
    const avatars = getAvatars();
    if (avatars.length === 0) {
        prevNode.classList.add('is-disabled');
        nextNode.classList.add('is-disabled');
        trackNode.style.transform = 'translateX(0)';
        trackNode.dataset.currentIndex = '0';
        return;
    }

    let currentIndex = Number(trackNode.dataset.currentIndex || 0);
    if (!Number.isFinite(currentIndex) || currentIndex < 0) {
        currentIndex = 0;
    }

    const getStep = () => {
        const firstAvatar = getAvatars()[0];
        if (!firstAvatar) return 0;
        const gap = parseFloat(window.getComputedStyle(trackNode).gap || '0') || 0;
        return firstAvatar.getBoundingClientRect().width + gap;
    };

    const getVisibleCount = () => {
        const step = getStep();
        if (step <= 0) return 1;
        return Math.max(1, Math.floor(windowNode.clientWidth / step));
    };

    const getMaxIndex = () => Math.max(0, getAvatars().length - getVisibleCount());

    const update = () => {
        const step = getStep();
        const maxIndex = getMaxIndex();

        currentIndex = Math.min(currentIndex, maxIndex);
        trackNode.style.transform = `translateX(${-currentIndex * step}px)`;
        trackNode.dataset.currentIndex = String(currentIndex);
        prevNode.classList.toggle('is-disabled', currentIndex <= 0);
        nextNode.classList.toggle('is-disabled', currentIndex >= maxIndex);
    };

    const onArrowAction = (event, direction) => {
        event.preventDefault();
        event.stopPropagation();

        const maxIndex = getMaxIndex();
        currentIndex = Math.min(maxIndex, Math.max(0, currentIndex + direction));
        update();
    };

    prevNode.onclick = (event) => onArrowAction(event, -1);
    nextNode.onclick = (event) => onArrowAction(event, 1);

    prevNode.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            onArrowAction(event, -1);
        }
    };

    nextNode.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            onArrowAction(event, 1);
        }
    };

    if (windowNode.dataset.carouselResizeBound !== '1') {
        window.addEventListener('resize', update);
        windowNode.dataset.carouselResizeBound = '1';
    }
    update();
}

function getConnectedUser() {
    if (!window.auth || typeof window.auth.getCurrentUser !== 'function') {
        return null;
    }

    return window.auth.getCurrentUser();
}

function isUserLoggedIn() {
    if (!window.auth || typeof window.auth.isLoggedIn !== 'function') {
        return false;
    }

    return window.auth.isLoggedIn();
}

function isCurrentUserAdmin() {
    if (!window.auth || typeof window.auth.isAdmin !== 'function') {
        return false;
    }

    return window.auth.isAdmin();
}

function getStorageArray(key) {
    if (window.dataStore && typeof window.dataStore.readArray === 'function') {
        return window.dataStore.readArray(key);
    }

    // fallback de sécurité si dataStore n'est pas chargé
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function toAgendaDateKey(value) {
    if (!value) return '';

    if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
            return trimmedValue;
        }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getAgendaEventDate(item) {
    if (!item || typeof item !== 'object') return '';
    return toAgendaDateKey(item.date || item.eventDate || item.day || item.datetime || '');
}

function getAgendaEventText(item) {
    if (!item || typeof item !== 'object') return '';
    const text = item.title || item.event || item.name || item.description || item.label || '';
    return String(text).trim();
}

function getHomeAgendaEvents() {
    const primary = getStorageArray('agendaEvents');
    if (primary.length > 0) return primary;

    const fallback = getStorageArray('imeAgendaEvents');
    if (fallback.length > 0) return fallback;

    return [];
}

function getAgendaEventsByDay(year, monthIndex) {
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const eventsByDay = new Map();
    const events = getHomeAgendaEvents();

    events.forEach((eventItem) => {
        const dateKey = getAgendaEventDate(eventItem);
        if (!dateKey || !dateKey.startsWith(monthKey)) return;

        const day = Number(dateKey.slice(8, 10));
        if (!Number.isFinite(day) || day < 1 || day > 31) return;

        const text = getAgendaEventText(eventItem) || 'Événement prévu';
        const source = String(eventItem.source || '').trim().toLowerCase();
        const sourcePostId = Number(eventItem.sourcePostId);
        const current = eventsByDay.get(day) || [];
        current.push({
            text,
            source,
            sourcePostId: Number.isFinite(sourcePostId) ? sourcePostId : null,
            dateKey
        });
        eventsByDay.set(day, current);
    });

    return eventsByDay;
}

function shiftMonth(referenceDate, offset) {
    const base = referenceDate instanceof Date ? referenceDate : new Date();
    return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

function renderHomeAgenda(referenceDate = new Date()) {
    const todayLabelNode = document.getElementById('homeAgendaToday');
    const monthLabelNode = document.getElementById('homeAgendaMonthLabel');
    const gridNode = document.getElementById('homeAgendaGrid');
    if (!monthLabelNode || !gridNode) return;

    const year = referenceDate.getFullYear();
    const monthIndex = referenceDate.getMonth();
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayMondayBased = (firstDayOfMonth.getDay() + 6) % 7;
    const monthLabel = new Intl.DateTimeFormat('fr-FR', {
        month: 'long',
        year: 'numeric'
    }).format(firstDayOfMonth);
    if (todayLabelNode) {
        const todayLabel = new Intl.DateTimeFormat('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(new Date());
        todayLabelNode.textContent = `Aujourd'hui : ${todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}`;
    }
    const eventsByDay = getAgendaEventsByDay(year, monthIndex);

    monthLabelNode.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    gridNode.innerHTML = '';

    for (let i = 0; i < firstDayMondayBased; i += 1) {
        const emptyNode = document.createElement('span');
        emptyNode.className = 'agenda-day is-empty';
        emptyNode.setAttribute('aria-hidden', 'true');
        gridNode.appendChild(emptyNode);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const currentDateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = eventsByDay.get(day) || [];
        const blogEvent = dayEvents.find((item) => item.source === 'blog' && Number.isFinite(item.sourcePostId));
        const hasEvent = dayEvents.length > 0;
        const dayNode = document.createElement(hasEvent ? 'a' : 'span');
        dayNode.className = 'agenda-day';
        dayNode.textContent = String(day);

        if (hasEvent) {
            dayNode.classList.add('has-event');
            dayNode.title = dayEvents.map((item) => item.text).join('\n');

            if (dayNode instanceof HTMLAnchorElement) {
                if (blogEvent && Number.isFinite(blogEvent.sourcePostId)) {
                    dayNode.href = `blog.html?highlightPost=${encodeURIComponent(String(blogEvent.sourcePostId))}`;
                } else {
                    dayNode.href = `blog.html?highlightDate=${encodeURIComponent(currentDateKey)}`;
                }
                dayNode.setAttribute('aria-label', `Voir l'évènement du ${day}`);
            }
        }

        gridNode.appendChild(dayNode);
    }

    const totalCells = firstDayMondayBased + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < trailing; i += 1) {
        const emptyNode = document.createElement('span');
        emptyNode.className = 'agenda-day is-empty';
        emptyNode.setAttribute('aria-hidden', 'true');
        gridNode.appendChild(emptyNode);
    }
}

function initHomeAgendaNavigation() {
    const prevMonthBtn = document.getElementById('homeAgendaPrevMonth');
    const nextMonthBtn = document.getElementById('homeAgendaNextMonth');

    let displayedMonth = new Date();
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);

    const renderDisplayedMonth = () => {
        renderHomeAgenda(displayedMonth);
    };

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            displayedMonth = shiftMonth(displayedMonth, -1);
            renderDisplayedMonth();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            displayedMonth = shiftMonth(displayedMonth, 1);
            renderDisplayedMonth();
        });
    }

    renderDisplayedMonth();
}

function truncateText(value, maxLength) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
}

function toPreviewTimestamp(value) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? 0 : value.getTime();
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const raw = String(value || '').trim();
    if (!raw) return 0;

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
        const [day, month, year] = raw.split('/').map((part) => Number(part));
        const parsedFrenchDate = new Date(year, month - 1, day);
        return Number.isNaN(parsedFrenchDate.getTime()) ? 0 : parsedFrenchDate.getTime();
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function parsePreviewPostDate(value) {
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
        const [day, month, year] = raw.split('/').map((part) => Number(part));
        const fromFrenchDate = new Date(year, month - 1, day);
        return Number.isNaN(fromFrenchDate.getTime()) ? null : fromFrenchDate;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolvePreviewPostDate(post) {
    const fromDate = parsePreviewPostDate(post?.date);
    const fromCreatedAt = parsePreviewPostDate(post?.createdAt);
    const fromTimestamp = parsePreviewPostDate(post?.timestamp);
    const fromId = parsePreviewPostDate(Number(post?.id));

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

    return fromCreatedAt || fromTimestamp || fromId || null;
}

function getBlogPostPublishedTimestamp(post) {
    const resolvedDate = resolvePreviewPostDate(post);
    if (resolvedDate) return resolvedDate.getTime();

    return Math.max(
        toPreviewTimestamp(post?.createdAt),
        toPreviewTimestamp(post?.date),
        toPreviewTimestamp(post?.timestamp),
        toPreviewTimestamp(post?.id)
    );
}

function getLatestPublishedBlogPost(posts) {
    if (!Array.isArray(posts) || posts.length === 0) return null;

    return [...posts].sort((first, second) => {
        const dateDiff = getBlogPostPublishedTimestamp(second) - getBlogPostPublishedTimestamp(first);
        if (dateDiff !== 0) return dateDiff;

        return Number(second?.id || 0) - Number(first?.id || 0);
    })[0] || null;
}

function updateMediaPreview(imageId, titleId, imageSrc, titleText, emptyText) {
    const imageNode = document.getElementById(imageId);
    const titleNode = document.getElementById(titleId);

    if (titleNode) {
        titleNode.textContent = titleText || emptyText;
    }

    if (!imageNode) return;
    if (imageSrc) {
        imageNode.classList.add('is-loading');
        imageNode.addEventListener('load', () => {
            imageNode.classList.remove('is-loading');
        }, { once: true });
        imageNode.addEventListener('error', () => {
            imageNode.classList.remove('is-loading');
        }, { once: true });
        imageNode.src = imageSrc;
        imageNode.style.display = 'block';
    } else {
        imageNode.removeAttribute('src');
        imageNode.classList.remove('is-loading');
        imageNode.style.display = 'none';
    }
}

function buildPreviewSummary(author, title) {
    const cleanTitle = truncateText(title || 'Sans titre', 52);
    const cleanAuthor = truncateText(author || 'Anonyme', 28);
    return `${cleanTitle} • ${cleanAuthor}`;
}

function getAuthorProfileImageByName(authorName) {
    const cleanName = String(authorName || '').trim();
    if (!cleanName) return '';

    const users = getStorageArray('users');
    const matchedUser = users.find((item) => String(item?.name || '').trim().toLowerCase() === cleanName.toLowerCase());
    if (matchedUser && isSafeProfileImage(matchedUser.profilePhoto)) {
        return matchedUser.profilePhoto;
    }

    const profilePhotos = getStorageObject('profilePhotos');
    const key = normalizeKey(cleanName);
    const photo = String(profilePhotos[key] || '').trim();
    return isSafeProfileImage(photo) ? photo : '';
}

function getLatestViePreviewSource() {
    const reseauPosts = getStorageArray('reseauposts');
    const blogPosts = getStorageArray('blogposts');
    const tools = getStorageArray('tools');
    const candidates = [];

    if (reseauPosts[0]) {
        const post = reseauPosts[0];
        candidates.push({
            source: 'reseau',
            timestamp: toPreviewTimestamp(post.createdAt || post.date || post.timestamp || post.id),
            author: post.author || 'Anonyme',
            title: post.title || post.content || 'Post réseau',
            image: post.image || getAuthorProfileImageByName(post.author)
        });
    }

    if (blogPosts.length > 0) {
        const post = getLatestPublishedBlogPost(blogPosts) || blogPosts[0];
        candidates.push({
            source: 'blog',
            timestamp: getBlogPostPublishedTimestamp(post),
            author: post.author || 'Anonyme',
            title: post.title || post.content || 'Post blog',
            image: getAuthorProfileImageByName(post.author) || 'images/fond page d\'acceuil.png'
        });
    }

    if (tools[0]) {
        const tool = tools[0];
        candidates.push({
            source: 'outils',
            timestamp: toPreviewTimestamp(tool.createdAt || tool.id),
            author: tool.author || 'Anonyme',
            title: tool.name || 'Outil',
            image: tool.steps?.[0]?.images?.[0] || getAuthorProfileImageByName(tool.author)
        });
    }

    if (candidates.length === 0) return null;

    candidates.sort((first, second) => second.timestamp - first.timestamp);
    return candidates[0];
}

function getResourcesCatalog() {
    if (Array.isArray(window.imeResources)) {
        return window.imeResources;
    }
    return [];
}

function initHomeResourcesCarousel() {
    const resources = getResourcesCatalog();
    const carouselNode = document.getElementById('homeResourcesCarousel');
    const windowNode = document.getElementById('homeResourcesWindow');
    const trackNode = document.getElementById('homeResourcesTrack');
    const prevNode = document.getElementById('homeResourcesPrev');
    const nextNode = document.getElementById('homeResourcesNext');

    if (!carouselNode || !windowNode || !trackNode || !prevNode || !nextNode) return;
    if (resources.length === 0) {
        trackNode.innerHTML = '<p class="resource-home-empty">Aucune ressource disponible.</p>';
        prevNode.disabled = true;
        nextNode.disabled = true;
        return;
    }

    const gapPx = 10;
    const slideDurationMs = 2000;
    const resumeDelayAfterManualMs = 3000;

    let visibleCount = 3;
    let currentIndex = 0;
    let slideStepPx = 0;
    let isAnimating = false;
    let intervalId = null;
    let resumeTimeoutId = null;
    let isPointerOverCarousel = false;

    const getVisibleCount = () => {
        if (window.matchMedia('(max-width: 640px)').matches) return 1;
        if (window.matchMedia('(max-width: 980px)').matches) return 2;
        return 3;
    };

    const getEffectiveVisibleCount = () => Math.min(visibleCount, resources.length);

    const createResourceItem = (item) => {
        const linkNode = document.createElement('a');
        linkNode.className = 'resource-home-item';
        linkNode.href = item.url;
        linkNode.target = '_blank';
        linkNode.rel = 'noopener noreferrer';
        linkNode.setAttribute('aria-label', `${item.title} (ouvre un nouvel onglet)`);

        const imageNode = document.createElement('img');
        imageNode.alt = `Logo ${item.title}`;
        imageNode.loading = 'lazy';
        imageNode.classList.add('is-loading');
        imageNode.addEventListener('load', () => {
            imageNode.classList.remove('is-loading');
        }, { once: true });
        imageNode.addEventListener('error', () => {
            imageNode.classList.remove('is-loading');
        }, { once: true });
        imageNode.src = item.image;

        const titleNode = document.createElement('span');
        titleNode.textContent = item.title;

        linkNode.appendChild(imageNode);
        linkNode.appendChild(titleNode);
        return linkNode;
    };

    const computeSlideStep = () => {
        const effectiveVisible = getEffectiveVisibleCount();
        if (effectiveVisible === 0) {
            slideStepPx = 0;
            return;
        }
        const firstItem = trackNode.querySelector('.resource-home-item');
        const computedGap = Number.parseFloat(window.getComputedStyle(trackNode).gap || '');
        const realGap = Number.isFinite(computedGap) ? computedGap : gapPx;

        if (firstItem) {
            slideStepPx = firstItem.getBoundingClientRect().width + realGap;
            return;
        }

        const windowWidth = windowNode.clientWidth;
        slideStepPx = ((windowWidth - realGap * (effectiveVisible - 1)) / effectiveVisible) + realGap;
    };

    const applyTransform = (animated) => {
        trackNode.style.transition = animated ? 'transform 380ms ease-in-out' : 'none';
        trackNode.style.transform = `translateX(${-currentIndex * slideStepPx}px)`;
    };

    const getLogicalIndex = () => {
        if (resources.length === 0) return 0;
        const effectiveVisible = getEffectiveVisibleCount();
        if (resources.length <= effectiveVisible) return 0;
        return ((currentIndex - effectiveVisible) % resources.length + resources.length) % resources.length;
    };

    const renderTrack = (startLogicalIndex = 0) => {
        const effectiveVisible = getEffectiveVisibleCount();
        carouselNode.style.setProperty('--resource-visible', String(effectiveVisible));
        trackNode.innerHTML = '';

        if (resources.length <= effectiveVisible) {
            resources.forEach((item) => {
                trackNode.appendChild(createResourceItem(item));
            });
            prevNode.disabled = true;
            nextNode.disabled = true;
            trackNode.style.transition = 'none';
            trackNode.style.transform = 'translateX(0)';
            return;
        }

        const prefix = resources.slice(-effectiveVisible);
        const suffix = resources.slice(0, effectiveVisible);
        const loopItems = [...prefix, ...resources, ...suffix];

        loopItems.forEach((item) => {
            trackNode.appendChild(createResourceItem(item));
        });

        computeSlideStep();
        currentIndex = effectiveVisible + ((startLogicalIndex % resources.length + resources.length) % resources.length);
        applyTransform(false);
        prevNode.disabled = false;
        nextNode.disabled = false;
    };

    const moveCarousel = (step) => {
        if (isAnimating) return;
        if (resources.length <= getEffectiveVisibleCount()) return;
        isAnimating = true;
        currentIndex += step;
        applyTransform(true);
    };

    const startAutoSlide = () => {
        if (intervalId !== null) return;
        if (resources.length <= getEffectiveVisibleCount()) return;
        intervalId = window.setInterval(() => {
            moveCarousel(1);
        }, slideDurationMs);
    };

    const stopAutoSlide = () => {
        if (intervalId === null) return;
        window.clearInterval(intervalId);
        intervalId = null;
    };

    const clearResumeTimeout = () => {
        if (resumeTimeoutId === null) return;
        window.clearTimeout(resumeTimeoutId);
        resumeTimeoutId = null;
    };

    const scheduleAutoResume = () => {
        clearResumeTimeout();
        if (isPointerOverCarousel) return;
        if (resources.length <= getEffectiveVisibleCount()) return;
        resumeTimeoutId = window.setTimeout(() => {
            resumeTimeoutId = null;
            startAutoSlide();
        }, resumeDelayAfterManualMs);
    };

    const handleManualNavigation = (step) => {
        stopAutoSlide();
        moveCarousel(step);
        scheduleAutoResume();
    };

    const syncAutoSlideState = () => {
        if (resources.length <= getEffectiveVisibleCount()) {
            clearResumeTimeout();
            stopAutoSlide();
            return;
        }
        if (isPointerOverCarousel) {
            clearResumeTimeout();
            stopAutoSlide();
            return;
        }
        if (intervalId === null && resumeTimeoutId === null) {
            startAutoSlide();
        }
    };

    trackNode.addEventListener('transitionend', (event) => {
        if (event.propertyName !== 'transform') return;
        if (!isAnimating) return;
        isAnimating = false;

        const effectiveVisible = getEffectiveVisibleCount();
        const minLoopIndex = effectiveVisible;
        const maxLoopIndex = effectiveVisible + resources.length - 1;

        if (currentIndex < minLoopIndex) {
            currentIndex += resources.length;
            applyTransform(false);
        } else if (currentIndex > maxLoopIndex) {
            currentIndex -= resources.length;
            applyTransform(false);
        }
    });

    prevNode.addEventListener('click', () => {
        handleManualNavigation(-1);
    });

    nextNode.addEventListener('click', () => {
        handleManualNavigation(1);
    });

    carouselNode.addEventListener('mouseenter', () => {
        isPointerOverCarousel = true;
        clearResumeTimeout();
        stopAutoSlide();
    });

    carouselNode.addEventListener('mouseleave', () => {
        isPointerOverCarousel = false;
        clearResumeTimeout();
        startAutoSlide();
    });

    window.addEventListener('resize', () => {
        const logicalIndex = getLogicalIndex();
        visibleCount = getVisibleCount();
        renderTrack(logicalIndex);
        syncAutoSlideState();
    });

    visibleCount = getVisibleCount();
    renderTrack(0);
    syncAutoSlideState();
}

function renderHomepagePreviews() {
    const reseauPosts = getStorageArray('reseauposts');
    if (reseauPosts.length > 0) {
        const lastReseauPost = reseauPosts[0];
        const reseauTitle = lastReseauPost.title || lastReseauPost.content;
        updateMediaPreview(
            'reseauPreviewImg',
            'reseauPreviewTitle',
            lastReseauPost.image || '',
            buildPreviewSummary(lastReseauPost.author, reseauTitle),
            'Aucun post récent.'
        );
    }

    const tools = getStorageArray('tools');
    if (tools.length > 0) {
        const lastTool = tools[0];
        const toolTitle = lastTool.name;
        const toolImage = lastTool.steps?.[0]?.images?.[0] || '';
        updateMediaPreview(
            'outilsPreviewImg',
            'outilsPreviewTitle',
            toolImage,
            buildPreviewSummary(lastTool.author, toolTitle),
            'Aucun contenu récent.'
        );
    }

    const blogPosts = getStorageArray('blogposts');
    const blogLine = document.getElementById('blogLatestLine');
    if (blogLine) {
        if (blogPosts.length > 0) {
            const lastBlogPost = getLatestPublishedBlogPost(blogPosts) || blogPosts[0];
            const blogText = truncateText(lastBlogPost.title || lastBlogPost.content, 70);
            blogLine.textContent = `Dernier contenu : ${blogText || 'Sans titre'}`;
        } else {
            blogLine.textContent = 'Dernier contenu : Aucun contenu récent.';
        }
    }

    if (blogPosts.length > 0) {
        const lastBlogPost = getLatestPublishedBlogPost(blogPosts) || blogPosts[0];
        const blogImage = getAuthorProfileImageByName(lastBlogPost.author) || 'images/fond page d\'acceuil.png';
        updateMediaPreview(
            'blogPreviewImg',
            'blogPreviewTitle',
            blogImage,
            buildPreviewSummary(lastBlogPost.author, lastBlogPost.title || lastBlogPost.content),
            'Aucun post récent.'
        );
    }

    const viePreview = getLatestViePreviewSource();
    const vieTitleNode = document.getElementById('nativeVieCalendarMonthLabel');
    if (viePreview && vieTitleNode && isNativeAppRuntime()) {
        vieTitleNode.title = `${viePreview.title} • ${viePreview.author}`;
    }
}

// Vérifier l'état de connexion au chargement
function checkLoginState() {
    const user = getConnectedUser();

    if (user && (user.email || user.name)) {
        showConnectedState(user.email || user.name);
    } else {
        showNotConnectedState();
    }
}

// Bloquage des différentes pages et liens si non connecté
function checkConnection(event, pageUrl) {
    event.preventDefault();
    window.location.href = pageUrl;
}

function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
    const ua = window.navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opr\//i.test(ua);
    return isIos && isSafari;
}

function initInstallAppButton() {
    const installButton = document.getElementById('installAppBtn');
    if (!installButton) return;

    if (isStandaloneMode()) {
        installButton.style.display = 'none';
        return;
    }

    if (isIosSafari()) {
        installButton.style.display = 'inline-block';
        installButton.addEventListener('click', () => {
            alert("Sur iPhone/iPad: ouvrez le menu Partager, puis 'Sur l'écran d'accueil'.");
        });
        return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installButton.style.display = 'inline-block';
    });

    installButton.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;

        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installButton.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
        installButton.style.display = 'none';
        deferredInstallPrompt = null;
    });
}

function placeResetPasswordButton() {
    const resetPasswordAdminBtn = document.getElementById('resetPasswordAdminBtn');
    const connectedState = document.getElementById('connectedState');
    const headerTitle = document.querySelector('header .header-h1');
    if (!resetPasswordAdminBtn || !connectedState) return;

    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    if (isMobile && headerTitle) {
        const a11yButton = document.getElementById('a11yToggleBtn');
        if (a11yButton && a11yButton.parentElement === headerTitle) {
            a11yButton.insertAdjacentElement('afterend', resetPasswordAdminBtn);
        } else {
            headerTitle.appendChild(resetPasswordAdminBtn);
        }
        return;
    }

    connectedState.appendChild(resetPasswordAdminBtn);
}

// Afficher l'état connecté
function showConnectedState(email) {
    const notConnectedState = document.getElementById('notConnectedState');
    const connectedState = document.getElementById('connectedState');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const profileBtn = document.getElementById('profileBtn');
    const messagesBtn = document.getElementById('messagesBtn');
    const resetPasswordAdminBtn = document.getElementById('resetPasswordAdminBtn');
    
    if (notConnectedState && connectedState && userEmailDisplay) {
        notConnectedState.style.display = 'none';
        connectedState.style.display = 'block';
        userEmailDisplay.textContent = email;
    }

    if (profileBtn) {
        const user = getConnectedUser();
        const userName = user ? user.name : '';
        profileBtn.href = userName ? `profil.html?user=${encodeURIComponent(userName)}` : 'profil.html';
        profileBtn.style.display = 'inline-block';
    }

    if (messagesBtn) {
        messagesBtn.style.display = 'inline-block';
    }

    if (resetPasswordAdminBtn) {
        resetPasswordAdminBtn.style.display = isCurrentUserAdmin() ? 'inline-block' : 'none';
    }
    placeResetPasswordButton();
    updateNativeDrawerLinks();
    if (isNativeAppRuntime()) {
        hideNativeIntro();
    }
    
    // Cacher le bouton de connexion du header
    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons) {
        authButtons.style.display = 'none';
    }
}

// Afficher l'état non connecté
function showNotConnectedState() {
    const notConnectedState = document.getElementById('notConnectedState');
    const connectedState = document.getElementById('connectedState');
    const profileBtn = document.getElementById('profileBtn');
    const messagesBtn = document.getElementById('messagesBtn');
    const resetPasswordAdminBtn = document.getElementById('resetPasswordAdminBtn');
    
    if (notConnectedState && connectedState) {
        notConnectedState.style.display = 'block';
        connectedState.style.display = 'none';
    }
    if (profileBtn) {
        profileBtn.style.display = 'none';
    }
    if (messagesBtn) {
        messagesBtn.style.display = 'none';
    }
    if (resetPasswordAdminBtn) {
        resetPasswordAdminBtn.style.display = 'none';
    }
    placeResetPasswordButton();
    updateNativeDrawerLinks();
    
    // Afficher le bouton de connexion du header
    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons) {
        authButtons.style.display = 'flex';
    }
}

window.addEventListener('resize', placeResetPasswordButton);

// Fonction de déconnexion
function logout() {
    if (window.auth) {
        window.auth.logout();
    }

    showNotConnectedState();
    alert('Vous avez été déconnecté.');
    closeNativeDrawer();
    if (isNativeAppRuntime()) {
        showNativeIntro();
    }
}



// ==================== GESTION DES BULLES (MODALES) ====================

// Fonction pour afficher la bulle de connexion
function showLogin() {
    if (isNativeAppRuntime()) {
        showNativeIntro();
        openNativeAuthSheet();
        return;
    }
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'block';
    }
}

// Fonction pour fermer la bulle de connexion
function closeLogin() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'none';
    }
}

// Fonction pour afficher la bulle d'inscription
function showSignup() {
    closeLogin(); // Ferme la bulle de connexion si elle est ouverte
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
        signupModal.style.display = 'block';
    }
}

// Fonction pour fermer la bulle d'inscription
function closeSignup() {
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
        signupModal.style.display = 'none';
    }
}

// Fermer les bulles en cliquant en dehors
window.onclick = function(event) {
    const loginModal = document.getElementById('loginModal');
    const signupModal = document.getElementById('signupModal');
    const adminModal = document.getElementById('adminModal');
    const adminResetPasswordModal = document.getElementById('adminResetPasswordModal');

    if (event.target === loginModal) {
        closeLogin();
    }
    if (event.target === signupModal) {
        closeSignup();
    }
    if (event.target === adminModal) {
        closeAdmin();
    }
    if (event.target === adminResetPasswordModal) {
        closeAdminResetPassword();
    }
}


// ==================== GESTION DES FORMULAIRES =========================

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelector('input[type="password"]').value;

    const result = window.auth
        ? await window.auth.login(email, password)
        : { ok: false, reason: 'auth_unavailable' };

    if (result.ok) {
        showConnectedState(result.user.email);
        closeLogin();
        return;
    }

    if (result.reason === 'not_validated') {
        alert("Votre compte est en attente de validation par un administrateur.");
        return;
    }

    if (result.reason === 'invalid_credentials') {
        alert("Compte inexistant ou mot de passe incorrect.");
        return;
    }

    if (result.reason === 'crypto_unavailable') {
        alert("Votre navigateur ne supporte pas la sécurité requise (Web Crypto).");
        return;
    }

    alert("Le service de connexion est indisponible.");
});



document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const role = document.getElementById('signupRole').value;

    // Créer l'objet utilisateur pour l'envoi
    const userData = {
        name,
        email,
        password,
        role,
        isValidated: false
    };

    const result = window.auth
        ? await window.auth.signup(userData)
        : { ok: false };

    if (!result.ok) {
        if (result.reason === 'email_taken') {
            alert("Cet email est déjà utilisé.");
            return;
        }

        if (result.reason === 'weak_password') {
            alert("Mot de passe trop court (minimum 8 caractères).");
            return;
        }

        if (result.reason === 'invalid_email') {
            alert("Adresse email invalide.");
            return;
        }

        if (result.reason === 'invalid_name') {
            alert("Nom invalide.");
            return;
        }

        if (result.reason === 'crypto_unavailable') {
            alert("Votre navigateur ne supporte pas la sécurité requise (Web Crypto).");
            return;
        }

        if (result.reason === 'signup_disabled') {
            alert("Les inscriptions sont désactivées côté Supabase (Auth > Providers > Email).");
            return;
        }

        if (result.reason === 'rate_limited') {
            alert("Trop de tentatives d'inscription. Attendez une minute et réessayez.");
            return;
        }

        if (result.reason === 'captcha_required') {
            alert("Supabase demande un CAPTCHA pour l'inscription. Vérifiez les réglages Auth.");
            return;
        }

        if (result.reason === 'signup_db_error') {
            alert("Erreur base de données à l'inscription. Vérifiez les triggers/profils Supabase.");
            return;
        }

        if (result.reason === 'supabase_unavailable') {
            alert("Supabase indisponible côté navigateur (SDK ou configuration).");
            return;
        }

        if (result.reason === 'signup_no_user') {
            alert("Réponse Supabase incomplète à l'inscription. Vérifiez Auth > Logs.");
            return;
        }

        alert("Le service d'inscription est indisponible.");
        return;
    }

    if (result.firstAdminBootstrap) {
        alert("Compte créé: vous êtes le premier administrateur et votre accès est déjà validé.");
        closeSignup();
        return;
    }

    // Créer la demande de mail pour l'administrateur
    const emailData = {
        _subject: `Nouvelle demande de compte pour ${name}`,
        _replyto: email, // Permet à l'administrateur de répondre directement
        message: `Une nouvelle demande de compte a été soumise par ${name} (${email}). Rôle : ${role}. Veuillez valider son compte dans la console d'administration.`,
    };

    // Envoyer les données à Formspree
    const formUrl = 'https://formspree.io/f/xqadwrqd'; // <-- REMPLACEZ PAR VOTRE URL FORMSPREE
    try {
        const response = await fetch(formUrl, {
            method: 'POST',
            body: JSON.stringify(emailData),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            alert("Votre demande de compte a été reçue. Un administrateur va la valider.");
        } else {
            alert("Compte créé, mais l'email de notification admin n'a pas pu être envoyé.");
        }
    } catch (error) {
        alert("Compte créé, mais l'email de notification admin n'a pas pu être envoyé.");
    }

    closeSignup();
});



// Fonction pour ouvrir le formulaire d'administration
function showAdmin() {
    if (!isCurrentUserAdmin()) {
        alert("Action réservée à un administrateur connecté.");
        return;
    }

    const adminModal = document.getElementById('adminModal');
    if (adminModal) {
        adminModal.style.display = 'block';
    }
}

function showAdminResetPassword() {
    if (!isCurrentUserAdmin()) {
        alert("Action réservée à un administrateur connecté.");
        return;
    }

    const resetModal = document.getElementById('adminResetPasswordModal');
    if (resetModal) {
        resetModal.style.display = 'block';
    }
}

function closeAdminResetPassword() {
    const resetModal = document.getElementById('adminResetPasswordModal');
    if (resetModal) {
        resetModal.style.display = 'none';
    }
}

// Fonction pour fermer le formulaire d'administration
function closeAdmin() {
    const adminModal = document.getElementById('adminModal');
    if (adminModal) {
        adminModal.style.display = 'none';
    }
}

// Gérer la soumission du formulaire d'administration
document.getElementById('adminForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const emailToValidate = document.getElementById('adminEmail').value;

    const result = window.auth
        ? await window.auth.validateUser(emailToValidate)
        : { ok: false, reason: 'auth_unavailable' };

    if (result.ok) {
        alert("Le compte a été validé avec succès ! L'utilisateur peut maintenant se connecter.");
        closeAdmin();
        return;
    }

    if (result.reason === 'forbidden') {
        alert("Action réservée à un administrateur connecté.");
        return;
    }

    if (result.reason === 'already_validated') {
        alert("Ce compte est déjà validé.");
        return;
    }

    if (result.reason === 'not_found') {
        alert("Aucun compte trouvé avec cet email.");
        return;
    }

    if (result.reason === 'backend_required') {
        alert("Cette action nécessite la fonction backend Supabase (étape suivante).");
        return;
    }

    alert("Le service de validation est indisponible.");
});

const adminResetPasswordForm = document.getElementById('adminResetPasswordForm');
if (adminResetPasswordForm) {
    adminResetPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const emailToReset = document.getElementById('adminResetEmail').value;
        const tempPassword = document.getElementById('adminTemporaryPassword').value;

        const result = window.auth
            ? await window.auth.adminResetPassword(emailToReset, tempPassword)
            : { ok: false, reason: 'auth_unavailable' };

        if (result.ok) {
            alert("Mot de passe réinitialisé avec succès.");
            closeAdminResetPassword();
            this.reset();
            return;
        }

        if (result.reason === 'forbidden') {
            alert("Action réservée à un administrateur connecté.");
            return;
        }

        if (result.reason === 'invalid_email') {
            alert("Adresse email invalide.");
            return;
        }

        if (result.reason === 'not_found') {
            alert("Aucun compte trouvé avec cet email.");
            return;
        }

        if (result.reason === 'weak_password') {
            alert("Le mot de passe temporaire doit contenir au moins 8 caractères.");
            return;
        }

        if (result.reason === 'crypto_unavailable') {
            alert("Votre navigateur ne supporte pas la sécurité requise (Web Crypto).");
            return;
        }

        if (result.reason === 'backend_required') {
            alert("Fonction backend non déployée. Déploie 'admin-reset-password' dans Supabase Functions.");
            return;
        }

        alert("Le service de réinitialisation est indisponible.");
    });
}
