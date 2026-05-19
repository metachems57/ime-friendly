const toolsKey = 'tools';
let currentDisplayedTool = null;
let nativeDetailToolsDrawerReady = false;

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

function closeNativeToolsDrawer() {
    document.body.classList.remove('app-native-tools-drawer-open');
    const backdropNode = document.getElementById('appNativeToolsDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeToolsDrawer');
    if (backdropNode) backdropNode.hidden = true;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'true');
}

function openNativeToolsDrawer() {
    document.body.classList.add('app-native-tools-drawer-open');
    const backdropNode = document.getElementById('appNativeToolsDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeToolsDrawer');
    if (backdropNode) backdropNode.hidden = false;
    if (drawerNode) drawerNode.setAttribute('aria-hidden', 'false');
}

function getConnectedUser() {
    if (window.auth && typeof window.auth.getCurrentUser === 'function') {
        const authUser = window.auth.getCurrentUser();
        if (authUser) return authUser;
    }

    const isConnected = localStorage.getItem('imeConnected') === 'true';
    if (!isConnected) return null;

    return {
        name: localStorage.getItem('userName') || '',
        role: localStorage.getItem('userRole') || '',
        email: localStorage.getItem('userEmail') || ''
    };
}

function updateNativeToolsDrawerLinks() {
    const profileNode = document.getElementById('appNativeToolsProfileLink');
    const messagesNode = document.getElementById('appNativeToolsMessagesLink');
    const logoutNode = document.getElementById('appNativeToolsLogoutBtn');
    const resetNode = document.getElementById('appNativeToolsAdminResetLink');
    const user = getConnectedUser();
    const isAdmin = window.auth && typeof window.auth.isAdmin === 'function'
        ? window.auth.isAdmin()
        : String(user?.role || '').trim().toLowerCase() === 'admin';
    const isLogged = !!user;

    if (profileNode) {
        const userName = user && user.name ? String(user.name).trim() : '';
        profileNode.href = userName ? `profil.html?user=${encodeURIComponent(userName)}` : 'profil.html';
        profileNode.style.display = isLogged ? 'block' : 'none';
    }

    if (messagesNode) {
        messagesNode.style.display = isLogged ? 'block' : 'none';
    }

    if (logoutNode) {
        logoutNode.style.display = isLogged ? 'block' : 'none';
    }

    if (resetNode) {
        resetNode.style.display = isAdmin ? 'block' : 'none';
    }
}

