(function () {
    const MESSAGES_KEY = 'privateMessages';
    const REPORTS_KEY = 'messageReports';
    const BLOCKS_KEY = 'messagingBlocks';
    const REPORTS_EMAIL_WEBHOOK_URL = 'https://formspree.io/f/xqadwrqd';

    const SYNC_STORAGE_KEY = 'messagingCoreLastSyncAt';
    const SYNC_MIN_DELAY_MS = 3000;
    const CROSS_PAGE_SYNC_MIN_DELAY_MS = 45000;

    let lastSyncRun = 0;
    let syncInFlight = null;

    function normalizeName(value) {
        return String(value || '').trim();
    }

    function normalizeKey(value) {
        return normalizeName(value).toLowerCase();
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

    function getOfflineQueue() {
        return window.offlineActionQueue || null;
    }

    function shouldQueueOfflineAction(error) {
        const queue = getOfflineQueue();
        if (navigator.onLine === false) return true;
        if (!queue || typeof queue.isLikelyNetworkError !== 'function') return false;
        return queue.isLikelyNetworkError(error);
    }

    function queueMessagingAction(type, payload) {
        const queue = getOfflineQueue();
        if (!queue || typeof queue.enqueue !== 'function') return false;
        const currentUser = getCurrentUser();
        queue.enqueue({
            type,
            payload,
            meta: {
                userEmail: String(currentUser?.email || '').trim().toLowerCase(),
                userName: String(currentUser?.name || '').trim()
            }
        });
        return true;
    }

    function isQueueActionForCurrentUser(item) {
        const itemEmail = String(item?.meta?.userEmail || '').trim().toLowerCase();
        if (!itemEmail) return true;
        const currentEmail = String(getCurrentUser()?.email || '').trim().toLowerCase();
        return !!currentEmail && currentEmail === itemEmail;
    }

    function readLastSyncTimestamp() {
        const rawValue = localStorage.getItem(SYNC_STORAGE_KEY) || '';
        const timestamp = Date.parse(rawValue);
        return Number.isFinite(timestamp) ? timestamp : 0;
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

    function writeArray(key, value) {
        if (!Array.isArray(value)) return;

        if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
            window.dataStore.writeArray(key, value);
            return;
        }

        localStorage.setItem(key, JSON.stringify(value));
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
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;

        if (window.dataStore && typeof window.dataStore.writeObject === 'function') {
            window.dataStore.writeObject(key, value);
            return;
        }

        localStorage.setItem(key, JSON.stringify(value));
    }

    function getCurrentUser() {
        if (window.auth && typeof window.auth.getCurrentUser === 'function') {
            return window.auth.getCurrentUser() || null;
        }
        return null;
    }

    function getCurrentUserName() {
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.name) {
            return normalizeName(currentUser.name);
        }

        const isConnected = localStorage.getItem('imeConnected') === 'true';
        if (!isConnected) return '';

        return normalizeName(localStorage.getItem('userName') || '');
    }

    function getCurrentUserId() {
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.supabaseId) {
            return String(currentUser.supabaseId);
        }

        const emailKey = normalizeKey(currentUser && currentUser.email);
        if (emailKey) {
            const userByEmail = readUsers().find((user) => normalizeKey(user && user.email) === emailKey);
            const id = String(userByEmail && userByEmail.supabaseId || '').trim();
            if (id) return id;
        }
        return '';
    }

    function getCurrentUserRole() {
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.role) {
            return normalizeKey(currentUser.role);
        }

        return normalizeKey(localStorage.getItem('userRole') || '');
    }

    function isAdminSession() {
        if (window.auth && typeof window.auth.isAdmin === 'function') {
            return window.auth.isAdmin();
        }

        return getCurrentUserRole() === 'admin';
    }

    function readUsers() {
        if (window.auth && typeof window.auth.readUsers === 'function') {
            return window.auth.readUsers();
        }

        return readArray('users');
    }

    function findUserByName(userName) {
        const targetKey = normalizeKey(userName);
        if (!targetKey) return null;

        const users = readUsers();
        return users.find((user) => normalizeKey(user && user.name) === targetKey) || null;
    }

    function getAdminUsers() {
        return readUsers().filter((user) => normalizeKey(user && user.role) === 'admin');
    }

    function notifyAdminsByEmail(report) {
        if (!report || typeof fetch !== 'function') return;

        const admins = getAdminUsers();
        const adminEmails = Array.from(new Set(
            admins
                .map((user) => String(user && user.email || '').trim().toLowerCase())
                .filter(Boolean)
        ));

        if (!adminEmails.length || !REPORTS_EMAIL_WEBHOOK_URL) return;

        const reporterUser = findUserByName(report.reporter);
        const reporterEmail = String(reporterUser && reporterUser.email || '').trim().toLowerCase();
        const shortMessage = String(report.messageText || '').trim().slice(0, 240);

        const payload = {
            _subject: `Nouveau signalement IME-Friendly #${report.id}`,
            _replyto: reporterEmail || undefined,
            admin_emails: adminEmails.join(', '),
            reporter: String(report.reporter || 'Inconnu'),
            reporter_email: reporterEmail || 'inconnu',
            reported_user: String(report.reportedUser || 'Inconnu'),
            reason: String(report.reason || 'Non précisée'),
            message_excerpt: shortMessage || '(vide)',
            signalement_id: String(report.id || ''),
            message_id: String(report.messageId || ''),
            message: `Un nouveau signalement a été créé.\n\nReporter: ${report.reporter || 'Inconnu'} (${reporterEmail || 'email inconnu'})\nUtilisateur signalé: ${report.reportedUser || 'Inconnu'}\nRaison: ${report.reason || 'Non précisée'}\nMessage: ${shortMessage || '(vide)'}\nID signalement: ${report.id || ''}\nID message: ${report.messageId || ''}\n\nConsultez la modération dans l'interface admin.`
        };

        fetch(REPORTS_EMAIL_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        }).catch(() => {});
    }

    function findUserBySupabaseId(userId) {
        const id = String(userId || '').trim();
        if (!id) return null;

        const users = readUsers();
        return users.find((user) => String(user && user.supabaseId || '').trim() === id) || null;
    }

    function getUserNameById(userId) {
        const id = String(userId || '').trim();
        if (!id) return '';

        const currentUser = getCurrentUser();
        if (currentUser && String(currentUser.supabaseId || '').trim() === id) {
            return normalizeName(currentUser.name || '');
        }

        const user = findUserBySupabaseId(id);
        return normalizeName(user && user.name || '');
    }

    function getUserIdByName(userName) {
        const targetName = normalizeName(userName);
        if (!targetName) return '';

        const currentUser = getCurrentUser();
        if (
            currentUser &&
            normalizeKey(currentUser.name) === normalizeKey(targetName) &&
            currentUser.supabaseId
        ) {
            return String(currentUser.supabaseId);
        }

        const user = findUserByName(targetName);
        return String(user && user.supabaseId || '').trim();
    }

    function buildThreadId(a, b) {
        const pair = [normalizeKey(a), normalizeKey(b)].sort();
        return `${pair[0]}::${pair[1]}`;
    }

    function readMessages() {
        const messages = readArray(MESSAGES_KEY);
        return messages.filter((message) => message && typeof message === 'object');
    }

    function writeMessages(messages) {
        writeArray(MESSAGES_KEY, messages);
    }

    function readReports() {
        const reports = readArray(REPORTS_KEY);
        return reports.filter((report) => report && typeof report === 'object');
    }

    function writeReports(reports) {
        writeArray(REPORTS_KEY, reports);
    }

    function readBlocks() {
        return readObject(BLOCKS_KEY);
    }

    function writeBlocks(blocks) {
        writeObject(BLOCKS_KEY, blocks);
    }

    function isUserBlocked(userName) {
        const key = normalizeKey(userName);
        if (!key) return false;

        const blocks = readBlocks();
        return !!(blocks[key] && blocks[key].blocked);
    }

    function getBlockedUsers() {
        const blocks = readBlocks();

        return Object.keys(blocks)
            .map((key) => blocks[key])
            .filter((entry) => entry && entry.blocked)
            .sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name), 'fr', { sensitivity: 'base' }));
    }

    function getContactCandidates(currentUserName) {
        const selfKey = normalizeKey(currentUserName);
        if (!selfKey) return [];

        queueBackgroundSync();

        if (isUserBlocked(currentUserName)) {
            return [];
        }

        return readUsers()
            .filter((user) => normalizeKey(user && user.name) !== selfKey)
            .filter((user) => normalizeName(user && user.name))
            .filter((user) => !isUserBlocked(user && user.name))
            .sort((a, b) => normalizeName(a && a.name).localeCompare(normalizeName(b && b.name), 'fr', { sensitivity: 'base' }));
    }

    function listConversations(currentUserName) {
        const self = normalizeName(currentUserName);
        if (!self) return [];

        queueBackgroundSync();

        const selfKey = normalizeKey(self);
        const grouped = new Map();

        readMessages().forEach((message) => {
            const from = normalizeName(message.from);
            const to = normalizeName(message.to);
            const fromKey = normalizeKey(from);
            const toKey = normalizeKey(to);
            const touchesUser = fromKey === selfKey || toKey === selfKey;

            if (!touchesUser) return;

            const partnerName = fromKey === selfKey ? to : from;
            if (!partnerName) return;

            const threadId = buildThreadId(self, partnerName);
            const existing = grouped.get(threadId);
            const messageDate = new Date(message.createdAt || 0).getTime() || 0;
            const isUnread = toKey === selfKey && !message.read;

            if (!existing) {
                grouped.set(threadId, {
                    threadId,
                    partnerName,
                    lastMessage: String(message.text || '').trim(),
                    lastMessageDate: message.createdAt || '',
                    lastMessageTs: messageDate,
                    unreadCount: isUnread ? 1 : 0
                });
                return;
            }

            if (messageDate >= existing.lastMessageTs) {
                existing.lastMessage = String(message.text || '').trim();
                existing.lastMessageDate = message.createdAt || '';
                existing.lastMessageTs = messageDate;
            }

            if (isUnread) {
                existing.unreadCount += 1;
            }
        });

        return Array.from(grouped.values()).sort((a, b) => b.lastMessageTs - a.lastMessageTs);
    }

    function getThreadMessages(currentUserName, partnerName) {
        const self = normalizeName(currentUserName);
        const partner = normalizeName(partnerName);
        if (!self || !partner) return [];

        queueBackgroundSync();

        const threadId = buildThreadId(self, partner);

        return readMessages()
            .filter((message) => buildThreadId(message.from, message.to) === threadId)
            .sort((a, b) => {
                const tsA = new Date(a.createdAt || 0).getTime() || 0;
                const tsB = new Date(b.createdAt || 0).getTime() || 0;
                return tsA - tsB;
            });
    }

    function markThreadAsRead(currentUserName, partnerName) {
        const self = normalizeName(currentUserName);
        const partner = normalizeName(partnerName);
        if (!self || !partner) return;

        const selfKey = normalizeKey(self);
        const threadId = buildThreadId(self, partner);
        const messages = readMessages();
        const readIds = [];
        let changed = false;

        messages.forEach((message) => {
            const sameThread = buildThreadId(message.from, message.to) === threadId;
            const isRecipient = normalizeKey(message.to) === selfKey;
            if (sameThread && isRecipient && !message.read) {
                message.read = true;
                const id = Number(message.id);
                if (Number.isFinite(id) && id > 0) {
                    readIds.push(id);
                }
                changed = true;
            }
        });

        if (changed) {
            writeMessages(messages);
        }

        if (readIds.length > 0 && isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const currentUserId = getCurrentUserId();
            if (supabase && currentUserId) {
                const nowIso = new Date().toISOString();
                supabase
                    .from('private_messages')
                    .update({ read_at: nowIso })
                    .in('id', readIds)
                    .eq('to_user_id', currentUserId)
                    .then(() => {
                        queueBackgroundSync(true);
                    })
                    .catch(() => {});
            }
        }
    }

    async function insertPrivateMessageToSupabase(payload) {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('supabase_unavailable');

        const fromUserId = getUserIdByName(payload?.from);
        const toUserId = getUserIdByName(payload?.to);
        const content = String(payload?.text || '').trim();
        if (!fromUserId || !toUserId || !content) {
            throw new Error('invalid_payload');
        }

        const { data, error } = await supabase
            .from('private_messages')
            .insert({
                from_user_id: fromUserId,
                to_user_id: toUserId,
                content
            })
            .select('id, created_at')
            .single();

        if (error || !data) {
            throw new Error(error?.message || 'message_insert_failed');
        }

        return {
            id: Number(data.id),
            createdAt: data.created_at || new Date().toISOString()
        };
    }

    function registerMessagingOfflineProcessors() {
        const queue = getOfflineQueue();
        if (!queue || typeof queue.registerProcessor !== 'function') return;

        queue.registerProcessor('messaging.sendMessage', async (item) => {
            if (!isQueueActionForCurrentUser(item)) return { retry: true };
            const payload = item?.payload || {};
            const save = await insertPrivateMessageToSupabase(payload);

            const localId = Number(payload.localId);
            if (Number.isFinite(localId)) {
                const nextMessages = readMessages();
                const target = nextMessages.find((message) => Number(message.id) === localId);
                if (target) {
                    target.id = Number.isFinite(save.id) ? save.id : target.id;
                    target.createdAt = save.createdAt || target.createdAt;
                    writeMessages(nextMessages);
                }
            }

            return { ok: true };
        });
    }

    function sendMessage(payload) {
        const from = normalizeName(getCurrentUserName());
        const to = normalizeName(payload && payload.to);
        const text = String((payload && payload.text) || '').trim();

        if (!from) {
            return { ok: false, reason: 'not_logged_in' };
        }

        if (isUserBlocked(from)) {
            return { ok: false, reason: 'sender_blocked' };
        }

        if (!to || normalizeKey(from) === normalizeKey(to)) {
            return { ok: false, reason: 'invalid_target' };
        }

        if (!text) {
            return { ok: false, reason: 'empty_message' };
        }

        const targetUser = findUserByName(to);
        if (!targetUser) {
            return { ok: false, reason: 'target_not_found' };
        }

        if (isUserBlocked(targetUser.name)) {
            return { ok: false, reason: 'target_blocked' };
        }

        const finalTo = normalizeName(targetUser.name);
        const messages = readMessages();
        const now = new Date().toISOString();
        const tempId = Date.now() + Math.floor(Math.random() * 1000);

        messages.push({
            id: tempId,
            from,
            to: finalTo,
            text,
            createdAt: now,
            read: false
        });

        writeMessages(messages);

        if (isSupabaseReady()) {
            insertPrivateMessageToSupabase({
                from,
                to: finalTo,
                text
            })
                .then((save) => {
                    const nextMessages = readMessages();
                    const localMessage = nextMessages.find((item) => Number(item.id) === tempId);
                    if (!localMessage) return;

                    if (Number.isFinite(save.id)) {
                        localMessage.id = save.id;
                    }
                    if (save.createdAt) {
                        localMessage.createdAt = save.createdAt;
                    }
                    writeMessages(nextMessages);
                })
                .catch((error) => {
                    if (shouldQueueOfflineAction(error)) {
                        queueMessagingAction('messaging.sendMessage', {
                            localId: tempId,
                            from,
                            to: finalTo,
                            text
                        });
                    }
                });
        }

        return {
            ok: true,
            message: {
                from,
                to: finalTo,
                text,
                createdAt: now
            }
        };
    }

    function reportMessage(payload) {
        const reporter = normalizeName(getCurrentUserName());
        const messageId = Number(payload && payload.messageId);
        const reason = String((payload && payload.reason) || '').trim();

        if (!reporter) {
            return { ok: false, reason: 'not_logged_in' };
        }

        if (!Number.isFinite(messageId)) {
            return { ok: false, reason: 'invalid_message' };
        }

        const messages = readMessages();
        const message = messages.find((item) => Number(item.id) === messageId);

        if (!message) {
            return { ok: false, reason: 'message_not_found' };
        }

        const reports = readReports();
        const duplicateOpenReport = reports.find((report) => (
            Number(report.messageId) === messageId &&
            normalizeKey(report.reporter) === normalizeKey(reporter) &&
            report.status === 'open'
        ));

        if (duplicateOpenReport) {
            return { ok: false, reason: 'already_reported' };
        }

        const tempId = Date.now() + Math.floor(Math.random() * 1000);
        const newReport = {
            id: tempId,
            messageId,
            reporter,
            reportedUser: normalizeName(message.from),
            messageText: String(message.text || ''),
            reason: reason || 'Signalement sans detail',
            status: 'open',
            createdAt: new Date().toISOString()
        };

        reports.push(newReport);
        writeReports(reports);
        notifyAdminsByEmail(newReport);

        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const reporterId = getUserIdByName(reporter);
            const reportedUserId = getUserIdByName(newReport.reportedUser);
            if (supabase && reporterId) {
                supabase
                    .from('message_reports')
                    .insert({
                        message_id: Number.isFinite(messageId) ? messageId : null,
                        reporter_id: reporterId,
                        reported_user_id: reportedUserId || null,
                        reason: newReport.reason
                    })
                    .select('id, created_at')
                    .single()
                    .then(({ data, error }) => {
                        if (error || !data) return;

                        const savedId = Number(data.id);
                        const nextReports = readReports();
                        const target = nextReports.find((item) => Number(item.id) === tempId);
                        if (!target) return;

                        if (Number.isFinite(savedId)) {
                            target.id = savedId;
                        }
                        if (data.created_at) {
                            target.createdAt = data.created_at;
                        }
                        writeReports(nextReports);
                    })
                    .catch(() => {});
            }
        }

        return { ok: true };
    }

    function listReports() {
        if (!isAdminSession()) {
            return [];
        }

        queueBackgroundSync();

        return readReports()
            .sort((a, b) => (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0));
    }

    function resolveReport(reportId) {
        if (!isAdminSession()) {
            return { ok: false, reason: 'forbidden' };
        }

        const numericId = Number(reportId);
        if (!Number.isFinite(numericId)) {
            return { ok: false, reason: 'invalid_report' };
        }

        const reports = readReports();
        const report = reports.find((item) => Number(item.id) === numericId);

        if (!report) {
            return { ok: false, reason: 'not_found' };
        }

        report.status = 'resolved';
        report.resolvedAt = new Date().toISOString();
        report.resolvedBy = getCurrentUserName() || 'admin';
        writeReports(reports);

        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            if (supabase) {
                supabase
                    .from('message_reports')
                    .update({ resolved_at: report.resolvedAt })
                    .eq('id', numericId)
                    .then(() => {
                        queueBackgroundSync(true);
                    })
                    .catch(() => {});
            }
        }

        return { ok: true };
    }

    function setUserBlocked(targetName, blocked, reason = '') {
        if (!isAdminSession()) {
            return { ok: false, reason: 'forbidden' };
        }

        const targetUser = findUserByName(targetName);
        if (!targetUser) {
            return { ok: false, reason: 'target_not_found' };
        }

        const targetRole = normalizeKey(targetUser.role);
        const targetUserName = normalizeName(targetUser.name);
        const adminName = getCurrentUserName() || 'admin';
        const isBlocking = !!blocked;

        if (normalizeKey(targetUserName) === normalizeKey(adminName) && isBlocking) {
            return { ok: false, reason: 'forbidden_self' };
        }

        if (targetRole === 'admin' && isBlocking) {
            return { ok: false, reason: 'forbidden_admin' };
        }

        const blocks = readBlocks();
        const targetKey = normalizeKey(targetUserName);

        if (isBlocking) {
            blocks[targetKey] = {
                name: targetUserName,
                blocked: true,
                blockedAt: new Date().toISOString(),
                blockedBy: adminName,
                reason: String(reason || '').trim()
            };
        } else {
            delete blocks[targetKey];
        }

        writeBlocks(blocks);

        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const targetUserId = getUserIdByName(targetUserName);
            const adminUserId = getCurrentUserId();

            if (supabase && targetUserId && adminUserId) {
                if (isBlocking) {
                    supabase
                        .from('messaging_blocks')
                        .select('id')
                        .eq('blocked_user_id', targetUserId)
                        .is('lifted_at', null)
                        .limit(1)
                        .then(async ({ data, error }) => {
                            if (error) return;

                            const active = Array.isArray(data) ? data[0] : null;
                            if (active && Number.isFinite(Number(active.id))) {
                                await supabase
                                    .from('messaging_blocks')
                                    .update({
                                        blocked_by_admin_id: adminUserId,
                                        reason: String(reason || '').trim(),
                                        lifted_at: null
                                    })
                                    .eq('id', Number(active.id));
                            } else {
                                await supabase
                                    .from('messaging_blocks')
                                    .insert({
                                        blocked_user_id: targetUserId,
                                        blocked_by_admin_id: adminUserId,
                                        reason: String(reason || '').trim()
                                    });
                            }
                            queueBackgroundSync(true);
                        })
                        .catch(() => {});
                } else {
                    supabase
                        .from('messaging_blocks')
                        .update({ lifted_at: new Date().toISOString() })
                        .eq('blocked_user_id', targetUserId)
                        .is('lifted_at', null)
                        .then(() => {
                            queueBackgroundSync(true);
                        })
                        .catch(() => {});
                }
            }
        }

        return {
            ok: true,
            blocked: isBlocking,
            user: targetUserName
        };
    }

    function getUnreadCount(currentUserName) {
        const self = normalizeName(currentUserName);
        if (!self) return 0;

        const selfKey = normalizeKey(self);

        return readMessages().reduce((count, message) => {
            const isRecipient = normalizeKey(message.to) === selfKey;
            return count + (isRecipient && !message.read ? 1 : 0);
        }, 0);
    }

    function ensureDataShape() {
        const messages = readMessages();
        let messagesChanged = false;

        messages.forEach((message) => {
            if (!Number.isFinite(Number(message.id))) {
                message.id = Date.now() + Math.floor(Math.random() * 1000);
                messagesChanged = true;
            }

            if (typeof message.read !== 'boolean') {
                message.read = !!message.read;
                messagesChanged = true;
            }

            if (!message.createdAt) {
                message.createdAt = new Date().toISOString();
                messagesChanged = true;
            }
        });

        if (messagesChanged) {
            writeMessages(messages);
        }

        const reports = readReports();
        let reportsChanged = false;

        reports.forEach((report) => {
            if (!Number.isFinite(Number(report.id))) {
                report.id = Date.now() + Math.floor(Math.random() * 1000);
                reportsChanged = true;
            }

            if (!report.status) {
                report.status = 'open';
                reportsChanged = true;
            }

            if (!report.createdAt) {
                report.createdAt = new Date().toISOString();
                reportsChanged = true;
            }
        });

        if (reportsChanged) {
            writeReports(reports);
        }
    }

    async function syncMessagesFromSupabase() {
        const supabase = getSupabaseClient();
        const currentUserId = getCurrentUserId();
        if (!supabase || !currentUserId) return false;

        const [sentResult, receivedResult] = await Promise.all([
            supabase
                .from('private_messages')
                .select('id, from_user_id, to_user_id, content, created_at, read_at')
                .eq('from_user_id', currentUserId)
                .order('created_at', { ascending: true })
                .limit(1000),
            supabase
                .from('private_messages')
                .select('id, from_user_id, to_user_id, content, created_at, read_at')
                .eq('to_user_id', currentUserId)
                .order('created_at', { ascending: true })
                .limit(1000)
        ]);

        if (sentResult.error && receivedResult.error) {
            return false;
        }

        const byId = new Map();
        const allRows = [];
        if (Array.isArray(sentResult.data)) allRows.push(...sentResult.data);
        if (Array.isArray(receivedResult.data)) allRows.push(...receivedResult.data);

        allRows.forEach((row) => {
            const id = Number(row && row.id);
            if (!Number.isFinite(id)) return;
            byId.set(id, row);
        });

        const nextMessages = Array.from(byId.values())
            .map((row) => {
                const fromId = String(row.from_user_id || '');
                const toId = String(row.to_user_id || '');
                const fromName = getUserNameById(fromId) || fromId;
                const toName = getUserNameById(toId) || toId;
                return {
                    id: Number(row.id),
                    from: fromName,
                    to: toName,
                    text: String(row.content || ''),
                    createdAt: row.created_at || new Date().toISOString(),
                    read: !!row.read_at
                };
            })
            .sort((a, b) => (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0));

        writeMessages(nextMessages);
        return true;
    }

    async function syncReportsFromSupabase() {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const { data, error } = await supabase
            .from('message_reports')
            .select('id, message_id, reporter_id, reported_user_id, reason, created_at, resolved_at')
            .order('created_at', { ascending: false })
            .limit(500);

        if (error || !Array.isArray(data)) return false;

        const messageIds = Array.from(new Set(
            data
                .map((row) => Number(row && row.message_id))
                .filter((id) => Number.isFinite(id) && id > 0)
        ));

        const messageTextById = new Map();
        if (messageIds.length > 0) {
            const { data: messageRows } = await supabase
                .from('private_messages')
                .select('id, content')
                .in('id', messageIds);

            if (Array.isArray(messageRows)) {
                messageRows.forEach((row) => {
                    const id = Number(row && row.id);
                    if (!Number.isFinite(id)) return;
                    messageTextById.set(id, String(row && row.content || ''));
                });
            }
        }

        const nextReports = data.map((row) => {
            const id = Number(row && row.id);
            const messageId = Number(row && row.message_id);
            const reporterName = getUserNameById(row && row.reporter_id) || String(row && row.reporter_id || '');
            const reportedName = getUserNameById(row && row.reported_user_id) || String(row && row.reported_user_id || '');
            const createdAt = row && row.created_at ? row.created_at : new Date().toISOString();
            const resolvedAt = row && row.resolved_at ? row.resolved_at : '';

            return {
                id: Number.isFinite(id) ? id : Date.now() + Math.floor(Math.random() * 1000),
                messageId: Number.isFinite(messageId) ? messageId : 0,
                reporter: reporterName,
                reportedUser: reportedName,
                messageText: Number.isFinite(messageId) ? String(messageTextById.get(messageId) || '') : '',
                reason: String(row && row.reason || ''),
                status: resolvedAt ? 'resolved' : 'open',
                createdAt,
                resolvedAt
            };
        });

        writeReports(nextReports);
        return true;
    }

    async function syncBlocksFromSupabase() {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const { data, error } = await supabase
            .from('messaging_blocks')
            .select('id, blocked_user_id, blocked_by_admin_id, reason, created_at, lifted_at')
            .is('lifted_at', null);

        if (error || !Array.isArray(data)) return false;

        const nextBlocks = {};
        data.forEach((row) => {
            const blockedName = getUserNameById(row && row.blocked_user_id) || String(row && row.blocked_user_id || '');
            if (!blockedName) return;

            const blockedByName = getUserNameById(row && row.blocked_by_admin_id) || String(row && row.blocked_by_admin_id || 'admin');
            const key = normalizeKey(blockedName);
            nextBlocks[key] = {
                id: Number(row && row.id) || null,
                name: blockedName,
                blocked: true,
                blockedAt: row && row.created_at ? row.created_at : new Date().toISOString(),
                blockedBy: blockedByName,
                reason: String(row && row.reason || '')
            };
        });

        writeBlocks(nextBlocks);
        return true;
    }

    async function syncAllFromSupabase(options = {}) {
        const force = !!options.force;
        const maxAgeMs = Number(options.maxAgeMs);
        const effectiveMaxAgeMs = Number.isFinite(maxAgeMs) && maxAgeMs >= 0
            ? maxAgeMs
            : CROSS_PAGE_SYNC_MIN_DELAY_MS;

        if (!isSupabaseReady()) return false;

        const now = Date.now();
        if (!force && now - lastSyncRun < SYNC_MIN_DELAY_MS) {
            return false;
        }

        if (!force) {
            const lastGlobalSync = readLastSyncTimestamp();
            if (lastGlobalSync > 0 && (now - lastGlobalSync) < effectiveMaxAgeMs) {
                return false;
            }
        }

        if (syncInFlight) return syncInFlight;

        syncInFlight = (async () => {
            if (window.supabaseSync && typeof window.supabaseSync.syncUsers === 'function') {
                await Promise.race([
                    window.supabaseSync.syncUsers(),
                    new Promise((resolve) => setTimeout(resolve, 2000))
                ]);
            }

            await Promise.allSettled([
                syncMessagesFromSupabase(),
                syncReportsFromSupabase(),
                syncBlocksFromSupabase()
            ]);
            lastSyncRun = Date.now();
            localStorage.setItem(SYNC_STORAGE_KEY, new Date().toISOString());
            syncInFlight = null;
            return true;
        })();

        return syncInFlight;
    }

    function queueBackgroundSync(force = false) {
        syncAllFromSupabase({ force }).catch(() => {});
    }

    window.messagingCore = {
        MESSAGES_KEY,
        REPORTS_KEY,
        BLOCKS_KEY,
        getCurrentUserName,
        getCurrentUserRole,
        isAdminSession,
        findUserByName,
        getContactCandidates,
        readMessages,
        writeMessages,
        readReports,
        writeReports,
        isUserBlocked,
        getBlockedUsers,
        listConversations,
        getThreadMessages,
        markThreadAsRead,
        sendMessage,
        reportMessage,
        listReports,
        resolveReport,
        setUserBlocked,
        getUnreadCount,
        ensureDataShape,
        syncAllFromSupabase
    };

    registerMessagingOfflineProcessors();
    ensureDataShape();
    queueBackgroundSync();
    const queue = getOfflineQueue();
    if (queue && typeof queue.flush === 'function') {
        queue.flush().catch(() => {});
    }

    window.addEventListener('focus', () => {
        queueBackgroundSync();
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            queueBackgroundSync();
        }
    });
})();
