const IME_STATUS_GROUPS = Object.freeze([
    { key: 'direction', title: 'Direction', icon: 'fa-user-tie' },
    { key: 'secretariat', title: 'Secretariat', icon: 'fa-envelope-open-text' },
    { key: 'pedagogique', title: 'Equipe pedagogique', icon: 'fa-stethoscope' },
    { key: 'educateurs', title: 'Equipe educateurs', icon: 'fa-people-group' },
    { key: 'non_renseigne', title: 'Statut non renseigne', icon: 'fa-user' }
]);

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

function closeNativeTeamsDrawer() {
    document.body.classList.remove('app-native-teams-drawer-open');
    const backdropNode = document.getElementById('appNativeTeamsDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeTeamsDrawer');
    if (backdropNode) backdropNode.hidden = true;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'true');
}

function openNativeTeamsDrawer() {
    document.body.classList.add('app-native-teams-drawer-open');
    const backdropNode = document.getElementById('appNativeTeamsDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeTeamsDrawer');
    if (backdropNode) backdropNode.hidden = false;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'false');
}

function isCurrentUserAdmin() {
    if (!window.auth || typeof window.auth.isAdmin !== 'function') return false;
    return !!window.auth.isAdmin();
}

function updateNativeTeamsDrawerLinks() {
    const profileNode = document.getElementById('appNativeDrawerProfile');
    const messagesNode = document.getElementById('appNativeDrawerMessages');
    const logoutNode = document.getElementById('appNativeTeamsLogoutBtn');
    const resetNode = document.getElementById('appNativeTeamsAdminResetLink');
    const user = getCurrentConnectedUser();
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
        resetNode.style.display = isCurrentUserAdmin() ? 'block' : 'none';
    }
}

