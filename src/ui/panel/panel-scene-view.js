import { runtimeState } from '../../app/runtime-state.js';
import { canCommitPassForChat } from '../../state/pass-affinity.js';
import { canUseSceneMemo } from '../../state/scene-affinity.js';
import { isLocationMappingEnabled } from '../../state/section-enabled.js';
import {
    bindDungeonMapEmbedEvents,
    captureDungeonMapViewport,
    isDungeonMapDetached,
    reattachDungeonMapPanel,
    restoreDungeonMapViewport,
    updateDetachedDungeonMapPanel,
} from './dungeon-map-panel.js';
import { createCoalescedRefresh } from './refresh-coalescer.js';

/** Manages the Lorebook Agent Scene View and its Records/Visuals/Map UI. */
export function createSceneViewController({
    agentPanel,
    buildImmersionSceneState,
    getSettings,
    loadLocationEntryByPath,
    loadNpcEntryByKey,
    maybeAutoGenerateImmersionSceneArt,
    renderImmersionViewHtml,
    runRealtimeSceneArtCheck,
    showLocationImageSettingsMenu,
}) {
        const openMappedLocation = async (path) => {
            const item = await loadLocationEntryByPath(path);
            const opener = globalThis._rpgAgentOpenLocationDetail;
            if (item && typeof opener === 'function') {
                await opener(item, path);
                return;
            }
            if (path) {
                toastr.info(`还没有「${path}」对应的地点记录。`, '视觉/地图');
            }
        };

        const mapHandlers = () => ({
            onAreaClick: openMappedLocation,
            onDetach: () => { void runtimeState.refreshImmersionView(); },
            onReattach: () => { void runtimeState.refreshImmersionView(); },
        });

        const bindImmersionViewEvents = (scene) => {
            const root = agentPanel.querySelector('#rt-agent-immersion-view');
            if (!root) return;

            const hero = root.querySelector('.rt-immersion-hero-wrap');
            if (hero) {
                const activateHero = async () => {
                    const path = hero.getAttribute('data-loc-path');
                    const raw = hero.getAttribute('data-loc-raw');
                    if (path) {
                        const item = await loadLocationEntryByPath(path);
                        await showLocationImageSettingsMenu(
                            path,
                            () => runtimeState.refreshImmersionView(),
                            item?.content || '',
                        );
                    } else if (raw) {
                        toastr.info(`没有匹配到「${raw}」的设定。请添加地点条目或检查名称。`, '视觉/地图');
                    }
                };
                hero.addEventListener('click', () => { void activateHero(); });
                hero.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void activateHero();
                    }
                });
            }

            root.querySelectorAll('.rt-immersion-npc-tile').forEach(tile => {
                tile.addEventListener('click', (e) => {
                    e.stopPropagation();
                    void (async () => {
                        if (tile.getAttribute('data-is-pc') === '1') {
                            let opener = globalThis._rpgAgentOpenPcDetail;
                            if (typeof opener !== 'function' && typeof globalThis._rpgRefreshAgentManifest === 'function') {
                                await globalThis._rpgRefreshAgentManifest();
                                opener = globalThis._rpgAgentOpenPcDetail;
                            }
                            if (typeof opener === 'function') {
                                await opener(false);
                            }
                            return;
                        }
                        const entryId = tile.getAttribute('data-npc-entry-id');
                        if (!entryId) return;
                        const item = await loadNpcEntryByKey(entryId);
                        let opener = globalThis._rpgAgentOpenNpcDetail;
                        let parseRel = globalThis._rpgAgentParseRelationship;
                        if (typeof opener !== 'function' || typeof parseRel !== 'function') {
                            if (typeof globalThis._rpgRefreshAgentManifest === 'function') {
                                await globalThis._rpgRefreshAgentManifest();
                            }
                            opener = globalThis._rpgAgentOpenNpcDetail;
                            parseRel = globalThis._rpgAgentParseRelationship;
                        }
                        if (item && typeof opener === 'function' && typeof parseRel === 'function') {
                            await opener(item, parseRel(entryId));
                        }
                    })();
                });
            });

            bindDungeonMapEmbedEvents(root, { scene, ...mapHandlers() });
        };

        const syncAgentImmersionUi = () => {
            const s = getSettings();
            const immersionEl = agentPanel.querySelector('#rt-agent-immersion-view');
            const manifestEl = agentPanel.querySelector('#rt-agent-manifest-list');
            const recordsBtn = agentPanel.querySelector('#rt-agent-view-mode-records');
            const vizBtn = agentPanel.querySelector('#rt-agent-view-mode-visualization');
            const viewModeSwitch = agentPanel.querySelector('#rt-agent-view-mode-switch');
            const campaignTitle = agentPanel.querySelector('#rt-agent-campaign-header-title');
            const visualsAvailable = !!s.locationImages || !!runtimeState.hasActiveDungeonMap;
            const showImmersion = visualsAvailable && !!s.agentImmersionMode;

            if (viewModeSwitch) viewModeSwitch.style.display = visualsAvailable ? '' : 'none';
            if (campaignTitle) campaignTitle.style.display = visualsAvailable ? 'none' : 'block';
            if (immersionEl) immersionEl.style.display = showImmersion ? 'flex' : 'none';
            if (manifestEl) manifestEl.style.display = showImmersion ? 'none' : 'flex';
            if (recordsBtn) {
                recordsBtn.classList.toggle('rt-agent-view-mode-btn-active', !showImmersion);
                recordsBtn.setAttribute('aria-selected', !showImmersion ? 'true' : 'false');
            }
            if (vizBtn) {
                vizBtn.classList.toggle('rt-agent-view-mode-btn-active', showImmersion);
                vizBtn.setAttribute('aria-selected', showImmersion ? 'true' : 'false');
            }
        };
        globalThis._rpgSyncAgentImmersionUi = syncAgentImmersionUi;

        const performImmersionRefresh = async () => {
            const s = getSettings();
            // Pin before lorebook await — a mid-refresh chat switch must not
            // render the departing chat's scene or queue Real-Time gen into the
            // arriving chat (runRealtimeSceneArtCheck has the same guard).
            //
            // onChatChanged flips runtimeState.currentChatId and kicks an
            // "instant" manifest/immersion refresh BEFORE loadChatState replaces
            // the live memo. Chat-id affinity alone then passes (id is already
            // the arriving chat) while buildImmersionSceneState still captured
            // the departing memo — which queued Real-Time location art into the
            // wrong chat. Abort when the live memo was swapped mid-await; the
            // post-loadChatState refresh will rebuild from the arriving partition.
            const passChatId = runtimeState.currentChatId;
            const memoAtStart = s.currentMemo;
            if (!canUseSceneMemo(s, passChatId, memoAtStart)) return;
            try {
                const scene = await buildImmersionSceneState(memoAtStart, s);
                if (!canCommitPassForChat(passChatId, runtimeState.currentChatId)) return;
                if (!canUseSceneMemo(getSettings(), passChatId, memoAtStart)) return;
                runtimeState.hasActiveDungeonMap = !!scene.dungeonMap;
                maybeAutoGenerateImmersionSceneArt(scene, () => { void runtimeState.refreshImmersionView(); });
                syncAgentImmersionUi();
                if (isDungeonMapDetached()) {
                    if (scene.dungeonMap) {
                        updateDetachedDungeonMapPanel(scene, mapHandlers());
                    } else {
                        // Turning the component off must close a previously
                        // detached map window rather than leaving stale UI.
                        reattachDungeonMapPanel();
                    }
                }

                const showImmersion = s.agentImmersionMode && (s.locationImages || runtimeState.hasActiveDungeonMap);
                if (!showImmersion) return;
                const container = agentPanel.querySelector('#rt-agent-immersion-view');
                if (!container || agentPanel.style.display === 'none') return;
                // Rebuilding the scene also recreates the graph's overflow element.
                // Retain its pan position across Map Updater and other scene refreshes.
                const mapViewport = captureDungeonMapViewport(container);
                container.innerHTML = renderImmersionViewHtml(scene);
                restoreDungeonMapViewport(container, mapViewport);
                bindImmersionViewEvents(scene);
            } catch (err) {
                if (!canCommitPassForChat(passChatId, runtimeState.currentChatId)) return;
                if (!canUseSceneMemo(getSettings(), passChatId, memoAtStart)) return;
                console.error('[RPG Tracker] runtimeState.refreshImmersionView failed:', err);
                runtimeState.hasActiveDungeonMap = false;
                syncAgentImmersionUi();
                const container = agentPanel.querySelector('#rt-agent-immersion-view');
                if (container) {
                    container.innerHTML = '<div style="text-align:center;opacity:0.5;font-size:0.769em;padding:10px;">场景视图加载失败。</div>';
                }
            }
        };
        runtimeState.refreshImmersionView = createCoalescedRefresh(performImmersionRefresh);
        globalThis._rpgRefreshImmersionView = runtimeState.refreshImmersionView;
        globalThis._rpgCheckRealtimeSceneArt = runRealtimeSceneArtCheck;

        if (isDungeonMapDetached()) {
            const enabled = isLocationMappingEnabled(getSettings());
            if (enabled) {
                updateDetachedDungeonMapPanel(null, mapHandlers());
            } else {
                reattachDungeonMapPanel();
            }
        }

    return { syncAgentImmersionUi };
}
