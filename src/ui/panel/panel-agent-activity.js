import { runtimeState } from '../../app/runtime-state.js';
import {
    findLoreHistoryIndexForChat,
    isLoreRedoEntryForChat,
} from '../../state/lorebook-history.js';
import { isLocationMappingEnabled } from '../../state/section-enabled.js';

function getActiveLoreHistoryScope(settings = {}) {
    const chatId = runtimeState.currentChatId
        || (typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : null)
        || (typeof SillyTavern !== 'undefined' ? SillyTavern.getContext()?.chatId : null)
        || null;
    return {
        chatId,
        campaignPrefix: settings.routerCampaignPrefix || '',
    };
}

function getScopedRedoEntries(scope) {
    return (runtimeState.loreRedoStack || []).filter(entry => isLoreRedoEntryForChat(entry, scope));
}

/** Wires Lorebook Agent history, active-key refresh, and last-run status controls. */
export function wireAgentActivity({
    agentPanel,
    captureRouterLoreState,
    getRouterTick,
    getMapUpdaterTick,
    getSettings,
    reapplyRouterPass,
    refreshManifest,
    rollbackRouterPass,
    saveSettings,
}) {
    const agentNavBack = /** @type {HTMLButtonElement|null} */ (agentPanel.querySelector('#rt-agent-nav-back'));
    const agentNavFwd = /** @type {HTMLButtonElement|null} */ (agentPanel.querySelector('#rt-agent-nav-fwd'));
    const agentNavLabel = /** @type {HTMLElement|null} */ (agentPanel.querySelector('#rt-agent-nav-label'));

    const syncAgentNav = () => {
        const s = getSettings();
        const scope = getActiveLoreHistoryScope(s);
        const histIdx = findLoreHistoryIndexForChat(s.routerHistory || [], scope);
        const redoLen = getScopedRedoEntries(scope).length;
        if (agentNavBack) agentNavBack.disabled = histIdx < 0;
        if (agentNavFwd) agentNavFwd.disabled = redoLen === 0;
        if (agentNavLabel) {
            if (redoLen === 0) {
                agentNavLabel.textContent = '[ 实时 ]';
                agentNavLabel.title = 'Lorebook 处于当前的实时状态';
            } else {
                agentNavLabel.textContent = `[ -${redoLen} ]`;
                agentNavLabel.title = `已回滚 ${redoLen} 次代理操作 — 点击 → 重做`;
            }
            agentNavLabel.classList.remove('clickable');
        }
    };

    if (agentNavBack) {
        agentNavBack.addEventListener('click', async () => {
            const s = getSettings();
            const scope = getActiveLoreHistoryScope(s);
            const histIdx = findLoreHistoryIndexForChat(s.routerHistory || [], scope);
            if (histIdx < 0) return;
            agentNavBack.disabled = true;
            if (agentNavFwd) agentNavFwd.disabled = true;
            const histEntry = s.routerHistory[histIdx];
            try {
                const postPassState = await captureRouterLoreState();
                const ok = await rollbackRouterPass(histIdx, postPassState);
                if (ok) {
                    runtimeState.loreRedoStack.push({ prePassSnapshot: histEntry, postPassState });
                } else {
                    toastr['error']('回滚失败；已尝试安全恢复。请查看控制台。', '世界书代理');
                }
            } catch (error) {
                console.error('[RPG Tracker] Could not capture a safe rollback recovery state:', error);
                toastr['error']('无法制作完整的安全快照，撤销已停止。', '世界书代理');
            }
            syncAgentNav();
            await refreshManifest('rollback');
        });
    }

    if (agentNavFwd) {
        agentNavFwd.addEventListener('click', async () => {
            const s = getSettings();
            const scope = getActiveLoreHistoryScope(s);
            const scopedRedo = getScopedRedoEntries(scope);
            if (!scopedRedo.length) return;
            if (agentNavBack) agentNavBack.disabled = true;
            agentNavFwd.disabled = true;
            const redoEntry = scopedRedo[scopedRedo.length - 1];
            const stackIdx = runtimeState.loreRedoStack.lastIndexOf(redoEntry);
            if (stackIdx >= 0) runtimeState.loreRedoStack.splice(stackIdx, 1);
            const ok = await reapplyRouterPass(redoEntry.prePassSnapshot, redoEntry.postPassState);
            if (!ok) {
                runtimeState.loreRedoStack.push(redoEntry);
                toastr['error']('重做失败。请查看控制台。', '世界书代理');
            }
            syncAgentNav();
            await refreshManifest('redo');
        });
    }

    // updateUndoLabel kept as alias so existing call-sites still compile
    const updateUndoLabel = syncAgentNav;
    // ── Active Keys Refresh Button & Toggle ────────────────────────────────
    const keysToggleBtn = agentPanel.querySelector('#rt-agent-keys-toggle');
    if (keysToggleBtn) {
        keysToggleBtn.addEventListener('click', (e) => {
            if (e.target.closest('#rt-agent-keys-refresh')) {
                return;
            }
            const s = getSettings();
            s.agentKeysCollapsed = !s.agentKeysCollapsed;
            localStorage.setItem('rpg_tracker_agent_keys_collapsed', String(s.agentKeysCollapsed));

            const keysContainer = agentPanel.querySelector('#rt-agent-router-active-keys');
            const chevron = agentPanel.querySelector('#rt-agent-keys-chevron');
            if (keysContainer) {
                keysContainer.style.display = s.agentKeysCollapsed ? 'none' : 'flex';
            }
            if (chevron) {
                chevron.style.transform = s.agentKeysCollapsed ? 'rotate(-90deg)' : '';
            }
        });
    }

    const keysRefreshBtn = agentPanel.querySelector('#rt-agent-keys-refresh');
    if (keysRefreshBtn) {
        keysRefreshBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            keysRefreshBtn.querySelector('i')?.classList.add('fa-spin');
            await runtimeState.renderRouterUI();
            if (typeof runtimeState.refreshAgentManifest === 'function') {
                await runtimeState.refreshAgentManifest('manual-button');
            }
            keysRefreshBtn.querySelector('i')?.classList.remove('fa-spin');
        });
    }

    updateUndoLabel();

    // ── Last Run status display ────────────────────────────────────────────
    const lastRunEl = agentPanel.querySelector('#rt-agent-last-run');
    function formatLastRunRelative(epochMs) {
        if (!epochMs) return '从未';
        const sec = Math.floor((Date.now() - epochMs) / 1000);
        if (sec < 45) return '刚刚';
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min} 分钟前`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr} 小时前`;
        return `${Math.floor(hr / 24)} 天前`;
    }
    function syncLastRunDisplay() {
        if (!lastRunEl) return;
        const s = getSettings();
        const runEvery = s.routerRunEvery || 3;
        const tick = getRouterTick();
        const lastRunAt = s.routerLastRunAt || 0;
        const parts = [`上次运行：${formatLastRunRelative(lastRunAt)}`];
        if (runEvery > 1) {
            const nextIn = Math.max(0, runEvery - tick);
            parts.push(`下次：${nextIn} 条消息后`);
        }
        if (s.mapUpdaterEnabled !== false && isLocationMappingEnabled(s)) {
            const mapEvery = Math.max(1, Number(s.mapUpdaterRunEvery) || 1);
            const mapTick = typeof getMapUpdaterTick === 'function' ? getMapUpdaterTick() : 0;
            if (mapEvery > 1) {
                const mapNext = Math.max(0, mapEvery - mapTick);
                parts.push(`地图：${mapNext} 条消息后`);
            } else {
                parts.push('地图：每回合');
            }
        }
        lastRunEl.textContent = parts.join(' · ');
    }
    syncLastRunDisplay();

    document.addEventListener('rt_lore_agent_updated', async (event) => {
        saveSettings();
        // Rollback/redo requests use the manifest's dedicated disk-authoritative
        // list path. Avoid updateWorldInfoList here: it downloads and parses the
        // user's complete settings payload and made event bursts extremely costly.
        await runtimeState.renderRouterUI();
        if (typeof runtimeState.refreshAgentManifest === 'function') {
            const source = (/** @type {CustomEvent} */ (event)).detail?.source || 'auto';
            await runtimeState.refreshAgentManifest(source);
        }
        updateUndoLabel();
        syncLastRunDisplay();
    });

    document.addEventListener('rt_generation_tick', () => {
        syncLastRunDisplay();
    });

    // ── Lorebook Terminal Logic ──

    return { syncAgentNav, syncLastRunDisplay, updateUndoLabel };
}
