        // ==================== CONFIGURATION & ÉTATS ====================
        const toolsKey = 'tools';
        let runtimeTools = [];
        let runtimeToolsLoaded = false;
        let nativeToolsDrawerReady = false;
        let nativeToolsPhotoFlow = null;
        let nativeToolsRenderToken = 0;
        const NATIVE_TOOLS_INITIAL_BATCH = 8;
        const NATIVE_TOOLS_BATCH = 6;

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

        function openNativeToolsCreatePanel() {
            if (!isNativeAppRuntime()) return;
            document.body.classList.add('app-native-tools-create-open');
        }

        function closeNativeToolsCreatePanel() {
            if (!isNativeAppRuntime()) return;
            document.body.classList.remove('app-native-tools-create-open');
        }

        function closeNativeToolsCameraLauncher() {
            const launcher = document.getElementById('appNativeToolsCameraLauncher');
            if (launcher) launcher.hidden = true;
        }

        function openNativeToolsCameraLauncher() {
            const launcher = document.getElementById('appNativeToolsCameraLauncher');
            const titleNode = document.getElementById('appNativeToolsCameraLauncherTitle');
            if (!launcher) return;

            if (titleNode && nativeToolsPhotoFlow) {
                titleNode.textContent = `Étape ${nativeToolsPhotoFlow.currentStep}`;
            }

            launcher.hidden = false;
        }

        function closeNativeToolsStepModal() {
            const modal = document.getElementById('appNativeToolsStepModal');
            if (modal) modal.hidden = true;
        }

        function clearNativeToolsPhotoFlow() {
            nativeToolsPhotoFlow = null;
            closeNativeToolsCameraLauncher();
            closeNativeToolsStepModal();
        }

        function triggerNativeToolsCamera() {
            const input = document.getElementById('appNativeToolsCameraInput');
            if (!input || !nativeToolsPhotoFlow) return;

            input.value = '';
            window.setTimeout(() => {
                input.click();
            }, 60);
        }

        function startNativeToolsPhotoFlow() {
            if (!isUserLoggedIn()) {
                alert("Mode invité: connectez-vous pour publier.");
                return;
            }

            nativeToolsPhotoFlow = {
                currentStep: 1,
                steps: [],
                currentImage: '',
                currentText: ''
            };

            closeNativeToolsDrawer();
            closeNativeToolsCreatePanel();
            openNativeToolsCameraLauncher();
        }

        function openNativeToolsStepModal(imageDataUrl) {
            const modal = document.getElementById('appNativeToolsStepModal');
            const titleNode = document.getElementById('appNativeToolsStepTitle');
            const imageNode = document.getElementById('appNativeToolsStepImagePreview');
            const textNode = document.getElementById('appNativeToolsStepText');
            if (!modal || !titleNode || !imageNode || !textNode || !nativeToolsPhotoFlow) return;

            nativeToolsPhotoFlow.currentImage = String(imageDataUrl || '');
            titleNode.textContent = `Étape ${nativeToolsPhotoFlow.currentStep}`;
            imageNode.src = nativeToolsPhotoFlow.currentImage;
            textNode.value = '';

            closeNativeToolsCameraLauncher();
            modal.hidden = false;
            textNode.focus();
        }

        function createNativePhotoStepGroup(step, index) {
            const stepIndex = index + 1;
            const stepDiv = document.createElement('div');
            stepDiv.className = 'step-group';
            stepDiv.dataset.index = stepIndex;

            const inputId = `step-image-native-${stepIndex}-${Date.now()}`;
            const safeDescription = String(step?.description || '').trim();
            const images = Array.isArray(step?.images) ? step.images.map((img) => sanitizeImageSrc(img)).filter(Boolean) : [];
            const imagesJson = escapeHtml(JSON.stringify(images));

            stepDiv.innerHTML = `
                <h3>Étape ${stepIndex}</h3>
                <div class="form-group">
                    <textarea name="step-description" placeholder="Description de l'étape ${stepIndex}..." required>${escapeHtml(safeDescription)}</textarea>
                </div>
                <div class="form-group">
                    <label for="${inputId}" class="file-label">Ajouter des images</label>
                    <input type="file" id="${inputId}" name="step-images" multiple accept="image/*">
                    <input type="hidden" name="step-images-cache" value="${imagesJson}">
                </div>
                <div id="image-preview-native-${stepIndex}" class="image-preview-container"></div>
            `;

            const previewContainer = stepDiv.querySelector(`#image-preview-native-${stepIndex}`);
            if (previewContainer && images.length) {
                previewContainer.innerHTML = images
                    .map((imgSrc) => `<img src="${escapeHtml(imgSrc)}" class="image-preview-thumb" alt="Aperçu étape ${stepIndex}">`)
                    .join('');
                previewContainer.style.display = 'flex';
            }

            const stepInput = stepDiv.querySelector(`#${inputId}`);
            const cacheInput = stepDiv.querySelector('input[name="step-images-cache"]');
            if (stepInput) {
                stepInput.addEventListener('change', (event) => {
                    if (cacheInput) cacheInput.value = '';
                    handleImageSelection(event, `image-preview-native-${stepIndex}`);
                });
            }

            return stepDiv;
        }

        function draftNativeToolsPhotoFlowIntoForm() {
            if (!nativeToolsPhotoFlow || !nativeToolsPhotoFlow.steps.length) {
                alert("Ajoutez au moins une étape.");
                return;
            }

            const addToolForm = document.getElementById('addToolForm');
            const stepsContainer = document.getElementById('steps-container');
            if (!addToolForm || !stepsContainer) {
                clearNativeToolsPhotoFlow();
                return;
            }

            const nameInput = addToolForm.querySelector('[name="name"]');
            const ageInput = addToolForm.querySelector('[name="age"]');
            if (nameInput) nameInput.value = '';
            if (ageInput) ageInput.value = '';

            stepsContainer.innerHTML = '';
            nativeToolsPhotoFlow.steps.forEach((step, index) => {
                stepsContainer.appendChild(createNativePhotoStepGroup(step, index));
            });

            if (!isUserLoggedIn()) {
                addToolForm.querySelectorAll('input, textarea, button').forEach((field) => {
                    field.disabled = true;
                });
            }

            clearNativeToolsPhotoFlow();
            openNativeToolsCreatePanel();
            if (nameInput) nameInput.focus();
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
            try {
                localStorage.setItem('imeNativeRuntime', '1');
            } catch (error) {
                // ignore
            }

            document.body.classList.add('is-native-app');
            document.documentElement.classList.remove('native-preload');
            updateNativeToolsDrawerLinks();

            if (nativeToolsDrawerReady) return;
            nativeToolsDrawerReady = true;

            const menuBtnNode = document.getElementById('appNativeToolsMenuBtn');
            const backdropNode = document.getElementById('appNativeToolsDrawerBackdrop');
            const drawerNode = document.getElementById('appNativeToolsDrawer');
            const publishBtnNode = document.getElementById('appNativeToolsPublishBtn');
            const cameraBtnNode = document.getElementById('appNativeToolsCameraBtn');
            const closeCreateBtn = document.getElementById('appNativeToolsCloseCreateBtn');
            const accessibilityNode = document.getElementById('appNativeToolsAccessibilityLink');
            const adminResetNode = document.getElementById('appNativeToolsAdminResetLink');
            const logoutNode = document.getElementById('appNativeToolsLogoutBtn');
            const cameraInputNode = document.getElementById('appNativeToolsCameraInput');
            const openCameraNowNode = document.getElementById('appNativeToolsOpenCameraNowBtn');
            const quitLauncherNode = document.getElementById('appNativeToolsCameraLauncherQuit');
            const validateBtnNode = document.getElementById('appNativeToolsStepValidateBtn');
            const addStepBtnNode = document.getElementById('appNativeToolsStepAddBtn');
            const retryBtnNode = document.getElementById('appNativeToolsStepRetryBtn');
            const stepTextNode = document.getElementById('appNativeToolsStepText');

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

            if (publishBtnNode) {
                publishBtnNode.addEventListener('click', () => {
                    if (!isUserLoggedIn()) {
                        alert("Mode invité: connectez-vous pour publier.");
                        return;
                    }
                    closeNativeToolsDrawer();
                    openNativeToolsCreatePanel();
                });
            }

            if (cameraBtnNode) {
                cameraBtnNode.addEventListener('click', () => {
                    startNativeToolsPhotoFlow();
                });
            }

            if (closeCreateBtn) {
                closeCreateBtn.addEventListener('click', closeNativeToolsCreatePanel);
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
                    const canReset = window.auth && typeof window.auth.isAdmin === 'function' && window.auth.isAdmin();
                    if (canReset && typeof window.showAdminResetPassword === 'function') {
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

            if (quitLauncherNode) {
                quitLauncherNode.addEventListener('click', () => {
                    clearNativeToolsPhotoFlow();
                });
            }

            if (openCameraNowNode) {
                openCameraNowNode.addEventListener('click', () => {
                    triggerNativeToolsCamera();
                });
            }

            if (cameraInputNode) {
                cameraInputNode.addEventListener('change', async (event) => {
                    if (!nativeToolsPhotoFlow) return;
                    const file = event.target.files && event.target.files[0];
                    if (!file) {
                        return;
                    }

                    try {
                        const dataUrl = await compressImageFile(file);
                        openNativeToolsStepModal(dataUrl);
                    } catch (error) {
                        alert("La photo n'a pas pu être traitée.");
                    } finally {
                        event.target.value = '';
                    }
                });
            }

            if (addStepBtnNode) {
                addStepBtnNode.addEventListener('click', () => {
                    if (!nativeToolsPhotoFlow) return;
                    const description = String(stepTextNode?.value || '').trim();
                    if (!description) {
                        alert("Ajoutez un texte pour cette étape.");
                        return;
                    }

                    nativeToolsPhotoFlow.steps.push({
                        description,
                        images: [nativeToolsPhotoFlow.currentImage]
                    });

                    nativeToolsPhotoFlow.currentStep += 1;
                    nativeToolsPhotoFlow.currentImage = '';
                    nativeToolsPhotoFlow.currentText = '';
                    closeNativeToolsStepModal();
                    openNativeToolsCameraLauncher();
                    triggerNativeToolsCamera();
                });
            }

            if (validateBtnNode) {
                validateBtnNode.addEventListener('click', () => {
                    if (!nativeToolsPhotoFlow) return;
                    const description = String(stepTextNode?.value || '').trim();
                    if (!description) {
                        alert("Ajoutez un texte pour cette étape.");
                        return;
                    }

                    nativeToolsPhotoFlow.steps.push({
                        description,
                        images: [nativeToolsPhotoFlow.currentImage]
                    });

                    draftNativeToolsPhotoFlowIntoForm();
                });
            }

            if (retryBtnNode) {
                retryBtnNode.addEventListener('click', () => {
                    if (!nativeToolsPhotoFlow) return;
                    closeNativeToolsStepModal();
                    openNativeToolsCameraLauncher();
                    triggerNativeToolsCamera();
                });
            }
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

        function getCurrentUserName() {
            const user = getConnectedUser();
            return user && user.name ? user.name : '';
        }

        function isUserLoggedIn() {
            if (window.auth && typeof window.auth.isLoggedIn === 'function') {
                return window.auth.isLoggedIn();
            }

            return localStorage.getItem('imeConnected') === 'true';
        }

        function canDeleteByAuthor(authorName) {
            if (window.auth && typeof window.auth.canDeleteAuthorContent === 'function') {
                return window.auth.canDeleteAuthorContent(authorName);
            }

            const user = getConnectedUser();
            if (!user || !user.name) return false;
            if (user.role === 'admin') return true;
            if (!authorName) return false;
            return user.name.toLowerCase() === String(authorName).toLowerCase();
        }

        function renderToolsSkeleton(toolsGrid, count = 3) {
            toolsGrid.innerHTML = '';
            for (let i = 0; i < count; i += 1) {
                const skeleton = document.createElement('div');
                skeleton.className = 'tool-card tools-skeleton';
                skeleton.innerHTML = `
                    <div class="skeleton-media"></div>
                    <div class="skeleton-line skeleton-line-lg"></div>
                    <div class="skeleton-line"></div>
                `;
                toolsGrid.appendChild(skeleton);
            }
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

        function sanitizeImageSrc(src) {
            const value = String(src || '').trim();
            if (!value) return '';
            if (value.startsWith('data:image/')) return value;
            if (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('blob:') || value.startsWith('/')) {
                return value;
            }
            return '';
        }

        function isDataImageUrl(value) {
            return String(value || '').trim().startsWith('data:image/');
        }

        async function uploadToolImageIfNeeded(imageValue) {
            const value = String(imageValue || '').trim();
            if (!value || !isDataImageUrl(value)) return value;

            if (!window.supabaseStorage || typeof window.supabaseStorage.uploadDataUrl !== 'function') {
                return value;
            }

            const uploadResult = await window.supabaseStorage.uploadDataUrl(value, {
                bucket: 'tools-media',
                folder: 'steps',
                fileNamePrefix: 'tool-step'
            });

            if (!uploadResult.ok) {
                console.warn('Upload image outil échoué, fallback local/base64.', uploadResult.reason || uploadResult.error || 'unknown');
                return value;
            }

            return String(uploadResult.url || '').trim() || value;
        }

        async function normalizeToolStepsForStorage(steps) {
            const safeSteps = Array.isArray(steps) ? steps : [];
            const normalized = [];

            for (const step of safeSteps) {
                const description = String(step?.description || '').trim();
                const rawImages = Array.isArray(step?.images) ? step.images : [];
                const uploadedImages = [];

                for (const imageValue of rawImages) {
                    const nextImage = await uploadToolImageIfNeeded(imageValue);
                    if (nextImage) uploadedImages.push(nextImage);
                }

                normalized.push({
                    description,
                    images: uploadedImages
                });
            }

            return normalized;
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

        function persistResolvedSupabaseUserId(userId) {
            const cleanId = String(userId || '').trim();
            if (!cleanId) return;
            try {
                if (window.dataStore && typeof window.dataStore.writeValue === 'function') {
                    window.dataStore.writeValue('userSupabaseId', cleanId);
                    return;
                }
                localStorage.setItem('userSupabaseId', cleanId);
            } catch (error) {
                // ignore storage issues
            }
        }

        async function getCurrentSupabaseUserId() {
            const supabase = getSupabaseClient();
            if (!supabase) return null;

            if (window.auth && typeof window.auth.getCurrentUserSupabaseId === 'function') {
                const fromSession = String(window.auth.getCurrentUserSupabaseId() || '').trim();
                if (fromSession) return fromSession;
            }

            try {
                const fromStorage = String(localStorage.getItem('userSupabaseId') || '').trim();
                if (fromStorage) return fromStorage;
            } catch (error) {
                // ignore
            }

            try {
                const { data, error } = await supabase.auth.getUser();
                if (!error && data && data.user && data.user.id) {
                    const userId = String(data.user.id).trim();
                    if (userId) {
                        persistResolvedSupabaseUserId(userId);
                        return userId;
                    }
                }
            } catch (error) {
                // fallback below
            }

            try {
                const { data, error } = await supabase.auth.getSession();
                const userId = String(data?.session?.user?.id || '').trim();
                if (!error && userId) {
                    persistResolvedSupabaseUserId(userId);
                    return userId;
                }
            } catch (error) {
                // fallback below
            }

            try {
                const currentUser = window.auth && typeof window.auth.getCurrentUser === 'function'
                    ? window.auth.getCurrentUser()
                    : null;
                const email = String(currentUser && currentUser.email || '').trim().toLowerCase();
                if (!email) return null;
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', email)
                    .maybeSingle();
                if (!error && data && data.id) {
                    const resolvedId = String(data.id).trim();
                    persistResolvedSupabaseUserId(resolvedId);
                    return resolvedId;
                }
            } catch (error) {
                // ignore
            }

            try {
                const currentUser = window.auth && typeof window.auth.getCurrentUser === 'function'
                    ? window.auth.getCurrentUser()
                    : null;
                const displayName = String(currentUser && currentUser.name || '').trim();
                if (!displayName) return null;
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('display_name', displayName)
                    .limit(1);
                if (!error && Array.isArray(data) && data[0] && data[0].id) {
                    const resolvedId = String(data[0].id).trim();
                    persistResolvedSupabaseUserId(resolvedId);
                    return resolvedId;
                }
            } catch (error) {
                // ignore
            }

            return null;
        }

        async function fetchProfilesMapByIds(userIds) {
            const supabase = getSupabaseClient();
            const ids = Array.from(new Set((userIds || []).filter(Boolean)));
            const map = new Map();
            if (!supabase || !ids.length) return map;

            const { data, error } = await supabase
                .from('profiles')
                .select('id, display_name')
                .in('id', ids);

            if (error || !Array.isArray(data)) return map;

            data.forEach((row) => {
                if (!row || !row.id) return;
                map.set(row.id, String(row.display_name || '').trim());
            });

            return map;
        }

        async function fetchSupabaseTools() {
            const supabase = getSupabaseClient();
            if (!supabase) return { ok: false, tools: [] };

            const { data, error } = await supabase
                .from('tools')
                .select('id, author_id, name, age, steps_json, created_at')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erreur chargement outils (Supabase):', error.message);
                return { ok: false, tools: [] };
            }

            const rows = Array.isArray(data) ? data : [];
            const authorIds = rows.map((row) => row.author_id).filter(Boolean);
            const profilesMap = await fetchProfilesMapByIds(authorIds);

            const tools = rows.map((row) => {
                let steps = [];
                if (Array.isArray(row.steps_json)) {
                    steps = row.steps_json;
                } else if (typeof row.steps_json === 'string') {
                    try {
                        const parsed = JSON.parse(row.steps_json);
                        steps = Array.isArray(parsed) ? parsed : [];
                    } catch (error) {
                        steps = [];
                    }
                }

                return {
                    id: Number(row.id),
                    name: String(row.name || ''),
                    age: String(row.age || ''),
                    steps,
                    authorId: row.author_id || null,
                    author: profilesMap.get(row.author_id) || 'Anonyme',
                    createdAt: row.created_at || new Date().toISOString()
                };
            });

            return { ok: true, tools };
        }

        function readTools() {
            if (isSupabaseReady() && runtimeToolsLoaded) {
                return runtimeTools;
            }

            if (Array.isArray(runtimeTools) && runtimeTools.length) {
                return runtimeTools;
            }

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
            runtimeTools = Array.isArray(tools) ? tools : [];
            runtimeToolsLoaded = true;

            if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
                window.dataStore.writeArray(toolsKey, tools);
                return;
            }

            localStorage.setItem(toolsKey, JSON.stringify(tools));
        }

        function isQuotaExceededError(error) {
            if (!error) return false;
            return error.name === 'QuotaExceededError' ||
                error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                String(error.message || '').toLowerCase().includes('quota');
        }

        function compressImageFile(file, options = {}) {
            const maxDimension = options.maxDimension || 1280;
            const quality = options.quality || 0.75;
            const outputType = options.outputType || 'image/jpeg';

            return new Promise((resolve, reject) => {
                const reader = new FileReader();

                reader.onerror = () => reject(new Error('read_failed'));
                reader.onload = function (event) {
                    const img = new Image();
                    img.onerror = () => reject(new Error('image_decode_failed'));
                    img.onload = function () {
                        const originalWidth = img.width || 1;
                        const originalHeight = img.height || 1;
                        const largestSide = Math.max(originalWidth, originalHeight);
                        const ratio = largestSide > maxDimension ? (maxDimension / largestSide) : 1;
                        const width = Math.max(1, Math.round(originalWidth * ratio));
                        const height = Math.max(1, Math.round(originalHeight * ratio));

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;

                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            reject(new Error('canvas_context_unavailable'));
                            return;
                        }

                        ctx.drawImage(img, 0, 0, width, height);

                        try {
                            const dataUrl = canvas.toDataURL(outputType, quality);
                            resolve(dataUrl);
                        } catch (error) {
                            reject(error);
                        }
                    };

                    img.src = event.target.result;
                };

                reader.readAsDataURL(file);
            });
        }

        // ==================== GESTION DES ÉTAPES ====================
        function addStep() {
            const stepsContainer = document.getElementById('steps-container');
            const stepIndex = stepsContainer.children.length + 1;
            
            const stepDiv = document.createElement('div');
            stepDiv.className = 'step-group';
            stepDiv.dataset.index = stepIndex;

            stepDiv.innerHTML = `
                <h3>Étape ${stepIndex}</h3>
                <div class="form-group">
                    <textarea name="step-description" placeholder="Description de l'étape ${stepIndex}..." required></textarea>
                </div>
                <div class="form-group">
                    <label for="step-image-${stepIndex}" class="file-label">Ajouter des images</label>
                    <input type="file" id="step-image-${stepIndex}" name="step-images" multiple accept="image/*" required>
                </div>
                <div id="image-preview-${stepIndex}" class="image-preview-container"></div>
            `;
            stepsContainer.appendChild(stepDiv);
            
            // Écouteur d'événement pour le champ de fichier de cette nouvelle étape
            document.getElementById(`step-image-${stepIndex}`).addEventListener('change', function(e) {
                handleImageSelection(e, `image-preview-${stepIndex}`);
            });

            if (!isUserLoggedIn()) {
                const stepTextarea = stepDiv.querySelector('textarea[name="step-description"]');
                const stepImageInput = stepDiv.querySelector('input[type="file"]');
                if (stepTextarea) stepTextarea.disabled = true;
                if (stepImageInput) stepImageInput.disabled = true;
            }
        }
        
        // Ajoute la première étape au chargement de la page
        document.addEventListener('DOMContentLoaded', () => {
            addStep();
        });

        document.getElementById('add-step-btn').addEventListener('click', addStep);

        function applyGuestRestrictions() {
            const nativePublishBtn = document.getElementById('appNativeToolsPublishBtn');
            if (isUserLoggedIn()) return;

            const addToolSection = document.querySelector('.add-tool-section');
            const addToolForm = document.getElementById('addToolForm');
            const addStepButton = document.getElementById('add-step-btn');

            if (addToolForm) {
                addToolForm.querySelectorAll('input, textarea, button').forEach((field) => {
                    field.disabled = true;
                });
            }

            if (addStepButton) {
                addStepButton.disabled = true;
            }

            if (addToolSection && !document.getElementById('guestNoticeOutils')) {
                const notice = document.createElement('p');
                notice.id = 'guestNoticeOutils';
                notice.textContent = "Mode invité: consultation uniquement (ajout/suppression d'outils désactivés).";
                notice.style.marginTop = '0.8rem';
                notice.style.fontWeight = '700';
                notice.style.color = '#7a3f00';
                addToolSection.appendChild(notice);
            }

            if (nativePublishBtn) {
                nativePublishBtn.disabled = true;
                nativePublishBtn.style.opacity = '0.6';
            }
        }

        // ==================== GESTION DES IMAGES (avec compression) ====================
        function handleImageSelection(e, previewId) {
            const files = Array.from(e.target.files);
            const previewContainer = document.getElementById(previewId);
            if (!previewContainer) return;
            
            // On gère les images par étape, pas toutes en même temps
            previewContainer.innerHTML = '';
            
            files.forEach(file => {
                compressImageFile(file).then((dataURL) => {
                    const previewImg = document.createElement('img');
                    previewImg.src = dataURL;
                    previewImg.className = 'image-preview-thumb';
                    previewContainer.appendChild(previewImg);
                }).catch(() => {
                    alert("Une image n'a pas pu être lue. Essayez une autre image.");
                });
            });
            previewContainer.style.display = 'flex';
        }

        // ==================== GESTION DES OUTILS ====================
        document.getElementById('addToolForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const userName = getCurrentUserName();

            if (!userName) {
                alert("Vous devez être connecté pour ajouter un outil.");
                return;
            }

            const toolName = this.querySelector('[name="name"]').value;
            const toolAge = this.querySelector('[name="age"]').value;

            const steps = [];
            const stepElements = document.querySelectorAll('.step-group');
            let hasInvalidStep = false;
            const orderedSteps = new Array(stepElements.length);

            const allImagesPromises = [];

            stepElements.forEach((stepElement, index) => {
                const description = stepElement.querySelector('textarea[name="step-description"]').value;
                const imageInput = stepElement.querySelector('input[type="file"]');
                const files = Array.from(imageInput.files);
                const cacheInput = stepElement.querySelector('input[name="step-images-cache"]');
                let cachedImages = [];
                if (cacheInput && cacheInput.value) {
                    try {
                        const parsed = JSON.parse(cacheInput.value);
                        cachedImages = Array.isArray(parsed) ? parsed.map((img) => sanitizeImageSrc(img)).filter(Boolean) : [];
                    } catch (error) {
                        cachedImages = [];
                    }
                }

                if (description.trim() === "" || (files.length === 0 && cachedImages.length === 0)) {
                    alert(`Veuillez remplir la description et ajouter une image pour l'étape ${index + 1}.`);
                    hasInvalidStep = true;
                    return;
                }

                if (files.length > 0) {
                    const imagePromises = files.map(file => compressImageFile(file));
                    allImagesPromises.push(Promise.all(imagePromises).then(imagesBase64 => {
                        orderedSteps[index] = { description, images: imagesBase64 };
                    }));
                    return;
                }

                orderedSteps[index] = { description, images: cachedImages };
            });

            if (hasInvalidStep) {
                return;
            }

            try {
                await Promise.all(allImagesPromises);

                orderedSteps.forEach((step) => {
                    if (step) {
                        steps.push(step);
                    }
                });

                const newTool = {
                    name: toolName,
                    age: toolAge,
                    steps: steps,
                    author: userName
                };

                const savedTool = await saveToolToStorage(newTool);
                if (!savedTool) {
                    alert("Impossible d'ajouter cet outil pour le moment.");
                    return;
                }

                addNewToolToDOM(savedTool);
                this.reset();
                const stepsContainer = document.getElementById('steps-container');
                stepsContainer.innerHTML = ''; // Nettoie les étapes
                addStep(); // Ajoute une nouvelle étape vide
                if (isNativeAppRuntime()) {
                    closeNativeToolsCreatePanel();
                }
            } catch (error) {
                console.error("Erreur lors du traitement des images:", error);
                if (isQuotaExceededError(error)) {
                    alert("Stockage plein: réduisez la taille/nombre d'images ou supprimez d'anciens contenus.");
                    return;
                }
                alert("Une erreur est survenue lors du traitement des images.");
            }
        });

        function addNewToolToDOM(toolData, options = {}) {
            const toolsGrid = document.getElementById('tools-grid');
            if (!toolsGrid) return;
            const shouldPrepend = options.prepend !== false;

            const toolCard = document.createElement('div');
            toolCard.className = 'tool-card';
            toolCard.dataset.id = toolData.id;

            const canDelete = canDeleteByAuthor(toolData.author);
            const toolId = Number(toolData.id);
            const deleteButton = canDelete ? `
                <button class="delete-btn" onclick="deleteTool(event, ${Number.isFinite(toolId) ? toolId : 0})">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            ` : '';
            
            const firstStepImages = toolData.steps && toolData.steps.length > 0 ? toolData.steps[0].images : [];
            const safeImage = sanitizeImageSrc(firstStepImages[0]);
            const safeName = escapeHtml(toolData.name || 'Sans titre');
            const safeDescription = escapeHtml(toolData.steps && toolData.steps.length > 0 ? toolData.steps[0].description : 'Pas de description');
            const safeAge = escapeHtml(toolData.age || 'Non précisé');
            const safeLinkId = encodeURIComponent(String(toolData.id || ''));
            const imagePreview = safeImage
                ? `<img src="${safeImage}" alt="${safeName}" class="tool-image" loading="lazy" decoding="async" fetchpriority="low">`
                : '';
            const favoritePayload = getToolFavoritePayload(toolData);
            const isFavorited = favoritePayload && window.userFavorites && typeof window.userFavorites.isFavorite === 'function'
                ? window.userFavorites.isFavorite(favoritePayload.source, favoritePayload.itemId)
                : false;
            const favoriteLabel = getToolFavoriteButtonLabel(isFavorited);
            const favoriteStateClass = isFavorited ? 'is-active' : '';
            
            toolCard.innerHTML = `
                <a href="detail-outil.html?id=${safeLinkId}" class="tool-link">
                    ${imagePreview}
                    <h3>${safeName}</h3>
                </a>
                <p>${safeDescription}</p>
                <span class="age">Âge: ${safeAge}</span>
                <div class="tool-actions">
                    <button class="tool-action-btn tool-favorite-btn ${favoriteStateClass}" onclick="toggleToolFavorite(event, ${Number.isFinite(toolId) ? toolId : 0}, this)">
                        ${favoriteLabel}
                    </button>
                    <button class="tool-action-btn tool-print-btn" onclick="printTool(${Number.isFinite(toolId) ? toolId : 0})">
                        🖨️ Imprimer
                    </button>
                </div>
                ${deleteButton}
            `;

            if (shouldPrepend) {
                toolsGrid.prepend(toolCard);
            } else {
                toolsGrid.appendChild(toolCard);
            }
        }

        function renderToolsListWithBatch(savedTools) {
            const toolsGrid = document.getElementById('tools-grid');
            if (!toolsGrid) return;

            const tools = Array.isArray(savedTools) ? savedTools : [];
            nativeToolsRenderToken += 1;
            const token = nativeToolsRenderToken;

            renderToolsSkeleton(toolsGrid, isNativeAppRuntime() ? 4 : 3);
            window.setTimeout(() => {
                if (token !== nativeToolsRenderToken) return;

                toolsGrid.innerHTML = '';
                if (!tools.length) return;

                if (!isNativeAppRuntime() || tools.length <= NATIVE_TOOLS_INITIAL_BATCH) {
                    tools.forEach((tool) => addNewToolToDOM(tool, { prepend: false }));
                    return;
                }

                let cursor = 0;
                const appendBatch = (batchSize) => {
                    if (token !== nativeToolsRenderToken) return;
                    const limit = Math.min(tools.length, cursor + batchSize);
                    while (cursor < limit) {
                        addNewToolToDOM(tools[cursor], { prepend: false });
                        cursor += 1;
                    }

                    if (cursor >= tools.length) return;
                    window.requestAnimationFrame(() => appendBatch(NATIVE_TOOLS_BATCH));
                };

                appendBatch(NATIVE_TOOLS_INITIAL_BATCH);
            }, 0);
        }

        async function saveToolToStorage(newTool) {
            if (isSupabaseReady()) {
                const supabase = getSupabaseClient();
                const authorId = await getCurrentSupabaseUserId();
                if (!supabase || !authorId) return null;

                const normalizedSteps = await normalizeToolStepsForStorage(newTool?.steps);

                const payload = {
                    author_id: authorId,
                    name: String(newTool?.name || '').trim(),
                    age: String(newTool?.age || '').trim(),
                    steps_json: normalizedSteps
                };

                const { data, error } = await supabase
                    .from('tools')
                    .insert(payload)
                    .select('id, created_at')
                    .single();

                if (error) {
                    console.error('Erreur ajout outil (Supabase):', error.message);
                    return null;
                }

                const savedTool = {
                    ...newTool,
                    steps: normalizedSteps,
                    id: Number(data?.id) || Date.now(),
                    createdAt: data?.created_at || new Date().toISOString(),
                    authorId: authorId
                };

                const tools = readTools();
                tools.unshift(savedTool);
                writeTools(tools);
                return savedTool;
            }

            let tools = readTools();

            // Si l'ancien stockage était un objet unique, on le convertit en tableau
            if (!Array.isArray(tools)) tools = [tools];

            const localTool = {
                ...newTool,
                id: Date.now()
            };

            tools.unshift(localTool);
            writeTools(tools);
            return localTool;
        }

        function getToolById(toolId) {
            const id = Number(toolId);
            if (!Number.isFinite(id)) return null;

            const tools = readTools();
            return tools.find((tool) => Number(tool?.id) === id) || null;
        }

        function getToolFavoritePayload(tool) {
            const toolId = Number(tool?.id);
            if (!Number.isFinite(toolId)) return null;

            return {
                source: 'tool',
                itemId: String(toolId),
                title: String(tool?.name || 'Outil').trim() || 'Outil',
                href: `detail-outil.html?id=${encodeURIComponent(toolId)}`
            };
        }

        function getToolFavoriteButtonLabel(isFavorited) {
            return isFavorited ? '★ Retirer' : '☆ Favori';
        }

        function toggleToolFavorite(event, toolId, buttonEl) {
            event.preventDefault();
            event.stopPropagation();

            if (!window.userFavorites || typeof window.userFavorites.toggleFavorite !== 'function') {
                return;
            }

            if (!isUserLoggedIn()) {
                alert('Connectez-vous pour ajouter cet outil aux favoris.');
                return;
            }

            const tool = getToolById(toolId);
            if (!tool) return;

            const payload = getToolFavoritePayload(tool);
            if (!payload) return;

            const result = window.userFavorites.toggleFavorite(payload);
            if (!result.ok) return;

            const isFavorited = !!result.favorited;
            if (buttonEl) {
                buttonEl.textContent = getToolFavoriteButtonLabel(isFavorited);
                buttonEl.classList.toggle('is-active', isFavorited);
            }
        }

        function printTool(toolId) {
            const tool = getToolById(toolId);
            if (!tool) {
                alert("Impossible d'imprimer: outil introuvable.");
                return;
            }

            const printWindow = window.open('', '_blank', 'width=960,height=760');
            if (!printWindow) {
                alert("L'ouverture de la fenêtre d'impression a été bloquée.");
                return;
            }

            const safeToolName = escapeHtml(tool.name || "Fiche outil");
            const safeAge = escapeHtml(tool.age || 'Non précisé');
            const safeAuthor = escapeHtml(tool.author || 'Anonyme');
            const steps = Array.isArray(tool.steps) ? tool.steps : [];

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


        async function deleteTool(event, toolId) {
            event.stopPropagation();
            
            const id = Number(toolId);
            const tools = readTools();
            const toolToDelete = tools.find(t => Number(t.id) === id);

            if (!toolToDelete) {
                alert("Cet outil n'existe plus.");
                return;
            }
            
            const canDelete = canDeleteByAuthor(toolToDelete.author);

            if (!canDelete) {
                alert("Vous n'avez pas les autorisations pour supprimer cet outil.");
                return;
            }

            if (confirm('Êtes-vous sûr de vouloir supprimer cet outil ?')) {
                if (isSupabaseReady()) {
                    const supabase = getSupabaseClient();
                    const { error } = await supabase
                        .from('tools')
                        .delete()
                        .eq('id', id);

                    if (error) {
                        alert("Suppression impossible pour le moment.");
                        return;
                    }
                }
                
                const updatedTools = tools.filter(tool => Number(tool.id) !== id);
                writeTools(updatedTools);

                const toolElement = document.querySelector(`.tool-card[data-id="${id}"]`);
                if (toolElement) {
                    toolElement.remove();
                }
            }
        }

document.addEventListener('DOMContentLoaded', async function() {
    initNativeToolsExperience();
    applyGuestRestrictions();

    let savedTools = readTools();
    if (isSupabaseReady()) {
        const supabaseResult = await fetchSupabaseTools();
        if (supabaseResult.ok) {
            savedTools = supabaseResult.tools;
            writeTools(savedTools);
        }
    }

    renderToolsListWithBatch(savedTools);

    // Active la recherche
    document.getElementById('tool-search').addEventListener('input', function () {
        const query = this.value.toLowerCase().trim();
        const toolCards = document.querySelectorAll('.tool-card');

        toolCards.forEach(card => {
            const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
            const age = card.querySelector('.age')?.textContent.toLowerCase() || '';
            card.style.display = (title.includes(query) || age.includes(query)) ? '' : 'none';
        });
    });

    updateNativeToolsDrawerLinks();
});
