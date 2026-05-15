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

function setGuestMode(enabled) {
    const value = enabled ? 'true' : 'false';
    if (window.dataStore && typeof window.dataStore.writeValue === 'function') {
        window.dataStore.writeValue('imeGuestMode', value);
    } else {
        localStorage.setItem('imeGuestMode', value);
    }
}

function goToAppHome() {
    sessionStorage.setItem('imeOpeningShown', '1');
    window.location.href = 'index.html?fromApp=1';
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

document.addEventListener('DOMContentLoaded', () => {
    if (!isNativeAppRuntime()) {
        window.location.href = 'index.html';
        return;
    }

    const currentUser = window.auth && typeof window.auth.getCurrentUser === 'function'
        ? window.auth.getCurrentUser()
        : null;

    if (currentUser && (currentUser.email || currentUser.name)) {
        goToAppHome();
        return;
    }

    const introNode = document.getElementById('appNativeIntro');
    const swipeHintNode = document.getElementById('appSwipeHint');
    const authSheetNode = document.getElementById('appNativeAuthSheet');
    const loginFormNode = document.getElementById('appNativeLoginForm');
    const signupLinkNode = document.getElementById('appNativeSignupLink');
    const guestLinkNode = document.getElementById('appNativeGuestLink');

    if (!introNode || !swipeHintNode || !authSheetNode || !loginFormNode || !signupLinkNode || !guestLinkNode) {
        return;
    }

    let touchStartY = null;

    const openAuthSheet = () => {
        document.body.classList.add('app-native-auth-open');
        authSheetNode.setAttribute('aria-hidden', 'false');
    };

    swipeHintNode.addEventListener('click', openAuthSheet);
    introNode.addEventListener('touchstart', (event) => {
        const touch = event.touches && event.touches[0];
        touchStartY = touch ? touch.clientY : null;
    }, { passive: true });

    introNode.addEventListener('touchend', (event) => {
        if (touchStartY === null) return;
        const touch = event.changedTouches && event.changedTouches[0];
        if (!touch) {
            touchStartY = null;
            return;
        }
        const deltaY = touchStartY - touch.clientY;
        touchStartY = null;
        if (deltaY > 64) openAuthSheet();
    }, { passive: true });

    loginFormNode.addEventListener('submit', async (event) => {
        event.preventDefault();
        const emailNode = document.getElementById('appNativeEmail');
        const passwordNode = document.getElementById('appNativePassword');
        if (!emailNode || !passwordNode) return;

        const result = window.auth
            ? await window.auth.login(emailNode.value, passwordNode.value)
            : { ok: false, reason: 'auth_unavailable' };

        if (!handleNativeLoginResult(result)) return;

        setGuestMode(false);
        goToAppHome();
    });

    signupLinkNode.addEventListener('click', () => {
        sessionStorage.setItem('imeOpeningShown', '1');
    });

    guestLinkNode.addEventListener('click', (event) => {
        event.preventDefault();
        setGuestMode(true);
        goToAppHome();
    });
});
