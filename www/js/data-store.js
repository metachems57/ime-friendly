(function () {
    const KEYS = Object.freeze({
        users: 'users',
        reseauPosts: 'reseauposts',
        blogPosts: 'blogposts',
        tools: 'tools',
        userFavorites: 'userFavorites',
        activityNotifications: 'activityNotifications',
        privateMessages: 'privateMessages',
        messageReports: 'messageReports',
        messagingBlocks: 'messagingBlocks'
    });

    function readArray(key) {
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function writeArray(key, value) {
        if (!Array.isArray(value)) return;
        localStorage.setItem(key, JSON.stringify(value));
    }

    function readObject(key) {
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (error) {
            return {};
        }
    }

  function writeObject(key, value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        localStorage.setItem(key, JSON.stringify(value));
    }

    function readValue(key, fallbackValue = null) {
        const value = localStorage.getItem(key);
        return value === null ? fallbackValue : value;
    }

    function writeValue(key, value) {
        if (value === undefined) return;
        localStorage.setItem(key, String(value));
    }

    window.dataStore = {
        KEYS,
        readArray,
        writeArray,
        readObject,
        writeObject,
        readValue,
        writeValue
    };
})();
