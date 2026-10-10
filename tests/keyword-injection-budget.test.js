import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createChatCommitGuard, chatCommitResult } from '../src/state/pass-affinity.js';
import { resolveBooksToScan, isSkeletonBookName } from '../src/state/lorebook-keyring.js';
import { getDungeonMapAttachment } from '../dungeon-reality.js';

const source = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
const start = source.indexOf('export async function scanAssistantOutputForKeywords(');
const end = source.indexOf('\n}', start) + 2;
const scanSource = source.slice(start, end).replace(/^export /, '');

function harness(entries, overrides = {}) {
    const settings = {
        activeRouterKeys: [], keywordActivatedKeys: [], pinnedRouterKeys: [],
        routerMaxActivations: 2, routerMaxKeywordOverflow: 1,
        chatStates: { Campaign: { campaignBooks: ['Campaign_NPCs'] } },
        ...overrides,
    };
    const context = createContext({
        createChatCommitGuard, chatCommitResult, resolveBooksToScan, isSkeletonBookName,
        getDungeonMapAttachment,
        getSettings: () => settings, getActiveChatId: () => 'Campaign',
        getLivePrefix: () => 'Campaign', _rpgCurrentChatId: () => 'Campaign',
        isLorebookAgentRuntimeActive: () => true,
        isSkeletonEntryId: id => isSkeletonBookName(id.split('::')[0]),
        getWorldInfoNamesSafe: async () => ['Campaign_NPCs'],
        SillyTavern: { getContext: () => ({
            chat: [{ mes: 'We visited the city.', is_user: false }],
            loadWorldInfo: async () => ({ entries }),
        }) },
        saveSettings: () => {},
    });
    runInContext(scanSource, context);
    return { settings, scan: context.scanAssistantOutputForKeywords };
}

describe('same-turn keyword lore injection budget', () => {
    it('returns only retained matches when a shared location keyword floods the scan', async () => {
        const entries = Object.fromEntries(Array.from({ length: 30 }, (_, id) =>
            [id, { key: ['city'], content: `Archive ${id}` }]));
        const { settings, scan } = harness(entries);

        const triggered = await scan('What is my home?', { sweepEnabled: false });

        expect(settings.activeRouterKeys).toEqual([
            'Campaign_NPCs::27', 'Campaign_NPCs::28', 'Campaign_NPCs::29',
        ]);
        expect(triggered).toEqual(settings.activeRouterKeys);
        expect(settings.lastKeywordTriggeredKeys).toEqual(triggered);
    });

    it('keeps direct matches, pins and agent-owned entries when lookback matches overflow', async () => {
        const entries = {
            pinned: { key: ['keep'], content: 'Pinned' },
            agent: { key: ['keep'], content: 'Agent-owned' },
            home: { key: ['home'], content: 'Established home' },
            ...Object.fromEntries(Array.from({ length: 20 }, (_, id) =>
                [id, { key: ['city'], content: `Archive ${id}` }])),
        };
        const { settings, scan } = harness(entries, {
            activeRouterKeys: ['Campaign_NPCs::pinned', 'Campaign_NPCs::agent'],
            pinnedRouterKeys: ['Campaign_NPCs::pinned'],
        });

        const triggered = await scan('Return home.', { sweepEnabled: false });

        expect(settings.activeRouterKeys).toEqual([
            'Campaign_NPCs::pinned', 'Campaign_NPCs::agent', 'Campaign_NPCs::home',
        ]);
        expect(triggered).toEqual(['Campaign_NPCs::home']);
        expect(settings.keywordActivatedKeys).toEqual(['Campaign_NPCs::home']);
    });

    it('returns every match when the keyword overflow limit is disabled', async () => {
        const entries = { 0: { key: ['city'] }, 1: { key: ['city'] }, 2: { key: ['city'] } };
        const { settings, scan } = harness(entries, { routerMaxKeywordOverflow: 0 });

        const triggered = await scan('The city.', { sweepEnabled: false });

        expect(triggered).toHaveLength(3);
        expect(triggered).toEqual(settings.activeRouterKeys);
    });
});
