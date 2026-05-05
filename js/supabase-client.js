(function () {
    const SUPABASE_URL = 'https://eecejwuqsmgavtitbjou.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_MFmzOb6ErxcyWgxDqcn0kw_0_UfsI6F';
    let client = null;
    let lastReason = '';

    function resolveClient() {
        if (client) return client;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            lastReason = 'missing_config';
            return null;
        }

        if (SUPABASE_URL.includes('COLLE_ICI') || SUPABASE_ANON_KEY.includes('COLLE_ICI')) {
            lastReason = 'placeholder_config';
            return null;
        }

        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            lastReason = 'sdk_not_loaded';
            return null;
        }

        try {
            client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            lastReason = '';
            return client;
        } catch (error) {
            lastReason = `create_failed:${String(error?.message || 'unknown')}`;
            return null;
        }
    }

    window.supabaseClient = {
        getClient() {
            return resolveClient();
        },
        isReady() {
            return !!resolveClient();
        },
        getStatus() {
            const sdkLoaded = !!(window.supabase && typeof window.supabase.createClient === 'function');
            const currentClient = resolveClient();
            return {
                ready: !!currentClient,
                sdkLoaded,
                reason: lastReason || (currentClient ? 'ok' : 'unknown')
            };
        }
    };
})();