function logoutFromNativeTeamsDrawer() {
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

function initNativeTeamsExperience() {
    if (!isNativeAppRuntime()) return;

    document.body.classList.add('is-native-app');
    const chromeNode = document.getElementById('appNativeTeamsChrome');
    const menuBtnNode = document.getElementById('appNativeTeamsMenuBtn');
    const backdropNode = document.getElementById('appNativeTeamsDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeTeamsDrawer');
    const adminResetNode = document.getElementById('appNativeTeamsAdminResetLink');
    const accessibilityNode = document.getElementById('appNativeTeamsAccessibilityLink');
    const logoutNode = document.getElementById('appNativeTeamsLogoutBtn');

    if (chromeNode) chromeNode.setAttribute('aria-hidden', 'false');

    if (menuBtnNode) {
        menuBtnNode.addEventListener('click', () => {
            if (document.body.classList.contains('app-native-teams-drawer-open')) {
                closeNativeTeamsDrawer();
            } else {
                openNativeTeamsDrawer();
            }
        });
    }

    if (backdropNode) {
        backdropNode.addEventListener('click', closeNativeTeamsDrawer);
    }

    if (drawerNode) {
        drawerNode.querySelectorAll('a').forEach((linkNode) => {
            linkNode.addEventListener('click', () => {
                closeNativeTeamsDrawer();
            });
        });
    }

    if (adminResetNode) {
        adminResetNode.addEventListener('click', () => {
            closeNativeTeamsDrawer();
            if (isCurrentUserAdmin() && typeof window.showAdminResetPassword === 'function') {
                window.showAdminResetPassword();
            }
        });
    }

    if (accessibilityNode) {
        accessibilityNode.addEventListener('click', () => {
            closeNativeTeamsDrawer();
            const toggleNode = document.getElementById('a11yToggleBtn');
            if (toggleNode) toggleNode.click();
        });
    }

    if (logoutNode) {
        logoutNode.addEventListener('click', () => {
            closeNativeTeamsDrawer();
            logoutFromNativeTeamsDrawer();
        });
    }

    updateNativeTeamsDrawerLinks();
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

function writeArray(key, value) {
    const safeArray = Array.isArray(value) ? value : [];

    if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
        window.dataStore.writeArray(key, safeArray);
        return;
    }

    localStorage.setItem(key, JSON.stringify(safeArray));
}

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeImeStatus(value) {
    const key = normalizeKey(value);
    return IME_STATUS_GROUPS.some((group) => group.key === key) ? key : 'non_renseigne';
}

function normalizeProfessionalTitle(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function isIntervenantUser(user) {
    return normalizeKey(user && user.role) === 'professionnel';
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

function truncateText(value, maxLength) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
}

function initialsFromName(fullName) {
    const parts = String(fullName || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 0) return '??';
    return parts.map((part) => part[0].toUpperCase()).join('');
}

function buildInitialsAvatar(name) {
    const initials = initialsFromName(name);
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f5ea8" />
      <stop offset="100%" stop-color="#2f7ed1" />
    </linearGradient>
  </defs>
  <rect width="240" height="240" fill="url(#g)" />
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Segoe UI, Arial, sans-serif" font-size="84" fill="#ffffff" font-weight="700">
    ${initials}
  </text>
</svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function safeImageSrc(src) {
    const value = String(src || '').trim();
    if (!value) return '';
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('blob:') || value.startsWith('/')) {
        return value;
    }
    return '';
}

function toAgendaDateKey(value) {
    if (!value) return '';

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return '';

    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function readAgendaEvents() {
    const events = readArray('agendaEvents');
    return events.filter((item) => item && typeof item === 'object');
}

function writeAgendaEvents(events) {
    writeArray('agendaEvents', events);
}

function buildAgendaEventsByDay(year, monthIndex) {
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const byDay = new Map();
    const events = readAgendaEvents();

    events.forEach((item) => {
        const dateKey = toAgendaDateKey(item.date || item.eventDate || '');
        if (!dateKey || !dateKey.startsWith(monthKey)) return;

        const day = Number(dateKey.slice(8, 10));
        if (!Number.isFinite(day) || day < 1 || day > 31) return;

        const text = String(item.title || item.event || item.name || 'Évènement').trim();
        const list = byDay.get(day) || [];
        const sourcePostId = Number(item.sourcePostId);
        list.push({
            text: text || 'Évènement',
            source: String(item.source || '').trim().toLowerCase(),
            sourcePostId: Number.isFinite(sourcePostId) ? sourcePostId : null,
            dateKey
        });
        byDay.set(day, list);
    });

    return byDay;
}

function shiftMonth(referenceDate, offset) {
    const base = referenceDate instanceof Date ? referenceDate : new Date();
    return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

function renderTeamsAgenda(referenceDate = new Date()) {
    const todayLabelNode = document.getElementById('teamsAgendaToday');
    const monthLabelNode = document.getElementById('teamsAgendaMonthLabel');
    const gridNode = document.getElementById('teamsAgendaGrid');
    const tooltipNode = document.getElementById('teamsAgendaTooltip');
    const tooltipLinkNode = document.getElementById('teamsAgendaTooltipLink');
    const agendaPanelNode = gridNode ? gridNode.closest('.teams-agenda-panel') : null;
    if (!monthLabelNode || !gridNode || !tooltipNode || !tooltipLinkNode || !agendaPanelNode) return;

    const resetTooltip = () => {
        tooltipNode.hidden = true;
        tooltipLinkNode.textContent = '';
        tooltipLinkNode.removeAttribute('href');
    };

    const showTooltip = (targetNode, title, href) => {
        const cleanTitle = String(title || '').trim();
        const cleanHref = String(href || '').trim();
        if (!cleanTitle || !cleanHref) {
            resetTooltip();
            return;
        }

        tooltipLinkNode.textContent = cleanTitle;
        tooltipLinkNode.href = cleanHref;
        tooltipNode.hidden = false;

        const targetRect = targetNode.getBoundingClientRect();
        const panelRect = agendaPanelNode.getBoundingClientRect();
        const leftCenter = (targetRect.left - panelRect.left) + (targetRect.width / 2);
        let top = (targetRect.bottom - panelRect.top) + 8;

        if ((top + tooltipNode.offsetHeight) > (agendaPanelNode.clientHeight - 4)) {
            top = (targetRect.top - panelRect.top) - tooltipNode.offsetHeight - 8;
        }

        const maxLeft = Math.max(6, agendaPanelNode.clientWidth - tooltipNode.offsetWidth - 6);
        const left = Math.min(maxLeft, Math.max(6, leftCenter - (tooltipNode.offsetWidth / 2)));
        tooltipNode.style.top = `${Math.round(Math.max(6, top))}px`;
        tooltipNode.style.left = `${Math.round(left)}px`;
    };

    resetTooltip();

    const year = referenceDate.getFullYear();
    const monthIndex = referenceDate.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayMondayBased = (firstDay.getDay() + 6) % 7;
    const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(firstDay);
    if (todayLabelNode) {
        const todayLabel = new Intl.DateTimeFormat('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(new Date());
        todayLabelNode.textContent = `Aujourd'hui : ${todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}`;
    }
    const eventsByDay = buildAgendaEventsByDay(year, monthIndex);

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
        const dayNode = document.createElement(hasEvent ? 'button' : 'span');
        dayNode.className = 'agenda-day';
        dayNode.textContent = String(day);

        if (hasEvent) {
            dayNode.classList.add('has-event');
            dayNode.title = dayEvents.map((item) => item.text).join('\n');
            if (dayNode instanceof HTMLButtonElement) {
                dayNode.type = 'button';
                dayNode.setAttribute('aria-label', `Voir l'évènement du ${day}`);
                const href = blogEvent && Number.isFinite(blogEvent.sourcePostId)
                    ? `blog.html?highlightPost=${encodeURIComponent(String(blogEvent.sourcePostId))}`
                    : `blog.html?highlightDate=${encodeURIComponent(currentDateKey)}`;
                const title = dayEvents[0]?.text || `Évènement du ${day}`;

                dayNode.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    showTooltip(dayNode, title, href);
                });
            }
        }

        gridNode.appendChild(dayNode);
    }

    const totalCells = firstDayMondayBased + daysInMonth;
    const trailingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < trailingCells; i += 1) {
        const emptyNode = document.createElement('span');
        emptyNode.className = 'agenda-day is-empty';
        emptyNode.setAttribute('aria-hidden', 'true');
        gridNode.appendChild(emptyNode);
    }

    if (!gridNode.dataset.tooltipBound) {
        gridNode.dataset.tooltipBound = '1';
        gridNode.addEventListener('pointerdown', (event) => {
            if (!(event.target instanceof Element) || !event.target.closest('.agenda-day.has-event')) {
                resetTooltip();
            }
        });
        agendaPanelNode.addEventListener('pointerdown', (event) => {
            if (!(event.target instanceof Element) || !event.target.closest('#teamsAgendaTooltip, .agenda-day.has-event')) {
                resetTooltip();
            }
        });
        document.addEventListener('pointerdown', (event) => {
            if (!(event.target instanceof Element)) return;
            if (!agendaPanelNode.contains(event.target)) {
                resetTooltip();
            }
        });
    }
}

function initTeamsAgendaNavigation() {
    const prevMonthBtn = document.getElementById('teamsAgendaPrevMonth');
    const nextMonthBtn = document.getElementById('teamsAgendaNextMonth');

    let displayedMonth = new Date();
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);

    const renderDisplayedMonth = () => {
        renderTeamsAgenda(displayedMonth);
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

function getCurrentConnectedUser() {
    if (!window.auth || typeof window.auth.getCurrentUser !== 'function') {
        return null;
    }
    return window.auth.getCurrentUser();
}

function resolvePhotoByName(name, photosByKey) {
    const photo = safeImageSrc(photosByKey[normalizeKey(name)]);
    if (photo) return photo;
    return buildInitialsAvatar(name);
}

function parseDateValue(value) {
    if (!value) return 0;

    const firstTry = new Date(value);
    if (!Number.isNaN(firstTry.getTime())) {
        return firstTry.getTime();
    }

    const match = String(value).match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (!match) return 0;

    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const hours = Number(match[4] || 0);
    const minutes = Number(match[5] || 0);
    const seconds = Number(match[6] || 0);
    return new Date(year, month, day, hours, minutes, seconds).getTime();
}

function formatDateLabel(value) {
    const timestamp = parseDateValue(value);
    if (!timestamp) return 'Date non renseignee';
    return new Date(timestamp).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function buildIntervenantKeySet(users) {
    const keySet = new Set();

    users.forEach((user) => {
        if (!isIntervenantUser(user)) return;
        const key = normalizeKey(user.name);
        if (key) keySet.add(key);
    });

    return keySet;
}

function collectIntervenantHighlights(users, photosByKey) {
    const intervenantKeys = buildIntervenantKeySet(users);
    const reseauItems = [];
    const blogItems = [];
    const outilsItems = [];

    const reseauPosts = readArray('reseauposts');
    reseauPosts.forEach((post) => {
        const author = String(post.author || '').trim();
        if (!author || !intervenantKeys.has(normalizeKey(author))) return;

        const title = truncateText(post.title || post.content || 'Publication reseau', 110);
        const image = safeImageSrc(post.image) || resolvePhotoByName(author, photosByKey);
        reseauItems.push({
            source: 'Reseau',
            sourceIcon: 'fa-comments',
            title,
            image,
            author,
            dateValue: post.timestamp,
            timestamp: parseDateValue(post.timestamp),
            href: 'reseau.html'
        });
    });

    const blogPosts = readArray('blogposts');
    blogPosts.forEach((post) => {
        const author = String(post.author || '').trim();
        if (!author || !intervenantKeys.has(normalizeKey(author))) return;

        const title = truncateText(post.title || post.content || 'Publication blog', 110);
        const image = resolvePhotoByName(author, photosByKey);
        blogItems.push({
            source: 'Blog',
            sourceIcon: 'fa-newspaper',
            title,
            image,
            author,
            dateValue: post.date,
            timestamp: parseDateValue(post.date),
            href: 'blog.html'
        });
    });

    const tools = readArray('tools');
    tools.forEach((tool) => {
        const author = String(tool.author || '').trim();
        if (!author || !intervenantKeys.has(normalizeKey(author))) return;

        const title = truncateText(tool.name || 'Nouvel outil', 110);
        const toolImage = safeImageSrc(tool.steps?.[0]?.images?.[0]);
        const image = toolImage || resolvePhotoByName(author, photosByKey);
        const href = `detail-outil.html?id=${encodeURIComponent(String(tool.id || ''))}`;
        outilsItems.push({
            source: 'Outils',
            sourceIcon: 'fa-tools',
            title,
            image,
            author,
            dateValue: tool.createdAt || tool.timestamp || tool.date || '',
            timestamp: parseDateValue(tool.createdAt || tool.timestamp || tool.date || ''),
            href
        });
    });

    const takeLatestTwo = (list) => list
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 2);

    const selected = [
        ...takeLatestTwo(blogItems),
        ...takeLatestTwo(reseauItems),
        ...takeLatestTwo(outilsItems)
    ];

    return selected.sort((a, b) => b.timestamp - a.timestamp);
}

function renderImeLiveCarousel(items) {
    const card = document.getElementById('imeLiveCard');
    const image = document.getElementById('imeLiveImage');
    const badge = document.getElementById('imeLiveBadge');
    const title = document.getElementById('imeLiveTitle');
    const meta = document.getElementById('imeLiveMeta');
    const counter = document.getElementById('imeLiveCounter');
    const empty = document.getElementById('imeLiveEmpty');
    const prevButton = document.getElementById('imeLivePrev');
    const nextButton = document.getElementById('imeLiveNext');

    if (!card || !image || !badge || !title || !meta || !counter || !empty || !prevButton || !nextButton) {
        return;
    }

    if (items.length === 0) {
        card.hidden = true;
        prevButton.hidden = true;
        nextButton.hidden = true;
        counter.hidden = true;
        empty.hidden = false;
        return;
    }

    let currentIndex = 0;
    empty.hidden = true;
    card.hidden = false;
    prevButton.hidden = false;
    nextButton.hidden = false;
    counter.hidden = false;

    function refresh() {
        const item = items[currentIndex];
        card.href = item.href;
        image.src = item.image;
        badge.innerHTML = `<i class="fa-solid ${item.sourceIcon}" aria-hidden="true"></i> ${escapeHtml(item.source)}`;
        title.textContent = item.title;
        meta.textContent = `${item.author} • ${formatDateLabel(item.dateValue)}`;
        counter.textContent = `${currentIndex + 1} / ${items.length}`;
        prevButton.disabled = items.length <= 1;
        nextButton.disabled = items.length <= 1;
    }

    prevButton.onclick = () => {
        currentIndex = (currentIndex - 1 + items.length) % items.length;
        refresh();
    };

    nextButton.onclick = () => {
        currentIndex = (currentIndex + 1) % items.length;
        refresh();
    };

    refresh();
}

function createMemberCard(member, photosByKey) {
    const card = document.createElement('article');
    card.className = 'team-card';

    const profileUrl = `profil.html?user=${encodeURIComponent(member.name)}`;
    const photoSrc = resolvePhotoByName(member.name, photosByKey);
    const professionalTitle = normalizeProfessionalTitle(member.professionalTitle);
    const roleLabel = professionalTitle || 'Fonction non renseignee';

    card.innerHTML = `
        <a class="member-photo-link" href="${profileUrl}">
            <img class="member-photo" src="${photoSrc}" alt="Photo de ${escapeHtml(member.name)}">
        </a>
        <a class="member-name-link" href="${profileUrl}">${escapeHtml(member.name)}</a>
        <p class="member-role">${escapeHtml(roleLabel)}</p>
    `;

    return card;
}

function createTeamBlock(section, members, photosByKey) {
    const block = document.createElement('section');
    block.className = 'team-block';

    const iconClass = section.icon ? `fa-solid ${section.icon}` : 'fa-solid fa-users';

    const header = document.createElement('header');
    header.className = 'team-block-header';
    header.innerHTML = `
        <h3><i class="${iconClass}" aria-hidden="true"></i> ${escapeHtml(section.title || 'Equipe')}</h3>
        <span class="member-count">${members.length} profil(s)</span>
    `;

    const cards = document.createElement('div');
    cards.className = 'team-cards';

    if (members.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'team-empty';
        empty.textContent = 'Aucun profil dans cette section pour le moment.';
        cards.appendChild(empty);
    } else {
        members.forEach((member) => {
            cards.appendChild(createMemberCard(member, photosByKey));
        });
    }

    block.appendChild(header);
    block.appendChild(cards);
    return block;
}

function buildMembersByStatus(users) {
    const grouped = {};
    IME_STATUS_GROUPS.forEach((group) => {
        grouped[group.key] = [];
    });

    users.forEach((user) => {
        if (!isIntervenantUser(user)) return;
        const name = String(user.name || '').trim();
        if (!name) return;

        const statusKey = normalizeImeStatus(user.imeStatus);
        grouped[statusKey].push({
            name,
            statusKey,
            professionalTitle: normalizeProfessionalTitle(user.professionalTitle)
        });
    });

    IME_STATUS_GROUPS.forEach((group) => {
        grouped[group.key].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    });

    return grouped;
}

function renderTeams(users, photosByKey) {
    const container = document.getElementById('teamSections');
    if (!container) return;

    const grouped = buildMembersByStatus(users);
    container.innerHTML = '';

    IME_STATUS_GROUPS.forEach((group) => {
        container.appendChild(createTeamBlock(group, grouped[group.key], photosByKey));
    });
}

let lastTeamsSyncRefreshAt = 0;

function refreshTeamsAfterSupabaseSync() {
    const now = Date.now();
    if (now - lastTeamsSyncRefreshAt < 900) return;
    lastTeamsSyncRefreshAt = now;

    const users = readArray('users');
    const profilePhotos = readObject('profilePhotos');
    const highlights = collectIntervenantHighlights(users, profilePhotos);
    renderImeLiveCarousel(highlights);
    renderTeams(users, profilePhotos);
    updateNativeTeamsDrawerLinks();
}

document.addEventListener('DOMContentLoaded', async () => {
    initNativeTeamsExperience();

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

    const users = readArray('users');
    const profilePhotos = readObject('profilePhotos');

    initTeamsAgendaNavigation();

    const highlights = collectIntervenantHighlights(users, profilePhotos);
    renderImeLiveCarousel(highlights);
    renderTeams(users, profilePhotos);
    updateNativeTeamsDrawerLinks();

    window.addEventListener('supabase:sync-complete', refreshTeamsAfterSupabaseSync);
});
