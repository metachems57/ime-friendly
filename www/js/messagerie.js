const MAX_MESSAGE_LENGTH = 1000;

const state = {
    currentUserName: '',
    activePartnerName: '',
    conversations: [],
    isAdmin: false,
    isCurrentUserBlocked: false,
    notificationsOpen: false
};

function formatDate(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function truncate(value, maxLength) {
    const text = String(value || '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
}

function getNodes() {
    return {
        contactSelect: document.getElementById('contactSelect'),
        conversationsList: document.getElementById('conversationsList'),
        conversationsEmpty: document.getElementById('conversationsEmpty'),
        threadTitle: document.getElementById('threadTitle'),
        threadMeta: document.getElementById('threadMeta'),
        threadMessages: document.getElementById('threadMessages'),
        messageForm: document.getElementById('messageForm'),
        messageInput: document.getElementById('messageInput'),
        messageCount: document.getElementById('messageCount'),
        sendMessageBtn: document.getElementById('sendMessageBtn'),
        startConversationForm: document.getElementById('startConversationForm'),
        adminBlockBtn: document.getElementById('adminBlockBtn'),
        adminModerationPanel: document.getElementById('adminModerationPanel'),
        reportsList: document.getElementById('reportsList'),
        reportsEmpty: document.getElementById('reportsEmpty'),
        notificationsToggleBtn: document.getElementById('notificationsToggleBtn'),
        notificationsPanel: document.getElementById('notificationsPanel'),
        notificationsList: document.getElementById('notificationsList'),
        notificationsEmpty: document.getElementById('notificationsEmpty')
    };
}

function updateNotificationsBadges() {
    const badges = document.querySelectorAll('[data-notifications-badge]');
    if (!badges.length) return;

    let unreadCount = 0;
    if (
        state.currentUserName &&
        window.activityNotifications &&
        typeof window.activityNotifications.getUnreadCount === 'function'
    ) {
        unreadCount = window.activityNotifications.getUnreadCount(state.currentUserName);
    }

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

function renderNotificationsPanel() {
    const { notificationsPanel, notificationsList, notificationsEmpty } = getNodes();
    if (!notificationsPanel || !notificationsList || !notificationsEmpty) return;

    notificationsList.innerHTML = '';

    if (!window.activityNotifications || typeof window.activityNotifications.listForUser !== 'function') {
        notificationsPanel.hidden = true;
        notificationsEmpty.hidden = false;
        return;
    }

    const notifications = window.activityNotifications.listForUser(state.currentUserName, {
        includeRead: false,
        limit: 80
    });

    if (!notifications.length) {
        notificationsEmpty.hidden = false;
        return;
    }

    notificationsEmpty.hidden = true;

    notifications.forEach((notification) => {
        const itemLink = document.createElement('a');
        itemLink.className = 'notification-item';
        itemLink.href = window.activityNotifications.getNotificationLink(notification);

        const title = document.createElement('strong');
        title.className = 'notification-item-title';
        title.textContent = notification.postTitle || 'Publication';

        const details = document.createElement('span');
        details.className = 'notification-item-meta';
        details.textContent = `${window.activityNotifications.getNotificationMessage(notification)} • ${formatDate(notification.createdAt)}`;

        itemLink.appendChild(title);
        itemLink.appendChild(details);

        itemLink.addEventListener('click', () => {
            if (window.activityNotifications && typeof window.activityNotifications.markAsRead === 'function') {
                window.activityNotifications.markAsRead(notification.id, state.currentUserName);
            }
            updateNotificationsBadges();
            if (window.messagesWidget && typeof window.messagesWidget.updateUnreadBadges === 'function') {
                window.messagesWidget.updateUnreadBadges();
            }
        });

        notificationsList.appendChild(itemLink);
    });
}

function toggleNotificationsPanel() {
    const { notificationsPanel } = getNodes();
    if (!notificationsPanel) return;

    if (notificationsPanel.hidden) {
        notificationsPanel.hidden = false;
        state.notificationsOpen = true;

        renderNotificationsPanel();
        updateNotificationsBadges();

        if (window.messagesWidget && typeof window.messagesWidget.updateUnreadBadges === 'function') {
            window.messagesWidget.updateUnreadBadges();
        }
        return;
    }

    notificationsPanel.hidden = true;
    state.notificationsOpen = false;
}

function requireConnectedUser() {
    if (!window.auth || typeof window.auth.isLoggedIn !== 'function' || !window.auth.isLoggedIn()) {
        window.location.href = 'index.html';
        return false;
    }

    if (!window.messagingCore || typeof window.messagingCore.getCurrentUserName !== 'function') {
        alert('Messagerie indisponible.');
        return false;
    }

    const currentUserName = window.messagingCore.getCurrentUserName();
    if (!currentUserName) {
        window.location.href = 'index.html';
        return false;
    }

    state.currentUserName = currentUserName;
    state.isAdmin = typeof window.messagingCore.isAdminSession === 'function'
        ? window.messagingCore.isAdminSession()
        : false;
    return true;
}

function refreshCurrentUserBlockedStatus() {
    state.isCurrentUserBlocked = !!(
        window.messagingCore &&
        typeof window.messagingCore.isUserBlocked === 'function' &&
        window.messagingCore.isUserBlocked(state.currentUserName)
    );
}

function renderContactSelect() {
    const { contactSelect } = getNodes();
    if (!contactSelect) return;

    const contacts = window.messagingCore.getContactCandidates(state.currentUserName);
    contactSelect.innerHTML = '';

    if (!contacts.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = state.isCurrentUserBlocked
            ? 'Compte bloqué pour la messagerie'
            : 'Aucun contact disponible';
        contactSelect.appendChild(option);
        contactSelect.disabled = true;
        return;
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choisir un membre';
    contactSelect.appendChild(placeholder);

    contacts.forEach((user) => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        contactSelect.appendChild(option);
    });

    contactSelect.disabled = false;
}

function renderConversationsList() {
    const { conversationsList, conversationsEmpty } = getNodes();
    if (!conversationsList || !conversationsEmpty) return;

    conversationsList.innerHTML = '';

    if (!state.conversations.length) {
        conversationsEmpty.hidden = false;
        return;
    }

    conversationsEmpty.hidden = true;

    state.conversations.forEach((conversation) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'conversation-item';
        if (conversation.partnerName === state.activePartnerName) {
            button.classList.add('active');
        }

        const top = document.createElement('div');
        top.className = 'conversation-top';

        const name = document.createElement('span');
        name.className = 'conversation-name';
        name.textContent = conversation.partnerName;

        const date = document.createElement('span');
        date.className = 'conversation-date';
        date.textContent = formatDate(conversation.lastMessageDate);

        top.appendChild(name);
        top.appendChild(date);

        const preview = document.createElement('p');
        preview.className = 'conversation-preview';
        preview.textContent = truncate(conversation.lastMessage || 'Conversation vide', 70);

        button.appendChild(top);
        button.appendChild(preview);

        if (conversation.unreadCount > 0) {
            const unread = document.createElement('span');
            unread.className = 'conversation-unread';
            unread.textContent = conversation.unreadCount > 99 ? '99+' : String(conversation.unreadCount);
            button.appendChild(unread);
        }

        button.addEventListener('click', () => {
            openConversation(conversation.partnerName);
        });

        conversationsList.appendChild(button);
    });
}

function renderAdminBlockButton() {
    const { adminBlockBtn } = getNodes();
    if (!adminBlockBtn) return;

    if (!state.isAdmin || !state.activePartnerName) {
        adminBlockBtn.hidden = true;
        return;
    }

    if (state.activePartnerName.toLowerCase() === state.currentUserName.toLowerCase()) {
        adminBlockBtn.hidden = true;
        return;
    }

    const blocked = window.messagingCore.isUserBlocked(state.activePartnerName);
    adminBlockBtn.hidden = false;
    adminBlockBtn.textContent = blocked
        ? 'Débloquer cet utilisateur'
        : 'Bloquer cet utilisateur';
}

function handleReportMessage(messageId) {
    const reasonInput = window.prompt('Raison du signalement (optionnel) :', '');
    if (reasonInput === null) return;

    const result = window.messagingCore.reportMessage({
        messageId,
        reason: reasonInput
    });

    if (!result.ok) {
        if (result.reason === 'already_reported') {
            alert('Vous avez déjà signalé ce message.');
            return;
        }

        if (result.reason === 'message_not_found') {
            alert('Message introuvable.');
            return;
        }

        alert('Impossible de signaler ce message.');
        return;
    }

    alert('Signalement envoyé. Merci.');
    renderAdminReports();
}

function renderThread() {
    const {
        threadTitle,
        threadMeta,
        threadMessages,
        messageInput,
        sendMessageBtn
    } = getNodes();

    if (!threadTitle || !threadMeta || !threadMessages || !messageInput || !sendMessageBtn) return;

    threadMessages.innerHTML = '';

    if (!state.activePartnerName) {
        threadTitle.textContent = 'Sélectionnez une conversation';
        threadMeta.textContent = 'Choisissez un contact à gauche pour commencer.';

        const empty = document.createElement('p');
        empty.className = 'thread-empty';
        empty.textContent = 'Aucun fil actif.';
        threadMessages.appendChild(empty);

        messageInput.disabled = true;
        sendMessageBtn.disabled = true;
        return;
    }

    threadTitle.textContent = state.activePartnerName;

    if (state.isCurrentUserBlocked) {
        threadMeta.textContent = 'Votre compte est bloqué pour la messagerie par un administrateur.';
    } else if (window.messagingCore.isUserBlocked(state.activePartnerName)) {
        threadMeta.textContent = 'Cet utilisateur est bloqué par un administrateur.';
    } else {
        threadMeta.textContent = 'Conversation privée';
    }

    const messages = window.messagingCore.getThreadMessages(state.currentUserName, state.activePartnerName);

    if (!messages.length) {
        const empty = document.createElement('p');
        empty.className = 'thread-empty';
        empty.textContent = 'Commencez la conversation en envoyant le premier message.';
        threadMessages.appendChild(empty);
    } else {
        messages.forEach((message) => {
            const row = document.createElement('div');
            row.className = 'message-row';

            const isOwn = String(message.from || '').trim().toLowerCase() === state.currentUserName.toLowerCase();
            row.classList.add(isOwn ? 'own' : 'other');

            const bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            bubble.textContent = String(message.text || '');

            const meta = document.createElement('span');
            meta.className = 'message-meta';
            meta.textContent = `${isOwn ? 'Vous' : message.from} • ${formatDate(message.createdAt)}`;

            row.appendChild(bubble);
            row.appendChild(meta);

            if (!isOwn && Number.isFinite(Number(message.id))) {
                const actions = document.createElement('div');
                actions.className = 'message-actions';

                const reportBtn = document.createElement('button');
                reportBtn.type = 'button';
                reportBtn.className = 'report-btn';
                reportBtn.textContent = 'Signaler';
                reportBtn.addEventListener('click', () => handleReportMessage(Number(message.id)));

                actions.appendChild(reportBtn);
                row.appendChild(actions);
            }

            threadMessages.appendChild(row);
        });

        threadMessages.scrollTop = threadMessages.scrollHeight;
    }

    const partnerBlocked = window.messagingCore.isUserBlocked(state.activePartnerName);
    messageInput.disabled = state.isCurrentUserBlocked || partnerBlocked;
    sendMessageBtn.disabled = state.isCurrentUserBlocked || partnerBlocked;
}

function renderAdminReports() {
    const { adminModerationPanel, reportsList, reportsEmpty } = getNodes();
    if (!adminModerationPanel || !reportsList || !reportsEmpty) return;

    if (!state.isAdmin) {
        adminModerationPanel.hidden = true;
        return;
    }

    adminModerationPanel.hidden = false;
    reportsList.innerHTML = '';

    const reports = window.messagingCore.listReports();

    if (!reports.length) {
        reportsEmpty.hidden = false;
        return;
    }

    reportsEmpty.hidden = true;

    reports.forEach((report) => {
        const card = document.createElement('article');
        card.className = 'report-card';

        const title = document.createElement('h3');
        title.textContent = `Signalement #${report.id}`;

        const status = document.createElement('p');
        status.textContent = `Statut: ${report.status === 'resolved' ? 'Traité' : 'Ouvert'}`;

        const meta = document.createElement('p');
        meta.textContent = `Par ${report.reporter} • ${formatDate(report.createdAt)}`;

        const target = document.createElement('p');
        target.textContent = `Message de: ${report.reportedUser || 'Inconnu'}`;

        const excerpt = document.createElement('p');
        excerpt.textContent = `Contenu: ${truncate(report.messageText || '', 90)}`;

        const reason = document.createElement('p');
        reason.textContent = `Raison: ${report.reason || 'Non précisée'}`;

        card.appendChild(title);
        card.appendChild(status);
        card.appendChild(meta);
        card.appendChild(target);
        card.appendChild(excerpt);
        card.appendChild(reason);

        if (report.status !== 'resolved') {
            const actions = document.createElement('div');
            actions.className = 'report-card-actions';

            const resolveBtn = document.createElement('button');
            resolveBtn.type = 'button';
            resolveBtn.textContent = 'Marquer traité';
            resolveBtn.addEventListener('click', () => {
                const result = window.messagingCore.resolveReport(report.id);
                if (!result.ok) {
                    alert('Impossible de traiter ce signalement.');
                    return;
                }
                renderAdminReports();
            });

            const blockBtn = document.createElement('button');
            blockBtn.type = 'button';
            blockBtn.textContent = 'Bloquer auteur';
            blockBtn.addEventListener('click', () => {
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
                        alert('Impossible: cet utilisateur est administrateur.');
                        return;
                    }
                    alert('Blocage impossible.');
                    return;
                }

                alert(`${report.reportedUser} est maintenant bloqué.`);
                syncConversations(state.activePartnerName);
            });

            actions.appendChild(resolveBtn);
            actions.appendChild(blockBtn);
            card.appendChild(actions);
        }

        reportsList.appendChild(card);
    });
}

