(function () {
    const STORAGE_KEY = 'imeOfflineActionQueueV1';
    const MAX_RETRY_COUNT = 12;
    const BASE_RETRY_DELAY_MS = 2500;

    const processors = new Map();
    let flushInFlight = null;
    let scheduledFlushTimer = null;

    function readQueue() {
        if (window.dataStore && typeof window.dataStore.readArray === 'function') {
            return window.dataStore.readArray(STORAGE_KEY);
        }

        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function writeQueue(queue) {
        if (!Array.isArray(queue)) return;

        if (window.dataStore && typeof window.dataStore.writeArray === 'function') {
            window.dataStore.writeArray(STORAGE_KEY, queue);
            return;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }

    function notifyQueueChange(queue) {
        const total = Array.isArray(queue) ? queue.length : readQueue().length;
        window.dispatchEvent(new CustomEvent('ime:offline-queue-updated', {
            detail: { total }
        }));
    }

    function isLikelyNetworkError(error) {
        if (!error) return false;
        const message = String(error.message || error || '').toLowerCase();
        if (!message) return false;

        return (
            message.includes('failed to fetch') ||
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('fetch') ||
            message.includes('offline') ||
            message.includes('load failed') ||
            message.includes('temporarily unavailable')
        );
    }

    function buildQueuedAction(action) {
        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            type: String(action.type || '').trim(),
            payload: action.payload || {},
            meta: action.meta || {},
            createdAt: new Date().toISOString(),
            retryCount: 0,
            nextTryAt: Date.now()
        };
    }

    function enqueue(action) {
        const type = String(action && action.type || '').trim();
        if (!type) return null;

        const queue = readQueue();
        const queuedAction = buildQueuedAction(action || {});
        queue.push(queuedAction);
        writeQueue(queue);
        notifyQueueChange(queue);
        scheduleFlush(1200);
        return queuedAction.id;
    }

    function removeById(id) {
        const queue = readQueue();
        const nextQueue = queue.filter((item) => item && item.id !== id);
        if (nextQueue.length === queue.length) return false;
        writeQueue(nextQueue);
        notifyQueueChange(nextQueue);
        return true;
    }

    function registerProcessor(type, processor) {
        const key = String(type || '').trim();
        if (!key || typeof processor !== 'function') return false;
        processors.set(key, processor);
        scheduleFlush(400);
        return true;
    }

    function unregisterProcessor(type) {
        const key = String(type || '').trim();
        if (!key) return false;
        return processors.delete(key);
    }

    function computeNextTryDelay(retryCount) {
        const safeCount = Math.max(0, Number(retryCount) || 0);
        const exp = Math.min(6, safeCount);
        return BASE_RETRY_DELAY_MS * (2 ** exp);
    }

    async function flush(options = {}) {
        if (flushInFlight) return flushInFlight;

        const force = !!options.force;
        if (!force && navigator.onLine === false) {
            return { processed: 0, pending: readQueue().length };
        }

        flushInFlight = (async () => {
            const queue = readQueue();
            if (!queue.length) {
                flushInFlight = null;
                notifyQueueChange(queue);
                return { processed: 0, pending: 0 };
            }

            let processed = 0;
            let touched = false;
            const now = Date.now();
            const remaining = [];

            for (const item of queue) {
                if (!item || !item.type) continue;

                if (!force && Number(item.nextTryAt || 0) > now) {
                    remaining.push(item);
                    continue;
                }

                const processor = processors.get(String(item.type));
                if (typeof processor !== 'function') {
                    remaining.push(item);
                    continue;
                }

                try {
                    const result = await processor(item);
                    const explicitRetry = result && result.retry === true;
                    const explicitDrop = result && result.drop === true;
                    const success = result === true || (result && result.ok === true);

                    if (success || explicitDrop) {
                        processed += 1;
                        touched = true;
                        continue;
                    }

                    if (explicitRetry) {
                        throw new Error('retry_requested');
                    }

                    remaining.push(item);
                } catch (error) {
                    const retryCount = Number(item.retryCount || 0) + 1;
                    if (retryCount > MAX_RETRY_COUNT) {
                        touched = true;
                        continue;
                    }

                    const delay = computeNextTryDelay(retryCount);
                    remaining.push({
                        ...item,
                        retryCount,
                        lastError: String(error && error.message || error || 'unknown_error'),
                        nextTryAt: Date.now() + delay
                    });
                    touched = true;
                }
            }

            if (touched || remaining.length !== queue.length) {
                writeQueue(remaining);
                notifyQueueChange(remaining);
            } else {
                notifyQueueChange(queue);
            }

            flushInFlight = null;
            return { processed, pending: remaining.length };
        })();

        return flushInFlight;
    }

    function scheduleFlush(delayMs = 0) {
        if (scheduledFlushTimer) {
            window.clearTimeout(scheduledFlushTimer);
            scheduledFlushTimer = null;
        }

        scheduledFlushTimer = window.setTimeout(() => {
            scheduledFlushTimer = null;
            flush().catch(() => {});
        }, Math.max(0, Number(delayMs) || 0));
    }

    function getSnapshot() {
        const queue = readQueue();
        return {
            total: queue.length,
            items: queue
        };
    }

    function clearAll() {
        writeQueue([]);
        notifyQueueChange([]);
    }

    window.offlineActionQueue = {
        enqueue,
        flush,
        scheduleFlush,
        registerProcessor,
        unregisterProcessor,
        removeById,
        getSnapshot,
        clearAll,
        isLikelyNetworkError
    };

    window.addEventListener('online', () => {
        scheduleFlush(300);
    });

    window.addEventListener('focus', () => {
        scheduleFlush(500);
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) scheduleFlush(500);
    });

    scheduleFlush(1500);
})();
