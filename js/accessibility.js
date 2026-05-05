(function initAccessibilityModule() {
    const STORAGE_KEY = 'a11yPreferences';
    const TEXT_SCALE_CLASSES = ['a11y-text-110', 'a11y-text-120', 'a11y-text-130'];
    const TOGGLE_CLASSES = {
        highContrast: 'a11y-high-contrast',
        spacious: 'a11y-spacious',
        readableFont: 'a11y-readable-font',
        reduceMotion: 'a11y-reduce-motion'
    };

    const DEFAULT_PREFERENCES = {
        textScale: 100,
        highContrast: false,
        spacious: false,
        readableFont: false,
        reduceMotion: false
    };

    function normalizeTextScale(value) {
        const allowed = [100, 110, 120, 130];
        const parsed = Number(value);
        return allowed.includes(parsed) ? parsed : 100;
    }

    function readPreferences() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return {
                textScale: normalizeTextScale(parsed.textScale),
                highContrast: !!parsed.highContrast,
                spacious: !!parsed.spacious,
                readableFont: !!parsed.readableFont,
                reduceMotion: !!parsed.reduceMotion
            };
        } catch (error) {
            return { ...DEFAULT_PREFERENCES };
        }
    }

    function writePreferences(preferences) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        } catch (error) {
            // Ignorer les erreurs de quota ou mode prive.
        }
    }

    function applyPreferences(preferences) {
        const root = document.documentElement;

        TEXT_SCALE_CLASSES.forEach((className) => root.classList.remove(className));
        if (preferences.textScale !== 100) {
            root.classList.add(`a11y-text-${preferences.textScale}`);
        }

        Object.entries(TOGGLE_CLASSES).forEach(([key, className]) => {
            root.classList.toggle(className, !!preferences[key]);
        });
    }

    function createSwitchRow(id, label, checked) {
        const row = document.createElement('label');
        row.className = 'a11y-switch';
        row.setAttribute('for', id);

        const text = document.createElement('span');
        text.textContent = label;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = checked;

        row.appendChild(text);
        row.appendChild(input);

        return { row, input };
    }

    function resolveHeaderTarget() {
        const reseauLeftLinks = document.querySelector('.header-nav .header-left-links');
        if (reseauLeftLinks) {
            const reseauLeftBottom = document.querySelector('.header-nav .header-left-bottom');
            const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
            if (isMobile && reseauLeftBottom) return reseauLeftBottom;
            return reseauLeftLinks;
        }

        const path = window.location.pathname || '';
        const isHomePage = path.endsWith('/index.html') || path.endsWith('index.html') || path === '/' || path === '';
        const isDesktop = window.matchMedia && window.matchMedia('(min-width: 769px)').matches;
        const homeNavBlock = document.getElementById('homeNavBlock');
        if (isHomePage && isDesktop && homeNavBlock) return homeNavBlock;

        const headerNavLinks = document.querySelector('.header-nav .nav-links');
        if (headerNavLinks) return headerNavLinks;

        const homepageHeader = document.querySelector('header .header-h1');
        if (homepageHeader) return homepageHeader;

        const genericNav = document.querySelector('header nav');
        if (genericNav) return genericNav;

        return document.querySelector('header');
    }

    function mountAccessibilityUI() {
        if (!document.body) return;
        if (document.getElementById('a11yToggleBtn')) return;

        const target = resolveHeaderTarget();
        if (!target) return;

        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'a11y-toggle-btn';
        toggleButton.id = 'a11yToggleBtn';
        toggleButton.textContent = 'Accessibilité';
        toggleButton.setAttribute('aria-haspopup', 'dialog');
        toggleButton.setAttribute('aria-expanded', 'false');

        if (window.location.pathname.endsWith('/blog.html') || window.location.pathname.endsWith('blog.html')) {
            toggleButton.classList.add('a11y-toggle-btn--blog');
        }

        if (window.location.pathname.endsWith('/reseau.html') || window.location.pathname.endsWith('reseau.html')) {
            toggleButton.classList.add('a11y-toggle-btn--reseau');
        }

        if (
            window.location.pathname.endsWith('/outils.html') ||
            window.location.pathname.endsWith('outils.html') ||
            window.location.pathname.endsWith('/detail-outil.html') ||
            window.location.pathname.endsWith('detail-outil.html')
        ) {
            toggleButton.classList.add('a11y-toggle-btn--outils');
        }

        target.appendChild(toggleButton);

        const panel = document.createElement('section');
        panel.className = 'a11y-panel';
        panel.id = 'a11yPanel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');
        panel.setAttribute('aria-label', "Options d'accessibilité");
        panel.hidden = true;

        panel.innerHTML = `
            <div class="a11y-panel-header">
                <h2>Accessibilité</h2>
                <p>Adaptez l affichage a vos besoins.</p>
            </div>
            <div class="a11y-panel-body">
                <div class="a11y-row">
                    <label for="a11yTextScale">Taille du texte</label>
                    <input id="a11yTextScale" type="range" min="100" max="130" step="10" value="100">
                </div>
            </div>
            <div class="a11y-panel-footer">
                <button type="button" class="a11y-reset-btn" id="a11yResetBtn">Reinitialiser</button>
                <button type="button" class="a11y-close-btn" id="a11yCloseBtn">Fermer</button>
            </div>
        `;

        const panelBody = panel.querySelector('.a11y-panel-body');
        const textScaleInput = panel.querySelector('#a11yTextScale');
        const resetButton = panel.querySelector('#a11yResetBtn');
        const closeButton = panel.querySelector('#a11yCloseBtn');

        const highContrast = createSwitchRow('a11yHighContrast', 'Contraste eleve', false);
        const spacious = createSwitchRow('a11ySpacious', 'Espacement augmente', false);
        const readableFont = createSwitchRow('a11yReadableFont', 'Police plus lisible', false);
        const reduceMotion = createSwitchRow('a11yReduceMotion', 'Reduire les animations', false);

        panelBody.appendChild(highContrast.row);
        panelBody.appendChild(spacious.row);
        panelBody.appendChild(readableFont.row);
        panelBody.appendChild(reduceMotion.row);

        document.body.appendChild(panel);

        let preferences = readPreferences();

        function syncControls() {
            textScaleInput.value = String(preferences.textScale);
            highContrast.input.checked = preferences.highContrast;
            spacious.input.checked = preferences.spacious;
            readableFont.input.checked = preferences.readableFont;
            reduceMotion.input.checked = preferences.reduceMotion;
        }

        function commit(nextPreferences) {
            preferences = {
                textScale: normalizeTextScale(nextPreferences.textScale),
                highContrast: !!nextPreferences.highContrast,
                spacious: !!nextPreferences.spacious,
                readableFont: !!nextPreferences.readableFont,
                reduceMotion: !!nextPreferences.reduceMotion
            };

            writePreferences(preferences);
            applyPreferences(preferences);
            syncControls();
        }

        function positionPanelNearToggle() {
            const gap = 8;
            const viewportMargin = 10;
            const toggleRect = toggleButton.getBoundingClientRect();
            const panelWidth = panel.offsetWidth || 360;
            const panelHeight = panel.offsetHeight || 420;

            let left = toggleRect.left;
            const maxLeft = window.innerWidth - panelWidth - viewportMargin;
            if (left > maxLeft) left = maxLeft;
            if (left < viewportMargin) left = viewportMargin;

            let top = toggleRect.bottom + gap;
            const maxTop = window.innerHeight - panelHeight - viewportMargin;
            if (top > maxTop) {
                const above = toggleRect.top - panelHeight - gap;
                top = above >= viewportMargin ? above : Math.max(viewportMargin, maxTop);
            }

            panel.style.right = 'auto';
            panel.style.left = `${Math.round(left)}px`;
            panel.style.top = `${Math.round(top)}px`;
        }

        function openPanel() {
            panel.hidden = false;
            toggleButton.setAttribute('aria-expanded', 'true');
            requestAnimationFrame(() => {
                positionPanelNearToggle();
                textScaleInput.focus();
            });
        }

        function closePanel() {
            panel.hidden = true;
            toggleButton.setAttribute('aria-expanded', 'false');
        }

        toggleButton.addEventListener('click', () => {
            if (panel.hidden) {
                openPanel();
            } else {
                closePanel();
            }
        });

        closeButton.addEventListener('click', closePanel);

        textScaleInput.addEventListener('input', () => {
            commit({ ...preferences, textScale: Number(textScaleInput.value) });
        });

        highContrast.input.addEventListener('change', () => {
            commit({ ...preferences, highContrast: highContrast.input.checked });
        });

        spacious.input.addEventListener('change', () => {
            commit({ ...preferences, spacious: spacious.input.checked });
        });

        readableFont.input.addEventListener('change', () => {
            commit({ ...preferences, readableFont: readableFont.input.checked });
        });

        reduceMotion.input.addEventListener('change', () => {
            commit({ ...preferences, reduceMotion: reduceMotion.input.checked });
        });

        resetButton.addEventListener('click', () => {
            commit({ ...DEFAULT_PREFERENCES });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !panel.hidden) {
                closePanel();
            }
        });

        document.addEventListener('click', (event) => {
            if (panel.hidden) return;
            const clickedInsidePanel = panel.contains(event.target);
            const clickedToggle = toggleButton.contains(event.target);
            if (!clickedInsidePanel && !clickedToggle) {
                closePanel();
            }
        });

        window.addEventListener('resize', () => {
            if (panel.hidden) return;
            positionPanelNearToggle();
        });

        window.addEventListener('scroll', () => {
            if (panel.hidden) return;
            positionPanelNearToggle();
        });

        applyPreferences(preferences);
        syncControls();
    }

    applyPreferences(readPreferences());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountAccessibilityUI);
    } else {
        mountAccessibilityUI();
    }
})();