function syncConversations(preferredPartner = '') {
    refreshCurrentUserBlockedStatus();
    state.conversations = window.messagingCore.listConversations(state.currentUserName);

    if (preferredPartner) {
        state.activePartnerName = preferredPartner;
    }

    const activeExists = state.conversations.some((item) => item.partnerName === state.activePartnerName);

    if (!activeExists) {
        if (window.messagingCore.findUserByName(state.activePartnerName)) {
            // L'utilisateur existe, on garde un fil vide actif.
        } else {
            state.activePartnerName = state.conversations.length ? state.conversations[0].partnerName : '';
        }
    }

    if (state.activePartnerName) {
        window.messagingCore.markThreadAsRead(state.currentUserName, state.activePartnerName);
        state.conversations = window.messagingCore.listConversations(state.currentUserName);
    }

    renderContactSelect();
    renderConversationsList();
    renderAdminBlockButton();
    renderThread();
    renderAdminReports();
    updateNotificationsBadges();
    if (state.notificationsOpen) {
        renderNotificationsPanel();
    }

    if (window.messagesWidget && typeof window.messagesWidget.updateUnreadBadges === 'function') {
        window.messagesWidget.updateUnreadBadges();
    }
}

function openConversation(partnerName) {
    const name = String(partnerName || '').trim();
    if (!name) return;
    syncConversations(name);
}

