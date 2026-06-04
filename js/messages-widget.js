(function () {
    let refreshTimer = null;

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

    function ensureNativeMessageBadges() {
        if (!isNativeAppRuntime()) return;

        const menuButtonIds = [
            'appNativeMenuBtn',
            'appNativeShellMenuBtn',
            'appNativeBlogMenuBtn',
            'appNativeToolsMenuBtn',
            'appNativeReseauMenuBtn',
            'appNativeTeamsMenuBtn'
        ];

        menuButtonIds.forEach((id) => {
            const button = document.getElementById(id);
            if (!button) return;
            let badge = button.querySelector('[data-messages-badge]');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'messages-badge messages-badge--menu';
                badge.setAttribute('data-messages-badge', 'true');
                badge.hidden = true;
                badge.textContent = '0';
                button.appendChild(badge);
            }
        });

        const drawerMessageLinkIds = [
            'appNativeDrawerMessages',
            'appNativeShellMessagesLink',
            'appNativeBlogMessagesLink',
            'appNativeToolsMessagesLink',
            'appNativeTeamsMessagesLink'
        ];

        drawerMessageLinkIds.forEach((id) => {
            const link = document.getElementById(id);
            if (!link) return;
            let badge = link.querySelector('[data-messages-badge]');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'messages-badge messages-badge--drawer';
                badge.setAttribute('data-messages-badge', 'true');
                badge.hidden = true;
                badge.textContent = '0';
                link.appendChild(badge);
            }
        });
    }

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

    function updateUnreadBadges() {
        ensureNativeMessageBadges();

        const badges = document.querySelectorAll('[data-messages-badge]');
        if (!badges.length) return;

        const currentUserName = getCurrentUserName();
        let unreadMessages = 0;
        let unreadNotifications = 0;

        if (currentUserName && window.messagingCore && typeof window.messagingCore.getUnreadCount === 'function') {
            unreadMessages = window.messagingCore.getUnreadCount(currentUserName);
        }

        if (currentUserName && window.activityNotifications && typeof window.activityNotifications.getUnreadCount === 'function') {
            unreadNotifications = window.activityNotifications.getUnreadCount(currentUserName);
        }

        const unreadCount = unreadMessages + unreadNotifications;

        badges.forEach((badge) => {
            if (!badge) return;
            if (unreadCount > 0) {
                badge.hidden = false;
                badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            } else {
                badge.hidden = true;
                badge.textContent = '0';
            }
        });
    }

    function syncActivityNotificationsForBadges() {
        const currentUserName = getCurrentUserName();
        if (!currentUserName) return;
        if (!window.activityNotifications || typeof window.activityNotifications.syncFromSupabase !== 'function') return;

        window.activityNotifications
            .syncFromSupabase({ maxAgeMs: 15000 })
            .then(() => updateUnreadBadges())
            .catch(() => {});
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
        ensureProfileReportsBadges();

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
    }

    function init() {
        ensureNativeMessageBadges();
        ensureProfileReportsBadges();
        updateUnreadBadges();
        syncActivityNotificationsForBadges();
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
                syncActivityNotificationsForBadges();
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
