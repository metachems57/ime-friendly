(function initAdminResetHelper() {
    let modalReady = false;

    function isAdmin() {
        if (window.auth && typeof window.auth.isAdmin === 'function') {
            return !!window.auth.isAdmin();
        }
        const role = String(localStorage.getItem('userRole') || '').trim().toLowerCase();
        return role === 'admin';
    }

    function closeAdminResetPassword() {
        const modalNode = document.getElementById('globalAdminResetModal');
        if (!modalNode) return;
        modalNode.hidden = true;
        modalNode.style.display = 'none';
    }

    function ensureAdminResetModal() {
        if (modalReady) return;
        modalReady = true;

        if (document.getElementById('globalAdminResetModal')) return;

        const modalNode = document.createElement('div');
        modalNode.id = 'globalAdminResetModal';
        modalNode.hidden = true;
        modalNode.style.cssText = [
            'position: fixed',
            'inset: 0',
            'z-index: 20000',
            'background: rgba(10, 24, 44, 0.5)',
            'display: none',
            'align-items: center',
            'justify-content: center',
            'padding: 16px',
            'box-sizing: border-box'
        ].join(';');

        const cardNode = document.createElement('div');
        cardNode.style.cssText = [
            'width: min(430px, 95vw)',
            'background: #fff',
            'border: 1px solid #cfe0fb',
            'border-radius: 14px',
            'box-shadow: 0 14px 32px rgba(15, 52, 99, 0.28)',
            'padding: 14px 14px 12px',
            'position: relative'
        ].join(';');

        cardNode.innerHTML = `
            <button id="globalAdminResetCloseBtn" type="button" aria-label="Fermer"
                style="position:absolute;top:6px;right:8px;border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#3f5470;">&times;</button>
            <h3 style="margin:0 0 10px;color:#1f5ea8;font-size:1.08rem;text-align:center;">Réinitialiser un mot de passe</h3>
            <form id="globalAdminResetForm" style="display:grid;gap:8px;">
                <input id="globalAdminResetEmail" type="email" required placeholder="Email du compte"
                    style="border:1px solid #bfd8f7;border-radius:10px;padding:10px 11px;font:inherit;">
                <input id="globalAdminResetPassword" type="password" required minlength="8" placeholder="Mot de passe temporaire"
                    style="border:1px solid #bfd8f7;border-radius:10px;padding:10px 11px;font:inherit;">
                <button type="submit"
                    style="margin-top:2px;border:0;border-radius:10px;padding:10px 12px;background:#1f5ea8;color:#fff;font-weight:700;cursor:pointer;">
                    Appliquer
                </button>
            </form>
        `;

        modalNode.appendChild(cardNode);
        document.body.appendChild(modalNode);

        const closeBtn = document.getElementById('globalAdminResetCloseBtn');
        const formNode = document.getElementById('globalAdminResetForm');

        if (closeBtn) {
            closeBtn.addEventListener('click', closeAdminResetPassword);
        }

        modalNode.addEventListener('click', (event) => {
            if (event.target === modalNode) {
                closeAdminResetPassword();
            }
        });

        if (formNode) {
            formNode.addEventListener('submit', async (event) => {
                event.preventDefault();

                if (!isAdmin()) {
                    alert('Action réservée à un administrateur connecté.');
                    return;
                }

                if (!window.auth || typeof window.auth.adminResetPassword !== 'function') {
                    alert('Service de réinitialisation indisponible.');
                    return;
                }

                const emailNode = document.getElementById('globalAdminResetEmail');
                const passNode = document.getElementById('globalAdminResetPassword');
                const email = String(emailNode?.value || '').trim();
                const password = String(passNode?.value || '').trim();

                const result = await window.auth.adminResetPassword(email, password);
                if (result && result.ok) {
                    alert('Mot de passe réinitialisé avec succès.');
                    formNode.reset();
                    closeAdminResetPassword();
                    return;
                }

                if (result && result.reason === 'forbidden') {
                    alert('Action réservée à un administrateur connecté.');
                    return;
                }
                if (result && result.reason === 'invalid_email') {
                    alert('Adresse email invalide.');
                    return;
                }
                if (result && result.reason === 'not_found') {
                    alert('Aucun compte trouvé avec cet email.');
                    return;
                }
                if (result && result.reason === 'weak_password') {
                    alert('Le mot de passe temporaire doit contenir au moins 8 caractères.');
                    return;
                }
                if (result && result.reason === 'backend_required') {
                    alert("Fonction backend non déployée: 'admin-reset-password'.");
                    return;
                }
                alert('La réinitialisation a échoué. Réessayez.');
            });
        }
    }

    function showAdminResetPassword() {
        if (!isAdmin()) {
            alert('Action réservée à un administrateur connecté.');
            return;
        }
        ensureAdminResetModal();
        const modalNode = document.getElementById('globalAdminResetModal');
        if (!modalNode) return;
        modalNode.hidden = false;
        modalNode.style.display = 'flex';
        const emailNode = document.getElementById('globalAdminResetEmail');
        if (emailNode) emailNode.focus();
    }

    window.showAdminResetPassword = showAdminResetPassword;
    window.closeAdminResetPassword = closeAdminResetPassword;
})();