function handleStartConversation(event) {
    event.preventDefault();

    const { contactSelect } = getNodes();
    if (!contactSelect) return;

    const target = String(contactSelect.value || '').trim();
    if (!target) return;

    openConversation(target);
}

function updateMessageCount() {
    const { messageInput, messageCount } = getNodes();
    if (!messageInput || !messageCount) return;

    const length = messageInput.value.length;
    messageCount.textContent = `${length} / ${MAX_MESSAGE_LENGTH}`;
}

function handleSendMessage(event) {
    event.preventDefault();

    const { messageInput } = getNodes();
    if (!messageInput) return;

    if (!state.activePartnerName) {
        alert('Sélectionnez d\'abord un contact.');
        return;
    }

    const result = window.messagingCore.sendMessage({
        to: state.activePartnerName,
        text: messageInput.value
    });

    if (!result.ok) {
        if (result.reason === 'empty_message') {
            alert('Le message est vide.');
            return;
        }

        if (result.reason === 'target_not_found') {
            alert('Ce contact est introuvable.');
            return;
        }

        if (result.reason === 'invalid_target') {
            alert('Destinataire invalide.');
            return;
        }

        if (result.reason === 'sender_blocked') {
            alert('Votre compte est bloqué pour la messagerie.');
            syncConversations(state.activePartnerName);
            return;
        }

        if (result.reason === 'target_blocked') {
            alert('Ce membre est actuellement bloqué.');
            syncConversations(state.activePartnerName);
            return;
        }

        alert('Impossible d\'envoyer le message.');
        return;
    }

    messageInput.value = '';
    updateMessageCount();
    syncConversations(state.activePartnerName);
}