function logoutFromNativeToolsDrawer() {
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

function initNativeToolsExperience() {
    if (!isNativeAppRuntime()) return;
    document.body.classList.add('is-native-app');
    updateNativeToolsDrawerLinks();

    if (nativeDetailToolsDrawerReady) return;
    nativeDetailToolsDrawerReady = true;

    const menuBtnNode = document.getElementById('appNativeToolsMenuBtn');
    const backdropNode = document.getElementById('appNativeToolsDrawerBackdrop');
    const drawerNode = document.getElementById('appNativeToolsDrawer');
    const accessibilityNode = document.getElementById('appNativeToolsAccessibilityLink');
    const adminResetNode = document.getElementById('appNativeToolsAdminResetLink');
    const logoutNode = document.getElementById('appNativeToolsLogoutBtn');

    if (menuBtnNode) {
        menuBtnNode.addEventListener('click', () => {
            if (document.body.classList.contains('app-native-tools-drawer-open')) {
                closeNativeToolsDrawer();
            } else {
                openNativeToolsDrawer();
            }
        });
    }

    if (backdropNode) {
        backdropNode.addEventListener('click', closeNativeToolsDrawer);
    }

    if (drawerNode) {
        drawerNode.querySelectorAll('a').forEach((linkNode) => {
            linkNode.addEventListener('click', () => {
                closeNativeToolsDrawer();
            });
        });
    }

    if (accessibilityNode) {
        accessibilityNode.addEventListener('click', () => {
            closeNativeToolsDrawer();
            if (typeof window.openAccessibilityPanel === 'function') {
                window.openAccessibilityPanel();
                return;
            }
            if (window.imeAccessibilityPanel && typeof window.imeAccessibilityPanel.open === 'function') {
                window.imeAccessibilityPanel.open();
                return;
            }
            const toggleNode = document.getElementById('a11yToggleBtn');
            if (toggleNode) toggleNode.click();
        });
    }

    if (adminResetNode) {
        adminResetNode.addEventListener('click', () => {
            closeNativeToolsDrawer();
            if (typeof window.showAdminResetPassword === 'function') {
                window.showAdminResetPassword();
            }
        });
    }

    if (logoutNode) {
        logoutNode.addEventListener('click', () => {
            closeNativeToolsDrawer();
            logoutFromNativeToolsDrawer();
        });
    }
}


function readTools() {
    if (window.dataStore && typeof window.dataStore.readArray === 'function') {
        return window.dataStore.readArray(toolsKey);
    }

    try {
        const parsed = JSON.parse(localStorage.getItem(toolsKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function writeTools(tools) {
    const safeTools = Array.isArray(tools) ? tools : [];

    if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
        window.dataStore.writeArray(toolsKey, safeTools);
        return;
    }

    localStorage.setItem(toolsKey, JSON.stringify(safeTools));
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

async function fetchProfileNameById(userId) {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return '';

    const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle();

    if (error || !data) return '';
    return String(data.display_name || '').trim();
}

async function fetchToolByIdFromSupabase(toolId) {
    const supabase = getSupabaseClient();
    const numericId = Number(toolId);
    if (!supabase || !Number.isFinite(numericId)) return null;

    const { data, error } = await supabase
        .from('tools')
        .select('id, author_id, name, age, steps_json, created_at')
        .eq('id', numericId)
        .maybeSingle();

    if (error || !data) return null;

    let steps = [];
    if (Array.isArray(data.steps_json)) {
        steps = data.steps_json;
    } else if (typeof data.steps_json === 'string') {
        try {
            const parsed = JSON.parse(data.steps_json);
            steps = Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            steps = [];
        }
    }

    const author = await fetchProfileNameById(data.author_id);

    return {
        id: Number(data.id),
        authorId: data.author_id || null,
        author: author || 'Anonyme',
        name: String(data.name || ''),
        age: String(data.age || ''),
        steps,
        createdAt: data.created_at || new Date().toISOString()
    };
}

function getToolIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function findToolById(tools, toolId) {
    const asNumber = Number(toolId);
    const isNumericId = Number.isFinite(asNumber);

    return tools.find((tool) => {
        if (isNumericId) {
            return Number(tool.id) === asNumber;
        }
        return String(tool.id) === String(toolId);
    });
}

function sanitizeImageSrc(src) {
    const value = String(src || '').trim();
    if (!value) return '';
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('blob:') || value.startsWith('/')) {
        return value;
    }
    return '';
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

function isUserLoggedIn() {
    if (window.auth && typeof window.auth.isLoggedIn === 'function') {
        return window.auth.isLoggedIn();
    }

    return localStorage.getItem('imeConnected') === 'true';
}

function getFavoritePayload(tool) {
    const toolId = Number(tool?.id);
    if (!Number.isFinite(toolId)) return null;

    return {
        source: 'tool',
        itemId: String(toolId),
        title: String(tool?.name || 'Outil').trim() || 'Outil',
        href: `detail-outil.html?id=${encodeURIComponent(toolId)}`
    };
}

function updateFavoriteButtonState(isFavorited) {
    const favoriteBtn = document.getElementById('favoriteToolBtn');
    if (!favoriteBtn) return;

    favoriteBtn.textContent = isFavorited ? '★ Retirer des favoris' : '☆ Ajouter aux favoris';
    favoriteBtn.classList.toggle('is-active', isFavorited);
}

function printCurrentTool() {
    if (!currentDisplayedTool) {
        alert("Impossible d'imprimer: outil introuvable.");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=960,height=760');
    if (!printWindow) {
        alert("L'ouverture de la fenêtre d'impression a été bloquée.");
        return;
    }

    const safeToolName = escapeHtml(currentDisplayedTool.name || "Fiche outil");
    const safeAge = escapeHtml(currentDisplayedTool.age || 'Non précisé');
    const safeAuthor = escapeHtml(currentDisplayedTool.author || 'Anonyme');
    const steps = Array.isArray(currentDisplayedTool.steps) ? currentDisplayedTool.steps : [];

    const stepsHtml = steps.length > 0
        ? steps.map((step, index) => {
            const description = escapeHtml(step?.description || 'Description non renseignée.');
            const images = Array.isArray(step?.images) ? step.images : [];
            const imagesHtml = images
                .map((img) => sanitizeImageSrc(img))
                .filter(Boolean)
                .map((img) => `<img src="${img}" alt="Etape ${index + 1}">`)
                .join('');

            return `
                <section class="step">
                    <h2>Etape ${index + 1}</h2>
                    <p>${description}</p>
                    ${imagesHtml ? `<div class="images">${imagesHtml}</div>` : ''}
                </section>
            `;
        }).join('')
        : '<p>Aucune étape disponible.</p>';

    printWindow.document.write(`
        <!doctype html>
        <html lang="fr">
        <head>
            <meta charset="utf-8">
            <title>Impression - ${safeToolName}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
                h1 { margin: 0 0 8px; font-size: 24px; }
                .meta { color: #475569; margin-bottom: 14px; font-size: 14px; }
                .step { border: 1px solid #c9dcf5; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
                .step h2 { margin: 0 0 8px; font-size: 18px; color: #1e40af; }
                .step p { margin: 0; line-height: 1.5; white-space: pre-wrap; }
                .images { margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
                .images img { width: 100%; border-radius: 8px; border: 1px solid #d5e4f8; }
            </style>
        </head>
        <body>
            <h1>${safeToolName}</h1>
            <div class="meta">Age: ${safeAge} • Auteur: ${safeAuthor}</div>
            ${stepsHtml}
            <script>
                window.addEventListener('load', function () {
                    setTimeout(function () { window.print(); }, 100);
                });
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function initToolActions(tool) {
    const printBtn = document.getElementById('printToolBtn');
    const favoriteBtn = document.getElementById('favoriteToolBtn');

    if (printBtn) {
        printBtn.addEventListener('click', printCurrentTool);
    }

    if (!favoriteBtn) return;

    const payload = getFavoritePayload(tool);
    if (!payload || !window.userFavorites || typeof window.userFavorites.isFavorite !== 'function') {
        favoriteBtn.hidden = true;
        return;
    }

    const canUseFavorites = isUserLoggedIn();
    favoriteBtn.hidden = false;
    favoriteBtn.disabled = !canUseFavorites;

    updateFavoriteButtonState(window.userFavorites.isFavorite(payload.source, payload.itemId));
    if (!canUseFavorites) {
        favoriteBtn.textContent = '☆ Favori (connexion requise)';
        return;
    }

    favoriteBtn.addEventListener('click', () => {
        const result = window.userFavorites.toggleFavorite(payload);
        if (!result.ok) return;
        updateFavoriteButtonState(!!result.favorited);
    });
}

function renderNotFound(message) {
    const titleEl = document.getElementById('tool-title');
    const ageEl = document.getElementById('tool-age');
    const container = document.getElementById('steps-content-container');

    titleEl.textContent = "Outil introuvable";
    ageEl.textContent = '';
    container.innerHTML = '';

    const text = document.createElement('p');
    text.textContent = message;
    container.appendChild(text);
}

function renderTool(tool) {
    const titleEl = document.getElementById('tool-title');
    const ageEl = document.getElementById('tool-age');
    const container = document.getElementById('steps-content-container');

    titleEl.textContent = tool.name || "Détail de l'outil";
    ageEl.textContent = tool.age ? `Âge recommandé: ${tool.age}` : '';
    container.innerHTML = '';
    currentDisplayedTool = tool;

    const steps = Array.isArray(tool.steps) ? tool.steps : [];
    if (steps.length === 0) {
        const noStepText = document.createElement('p');
        noStepText.textContent = "Aucune étape disponible pour cet outil.";
        container.appendChild(noStepText);
        return;
    }

    steps.forEach((step, index) => {
        const stepBlock = document.createElement('article');
        stepBlock.className = 'detail-step';

        const stepTitle = document.createElement('h2');
        stepTitle.textContent = `Étape ${index + 1}`;
        stepBlock.appendChild(stepTitle);

        const stepDescription = document.createElement('p');
        stepDescription.textContent = step.description || 'Description non renseignée.';
        stepBlock.appendChild(stepDescription);

        const images = Array.isArray(step.images) ? step.images : [];
        if (images.length > 0) {
            const imagesWrap = document.createElement('div');
            imagesWrap.className = 'step-images';

            images.forEach((imageSrc, imageIndex) => {
                const safeImageSrc = sanitizeImageSrc(imageSrc);
                if (!safeImageSrc) return;

                const image = document.createElement('img');
                image.src = safeImageSrc;
                image.alt = `Étape ${index + 1} - image ${imageIndex + 1}`;
                image.className = 'detail-image';
                imagesWrap.appendChild(image);
            });

            stepBlock.appendChild(imagesWrap);
        }

        container.appendChild(stepBlock);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initNativeToolsExperience();

    const toolId = getToolIdFromUrl();

    if (!toolId) {
        renderNotFound("Identifiant d'outil manquant dans l'URL.");
        return;
    }

    let tool = null;
    if (isSupabaseReady()) {
        tool = await fetchToolByIdFromSupabase(toolId);
    }

    if (!tool) {
        const tools = readTools();
        tool = findToolById(tools, toolId);
    } else {
        const tools = readTools();
        const numericId = Number(tool.id);
        const nextTools = tools.filter((item) => Number(item?.id) !== numericId);
        nextTools.unshift(tool);
        writeTools(nextTools);
    }

    if (!tool) {
        renderNotFound("L'outil demandé n'existe pas ou a été supprimé.");
        return;
    }

    renderTool(tool);
    initToolActions(tool);
    updateNativeToolsDrawerLinks();
});
