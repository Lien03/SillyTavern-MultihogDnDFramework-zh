import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    createPanel,
    resolveInitialPanelContentMode,
    resolveModeAfterAgentAttach,
} from '../src/ui/panel/panel-builder.js';
import { renderMapEvolutionHistoryHtml } from '../src/ui/panel/dungeon-map-panel.js';
import { runtimeState } from '../src/app/runtime-state.js';

describe('panel builder', () => {
    it('loads independently from the application entry point', () => {
        expect(typeof createPanel).toBe('function');
        expect(runtimeState).toMatchObject({
            currentChatId: null,
            historyViewIndex: -1,
            renderedViewActive: false,
        });
    });

    it('restores the tracker pane when the agent is attached during CHAT', () => {
        expect(resolveModeAfterAgentAttach(true, 'agent')).toBe('tracker');
        expect(resolveModeAfterAgentAttach(false, 'agent')).toBe('agent');
        expect(resolveModeAfterAgentAttach(false, 'tracker')).toBe('tracker');
    });

    it('always opens a rebuilt UI on State Tracker regardless of the saved tab', () => {
        expect(resolveInitialPanelContentMode('agent')).toBe('tracker');
        expect(resolveInitialPanelContentMode('tracker')).toBe('tracker');
        expect(resolveInitialPanelContentMode(undefined)).toBe('tracker');
    });

    it('shows a private-map viewer button on mapped Lorebook Agent locations', () => {
        const source = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
        expect(source).toContain('node.item?.has_dungeon_map');
        expect(source).toContain('rt-dungeon-map-badge');
        expect(source).toContain('title="查看此根地点附带的私人地城地图（alpha）"');
        expect(source).toContain('openDungeonMapPopup');
        expect(source).toContain('openDungeonMapReadablePopup');
        expect(source).toContain('rt-dungeon-map-delete');
        expect(source).toContain('rt-dungeon-map-create');
        expect(source).toContain('deleteDungeonMapFromLocationEntry');
        expect(source).toContain('runMapArchitect');
        expect(source).toContain('allowOffsite: true');
        expect(source).toContain('title="为此地点根创建私人地图"');
        expect(source).toContain('title="从此地点移除私人地图（保留 CORE）"');
        expect(source).not.toContain('startUserRequestedAreaMapGeneration');
        expect(source).not.toContain('renderDungeonMapReadableHtml');
        expect(source).not.toContain('revealAll: true');
        expect(source).toContain('stripDungeonMapSection(item.content');
        expect(source).toContain("Math.round(stripDungeonMapSection(node.item.content || '').length / 4)");
        expect(source).toContain('rt-map-create-mode');
        expect(source).toContain('inferMapArchitectArgs');
        expect(source).toContain("value=\"auto\" checked");
        expect(source).toContain('rt-map-create-lookback');
        expect(source).toContain('正在为 ${site} 填充地图简报…');
        expect(source).toContain('id="rt-map-create-manual" hidden');
        expect(source).toContain('rt-loc-add-mapped-btn');
        expect(source).toContain('rt-loc-maps-guide-btn');
        expect(source).toContain('地图指南');
        expect(source).toContain('什么是地图？');
        expect(source).toContain('世界进程与地图演化的交互');
        expect(source).toContain('promptAndCreateMappedLocation');
        expect(source).toContain('requireNew: true');
        expect(source).toContain('locationKeys');
        expect(source).toContain('地点名称会自动添加。最多 6 个。');
        expect(source).toContain('rt-map-loc-mode');
        expect(source).toContain('rt-map-loc-brief');
        expect(source).toContain('rt-map-loc-lookback');
        expect(source).toContain('0 表示不使用最近的聊天记录——仅使用名称和简报。');
        expect(source).toContain('可选参考上下文');
        expect(source).toContain('data-map-context-lorebooks');
        expect(source).toContain('data-map-context-character-cards');
        expect(source).toContain('populateMapCreationContextOptions');
        expect(source).toContain('rt-map-create-mode');
        expect(source).toContain('lorebookNames: form.lorebookNames');
        expect(source).toContain('characterCards: form.characterCards');
        expect(source).not.toContain('Keywords are required');
        expect(source).not.toContain('Include the location name.');
        expect(source).toContain('Add Mapped Location');
        expect(source).toContain('onClosing');
        expect(source).toContain('popup.dlg');
        expect(source).toContain('#rt-map-loc-name');
        expect(source).toContain('value="INTERIOR"');
        expect(source).toContain('value="NONE"');
        expect(source).toContain('data-map-include-site');
        expect(source).toContain("include: [...root.querySelectorAll('input[data-map-include-site]:checked')]");
        expect(source).toContain("['DUNGEON', 'INTERIOR'].includes(item.kind)");
    });

    it('ships distinct structured settlement-site icons and ordering', () => {
        const icons = readFileSync(new URL('../dungeon-map-icons.js', import.meta.url), 'utf8');
        expect(icons).toContain("'BUILDING'");
        expect(icons).toContain("'SUBDUNGEON'");
        expect(icons).toContain("'SUBINTERIOR'");
        expect(icons).toContain("BUILDING: new URL('./src/ui/SVG/building.svg'");
        expect(icons).toContain("SUBDUNGEON: new URL('./src/ui/SVG/subdungeon.svg'");
        expect(icons).toContain("SUBINTERIOR: new URL('./src/ui/SVG/subinterior.svg'");
    });

    it('probes the mapped site on first panel build so Visuals/Map does not wait for a settings toggle', () => {
        const source = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
        expect(source).toContain('dungeonRealityEnabled || !s.locationImages || s.agentImmersionMode');
        expect(source).toContain('void runtimeState.refreshImmersionView()');
        expect(source).toContain('void Promise.resolve(refreshManifest()).then(() => {');
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(indexSource).toContain('Still probe the mapped site so Visuals/Map is ready on first open.');
        const immersion = readFileSync(new URL('../immersion.js', import.meta.url), 'utf8');
        expect(immersion).toContain('playerFacing: !isDungeonMapRevealAll()');
        expect(indexSource).toContain('applyDungeonMapForHistoryView');
        expect(indexSource).toContain('captureActiveDungeonMapHistory');
    });

    it('opens a knowledge-filtered site inspector from Visuals/Map', () => {
        const source = readFileSync(new URL('../src/ui/panel/dungeon-map-panel.js', import.meta.url), 'utf8');
        expect(source).toContain('bindDungeonMapPan');
        expect(source).toContain('bindDungeonMapAssetPopups');
        expect(source).toContain('document.body.appendChild(tip)');
        expect(source).toContain("tip.setAttribute('popover', 'manual')");
        expect(source).toContain('onClose: () => hideDungeonMapAssetTip()');
        expect(source).toContain('ensureDungeonMapKindArtStyles');
        expect(source).not.toContain("anchor.closest('dialog, .popup')");
        expect(source).not.toContain('popupContent.dataset.assetTipScroll');
        expect(source).toContain("root.classList.contains('rt-dungeon-graph-scroll')");
        expect(source).toContain('openDungeonMapReadablePopup');
        expect(source).toContain('Reveal All');
        expect(source).toContain('Map Entries');
        expect(source).toContain('Raw JSON');
        expect(source).toContain('Save JSON');
        expect(source).toContain('parseEditableDungeonMapJson');
        expect(source).toContain('persistManualDungeonMapDocument');
        expect(source).toContain('<textarea class="rt-dungeon-map-raw"');
        const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        expect(css).toContain('.rt-dungeon-graph-asset-tip');
        expect(css).toMatch(/\.rt-dungeon-map-popup\s*\{[^}]*text-align:\s*left;/);
        expect(css).toMatch(/\.rt-dungeon-map-raw\s*\{[\s\S]*?text-align:\s*left;[\s\S]*?white-space:\s*pre;/);
        expect(source).toContain('Map Evolution History');
        expect(source).toContain('Map Evolution: Run Now');
        expect(source).toContain('Testing Ground');
        expect(source).toContain('data-map-graph');
        expect(source).toContain('persistDungeonMapRevealAll');
        expect(source).toContain('isDungeonMapRevealAll');
        expect(source).toContain('playerFacing: !revealAll');
        expect(source).toContain('openMapEvolutionTestingGround');
        expect(source).toContain('allowVerticalScrolling: true');
        expect(css).toContain('.popup-content:has(.rt-dungeon-map-popup)');
        expect(css).toMatch(/\.rt-dungeon-map-evolution-history\s*\{[\s\S]*?overflow-y:\s*auto;/);
        expect(source).toContain('reloadInspectorFromLiveMap');
        expect(source).toContain('await reloadInspectorFromLiveMap()');
        expect(source).toContain("siteRoots: [site]");
        expect(source).toContain('runtimeState.loadMappedEvolutionSiteRef(site)');
        expect(source).toContain('mapAssetGlyphFromEventTarget');
        expect(source).toContain('assetTipPinned');
        expect(source).toContain("scroll.addEventListener('click'");
        expect(source).toContain('pinDungeonMapAssetTip');
        expect(source).toContain('rt-dungeon-map-view-row');
        expect(source).toContain('Direct Prompt</button>');
        expect(source).toContain('bindMapUpdaterDirectControls(popupDom');
        expect(source).toContain('siteRoot: site');
        expect(source).toContain('runMapUpdaterPassRef');
    });

    it('keeps material Evolution history private until Reveal All is enabled', () => {
        const backlog = {
            morrowfen: [
                {
                    kind: 'commit', at: 'Day 2, 08:00', elapsedMinutes: 60,
                    operationId: 'evo-secret-riot', summary: 'Morrowfen: added hidden rioters in docks',
                },
                {
                    kind: 'quiet', at: 'Day 2, 09:00', elapsedMinutes: 60, passes: 2,
                    summary: '2 consecutive Map Evolution passes committed no material change.',
                },
            ],
        };
        const protectedHtml = renderMapEvolutionHistoryHtml(backlog, 'Morrowfen');
        expect(protectedHtml).toContain('Material details hidden');
        expect(protectedHtml).not.toContain('hidden rioters');
        expect(protectedHtml).not.toContain('evo-secret-riot');
        expect(protectedHtml).toContain('2 passes');

        const revealedHtml = renderMapEvolutionHistoryHtml(backlog, 'Morrowfen', { revealAll: true });
        expect(revealedHtml).toContain('hidden rioters');
        expect(revealedHtml).not.toContain('Morrowfen:');
        expect(revealedHtml).toContain('evo-secret-riot');
    });

    it('expands Run Research Now into Lorebook Agent and Map Updater', () => {
        const source = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
        expect(source).toContain('runMapUpdaterPass({ isManual: true, lookback: s.routerLookback || 4 })');
        expect(source).toContain('rt-research-lorebook');
        expect(source).toContain('rt-research-map-updater');
        expect(source).toContain('rt-research-map-evolution');
        expect(source).toContain('promptMappedEvolutionSites');
        expect(source).toContain('siteRoots');
        expect(source).toContain('listMappedEvolutionSites');
        expect(source).toContain("toastr['info']('正在启动世界书代理流程…')");
        expect(source).toContain("toastr['info']('正在启动地图更新流程…')");
        expect(source).toContain("toastr['info']('正在启动地图演化流程…')");
    });

    it('shares Stop and tabbed Agent Console with Map Updater without NPC auto-portraits', () => {
        const source = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(source).toContain('stopRouterPass()');
        expect(source).toContain('stopMapUpdaterPass()');
        expect(source).toContain('stopMapEvolutionPass()');
        expect(source).toContain("skipped === 'stopped'");
        expect(source).toContain("toastr['info']('已停止。', 'Map Updater')");
        expect(source).toContain("source === 'lorebook_agent'");
        expect(source).toContain('checkAndTriggerAutoGenerations(refreshAll)');
        expect(source).toContain('rt-agent-terminal-tabs');
        expect(source).toContain('resolveTerminalSource');
        expect(indexSource).toContain("stopBtn.style.display = busy ? 'flex' : 'none'");
        expect(indexSource).toContain('const busy = !!running || isMapUpdaterRunning() || isMapEvolutionRunning()');
        expect(indexSource).toContain('stopMapUpdaterPass');
        expect(indexSource).toContain('stopMapEvolutionPass');
    });
});