function handleAdminBlockToggle() {
    if (!state.isAdmin || !state.activePartnerName) return;

    const currentlyBlocked = window.messagingCore.isUserBlocked(state.activePartnerName);

    if (currentlyBlocked) {
        const result = window.messagingCore.setUserBlocked(state.activePartnerName, false, '');
        if (!result.ok) {
            alert('Déblocage impossible.');
            return;
        }

        alert(`${state.activePartnerName} a été débloqué.`);
        syncConversations(state.activePartnerName);
        return;
    }

    const reason = window.prompt('Raison du blocage (optionnel) :', '') || '';
    const result = window.messagingCore.setUserBlocked(state.activePartnerName, true, reason);

    if (!result.ok) {
        if (result.reason === 'forbidden_admin') {
            alert('Un administrateur ne peut pas bloquer un autre administrateur.');
            return;
        }

        if (result.reason === 'forbidden_self') {
            alert('Vous ne pouvez pas vous bloquer vous-même.');
            return;
        }

        alert('Blocage impossible.');
        return;
    }

    alert(`${state.activePartnerName} est maintenant bloqué.`);
    syncConversations(state.activePartnerName);
}

function getPreselectedTargetFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('to') || '').trim();
}

function initEvents() {
    const { messageForm, messageInput, startConversationForm, adminBlockBtn, notificationsToggleBtn } = getNodes();

    if (messageForm) {
        messageForm.addEventListener('submit', handleSendMessage);
    }

    if (startConversationForm) {
        startConversationForm.addEventListener('submit', handleStartConversation);
    }

    if (messageInput) {
        messageInput.addEventListener('input', updateMessageCount);
    }

    if (adminBlockBtn) {
        adminBlockBtn.addEventListener('click', handleAdminBlockToggle);
    }

    if (notificationsToggleBtn) {
        notificationsToggleBtn.addEventListener('click', toggleNotificationsPanel);
    }

    window.addEventListener('storage', (event) => {
        if (
            event.key === 'privateMessages' ||
            event.key === 'messageReports' ||
            event.key === 'messagingBlocks' ||
            event.key === 'activityNotifications'
        ) {
            syncConversations(state.activePartnerName);
        }
    });

    window.setInterval(() => {
        syncConversations(state.activePartnerName);
    }, 5000);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireConnectedUser()) return;

    if (window.messagingCore && typeof window.messagingCore.syncAllFromSupabase === 'function') {
        try {
            await Promise.race([
                window.messagingCore.syncAllFromSupabase({ force: true, maxAgeMs: 0 }),
                new Promise((resolve) => setTimeout(resolve, 1200))
            ]);
        } catch (error) {
            // Fallback local silencieux.
        }
    }

    initEvents();

    const preselected = getPreselectedTargetFromUrl();
    if (preselected && window.messagingCore.findUserByName(preselected)) {
        syncConversations(preselected);
    } else {
        syncConversations();
    }

    updateMessageCount();
    updateNotificationsBadges();
});
