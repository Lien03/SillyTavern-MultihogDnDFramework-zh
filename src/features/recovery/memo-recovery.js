const RECOVERY_STORAGE_KEY = 'rpg_tracker_memo_recovery_v1';
const RECOVERY_BROWSER_ID_KEY = 'rpg_tracker_recovery_browser_id_v1';
const MAX_RECOVERY_CHATS = 8;

/**
 * Creates the browser-local memo and settings recovery service.
 * Dependencies are injected so this module stays independent of the main UI controller.
 */
export function createMemoRecoveryManager({
    getSettings,
    saveSettings,
    updateUIMemo,
    refreshRenderedView,
    syncMemoView,
    escapeHtml,
}) {
    let recoveryPromptActive = false;
    let bootCheckDone = false;
    let browserId = null;

    function getBrowserId() {
        if (browserId) return browserId;
        browserId = localStorage.getItem(RECOVERY_BROWSER_ID_KEY);
        if (!browserId) {
            browserId = globalThis.crypto?.randomUUID?.() || `rt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localStorage.setItem(RECOVERY_BROWSER_ID_KEY, browserId);
        }
        return browserId;
    }

    function markMemoPersistedByCurrentBrowser(settings = getSettings()) {
        settings.memoPersistedBy = getBrowserId();
    }

    function snapshotMemoToLocalStorage(chatId, opts = {}) {
        if (!chatId || recoveryPromptActive) return;
        if (!bootCheckDone && !opts.force) return;
        try {
            const settings = getSettings();
            const memo = settings.currentMemo || '';
            if (!memo.trim()) return;
            let map = {};
            try { map = JSON.parse(localStorage.getItem(RECOVERY_STORAGE_KEY) || '{}') || {}; } catch (_) { map = {}; }
            const existing = map[chatId];
            if (!opts.allowDowngrade && existing?.currentMemo && existing.currentMemo.length > memo.length) {
                console.warn('[RPG Tracker] Refusing to shrink local memo backup', {
                    chatId,
                    localChars: existing.currentMemo.length,
                    incomingChars: memo.length,
                });
                return;
            }
            map[chatId] = {
                ts: Date.now(),
                browserId: getBrowserId(),
                currentMemo: memo,
                lastDelta: settings.lastDelta || '',
                quests: Array.isArray(settings.quests) ? settings.quests : [],
            };
            const ids = Object.keys(map).sort((a, b) => (map[b]?.ts || 0) - (map[a]?.ts || 0));
            for (const id of ids.slice(MAX_RECOVERY_CHATS)) delete map[id];
            localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(map));
        } catch (err) {
            console.warn('[RPG Tracker] localStorage memo snapshot failed:', err);
        }
    }

    function formatRecoveryTimestamp(ts) {
        const n = Number(ts);
        if (!n || !Number.isFinite(n) || n <= 0) return 'unknown time';
        try {
            const date = new Date(n);
            const absolute = date.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', second: '2-digit',
            });
            const ageMs = Date.now() - n;
            if (ageMs < 0) return absolute;
            const mins = Math.round(ageMs / 60000);
            if (mins < 1) return `${absolute} (just now)`;
            if (mins < 60) return `${absolute} (~${mins} min ago)`;
            const hours = Math.round(mins / 60);
            if (hours < 48) return `${absolute} (~${hours}h ago)`;
            return `${absolute} (~${Math.round(hours / 24)}d ago)`;
        } catch (_) {
            return 'unknown time';
        }
    }

    async function checkLocalMemoRecovery(chatId) {
        let prompted = false;
        let restored = false;
        try {
            if (!chatId) {
                console.warn('[RPG Tracker] Memo recovery skipped: no chatId yet');
                return;
            }
            let entry = null;
            try {
                const map = JSON.parse(localStorage.getItem(RECOVERY_STORAGE_KEY) || '{}') || {};
                entry = map[chatId] || null;
            } catch (_) { entry = null; }
            if (!entry || !entry.currentMemo || !entry.currentMemo.trim()) {
                console.warn('[RPG Tracker] Memo recovery skipped: no local backup for this chat', { chatId });
                return;
            }
            const settings = getSettings();
            const diskMemo = settings.currentMemo || '';
            if (entry.currentMemo === diskMemo) {
                console.warn('[RPG Tracker] Memo recovery skipped: disk already matches local backup', { chatId, chars: diskMemo.length });
                return;
            }
            const diskChatState = settings.chatStates?.[chatId];
            const diskStamp = diskChatState
                ? (Number(diskChatState.memoPersistedAt) || 0)
                : (Number(settings.memoPersistedAt) || 0);
            const diskWriterId = diskChatState?.memoPersistedBy || settings.memoPersistedBy || null;
            if (entry.browserId !== getBrowserId() || diskWriterId !== getBrowserId()) {
                console.warn('[RPG Tracker] Memo recovery skipped: disk was last saved by another browser profile', { chatId });
                return;
            }
            const ctx = SillyTavern.getContext();
            if (typeof ctx.callGenericPopup !== 'function') {
                console.warn('[RPG Tracker] Memo recovery skipped: popup API unavailable');
                return;
            }

            prompted = true;
            recoveryPromptActive = true;
            const localWhen = formatRecoveryTimestamp(entry.ts);
            const diskWhen = formatRecoveryTimestamp(diskStamp);
            const diskLabel = diskStamp > 0 ? '磁盘版本（此聊天）' : '磁盘版本（此聊天；无保存时间戳）';
            const content = `<div style="text-align:left; line-height:1.45;">
                <p><b>发现可能未保存的追踪器数据。</b></p>
                <p>此浏览器中有该聊天「状态备忘」的本地副本，与磁盘上的当前内容不一致。这可能发生在保存被取消或另一个浏览器写入了更新副本时。请选择要保留的版本。</p>
                <p style="margin:10px 0; padding:8px 10px; background:rgba(255,255,255,0.05); border-radius:6px; font-size:0.95em;">
                    <b>本地备份</b>（此浏览器）<br>
                    ${entry.currentMemo.length.toLocaleString()} 字符 · ${escapeHtml(localWhen)}<br><br>
                    <b>${diskLabel}</b><br>
                    ${diskMemo.length.toLocaleString()} 字符 · ${escapeHtml(diskWhen)}
                </p>
                <p style="margin-top:10px; padding:8px 10px; border-left:3px solid #f0ad4e; background:rgba(240,173,78,0.12); border-radius:4px;"><b>请查看此对话框后方</b>（背景特意保持未模糊）。如果追踪器/聊天界面与你刚才看到的不一致或显得过时——请点击 <b>恢复</b>。</p>
                <p>恢复本地备份？</p>
            </div>`;
            const { Popup, POPUP_TYPE } = ctx;
            let result = false;
            if (typeof Popup === 'function') {
                const popup = new Popup(content, POPUP_TYPE?.CONFIRM ?? 1, '', {
                    okButton: '恢复',
                    cancelButton: 'Keep disk version (keep what\'s visible right now)',
                    leftAlign: true,
                    animation: 'none',
                });
                popup.dlg?.classList.add('rt-recovery-popup');
                result = await popup.show();
            } else {
                result = await ctx.callGenericPopup(content, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', {
                    okButton: '恢复',
                    cancelButton: 'Keep disk version (keep what\'s visible right now)',
                    leftAlign: true,
                    animation: 'none',
                });
            }
            if (result) {
                settings.currentMemo = entry.currentMemo;
                settings.lastDelta = entry.lastDelta || settings.lastDelta;
                if (Array.isArray(entry.quests)) settings.quests = entry.quests;
                saveSettings(true);
                if (typeof updateUIMemo === 'function') updateUIMemo(settings.currentMemo);
                if (typeof refreshRenderedView === 'function') refreshRenderedView();
                if (typeof syncMemoView === 'function') syncMemoView();
                toastr.success('已恢复本地备份。', 'RPG Tracker');
                restored = true;
            }
        } catch (err) {
            console.warn('[RPG Tracker] Local memo recovery prompt failed:', err);
        } finally {
            recoveryPromptActive = false;
            if (chatId) {
                bootCheckDone = true;
                if (prompted) snapshotMemoToLocalStorage(chatId, { force: true, allowDowngrade: !restored });
            }
        }
    }

    async function ensureLocalMemoRecovery(chatId) {
        if (bootCheckDone || !chatId) return;
        await checkLocalMemoRecovery(chatId);
        if (!bootCheckDone) bootCheckDone = true;
    }

    async function confirmLocalSettingsRecovery(backup) {
        const ctx = SillyTavern.getContext();
        const localWhen = formatRecoveryTimestamp(backup?.ts);
        const content = `<div style="text-align:left;line-height:1.45;">
            <p><b>浏览器配置与 settings.json 不一致。</b></p>
            <p>此浏览器保存了来自 ${escapeHtml(localWhen)} 的本地配置快照，与磁盘版本不一致。可能是被中断的保存，或来自另一个浏览器会话的旧缓存。</p>
            <p style="margin:10px 0;padding:8px 10px;border-left:3px solid #f0ad4e;background:rgba(240,173,78,0.12);border-radius:4px;">这包括追踪器字段、叙述者设置、内置提示词，以及 <b>CYOA 设置与预设</b>。不会自动恢复任何内容。</p>
            <p style="margin:10px 0;padding:8px 10px;border-left:3px solid #f0ad4e;background:rgba(240,173,78,0.12);border-radius:4px;"><b>请查看此对话框后方</b>（背景特意保持未模糊）。用你能看到的追踪器/聊天界面来判断本地版本比磁盘更新还是更旧，然后做出选择。</p>
            <p>恢复此浏览器的本地配置？</p>
        </div>`;
        try {
            const { Popup, POPUP_TYPE } = ctx;
            if (typeof Popup === 'function') {
                const popup = new Popup(content, POPUP_TYPE?.CONFIRM ?? 1, '', {
                    okButton: '恢复本地配置',
                    cancelButton: 'Keep disk configuration (keep what\'s visible right now)',
                    leftAlign: true,
                    animation: 'none',
                });
                popup.dlg?.classList.add('rt-recovery-popup');
                return !!await popup.show();
            }
            return !!await ctx.callGenericPopup?.(content, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', {
                okButton: '恢复本地配置',
                cancelButton: 'Keep disk configuration (keep what\'s visible right now)',
                leftAlign: true,
                animation: 'none',
            });
        } catch (err) {
            console.warn('[RPG Tracker] Settings recovery prompt failed:', err);
            return false;
        }
    }

    return {
        snapshotMemoToLocalStorage,
        ensureLocalMemoRecovery,
        confirmLocalSettingsRecovery,
        isBootCheckDone: () => bootCheckDone,
        markBootCheckDone: () => { bootCheckDone = true; },
        markMemoPersistedByCurrentBrowser,
    };
}

export { RECOVERY_STORAGE_KEY, MAX_RECOVERY_CHATS };
