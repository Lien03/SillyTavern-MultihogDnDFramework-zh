/**
 * Guard for async agent passes that commit into the shared live settings
 * projection (and optionally a chatStates partition).
 *
 * After a real chat switch, loadChatState projects the arriving chat into the
 * same settings object. A late commit from a pass that started on the departing
 * chat would overwrite the arriving chat's memo/history and persist it.
 *
 * @param {string|null|undefined} passChatId Chat id captured when the pass started.
 * @param {string|null|undefined} currentChatId Live runtime chat id.
 * @param {{ aborted?: boolean }} [opts]
 * @returns {boolean}
 */
export function canCommitPassForChat(passChatId, currentChatId, { aborted = false } = {}) {
    if (aborted) return false;
    if (passChatId == null || String(passChatId).length === 0) return false;
    if (currentChatId == null || String(currentChatId).length === 0) return false;
    return String(passChatId) === String(currentChatId);
}

let chatSwitchGeneration = 0;

/** Invalidate deferred work on a real chat switch, including an A → B → A round trip. */
export function invalidateChatCommitGuards() {
    chatSwitchGeneration++;
}

/** Capture once at the start of an operation and pass the guard to nested writes. */
export function createChatCommitGuard(chatId, getCurrentChatId, { signal, canCommit } = {}) {
    const generation = chatSwitchGeneration;
    return () => generation === chatSwitchGeneration
        && !signal?.aborted
        && (!canCommit || canCommit())
        && canCommitPassForChat(chatId, getCurrentChatId());
}

/** Stop a chat-owned operation before another write, including after failed I/O. */
export function assertChatCommit(canCommit) {
    if (canCommit()) return;
    const error = new Error('Active chat changed or operation cancelled.');
    error.name = 'AbortError';
    error.code = 'CHAT_OWNERSHIP_LOST';
    throw error;
}

/**
 * Check an awaited result synchronously in the caller's continuation:
 *   const result = chatCommitResult(ownsChat, await load());
 * An async wrapper would leave another microtask gap between its check and the
 * caller's write. Catch paths must also check before recovery/fallback writes.
 */
export function chatCommitResult(canCommit, result) {
    assertChatCommit(canCommit);
    return result;
}

/** UI/event boundary: expected chat cancellation must not become an unhandled rejection. */
export function ignoreChatCancellation(handler) {
    return async function (...args) {
        try {
            return await handler.apply(this, args);
        } catch (error) {
            if (error?.code !== 'CHAT_OWNERSHIP_LOST') throw error;
        }
    };
}
