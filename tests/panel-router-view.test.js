import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouterViewRenderer } from '../src/ui/panel/panel-router-view.js';
import { runtimeState } from '../src/app/runtime-state.js';
import { stripDungeonMapSection } from '../dungeon-reality.js';

afterEach(() => {
    runtimeState.refreshImmersionView = async () => {};
    globalThis.SillyTavern = {
        getContext: () => ({ extensionSettings: {}, chatId: 'vitest-chat' }),
    };
});

describe('panel router view', () => {
    it('renders an empty router state and refreshes the linked World Progression fields', async () => {
        const keys = { innerHTML: '', querySelectorAll: () => [], style: {} };
        const log = { innerHTML: '', style: {} };
        const chevron = { style: {} };
        const tokens = { textContent: '' };
        const lastFired = { textContent: '' };
        const nextFire = { textContent: '' };
        const enabledBadge = { textContent: '', style: {} };
        const elements = new Map([
            ['#rt-agent-router-active-keys', keys],
            ['#rt-agent-router-log', log],
            ['#rt-agent-keys-chevron', chevron],
            ['#rt-agent-active-tokens', tokens],
            ['#rt-agent-world-last-fired', lastFired],
            ['#rt-agent-world-next-fire', nextFire],
            ['#rt-agent-world-enabled-badge', enabledBadge],
        ]);
        const settings = {
            activeRouterKeys: [],
            routerLog: [],
            worldProgressionEnabled: true,
            worldProgressionIntervalHours: 24,
            worldProgressionLastFiredPeriodLabel: '',
            currentMemo: '',
        };
        const refreshImmersionView = vi.fn().mockResolvedValue(undefined);
        runtimeState.refreshImmersionView = refreshImmersionView;
        globalThis.SillyTavern = {
            getContext: () => ({ loadWorldInfo: vi.fn() }),
        };

        const render = createRouterViewRenderer({
            agentPanel: { querySelector: (selector) => elements.get(selector) || null },
            escapeHtml: (value) => String(value),
            extractCurrentTimeStr: () => '',
            formatInWorldTime: () => '',
            getSettings: () => settings,
            parseInWorldTime: () => null,
            saveSettings: vi.fn(),
        });

        await render();

        expect(keys.innerHTML).toContain('无');
        expect(log.innerHTML).toContain('暂无日志');
        expect(tokens.textContent).toBe('(0t)');
        expect(lastFired.textContent).toBe('从未');
        expect(enabledBadge.textContent).toBe('开');
        expect(refreshImmersionView).toHaveBeenCalledOnce();
    });

    it('excludes stored MAP attachments from the displayed active token total', async () => {
        const keys = { innerHTML: '', querySelectorAll: () => [], style: {} };
        const log = { innerHTML: '', style: {} };
        const tokens = { textContent: '' };
        const elements = new Map([
            ['#rt-agent-router-active-keys', keys],
            ['#rt-agent-router-log', log],
            ['#rt-agent-active-tokens', tokens],
        ]);
        const content = `[CORE]\nA compact location premise.\n[/CORE]\n\n[MAP]\n${'private-map-data '.repeat(200)}\n[/MAP]`;
        const settings = {
            activeRouterKeys: ['Campaign_Locations::7'],
            pinnedRouterKeys: [],
            keywordActivatedKeys: [],
            routerLog: [],
            worldProgressionEnabled: false,
        };
        globalThis.SillyTavern = {
            getContext: () => ({
                loadWorldInfo: vi.fn().mockResolvedValue({
                    entries: { 7: { key: ['Old Keep'], comment: 'Old Keep', content } },
                }),
            }),
        };
        const render = createRouterViewRenderer({
            agentPanel: { querySelector: (selector) => elements.get(selector) || null },
            escapeHtml: (value) => String(value),
            extractCurrentTimeStr: () => '',
            formatInWorldTime: () => '',
            getSettings: () => settings,
            parseInWorldTime: () => null,
            saveSettings: vi.fn(),
        });

        await render();

        const expected = Math.round(stripDungeonMapSection(content).length / 4);
        expect(tokens.textContent).toBe(`(${expected}t)`);
        expect(expected).toBeLessThan(Math.round(content.length / 4));
    });
});
