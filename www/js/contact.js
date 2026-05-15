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

function getAdminProfileHref() {
    const users = readUsers();
    const adminUser = users.find((user) => String(user && user.role || '').trim().toLowerCase() === 'admin');
    if (!adminUser || !adminUser.name) {
        return 'profil.html';
    }

    return `profil.html?user=${encodeURIComponent(String(adminUser.name).trim())}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const donateButton = document.getElementById('donateBtn');
    const adminProfileLink = document.getElementById('adminProfileLink');

    if (adminProfileLink) {
        adminProfileLink.href = getAdminProfileHref();
    }

    if (!donateButton) return;

    donateButton.addEventListener('click', () => {
        alert("Le module de don sera activé après la mise en place du backend.");
    });
});
