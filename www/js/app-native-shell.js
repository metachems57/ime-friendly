(function () {
    let shellReady = false;
    let adminResetModalReady = false;

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

    function isLoggedIn() {
        if (window.auth && typeof window.auth.isLoggedIn === 'function') {
            return window.auth.isLoggedIn();
        }
        return localStorage.getItem('imeConnected') === 'true';
    }

    function getCurrentUser() {
        if (window.auth && typeof window.auth.getCurrentUser === 'function') {
            return window.auth.getCurrentUser();
        }
        return null;
    }

    function isAdmin() {
        if (window.auth && typeof window.auth.isAdmin === 'function') {
            return window.auth.isAdmin();
        }
        const user = getCurrentUser();
        return String(user?.role || '').trim().toLowerCase() === 'admin';
    }

    function logoutFromNativeDrawer() {
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

    function closeAdminResetModal() {
        ensureAdminResetModal();
        const modalNode = document.getElementById('appNativeAdminResetModal');
        if (!modalNode) return;
        modalNode.hidden = true;
        modalNode.style.display = 'none';
    }

    function showAdminResetPassword() {
        if (!isAdmin()) {
            alert('Action réservée à un administrateur connecté.');
            return;
        }

        ensureAdminResetModal();
        const modalNode = document.getElementById('appNativeAdminResetModal');
        if (!modalNode) return;
        modalNode.hidden = false;
        modalNode.style.display = 'flex';

        const emailNode = document.getElementById('appNativeAdminResetEmail');
        if (emailNode) {
            emailNode.focus();
        }
    }

    function ensureAdminResetModal() {
        if (adminResetModalReady) return;
        adminResetModalReady = true;

        if (document.getElementById('appNativeAdminResetModal')) return;

        const modalNode = document.createElement('div');
        modalNode.id = 'appNativeAdminResetModal';
        modalNode.className = 'app-native-admin-reset-modal';
        modalNode.hidden = true;
        modalNode.style.display = 'none';
        modalNode.innerHTML = `
            <div class="app-native-admin-reset-card">
                <button class="app-native-admin-reset-close" type="button" aria-label="Fermer">&times;</button>
                <h3>Réinitialiser un mot de passe</h3>
                <form id="appNativeAdminResetForm">
                    <input id="appNativeAdminResetEmail" type="email" placeholder="Email du compte" required>
                    <input id="appNativeAdminTempPassword" type="password" placeholder="Mot de passe temporaire" minlength="8" required>
                    <button type="submit">Appliquer</button>
                </form>
            </div>
        `;

        document.body.appendChild(modalNode);

        const closeBtnNode = modalNode.querySelector('.app-native-admin-reset-close');
        const formNode = document.getElementById('appNativeAdminResetForm');

        if (closeBtnNode) {
            closeBtnNode.addEventListener('click', closeAdminResetModal);
        }

        modalNode.addEventListener('click', (event) => {
            if (event.target === modalNode) {
                closeAdminResetModal();
            }
        });

        if (formNode) {
            formNode.addEventListener('submit', async (event) => {
                event.preventDefault();

                if (!isAdmin()) {
                    alert('Action réservée à un administrateur connecté.');
                    return;
                }

                const emailNode = document.getElementById('appNativeAdminResetEmail');
                const passwordNode = document.getElementById('appNativeAdminTempPassword');
                const email = String(emailNode?.value || '').trim();
                const tempPassword = String(passwordNode?.value || '').trim();

                const result = window.auth
                    ? await window.auth.adminResetPassword(email, tempPassword)
                    : { ok: false, reason: 'auth_unavailable' };

                if (result.ok) {
                    alert('Mot de passe réinitialisé avec succès.');
                    formNode.reset();
                    closeAdminResetModal();
                    return;
                }

                if (result.reason === 'forbidden') {
                    alert('Action réservée à un administrateur connecté.');
                    return;
                }

                if (result.reason === 'invalid_email') {
                    alert('Adresse email invalide.');
                    return;
                }

                if (result.reason === 'not_found') {
                    alert('Aucun compte trouvé avec cet email.');
                    return;
                }

                if (result.reason === 'weak_password') {
                    alert('Le mot de passe temporaire doit contenir au moins 8 caractères.');
                    return;
                }

                if (result.reason === 'crypto_unavailable') {
                    alert('Votre navigateur ne supporte pas la sécurité requise (Web Crypto).');
                    return;
                }

                if (result.reason === 'backend_required') {
                    alert("Fonction backend non déployée. Déploie 'admin-reset-password' dans Supabase Functions.");
                    return;
                }

                alert('Le service de réinitialisation est indisponible.');
            });
        }
    }

    function closeDrawer() {
        document.body.classList.remove('app-native-shell-drawer-open');
        const backdropNode = document.getElementById('appNativeShellDrawerBackdrop');
        const drawerNode = document.getElementById('appNativeShellDrawer');
        if (backdropNode) backdropNode.hidden = true;
        if (drawerNode) drawerNode.setAttribute('aria-hidden', 'true');
    }

    function openDrawer() {
        document.body.classList.add('app-native-shell-drawer-open');
        const backdropNode = document.getElementById('appNativeShellDrawerBackdrop');
        const drawerNode = document.getElementById('appNativeShellDrawer');
        if (backdropNode) backdropNode.hidden = false;
        if (drawerNode) drawerNode.setAttribute('aria-hidden', 'false');
    }

    function updateDynamicLinks() {
        const profileNode = document.getElementById('appNativeShellProfileLink');
        const messagesNode = document.getElementById('appNativeShellMessagesLink');
        const logoutNode = document.getElementById('appNativeShellLogoutBtn');
        const resetBtnNode = document.getElementById('appNativeShellAdminResetLink');
        const user = getCurrentUser();
        const logged = isLoggedIn();

        if (profileNode) {
            if (logged && user?.name) {
                profileNode.href = `profil.html?user=${encodeURIComponent(String(user.name).trim())}`;
            } else {
                profileNode.href = 'profil.html';
            }
        }

        if (messagesNode) {
            messagesNode.style.display = logged ? 'block' : 'none';
        }

        if (profileNode) {
            profileNode.style.display = logged ? 'block' : 'none';
        }

        if (logoutNode) {
            logoutNode.style.display = logged ? 'block' : 'none';
        }

        if (resetBtnNode) {
            resetBtnNode.style.display = isAdmin() ? 'block' : 'none';
        }
    }

    function initAppNativeShell() {
        if (!isNativeAppRuntime()) return;

        const shellNode = document.getElementById('appNativeShell');
        if (!shellNode) return;

        if (typeof window.showAdminResetPassword !== 'function') {
            window.showAdminResetPassword = showAdminResetPassword;
        }
        if (typeof window.closeAdminResetPassword !== 'function') {
            window.closeAdminResetPassword = closeAdminResetModal;
        }

        try {
            localStorage.setItem('imeNativeRuntime', '1');
        } catch (error) {
            // ignore
        }

        document.body.classList.add('is-native-app');
        document.documentElement.classList.remove('native-preload');
        shellNode.setAttribute('aria-hidden', 'false');
        updateDynamicLinks();

        if (shellReady) return;
        shellReady = true;

        const menuBtnNode = document.getElementById('appNativeShellMenuBtn');
        const backdropNode = document.getElementById('appNativeShellDrawerBackdrop');
        const drawerNode = document.getElementById('appNativeShellDrawer');
        const accessibilityNode = document.getElementById('appNativeShellAccessibilityLink');
        const resetNode = document.getElementById('appNativeShellAdminResetLink');
        const logoutNode = document.getElementById('appNativeShellLogoutBtn');

        if (menuBtnNode) {
            menuBtnNode.addEventListener('click', () => {
                if (document.body.classList.contains('app-native-shell-drawer-open')) {
                    closeDrawer();
                } else {
                    openDrawer();
                }
            });
        }

        if (backdropNode) {
            backdropNode.addEventListener('click', closeDrawer);
        }

        if (drawerNode) {
            drawerNode.querySelectorAll('a').forEach((linkNode) => {
                linkNode.addEventListener('click', () => {
                    closeDrawer();
                });
            });
        }

        if (accessibilityNode) {
            accessibilityNode.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                closeDrawer();
                if (window.imeAccessibilityPanel && typeof window.imeAccessibilityPanel.open === 'function') {
                    window.requestAnimationFrame(() => {
                        window.imeAccessibilityPanel.open();
                    });
                    return;
                }

                const toggleNode = document.getElementById('a11yToggleBtn');
                if (toggleNode) {
                    window.requestAnimationFrame(() => {
                        toggleNode.click();
                    });
                }
            });
        }

        if (resetNode) {
            resetNode.addEventListener('click', () => {
                closeDrawer();
                if (!isAdmin()) return;
                showAdminResetPassword();
            });
        }

        if (logoutNode) {
            logoutNode.addEventListener('click', () => {
                closeDrawer();
                logoutFromNativeDrawer();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', initAppNativeShell);
})();
