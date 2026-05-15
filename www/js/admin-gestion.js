function normalize(value) {
    return String(value || '').trim();
}

function normalizeKey(value) {
    return normalize(value).toLowerCase();
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

function formatDate(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return 'Date inconnue';
    return date.toLocaleString('fr-FR');
}

function requireAdminSession() {
    if (!window.auth || typeof window.auth.isLoggedIn !== 'function' || !window.auth.isLoggedIn()) {
        window.location.href = 'index.html';
        return false;
    }

    if (!window.auth.isAdmin || !window.auth.isAdmin()) {
        alert("Accès réservé à l'administrateur.");
        window.location.href = 'profil.html';
        return false;
    }

    return true;
}

function readUsers() {
    if (window.auth && typeof window.auth.readUsers === 'function') {
        return window.auth.readUsers();
    }

    if (window.dataStore && typeof window.dataStore.readArray === 'function') {
        return window.dataStore.readArray('users');
    }

    try {
        const parsed = JSON.parse(localStorage.getItem('users') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function buildItemCard(title, lines, actions = []) {
    const card = document.createElement('article');
    card.className = 'item-card';

    const heading = document.createElement('h3');
    heading.textContent = title;
    card.appendChild(heading);

    lines.forEach((line) => {
        const p = document.createElement('p');
        p.innerHTML = line;
        card.appendChild(p);
    });

    if (actions.length) {
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'item-actions';
        actions.forEach((button) => actionsWrap.appendChild(button));
        card.appendChild(actionsWrap);
    }

    return card;
}

function createButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

function renderPendingUsers() {
    const list = document.getElementById('pendingUsersList');
    const empty = document.getElementById('pendingUsersEmpty');
    if (!list || !empty) return;

    const users = readUsers();
    const pending = users
        .filter((user) => !user?.isValidated)
        .sort((a, b) => (new Date(b?.createdAt || 0).getTime() || 0) - (new Date(a?.createdAt || 0).getTime() || 0));

    list.innerHTML = '';

    if (!pending.length) {
        empty.hidden = false;
        return;
    }

    empty.hidden = true;

    pending.forEach((user) => {
        const email = normalize(user?.email);
        const role = normalize(user?.role) || 'parent';
        const title = `${normalize(user?.name) || 'Utilisateur sans nom'} (${email || 'email inconnu'})`;

        const validateBtn = createButton('Valider', 'primary-btn', async () => {
            const result = await window.auth.validateUser(email);
            if (!result.ok) {
                if (result.reason === 'already_validated') {
                    alert('Compte déjà validé.');
                } else {
                    alert('Validation impossible.');
                }
                syncAll();
                return;
            }

            alert('Compte validé.');
            syncAll();
        });

        const promoteBtn = createButton('Promouvoir admin', 'secondary-btn', async () => {
            const confirmed = window.confirm(`Promouvoir ${normalize(user?.name) || email} en administrateur ?`);
            if (!confirmed) return;

            const result = await window.auth.promoteToAdmin(email);
            if (!result.ok) {
                alert('Promotion impossible.');
                return;
            }

            alert('Compte promu administrateur.');
            syncAll();
        });

        const rejectBtn = createButton('Refuser le compte', 'danger-btn', async () => {
            const confirmed = window.confirm(`Refuser le compte ${normalize(user?.name) || email} ?`);
            if (!confirmed) return;

            const result = await window.auth.adminRejectUser(email);
            if (!result.ok) {
                if (result.reason === 'not_found') {
                    alert('Compte introuvable (déjà supprimé côté Supabase).');
                } else if (result.reason === 'invalid_email') {
                    alert('Adresse email invalide.');
                } else if (result.reason === 'forbidden') {
                    alert("Action réservée à l'administrateur connecté.");
                } else {
                    alert('Refus impossible.');
                }
                syncAll();
                return;
            }

            alert('Compte refusé et retiré de la liste.');
            syncAll();
        });

        const card = buildItemCard(
            title,
            [
                `Rôle demandé: <strong>${escapeHtml(role)}</strong>`,
                `Créé le: ${escapeHtml(formatDate(user?.createdAt))}`
            ],
            [validateBtn, promoteBtn, rejectBtn]
        );

        list.appendChild(card);
    });
}

function handleAdminResetPassword(event) {
    event.preventDefault();

    const emailInput = document.getElementById('resetEmailInput');
    const passwordInput = document.getElementById('resetTempPasswordInput');
    if (!emailInput || !passwordInput) return;

    const email = normalize(emailInput.value);
    const tempPassword = normalize(passwordInput.value);

    window.auth.adminResetPassword(email, tempPassword).then((result) => {
        if (result.ok) {
            alert('Mot de passe temporaire appliqué.');
            event.target.reset();
            return;
        }

        if (result.reason === 'not_found') {
            alert('Email introuvable.');
            return;
        }
        if (result.reason === 'weak_password') {
            alert('Le mot de passe temporaire doit contenir au moins 8 caractères.');
            return;
        }
        if (result.reason === 'crypto_unavailable') {
            alert('Fonction indisponible: sécurité navigateur non supportée.');
            return;
        }
        if (result.reason === 'forbidden') {
            alert("Action réservée à l'administrateur connecté.");
            return;
        }
        if (result.reason === 'backend_required') {
            alert("Fonction backend non déployée. Déploie 'admin-reset-password' dans Supabase Functions.");
            return;
        }

        alert('Réinitialisation impossible.');
    });
}

async function handlePromoteAdmin(event) {
    event.preventDefault();

    const emailInput = document.getElementById('promoteAdminEmailInput');
    if (!emailInput) return;

    const email = normalize(emailInput.value).toLowerCase();
    if (!email) {
        alert('Email requis.');
        return;
    }

    const confirmed = window.confirm(`Promouvoir ${email} en administrateur ?`);
    if (!confirmed) return;

    const result = await window.auth.promoteToAdmin(email);
    if (result.ok) {
        alert('Compte promu administrateur.');
        event.target.reset();
        syncAll();
        return;
    }

    if (result.reason === 'not_found') {
        alert('Compte introuvable.');
        return;
    }
    if (result.reason === 'forbidden') {
        alert("Action réservée à l'administrateur connecté.");
        return;
    }

    alert('Promotion impossible.');
}

async function handleDeleteAccount(event) {
    event.preventDefault();

    const emailInput = document.getElementById('deleteAccountEmailInput');
    if (!emailInput) return;

    const email = normalize(emailInput.value).toLowerCase();
    if (!email) {
        alert('Email requis.');
        return;
    }

    const confirmed = window.confirm(`Désactiver le compte ${email} ?`);
    if (!confirmed) return;

    const result = await window.auth.adminDeleteUser(email);
    if (result.ok) {
        alert('Compte désactivé.');
        event.target.reset();
        syncAll();
        return;
    }

    if (result.reason === 'not_found') {
        alert('Compte introuvable.');
        return;
    }
    if (result.reason === 'invalid_email') {
        alert('Adresse email invalide.');
        return;
    }
    if (result.reason === 'cannot_delete_self') {
        alert("Vous ne pouvez pas désactiver le compte admin connecté.");
        return;
    }
    if (result.reason === 'forbidden') {
        alert("Action réservée à l'administrateur connecté.");
        return;
    }

    alert('Désactivation impossible.');
}

function renderReports() {
    const list = document.getElementById('adminReportsList');
    const empty = document.getElementById('adminReportsEmpty');
    if (!list || !empty) return;
    if (!window.messagingCore) return;

    const reports = window.messagingCore.listReports();
    list.innerHTML = '';

    if (!reports.length) {
        empty.hidden = false;
        return;
    }

    empty.hidden = true;

    reports.forEach((report) => {
        const isResolved = report.status === 'resolved';
        const statusLabel = isResolved ? 'Traité' : 'Ouvert';
        const title = `Signalement #${report.id} - ${statusLabel}`;

        const actions = [];
        if (!isResolved) {
            actions.push(createButton('Marquer traité', 'secondary-btn', () => {
                const result = window.messagingCore.resolveReport(report.id);
                if (!result.ok) {
                    alert('Traitement impossible.');
                    return;
                }
                syncAll();
            }));

            actions.push(createButton('Bloquer auteur', 'danger-btn', () => {
                if (!report.reportedUser) {
                    alert('Auteur introuvable.');
                    return;
                }

                const result = window.messagingCore.setUserBlocked(
                    report.reportedUser,
                    true,
                    `Blocage suite signalement #${report.id}`
                );

                if (!result.ok) {
                    if (result.reason === 'forbidden_admin') {
                        alert('Impossible de bloquer un administrateur.');
                        return;
                    }
                    alert('Blocage impossible.');
                    return;
                }

                alert(`${report.reportedUser} est bloqué pour la messagerie.`);
                syncAll();
            }));
        }

        const card = buildItemCard(
            title,
            [
                `Par: <strong>${escapeHtml(report.reporter || 'Inconnu')}</strong>`,
                `Auteur signalé: <strong>${escapeHtml(report.reportedUser || 'Inconnu')}</strong>`,
                `Date: ${escapeHtml(formatDate(report.createdAt))}`,
                `Raison: ${escapeHtml(report.reason || 'Non précisée')}`,
                `Contenu: ${escapeHtml(report.messageText || '')}`
            ],
            actions
        );

        list.appendChild(card);
    });
}

function renderBlockedUsers() {
    const list = document.getElementById('blockedUsersList');
    const empty = document.getElementById('blockedUsersEmpty');
    if (!list || !empty) return;
    if (!window.messagingCore || typeof window.messagingCore.getBlockedUsers !== 'function') return;

    const blockedUsers = window.messagingCore.getBlockedUsers();
    list.innerHTML = '';

    if (!blockedUsers.length) {
        empty.hidden = false;
        return;
    }

    empty.hidden = true;

    blockedUsers.forEach((entry) => {
        const userName = normalize(entry?.name);
        const unblockBtn = createButton('Débloquer', 'primary-btn', () => {
            const result = window.messagingCore.setUserBlocked(userName, false, '');
            if (!result.ok) {
                alert('Déblocage impossible.');
                return;
            }

            alert(`${userName} est débloqué.`);
            syncAll();
        });

        const card = buildItemCard(
            userName || 'Utilisateur inconnu',
            [
                `Bloqué le: ${escapeHtml(formatDate(entry?.blockedAt))}`,
                `Bloqué par: ${escapeHtml(entry?.blockedBy || 'admin')}`,
                `Raison: ${escapeHtml(entry?.reason || 'Non précisée')}`
            ],
            [unblockBtn]
        );

        list.appendChild(card);
    });
}

async function syncAll() {
    if (window.supabaseSync && typeof window.supabaseSync.syncAll === 'function') {
        try {
            await window.supabaseSync.syncAll({ force: true, maxAgeMs: 0 });
        } catch (error) {
            // Fallback local silencieux.
        }
    }

    renderPendingUsers();
    renderReports();
    renderBlockedUsers();

    if (window.messagesWidget && typeof window.messagesWidget.updateAllBadges === 'function') {
        window.messagesWidget.updateAllBadges();
    } else if (window.messagesWidget && typeof window.messagesWidget.updateUnreadBadges === 'function') {
        window.messagesWidget.updateUnreadBadges();
    }
}

function initEvents() {
    const resetForm = document.getElementById('adminResetForm');
    const promoteAdminForm = document.getElementById('promoteAdminForm');
    const deleteAccountForm = document.getElementById('deleteAccountForm');
    const refreshPendingBtn = document.getElementById('refreshPendingBtn');
    const refreshReportsBtn = document.getElementById('refreshReportsBtn');
    const refreshBlockedBtn = document.getElementById('refreshBlockedBtn');

    if (resetForm) {
        resetForm.addEventListener('submit', handleAdminResetPassword);
    }
    if (promoteAdminForm) {
        promoteAdminForm.addEventListener('submit', handlePromoteAdmin);
    }
    if (deleteAccountForm) {
        deleteAccountForm.addEventListener('submit', handleDeleteAccount);
    }

    if (refreshPendingBtn) refreshPendingBtn.addEventListener('click', () => { syncAll(); });
    if (refreshReportsBtn) refreshReportsBtn.addEventListener('click', () => { syncAll(); });
    if (refreshBlockedBtn) refreshBlockedBtn.addEventListener('click', () => { syncAll(); });

    window.addEventListener('storage', (event) => {
        if (
            event.key === 'users' ||
            event.key === 'messageReports' ||
            event.key === 'messagingBlocks' ||
            event.key === 'privateMessages' ||
            event.key === 'activityNotifications'
        ) {
            syncAll();
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAdminSession()) return;
    initEvents();
    syncAll();
});
