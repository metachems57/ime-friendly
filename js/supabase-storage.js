(() => {
    function getClient() {
        if (!window.supabaseClient || typeof window.supabaseClient.getClient !== 'function') {
            return null;
        }
        return window.supabaseClient.getClient();
    }

    function randomId() {
        return Math.random().toString(36).slice(2, 10);
    }

    function getExtensionFromMime(mimeType) {
        const mime = String(mimeType || '').toLowerCase();
        if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
        if (mime.includes('png')) return 'png';
        if (mime.includes('webp')) return 'webp';
        if (mime.includes('gif')) return 'gif';
        if (mime.includes('heic')) return 'heic';
        if (mime.includes('heif')) return 'heif';
        return 'bin';
    }

    async function getCurrentUserId(supabase) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data || !data.user || !data.user.id) return '';
        return String(data.user.id);
    }

    async function dataUrlToBlob(dataUrl) {
        const value = String(dataUrl || '');
        if (!value.startsWith('data:')) {
            throw new Error('invalid_data_url');
        }

        const response = await fetch(value);
        return response.blob();
    }

    async function uploadFile(fileOrBlob, options = {}) {
        const supabase = getClient();
        if (!supabase) return { ok: false, reason: 'supabase_unavailable' };

        const bucket = String(options.bucket || '').trim();
        if (!bucket) return { ok: false, reason: 'bucket_required' };

        const userId = await getCurrentUserId(supabase);
        if (!userId) return { ok: false, reason: 'not_logged_in' };

        const blob = fileOrBlob;
        const mimeType = String(options.contentType || blob?.type || 'application/octet-stream');
        const ext = String(options.extension || getExtensionFromMime(mimeType)).replace(/[^a-z0-9]/gi, '') || 'bin';
        const folder = String(options.folder || '').trim().replace(/^\/+|\/+$/g, '');
        const baseName = String(options.fileNamePrefix || 'media').replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'media';
        const pathParts = [userId];
        if (folder) pathParts.push(folder);
        pathParts.push(`${baseName}-${Date.now()}-${randomId()}.${ext}`);
        const objectPath = pathParts.join('/');

        const { error: uploadError } = await supabase
            .storage
            .from(bucket)
            .upload(objectPath, blob, {
                cacheControl: '3600',
                contentType: mimeType,
                upsert: false
            });

        if (uploadError) {
            return { ok: false, reason: 'upload_failed', error: uploadError.message || 'upload_failed' };
        }

        const { data: publicUrlData } = supabase
            .storage
            .from(bucket)
            .getPublicUrl(objectPath);

        const publicUrl = String(publicUrlData?.publicUrl || '');
        if (!publicUrl) {
            return { ok: false, reason: 'url_unavailable' };
        }

        return {
            ok: true,
            bucket,
            path: objectPath,
            url: publicUrl
        };
    }

    async function uploadDataUrl(dataUrl, options = {}) {
        const blob = await dataUrlToBlob(dataUrl);
        return uploadFile(blob, {
            ...options,
            contentType: blob.type || options.contentType
        });
    }

    window.supabaseStorage = {
        isReady() {
            return !!getClient();
        },
        uploadFile,
        uploadDataUrl
    };
})();

