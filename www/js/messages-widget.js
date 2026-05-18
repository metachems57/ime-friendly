(function () {
    let refreshTimer = null;
    const DRAWER_BADGE_CONFIG = [
        { category: 'messagerie', hrefContains: 'messagerie.html' },
        { category: 'reseau', hrefContains: 'reseau.html' },
        { category: 'blog', hrefContains: 'blog.html' },
        { category: 'outils', hrefContains: 'outils.html' },
        { category: 'teams', hrefContains: 'teams.html' },
        { category: 'profil', hrefContains: 'profil.html' }
    ];

    function getCurrentUserName() {
        if (window.messagingCore && typeof window.messagingCore.getCurrentUserName === 'function') {
            return window.messagingCore.getCurrentUserName();
        }

        if (window.auth && typeof window.auth.getCurrentUser === 'function') {
            const user = window.auth.getCurrentUser();
            return user && user.name ? String(user.name).trim() : '';
        }

        const isConnected = localStorage.getItem('imeConnected') === 'true';
        if (!isConnected) return '';
        return String(localStorage.getItem('userName') || '').trim();
    }

    function ensureNativeMenuBadges() {
        const menuButtons = document.querySelectorAll('button[id$="MenuBtn"][class*="app-native-"]');
        menuButtons.forEach((button) => {
            if (!button) return;
            let badge = button.querySelector('[data-native-menu-badge]');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'messages-badge app-native-menu-badge';
                badge.setAttribute('data-native-menu-badge', 'true');
                badge.hidden = true;
                badge.textContent = '0';
                button.appendChild(badge);
            }
        });
    }

    function ensureNativeDrawerBadges() {
        const drawers = document.querySelectorAll(
            '[id*="Drawer"].app-native-drawer, [id*="Drawer"].app-native-shell-drawer, [id*="Drawer"].app-native-reseau-drawer, [id*="Drawer"].app-native-blog-drawer, [id*="Drawer"].app-native-tools-drawer, [id*="Drawer"].app-native-teams-drawer'
        );

        drawers.forEach((drawer) => {
            if (!drawer) return;
            DRAWER_BADGE_CONFIG.forEach((entry) => {
                const link = drawer.querySelector(`a[href*="${entry.hrefContains}"]`);
                if (!link) return;

                link.classList.add('app-native-drawer-link-with-badge');

                let badge = link.querySelector(`[data-native-drawer-badge="${entry.category}"]`);
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'messages-badge app-native-drawer-badge';
                    badge.setAttribute('data-native-drawer-badge', entry.category);
                    badge.hidden = true;
                    badge.textContent = '0';
                    link.appendChild(badge);
                }
            });
        });
    }

    function ensureAllBadgeSlots() {
        ensureNativeMenuBadges();
        ensureNativeDrawerBadges();
        ensureProfileReportsBadges();
    }

    function renderBadgeList(badges, value) {
        const safeValue = Number(value) || 0;
        badges.forEach((badge) => {
            if (!badge) return;
            if (safeValue > 0) {
                badge.hidden = false;
                badge.textContent = safeValue > 99 ? '99+' : String(safeValue);
            } else {
                badge.hidden = true;
                badge.textContent = '0';
            }
        });
    }

    function updateUnreadBadges() {
        ensureAllBadgeSlots();

        const currentUserName = getCurrentUserName();
        let unreadActivity = 0;
        let unreadMessages = 0;
        let unreadBySource = {
            reseau: 0,
            blog: 0,
            tools: 0,
            system: 0
        };

        if (currentUserName && window.activityNotifications && typeof window.activityNotifications.getUnreadCount === 'function') {
            unreadActivity = window.activityNotifications.getUnreadCount(currentUserName);
            if (typeof window.activityNotifications.listForUser === 'function') {
                const unreadItems = window.activityNotifications.listForUser(currentUserName, {
                    includeRead: false,
                    limit: 500
                });
                unreadBySource = unreadItems.reduce((acc, item) => {
                    const source = String(item && item.source || '').trim().toLowerCase();
                    if (source === 'reseau' || source === 'blog' || source === 'tools' || source === 'system') {
                        acc[source] += 1;
                    } else {
                        acc.system += 1;
                    }
                    return acc;
                }, unreadBySource);
            }
        }

        if (currentUserName && window.messagingCore && typeof window.messagingCore.getUnreadCount === 'function') {
            unreadMessages = window.messagingCore.getUnreadCount(currentUserName);
        }

        const unreadCount = unreadActivity + unreadMessages;
        const globalCount = unreadCount + (isAdminSession() ? getOpenReportsCount() : 0);

        renderBadgeList(document.querySelectorAll('[data-messages-badge]'), unreadCount);
        renderBadgeList(document.querySelectorAll('[data-native-menu-badge]'), globalCount);
        renderBadgeList(document.querySelectorAll('[data-native-drawer-badge="messagerie"]'), unreadCount);
        renderBadgeList(document.querySelectorAll('[data-native-drawer-badge="reseau"]'), unreadBySource.reseau);
        renderBadgeList(document.querySelectorAll('[data-native-drawer-badge="blog"]'), unreadBySource.blog);
        renderBadgeList(document.querySelectorAll('[data-native-drawer-badge="outils"]'), unreadBySource.tools);
        renderBadgeList(document.querySelectorAll('[data-native-drawer-badge="teams"]'), unreadActivity);
    }

    function isAdminSession() {
        if (window.auth && typeof window.auth.isAdmin === 'function') {
            return !!window.auth.isAdmin();
        }
        return String(localStorage.getItem('userRole') || '').trim().toLowerCase() === 'admin';
    }

    function ensureProfileReportsBadges() {
        const profileLinks = document.querySelectorAll(
            '.header-left-bottom > a.home-btn[href^="profil.html"], a#profileBtn[href^="profil.html"]'
        );

        profileLinks.forEach((link) => {
            if (!link) return;

            let badge = link.querySelector('[data-profile-reports-badge]');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'profile-reports-badge';
                badge.setAttribute('data-profile-reports-badge', 'true');
                badge.hidden = true;
                badge.textContent = '0';
                link.appendChild(badge);
            }
        });
    }

    function getOpenReportsCount() {
        if (!isAdminSession()) return 0;

        let reports = [];
        if (window.messagingCore) {
            if (typeof window.messagingCore.listReports === 'function') {
                reports = window.messagingCore.listReports();
            } else if (typeof window.messagingCore.readReports === 'function') {
                reports = window.messagingCore.readReports();
            }
        }

        const openMessageReports = Array.isArray(reports) ? reports.reduce((count, report) => {
            const status = String(report && report.status || 'open').trim().toLowerCase();
            return count + (status === 'resolved' ? 0 : 1);
        }, 0) : 0;

        // Compat futur: si des signalements de commentaires sont ajoutés dans ces clés,
        // le badge les comptera automatiquement.
        const commentKeys = ['commentReports', 'blogCommentReports', 'reseauCommentReports'];
        const openCommentReports = commentKeys.reduce((total, key) => {
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || '[]');
                if (!Array.isArray(parsed)) return total;
                const openCount = parsed.reduce((count, item) => {
                    const status = String(item && item.status || 'open').trim().toLowerCase();
                    return count + (status === 'resolved' ? 0 : 1);
                }, 0);
                return total + openCount;
            } catch (error) {
                return total;
            }
        }, 0);

        return openMessageReports + openCommentReports;
    }

    function updateAdminReportsBadges() {
        ensureAllBadgeSlots();

        const badges = document.querySelectorAll('[data-profile-reports-badge]');
        if (!badges.length) return;

        const isAdmin = isAdminSession();
        const openReports = isAdmin ? getOpenReportsCount() : 0;

        badges.forEach((badge) => {
            if (!badge) return;

            if (isAdmin && openReports > 0) {
                badge.hidden = false;
                badge.textContent = openReports > 99 ? '99+' : String(openReports);
            } else {
                badge.hidden = true;
                badge.textContent = '0';
            }
        });

        renderBadgeList(document.querySelectorAll('[data-native-drawer-badge="profil"]'), openReports);
    }

    function init() {
        ensureAllBadgeSlots();
        updateUnreadBadges();
        updateAdminReportsBadges();

        window.addEventListener('storage', (event) => {
            if (
                event.key === 'activityNotifications' ||
                event.key === 'privateMessages' ||
                event.key === 'messageReports' ||
                event.key === 'messagingBlocks' ||
                event.key === 'messagingCoreLastSyncAt' ||
                event.key === 'imeConnected' ||
                event.key === 'userName' ||
                event.key === 'userRole'
            ) {
                updateUnreadBadges();
                updateAdminReportsBadges();
            }
        });

        if (!refreshTimer) {
            refreshTimer = window.setInterval(() => {
                updateUnreadBadges();
                updateAdminReportsBadges();
            }, 5000);
        }
    }

    window.messagesWidget = {
        updateUnreadBadges,
        updateAdminReportsBadges,
        updateAllBadges: () => {
            updateUnreadBadges();
            updateAdminReportsBadges();
        },
        init
    };

    document.addEventListener('DOMContentLoaded', init);
})();
