(function () {
    const SESSION_KEYS = Object.freeze({
        connected: 'imeConnected',
        email: 'userEmail',
        name: 'userName',
        role: 'userRole',
        lastLogin: 'userLastLogin'
    });

    const PASSWORD_CONFIG = Object.freeze({
        version: 'sha256',
        minLength: 8
    });

    // Mode production: fallback local désactivé pour éviter une auth hors Supabase.
    const DEV_AUTH_CONFIG = Object.freeze({
        allowInsecureFallback: false,
        fallbackVersion: 'dev'
    });

    const USER_ROLES = Object.freeze({
        parent: 'parent',
        professionnel: 'professionnel',
        admin: 'admin'
    });

    let lastSupabaseError = null;

    function readUsers() {
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

    function writeUsers(users) {
        if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
            window.dataStore.writeArray('users', users);
            return;
        }

        localStorage.setItem('users', JSON.stringify(users));
    }

    function readSessionValue(key, fallbackValue = null) {
        if (window.dataStore && typeof window.dataStore.readValue === 'function') {
            return window.dataStore.readValue(key, fallbackValue);
        }

        const value = localStorage.getItem(key);
        return value === null ? fallbackValue : value;
    }

    function writeSessionValue(key, value) {
        if (window.dataStore && typeof window.dataStore.writeValue === 'function') {
            window.dataStore.writeValue(key, value);
            return;
        }

        localStorage.setItem(key, String(value));
    }

    function removeSessionValue(key) {
        localStorage.removeItem(key);
    }

    function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function normalizeName(value) {
        return String(value || '').trim();
    }

    function normalizeRole(value) {
        const role = String(value || '').trim().toLowerCase();
        if (role === USER_ROLES.professionnel) return USER_ROLES.professionnel;
        if (role === USER_ROLES.admin) return USER_ROLES.admin;
        return USER_ROLES.parent;
    }

    function hasAnyAdmin(users) {
        return users.some((user) => normalizeRole(user.role) === USER_ROLES.admin);
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

    function clearSession() {
        removeSessionValue(SESSION_KEYS.connected);
        removeSessionValue(SESSION_KEYS.email);
        removeSessionValue(SESSION_KEYS.name);
        removeSessionValue(SESSION_KEYS.role);
        removeSessionValue(SESSION_KEYS.lastLogin);
    }

    function writeSessionFromUser(user) {
        const safeUser = user || {};
        writeSessionValue(SESSION_KEYS.connected, 'true');
        writeSessionValue(SESSION_KEYS.email, normalizeEmail(safeUser.email || ''));
        writeSessionValue(SESSION_KEYS.name, normalizeName(safeUser.name || ''));
        writeSessionValue(SESSION_KEYS.role, normalizeRole(safeUser.role || USER_ROLES.parent));
        writeSessionValue(SESSION_KEYS.lastLogin, safeUser.lastLogin || new Date().toISOString());
    }

    function toSupabaseRole(localRole) {
        const normalized = normalizeRole(localRole);
        if (normalized === USER_ROLES.admin) return 'admin';
        if (normalized === USER_ROLES.professionnel) return 'pro';
        return 'parent';
    }

    function fromSupabaseRole(dbRole) {
        const normalized = String(dbRole || '').trim().toLowerCase();
        if (normalized === 'admin') return USER_ROLES.admin;
        if (normalized === 'pro') return USER_ROLES.professionnel;
        if (normalized === 'professionnel') return USER_ROLES.professionnel;
        return USER_ROLES.parent;
    }

    function upsertLocalShadowUser(userData) {
        const users = readUsers();
        const email = normalizeEmail(userData && userData.email);
        if (!email) return;

        const existing = users.find((item) => normalizeEmail(item.email) === email);
        const now = new Date().toISOString();
        const safeRole = normalizeRole(userData && userData.role);
        const hasIsValidated = !!(userData && Object.prototype.hasOwnProperty.call(userData, 'isValidated'));
        const hasImeStatus = !!(userData && Object.prototype.hasOwnProperty.call(userData, 'imeStatus'));
        const hasProfessionalTitle = !!(userData && Object.prototype.hasOwnProperty.call(userData, 'professionalTitle'));
        const hasProfilePhoto = !!(userData && Object.prototype.hasOwnProperty.call(userData, 'profilePhoto'));
        const providedImeStatus = hasImeStatus ? String(userData.imeStatus || '').trim() : '';
        const providedProfessionalTitle = hasProfessionalTitle ? String(userData.professionalTitle || '').trim() : '';
        const providedProfilePhoto = hasProfilePhoto ? String(userData.profilePhoto || '').trim() : '';

        const payload = {
            name: normalizeName(userData && userData.name),
            email,
            role: safeRole,
            isValidated: hasIsValidated ? !!userData.isValidated : undefined,
            imeStatus: hasImeStatus ? providedImeStatus : undefined,
            professionalTitle: hasProfessionalTitle ? providedProfessionalTitle : undefined,
            profilePhoto: hasProfilePhoto ? providedProfilePhoto : undefined,
            updatedAt: now
        };

        if (userData && userData.supabaseId) {
            payload.supabaseId = String(userData.supabaseId);
        }

        if (existing) {
            existing.name = payload.name || existing.name;
            existing.role = payload.role;
            if (hasIsValidated) {
                existing.isValidated = payload.isValidated;
            }
            if (hasImeStatus) {
                existing.imeStatus = payload.imeStatus;
            } else if (typeof existing.imeStatus !== 'string') {
                existing.imeStatus = safeRole === USER_ROLES.professionnel ? 'non_renseigne' : '';
            }
            if (hasProfessionalTitle) {
                existing.professionalTitle = payload.professionalTitle;
            } else if (typeof existing.professionalTitle !== 'string') {
                existing.professionalTitle = '';
            }
            if (hasProfilePhoto) {
                existing.profilePhoto = payload.profilePhoto;
            } else if (typeof existing.profilePhoto !== 'string') {
                existing.profilePhoto = '';
            }
            existing.updatedAt = payload.updatedAt;
            if (payload.supabaseId) {
                existing.supabaseId = payload.supabaseId;
            }
            // Sécurité: jamais de secret mot de passe dans l'ombre locale.
            delete existing.password;
            delete existing.passwordHash;
            delete existing.passwordHashDev;
        } else {
            users.push({
                ...payload,
                isValidated: hasIsValidated ? payload.isValidated : false,
                imeStatus: hasImeStatus ? payload.imeStatus : (safeRole === USER_ROLES.professionnel ? 'non_renseigne' : ''),
                professionalTitle: hasProfessionalTitle ? payload.professionalTitle : '',
                profilePhoto: hasProfilePhoto ? payload.profilePhoto : '',
                createdAt: now
            });
        }

        writeUsers(users);
    }

    function sanitizeLocalShadowUsers() {
        const users = readUsers();
        let hasChanges = false;

        users.forEach((user) => {
            if (!user || typeof user !== 'object') return;

            const normalizedEmail = normalizeEmail(user.email);
            if (user.email !== normalizedEmail) {
                user.email = normalizedEmail;
                hasChanges = true;
            }

            const normalizedRole = normalizeRole(user.role);
            if (user.role !== normalizedRole) {
                user.role = normalizedRole;
                hasChanges = true;
            }

            if (Object.prototype.hasOwnProperty.call(user, 'password')) {
                delete user.password;
                hasChanges = true;
            }
            if (Object.prototype.hasOwnProperty.call(user, 'passwordHash')) {
                delete user.passwordHash;
                hasChanges = true;
            }
            if (Object.prototype.hasOwnProperty.call(user, 'passwordHashDev')) {
                delete user.passwordHashDev;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            writeUsers(users);
        }
    }

    function mapSupabaseErrorToReason(error, fallbackReason = 'auth_unavailable') {
        const message = String(error && error.message ? error.message : '').toLowerCase();
        const code = String(error && (error.code || error.error_code) ? (error.code || error.error_code) : '').toLowerCase();

        lastSupabaseError = {
            code,
            message: String(error && error.message ? error.message : ''),
            at: new Date().toISOString()
        };

        if (message.includes('invalid login credentials')) return 'invalid_credentials';
        if (message.includes('email not confirmed')) return 'not_validated';
        if (message.includes('already registered')) return 'email_taken';
        if (message.includes('password should be at least')) return 'weak_password';
        if (message.includes('unable to validate email address')) return 'invalid_email';
        if (message.includes('signups not allowed')) return 'signup_disabled';
        if (message.includes('captcha')) return 'captcha_required';
        if (message.includes('rate limit') || message.includes('too many requests')) return 'rate_limited';
        if (message.includes('database error saving new user') || code === 'unexpected_failure') return 'signup_db_error';
        if (message.includes('network')) return 'auth_unavailable';

        return fallbackReason;
    }

    function getLastSupabaseError() {
        return lastSupabaseError;
    }

    async function readSupabaseProfile(supabase, userId) {
        if (!supabase || !userId) return null;
        const queryVariants = [
            'id, display_name, role, is_validated, ime_status, professional_title, job_title, profile_photo',
            'id, display_name, role, is_validated, ime_status, professional_title, job_title, avatar_url',
            'id, display_name, role, is_validated, ime_status, professional_title, job_title',
            'id, display_name, role, is_validated, ime_status, professional_title',
            'id, display_name, role, is_validated, ime_status, job_title',
            'id, display_name, role, is_validated, ime_status'
        ];

        for (const select of queryVariants) {
            const { data, error } = await supabase
                .from('profiles')
                .select(select)
                .eq('id', userId)
                .maybeSingle();

            if (!error) return data || null;
        }

        return null;
    }

    async function resolveSupabaseProfileIdByEmail(supabase, user, email) {
        if (!supabase) return '';

        const directId = String((user && user.supabaseId) || '').trim();
        if (directId) return directId;

        const targetEmail = normalizeEmail(email || (user && user.email) || '');
        if (!targetEmail) return '';

        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', targetEmail)
            .maybeSingle();

        if (!error && data && data.id) {
            return String(data.id);
        }

        const targetName = normalizeName(user && user.name);
        if (!targetName) return '';

        const { data: byName, error: byNameError } = await supabase
            .from('profiles')
            .select('id')
            .eq('display_name', targetName)
            .limit(1);

        if (byNameError || !Array.isArray(byName) || !byName[0] || !byName[0].id) return '';
        return String(byName[0].id);
    }

    async function loginWithSupabase(email, password) {
        const supabase = getSupabaseClient();
        if (!supabase) return { ok: false, reason: 'supabase_unavailable' };

        const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizeEmail(email),
            password: String(password || '')
        });

        if (error) {
            return { ok: false, reason: mapSupabaseErrorToReason(error, 'auth_unavailable') };
        }

        const authUser = data && data.user;
        if (!authUser) {
            return { ok: false, reason: 'auth_unavailable' };
        }

        const profile = await readSupabaseProfile(supabase, authUser.id);
        const profileName = normalizeName(
            (profile && profile.display_name)
            || (authUser.user_metadata && authUser.user_metadata.display_name)
            || (authUser.email ? authUser.email.split('@')[0] : '')
        );
        const localRole = fromSupabaseRole(profile && profile.role);
        const isValidated = !!(profile && profile.is_validated);

        if (!isValidated) {
            await supabase.auth.signOut();
            clearSession();
            return { ok: false, reason: 'not_validated' };
        }

        const user = {
            email: normalizeEmail(authUser.email || ''),
            name: profileName,
            role: localRole,
            lastLogin: new Date().toISOString()
        };

        writeSessionFromUser(user);
        upsertLocalShadowUser({
            ...user,
            isValidated: true,
            supabaseId: authUser.id,
            imeStatus: String((profile && profile.ime_status) || '').trim(),
            professionalTitle: String((profile && (profile.professional_title || profile.job_title)) || '').trim(),
            profilePhoto: String((profile && (profile.profile_photo || profile.avatar_url)) || '').trim()
        });

        return { ok: true, user };
    }

    async function signupWithSupabase(userData) {
        const supabase = getSupabaseClient();
        if (!supabase) return { ok: false, reason: 'supabase_unavailable' };

        const name = normalizeName(userData && userData.name);
        const email = normalizeEmail(userData && userData.email);
        const password = String((userData && userData.password) || '');
        const requestedRoleRaw = normalizeRole(userData && userData.role);
        const requestedRole = requestedRoleRaw === USER_ROLES.professionnel
            ? USER_ROLES.professionnel
            : USER_ROLES.parent;

        if (!name) return { ok: false, reason: 'invalid_name' };
        if (!email || !email.includes('@')) return { ok: false, reason: 'invalid_email' };
        if (password.length < PASSWORD_CONFIG.minLength) return { ok: false, reason: 'weak_password' };

        let hasAdminAlready = true;
        try {
            const { count, error: countError } = await supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('role', 'admin');
            if (!countError) {
                hasAdminAlready = Number(count || 0) > 0;
            }
        } catch (error) {
            hasAdminAlready = true;
        }

        let signupResponse = null;
        try {
            signupResponse = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: name,
                        requested_role: toSupabaseRole(requestedRole)
                    }
                }
            });
        } catch (error) {
            return { ok: false, reason: mapSupabaseErrorToReason(error, 'auth_unavailable') };
        }

        const { data, error } = signupResponse || {};

        if (error) {
            console.error('[auth.signupWithSupabase] signUp error:', error);
            return { ok: false, reason: mapSupabaseErrorToReason(error, 'auth_unavailable') };
        }

        const authUser = data && data.user;
        if (!authUser) {
            lastSupabaseError = {
                code: 'signup_no_user',
                message: 'Supabase signUp returned no user object',
                at: new Date().toISOString()
            };
            return { ok: false, reason: 'signup_no_user' };
        }

        const firstAdminBootstrap = !hasAdminAlready;
        const targetRole = firstAdminBootstrap ? USER_ROLES.admin : requestedRole;
        const targetIsValidated = firstAdminBootstrap;
        const updatePayload = {
            display_name: name,
            ime_status: targetRole === USER_ROLES.admin
                ? 'direction'
                : (targetRole === USER_ROLES.professionnel ? 'non_renseigne' : 'parent')
        };

        // Cette mise a jour depend des policies RLS/grants configurees dans Supabase.
        if (firstAdminBootstrap) {
            updatePayload.role = 'admin';
            updatePayload.is_validated = true;
        }

        try {
            await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', authUser.id);
        } catch (error) {
            // Non bloquant: on garde le compte cree.
        }

        if (data && data.session && !targetIsValidated) {
            await supabase.auth.signOut();
        }

        upsertLocalShadowUser({
            name,
            email,
            role: targetRole,
            isValidated: targetIsValidated,
            supabaseId: authUser.id
        });

        return {
            ok: true,
            user: {
                name,
                email,
                role: targetRole,
                isValidated: targetIsValidated
            },
            firstAdminBootstrap
        };
    }

    async function syncSessionFromSupabase() {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        try {
            const { data } = await supabase.auth.getSession();
            const sessionUser = data && data.session && data.session.user;
            if (!sessionUser) return;

            const profile = await readSupabaseProfile(supabase, sessionUser.id);
            const isValidated = !!(profile && profile.is_validated);
            if (!isValidated) return;

            const user = {
                email: normalizeEmail(sessionUser.email || ''),
                name: normalizeName(
                    (profile && profile.display_name)
                    || (sessionUser.user_metadata && sessionUser.user_metadata.display_name)
                    || (sessionUser.email ? sessionUser.email.split('@')[0] : '')
                ),
                role: fromSupabaseRole(profile && profile.role),
                lastLogin: new Date().toISOString()
            };

            writeSessionFromUser(user);
            upsertLocalShadowUser({
                ...user,
                isValidated: true,
                supabaseId: sessionUser.id,
                imeStatus: String((profile && profile.ime_status) || '').trim(),
                professionalTitle: String((profile && (profile.professional_title || profile.job_title)) || '').trim(),
                profilePhoto: String((profile && (profile.profile_photo || profile.avatar_url)) || '').trim()
            });
        } catch (error) {
            // Ignore: fallback local reste actif.
        }
    }

    function getCurrentSession() {
        return {
            isConnected: readSessionValue(SESSION_KEYS.connected) === 'true',
            email: readSessionValue(SESSION_KEYS.email, ''),
            name: readSessionValue(SESSION_KEYS.name, ''),
            role: readSessionValue(SESSION_KEYS.role, ''),
            lastLogin: readSessionValue(SESSION_KEYS.lastLogin, '')
        };
    }

    function getCurrentUser() {
        const session = getCurrentSession();
        if (!session.isConnected) {
            return null;
        }

        // Compatibilite legacy: certaines anciennes sessions n'avaient pas userEmail.
        const hasIdentity = !!(session.email || session.name);
        if (!hasIdentity) return null;

        const users = readUsers();
        const normalizedEmail = normalizeEmail(session.email);
        const normalizedName = normalizeName(session.name);
        const localUser = users.find((user) => (
            normalizeEmail(user && user.email) === normalizedEmail
            || normalizeName(user && user.name) === normalizedName
        )) || null;

        return {
            email: session.email,
            name: session.name,
            role: session.role,
            lastLogin: session.lastLogin,
            supabaseId: String((localUser && localUser.supabaseId) || '').trim(),
            imeStatus: String((localUser && localUser.imeStatus) || '').trim(),
            professionalTitle: String((localUser && localUser.professionalTitle) || '').trim(),
            profilePhoto: String((localUser && localUser.profilePhoto) || '').trim()
        };
    }

    function isLoggedIn() {
        const session = getCurrentSession();
        return session.isConnected && !!(session.email || session.name);
    }

    function isAdmin() {
        const user = getCurrentUser();
        return !!(user && user.role === USER_ROLES.admin);
    }

    function isOwner(authorName) {
        const user = getCurrentUser();
        if (!user || !user.name || !authorName) {
            return false;
        }

        return user.name.toLowerCase() === String(authorName).toLowerCase();
    }

    function canDeleteAuthorContent(authorName) {
        return isAdmin() || isOwner(authorName);
    }

    function isAdminSession() {
        return isAdmin();
    }

    function isGuestModeEnabled() {
        const fallback = localStorage.getItem('imeGuestMode');
        if (window.dataStore && typeof window.dataStore.readValue === 'function') {
            const value = window.dataStore.readValue('imeGuestMode', fallback);
            return String(value || '').toLowerCase() === 'true';
        }
        return String(fallback || '').toLowerCase() === 'true';
    }

    function canAccessPrivatePages() {
        return isLoggedIn() && !isGuestModeEnabled();
    }

    function shouldBlockPrivatePath(pathname) {
        const page = String(pathname || '')
            .split('/')
            .pop()
            .split('?')[0]
            .toLowerCase();
        return page === 'profil.html' || page === 'messagerie.html';
    }

    function updatePrivateNavVisibility() {
        const canAccess = canAccessPrivatePages();
        const selectors = [
            'a.home-btn[href^="profil.html"]',
            'a.home-btn[href^="messagerie.html"]',
            'a#profileBtn[href^="profil.html"]',
            'a#messagesBtn[href^="messagerie.html"]',
            'a#appNativeDrawerProfile[href^="profil.html"]',
            'a#appNativeDrawerMessages[href^="messagerie.html"]'
        ];

        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                node.style.display = canAccess ? '' : 'none';
                node.setAttribute('aria-hidden', canAccess ? 'false' : 'true');
                if (!canAccess) {
                    node.setAttribute('tabindex', '-1');
                } else {
                    node.removeAttribute('tabindex');
                }
            });
        });
    }

    function enforcePrivatePagesAccess() {
        if (!shouldBlockPrivatePath(window.location.pathname)) return;
        if (canAccessPrivatePages()) return;
        window.location.href = 'index.html';
    }

    function supportsCrypto() {
        return !!(window.crypto && window.crypto.subtle && typeof window.crypto.getRandomValues === 'function');
    }

    function canUseInsecureFallback() {
        if (!DEV_AUTH_CONFIG.allowInsecureFallback) return false;
        return !supportsCrypto();
    }

    function toBase64(bytes) {
        if (typeof btoa === 'function') {
            let binary = '';
            bytes.forEach((byte) => {
                binary += String.fromCharCode(byte);
            });
            return btoa(binary);
        }

        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64');
        }

        return '';
    }

    function randomSalt() {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return toBase64(bytes);
    }

    function randomSaltFallback() {
        return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    }

    function isHashedPassword(value) {
        return typeof value === 'string' && value.startsWith(`${PASSWORD_CONFIG.version}$`);
    }

    function isDevHashedPassword(value) {
        return typeof value === 'string' && value.startsWith(`${DEV_AUTH_CONFIG.fallbackVersion}$`);
    }

    function simpleHash(input) {
        const value = String(input || '');
        let hash = 2166136261;

        for (let i = 0; i < value.length; i += 1) {
            hash ^= value.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
            hash >>>= 0;
        }

        return hash.toString(16).padStart(8, '0');
    }

    async function hashPasswordSha256(rawPassword, providedSalt) {
        if (!supportsCrypto()) {
            throw new Error('crypto_unavailable');
        }

        const password = String(rawPassword || '');
        const salt = providedSalt || randomSalt();
        const input = new TextEncoder().encode(`${salt}:${password}`);
        const digest = await window.crypto.subtle.digest('SHA-256', input);
        const hash = toBase64(new Uint8Array(digest));
        return `${PASSWORD_CONFIG.version}$${salt}$${hash}`;
    }

    function hashPasswordDev(rawPassword, providedSalt) {
        const password = String(rawPassword || '');
        const salt = providedSalt || randomSaltFallback();
        const hash = simpleHash(`${salt}:${password}`);
        return `${DEV_AUTH_CONFIG.fallbackVersion}$${salt}$${hash}`;
    }

    async function hashPassword(rawPassword, providedSalt) {
        if (supportsCrypto()) {
            return hashPasswordSha256(rawPassword, providedSalt);
        }

        if (!canUseInsecureFallback()) {
            throw new Error('crypto_unavailable');
        }

        return hashPasswordDev(rawPassword, providedSalt);
    }

    async function verifyPassword(storedSecret, password) {
        if (!storedSecret) return false;

        if (isHashedPassword(storedSecret)) {
            const [, salt] = storedSecret.split('$');
            if (!salt) return false;
            if (!supportsCrypto()) return false;
            const computed = await hashPasswordSha256(password, salt);
            return computed === storedSecret;
        }

        if (isDevHashedPassword(storedSecret)) {
            const [, salt] = storedSecret.split('$');
            if (!salt) return false;
            const computed = hashPasswordDev(password, salt);
            return computed === storedSecret;
        }

        // Compatibilité anciens comptes en clair.
        return String(storedSecret) === String(password || '');
    }

    async function login(email, password) {
        if (!isSupabaseReady()) {
            return { ok: false, reason: 'supabase_unavailable' };
        }

        return loginWithSupabase(email, password);
    }

    function logout() {
        const supabase = getSupabaseClient();
        if (supabase) {
            supabase.auth.signOut().catch(() => {});
        }
        clearSession();
    }

    async function signup(userData) {
        if (!isSupabaseReady()) {
            return { ok: false, reason: 'supabase_unavailable' };
        }
        return signupWithSupabase(userData);
    }

    async function setUserPassword(user, rawPassword) {
        const password = String(rawPassword || '');
        if (password.length < PASSWORD_CONFIG.minLength) {
            return { ok: false, reason: 'weak_password' };
        }

        if (!supportsCrypto() && !canUseInsecureFallback()) {
            return { ok: false, reason: 'crypto_unavailable' };
        }

        try {
            user.passwordHash = await hashPassword(password);
            if (DEV_AUTH_CONFIG.allowInsecureFallback) {
                user.passwordHashDev = hashPasswordDev(password);
            }
            delete user.password;
            return { ok: true };
        } catch (error) {
            return { ok: false, reason: 'crypto_unavailable' };
        }
    }

    async function adminResetPassword(emailToReset, tempPassword) {
        if (!isAdminSession()) {
            return { ok: false, reason: 'forbidden' };
        }

        const targetEmail = normalizeEmail(emailToReset);
        if (!targetEmail || !targetEmail.includes('@')) {
            return { ok: false, reason: 'invalid_email' };
        }

        const nextPassword = String(tempPassword || '');
        if (nextPassword.length < PASSWORD_CONFIG.minLength) {
            return { ok: false, reason: 'weak_password' };
        }

        if (!isSupabaseReady()) {
            return { ok: false, reason: 'supabase_unavailable' };
        }

        const supabase = getSupabaseClient();
        let invokeResult = null;

        try {
            invokeResult = await supabase.functions.invoke('admin-reset-password', {
                body: {
                    email: targetEmail,
                    newPassword: nextPassword
                }
            });
        } catch (error) {
            return { ok: false, reason: 'auth_unavailable' };
        }

        const { data, error } = invokeResult || {};
        if (error) {
            const message = String(error && error.message || '').toLowerCase();
            const status = Number(error && error.context && error.context.status);
            let edgeReason = '';

            try {
                if (error && error.context && typeof error.context.clone === 'function') {
                    const payload = await error.context.clone().json();
                    edgeReason = String(payload && payload.reason || '').trim();
                }
            } catch (_parseError) {
                edgeReason = '';
            }

            if (edgeReason === 'not_found') {
                return { ok: false, reason: 'not_found' };
            }
            if (edgeReason === 'invalid_email') {
                return { ok: false, reason: 'invalid_email' };
            }
            if (edgeReason === 'weak_password') {
                return { ok: false, reason: 'weak_password' };
            }
            if (edgeReason === 'forbidden' || edgeReason === 'forbidden_self') {
                return { ok: false, reason: 'forbidden' };
            }

            if (status === 404 || message.includes('not found')) {
                return { ok: false, reason: 'backend_required' };
            }
            if (status === 401 || status === 403 || message.includes('forbidden')) {
                return { ok: false, reason: 'forbidden' };
            }
            if (status === 400 && message.includes('invalid email')) {
                return { ok: false, reason: 'invalid_email' };
            }

            return { ok: false, reason: 'auth_unavailable' };
        }

        if (!data || data.ok !== true) {
            const reason = String(data && data.reason || '').trim();
            if (reason === 'forbidden') return { ok: false, reason: 'forbidden' };
            if (reason === 'invalid_email') return { ok: false, reason: 'invalid_email' };
            if (reason === 'weak_password') return { ok: false, reason: 'weak_password' };
            if (reason === 'not_found') return { ok: false, reason: 'not_found' };
            if (reason === 'backend_required') return { ok: false, reason: 'backend_required' };
            return { ok: false, reason: 'auth_unavailable' };
        }

        const users = readUsers();
        const user = users.find((item) => normalizeEmail(item.email) === targetEmail) || null;
        if (user) {
            if (data.profileId) user.supabaseId = String(data.profileId);
            user.isValidated = true;
            user.lastPasswordResetAt = new Date().toISOString();
            writeUsers(users);
        }

        return { ok: true };
    }

    async function adminDeleteUser(emailToDelete) {
        if (!isAdminSession()) {
            return { ok: false, reason: 'forbidden' };
        }

        const targetEmail = normalizeEmail(emailToDelete);
        if (!targetEmail || !targetEmail.includes('@')) {
            return { ok: false, reason: 'invalid_email' };
        }

        const currentUser = getCurrentUser();
        if (currentUser && normalizeEmail(currentUser.email) === targetEmail) {
            return { ok: false, reason: 'cannot_delete_self' };
        }

        const users = readUsers();
        const userIndex = users.findIndex((item) => normalizeEmail(item.email) === targetEmail);
        if (userIndex === -1) {
            return { ok: false, reason: 'not_found' };
        }

        const user = users[userIndex];

        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const profileId = await resolveSupabaseProfileIdByEmail(supabase, user, targetEmail);
            if (profileId) {
                user.supabaseId = profileId;
            }

            // Nettoyage des contenus reseau migres sur Supabase.
            if (user.supabaseId) {
                await supabase.from('reseau_comments').delete().eq('author_id', user.supabaseId);
                await supabase.from('reseau_posts').delete().eq('author_id', user.supabaseId);
            }

            let error = null;
            if (user.supabaseId) {
                const result = await supabase
                    .from('profiles')
                    .update({
                        is_validated: false,
                        role: 'parent',
                        ime_status: 'parent',
                        job_title: null,
                        professional_title: null
                    })
                    .eq('id', user.supabaseId);
                error = result.error || null;
            }

            if (error) {
                return { ok: false, reason: 'auth_unavailable' };
            }
        }

        users.splice(userIndex, 1);
        writeUsers(users);
        return { ok: true };
    }

    async function adminRejectUser(emailToReject) {
        if (!isAdminSession()) {
            return { ok: false, reason: 'forbidden' };
        }

        const targetEmail = normalizeEmail(emailToReject);
        if (!targetEmail || !targetEmail.includes('@')) {
            return { ok: false, reason: 'invalid_email' };
        }

        const users = readUsers();
        const userIndex = users.findIndex((item) => normalizeEmail(item.email) === targetEmail);
        const user = userIndex >= 0 ? users[userIndex] : null;
        let hasRemoteProfile = false;

        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const profileId = await resolveSupabaseProfileIdByEmail(supabase, user || {}, targetEmail);

            if (profileId) {
                hasRemoteProfile = true;
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        is_validated: false,
                        role: 'parent',
                        ime_status: 'parent',
                        job_title: null,
                        professional_title: null
                    })
                    .eq('id', profileId);

                if (error) {
                    return { ok: false, reason: 'auth_unavailable' };
                }
            }
        }

        if (userIndex >= 0) {
            users.splice(userIndex, 1);
            writeUsers(users);
            return { ok: true };
        }

        if (hasRemoteProfile) {
            return { ok: true };
        }

        return { ok: false, reason: 'not_found' };
    }

    async function changeOwnPassword(currentPassword, nextPassword) {
        const supabase = getSupabaseClient();
        if (!isLoggedIn()) {
            return { ok: false, reason: 'not_logged_in' };
        }

        if (!supabase) {
            return { ok: false, reason: 'supabase_unavailable' };
        }

        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.email) {
            return { ok: false, reason: 'not_logged_in' };
        }

        if (String(nextPassword || '').length < PASSWORD_CONFIG.minLength) {
            return { ok: false, reason: 'weak_password' };
        }

        const reauth = await supabase.auth.signInWithPassword({
            email: normalizeEmail(currentUser.email),
            password: String(currentPassword || '')
        });

        if (reauth.error) {
            return { ok: false, reason: 'invalid_current_password' };
        }

        const updateResult = await supabase.auth.updateUser({
            password: String(nextPassword || '')
        });

        if (updateResult.error) {
            return { ok: false, reason: mapSupabaseErrorToReason(updateResult.error, 'auth_unavailable') };
        }

        return { ok: true };
    }

    async function validateUser(emailToValidate) {
        if (!isAdminSession()) {
            return { ok: false, reason: 'forbidden' };
        }

        const users = readUsers();
        const targetEmail = normalizeEmail(emailToValidate);
        const user = users.find((item) => normalizeEmail(item.email) === targetEmail);

        if (!user) {
            return { ok: false, reason: 'not_found' };
        }

        const wasValidated = !!user.isValidated;
        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const profileId = await resolveSupabaseProfileIdByEmail(supabase, user, targetEmail);
            if (!profileId) {
                return { ok: false, reason: 'not_found' };
            }

            const { error } = await supabase
                .from('profiles')
                .update({ is_validated: true })
                .eq('id', profileId);

            if (error) {
                return { ok: false, reason: 'auth_unavailable' };
            }

            user.supabaseId = profileId;
        }

        user.isValidated = true;
        writeUsers(users);
        return { ok: true, alreadyValidated: wasValidated };
    }

    async function promoteToAdmin(emailToPromote) {
        if (!isAdminSession()) {
            return { ok: false, reason: 'forbidden' };
        }

        const users = readUsers();
        const targetEmail = normalizeEmail(emailToPromote);
        const user = users.find((item) => normalizeEmail(item.email) === targetEmail);

        if (!user) {
            return { ok: false, reason: 'not_found' };
        }

        if (isSupabaseReady()) {
            const supabase = getSupabaseClient();
            const profileId = await resolveSupabaseProfileIdByEmail(supabase, user, targetEmail);
            if (!profileId) {
                return { ok: false, reason: 'not_found' };
            }

            const { error } = await supabase
                .from('profiles')
                .update({ role: 'admin', is_validated: true, ime_status: 'direction' })
                .eq('id', profileId);

            if (error) {
                return { ok: false, reason: 'auth_unavailable' };
            }

            user.supabaseId = profileId;
        }

        user.role = USER_ROLES.admin;
        user.isValidated = true;
        writeUsers(users);
        return { ok: true, user };
    }

    async function upgradeLegacyUsers() {
        // Conservé pour compat API externe, mais en mode prod:
        // on nettoie les secrets locaux au lieu de les migrer.
        sanitizeLocalShadowUsers();
    }

    window.auth = {
        SESSION_KEYS,
        PASSWORD_CONFIG,
        USER_ROLES,
        readUsers,
        writeUsers,
        getCurrentSession,
        getCurrentUser,
        isLoggedIn,
        isAdmin,
        isGuestModeEnabled,
        canAccessPrivatePages,
        isOwner,
        canDeleteAuthorContent,
        login,
        logout,
        signup,
        adminResetPassword,
        adminDeleteUser,
        adminRejectUser,
        changeOwnPassword,
        validateUser,
        isAdminSession,
        promoteToAdmin,
        upgradeLegacyUsers,
        getLastSupabaseError
    };

    // Nettoyage automatique des anciens secrets au chargement.
    upgradeLegacyUsers();
    syncSessionFromSupabase();

    document.addEventListener('DOMContentLoaded', () => {
        enforcePrivatePagesAccess();
        updatePrivateNavVisibility();
    });

    window.addEventListener('storage', (event) => {
        if (!event || !event.key) return;
        if (
            event.key === SESSION_KEYS.connected ||
            event.key === SESSION_KEYS.email ||
            event.key === SESSION_KEYS.name ||
            event.key === 'imeGuestMode'
        ) {
            updatePrivateNavVisibility();
        }
    });
})();
