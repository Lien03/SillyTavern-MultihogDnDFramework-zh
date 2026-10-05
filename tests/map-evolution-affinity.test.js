import * as chatAffinity from '../src/state/pass-affinity.js';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { WORLD_REPORT_METADATA_KEY } from '../world-progression-lib.js';

const source = readFileSync(new URL('../map-evolution.js', import.meta.url), 'utf8');

function install(context, name) {
    const match = source.match(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));
    if (!match) throw new Error(`Missing function ${name}`);
    const start = match.index;
    const next = source.indexOf('\nfunction ', start + 1);
    const end = next === -1 ? source.length : next;
    runInContext(source.slice(start, end).replace(/^export /, ''), context);
    return context[name];
}

describe('Map Evolution World Report affinity', () => {
    it.each([undefined, 'A'])('loads the tracked campaign World book when ctx.chatId is %s', async (ctxChatId) => {
        const loadWorldInfo = vi.fn(async (bookName) => {
            expect(bookName).toBe('CampaignB_World');
            return {
                entries: {
                    3: {
                        comment: 'Day 4',
                        key: ['world report'],
                        content: 'Pressure at Morrowfen docks.',
                        extensions: {
                            [WORLD_REPORT_METADATA_KEY]: {
                                reportId: 'CampaignB_World::3',
                                periodLabel: 'Day 4',
                                selectedLocations: ['Morrowfen'],
                            },
                        },
                    },
                },
            };
        });
        const prefixFor = vi.fn((id) => (id === 'B' ? 'CampaignB' : 'CampaignA'));
        const context = createContext({
            ...chatAffinity,
            console: { log() {}, warn() {}, error() {} },
            getActiveChatId: () => 'B',
            getEffectiveRouterCampaignPrefix: prefixFor,
            WORLD_REPORT_METADATA_KEY,
            normalizeWorldReportMetadata: (entry, bookName, uid) => ({
                reportId: entry?.extensions?.[WORLD_REPORT_METADATA_KEY]?.reportId || `${bookName}::${uid}`,
                periodLabel: entry?.extensions?.[WORLD_REPORT_METADATA_KEY]?.periodLabel || entry?.comment || '',
                selectedLocations: entry?.extensions?.[WORLD_REPORT_METADATA_KEY]?.selectedLocations || [],
            }),
        });
        const loadRecentWorldReports = install(context, 'loadRecentWorldReports');
        const reports = await loadRecentWorldReports({}, {
            chatId: ctxChatId,
            getCurrentChatId: () => ctxChatId,
            loadWorldInfo,
        });

        expect(prefixFor).toHaveBeenCalledWith('B');
        expect(prefixFor).not.toHaveBeenCalledWith('A');
        expect(loadWorldInfo).toHaveBeenCalledWith('CampaignB_World');
        expect(reports).toHaveLength(1);
        expect(reports[0].reportId).toBe('CampaignB_World::3');
    });

    it('prefers an explicit pass chat id over a live getActiveChatId change', async () => {
        let tracked = 'B';
        const loadWorldInfo = vi.fn(async (bookName) => {
            expect(bookName).toBe('CampaignB_World');
            return { entries: {} };
        });
        const prefixFor = vi.fn((id) => (id === 'B' ? 'CampaignB' : id === 'C' ? 'CampaignC' : 'CampaignA'));
        const context = createContext({
            ...chatAffinity,
            console: { log() {}, warn() {}, error() {} },
            getActiveChatId: () => tracked,
            getEffectiveRouterCampaignPrefix: prefixFor,
            WORLD_REPORT_METADATA_KEY,
            normalizeWorldReportMetadata: () => ({ reportId: '', periodLabel: '', selectedLocations: [] }),
        });
        const loadRecentWorldReports = install(context, 'loadRecentWorldReports');
        tracked = 'C';
        await loadRecentWorldReports({}, { chatId: 'A', loadWorldInfo }, 'B');
        expect(prefixFor).toHaveBeenCalledWith('B');
        expect(prefixFor).not.toHaveBeenCalledWith('A');
        expect(prefixFor).not.toHaveBeenCalledWith('C');
        expect(loadWorldInfo).toHaveBeenCalledWith('CampaignB_World');
    });
});
