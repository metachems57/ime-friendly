function getResourcesCatalog() {
    if (Array.isArray(window.imeResources)) {
        return window.imeResources;
    }
    return [];
}

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

function buildResourceCard(resource) {
    const card = document.createElement('a');
    card.className = 'resource-page-card';
    card.href = resource.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.setAttribute('aria-label', `${resource.title} (ouvre un nouvel onglet)`);

    const image = document.createElement('img');
    image.className = 'resource-page-image';
    image.src = resource.image;
    image.alt = `Logo ${resource.title}`;
    image.loading = 'lazy';

    const content = document.createElement('div');
    content.className = 'resource-page-content';

    const title = document.createElement('h3');
    title.className = 'resource-page-title';
    title.textContent = resource.title;

    const description = document.createElement('p');
    description.className = 'resource-page-description';
    description.textContent = resource.description;

    const action = document.createElement('span');
    action.className = 'resource-page-action';
    action.textContent = 'Visiter le site';

    content.appendChild(title);
    content.appendChild(description);
    content.appendChild(action);

    card.appendChild(image);
    card.appendChild(content);

    return card;
}

function renderResourcesGrid() {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;

    const resources = getResourcesCatalog();
    grid.innerHTML = '';

    if (resources.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'resources-empty';
        empty.textContent = 'Aucune ressource disponible pour le moment.';
        grid.appendChild(empty);
        return;
    }

    resources.forEach((resource) => {
        grid.appendChild(buildResourceCard(resource));
    });

    if (isNativeAppRuntime()) {
        initNativeInfiniteCarousel(grid);
    }
}

function initNativeInfiniteCarousel(grid) {
    const cards = Array.from(grid.querySelectorAll('.resource-page-card'));
    if (cards.length <= 1) return;

    const firstClone = cards[0].cloneNode(true);
    const lastClone = cards[cards.length - 1].cloneNode(true);
    firstClone.dataset.carouselClone = 'first';
    lastClone.dataset.carouselClone = 'last';

    grid.insertBefore(lastClone, cards[0]);
    grid.appendChild(firstClone);

    const allCards = Array.from(grid.querySelectorAll('.resource-page-card'));
    const firstRealCard = allCards[1];
    const lastRealCard = allCards[allCards.length - 2];
    const firstCloneCard = allCards[allCards.length - 1];

    let isAdjusting = false;

    const jumpToCard = (cardNode) => {
        if (!cardNode) return;
        isAdjusting = true;
        grid.scrollTo({ left: cardNode.offsetLeft, behavior: 'auto' });
        requestAnimationFrame(() => {
            isAdjusting = false;
        });
    };

    requestAnimationFrame(() => {
        jumpToCard(firstRealCard);
    });

    const handleScroll = () => {
        if (isAdjusting) return;
        const x = grid.scrollLeft;
        const firstRealX = firstRealCard.offsetLeft;
        const firstCloneX = firstCloneCard.offsetLeft;

        if (x <= firstRealX - 8) {
            jumpToCard(lastRealCard);
            return;
        }

        if (x >= firstCloneX - 8) {
            jumpToCard(firstRealCard);
        }
    };

    grid.addEventListener('scroll', handleScroll, { passive: true });
}

document.addEventListener('DOMContentLoaded', async () => {
    renderResourcesGrid();
});
