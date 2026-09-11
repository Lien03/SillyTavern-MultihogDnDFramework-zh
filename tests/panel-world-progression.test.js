import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { wireAgentWorldProgression } from '../src/ui/panel/panel-world-progression.js';

describe('World Progression panel controls', () => {
    it('loads the extension-root router for on-demand report generation', () => {
        const source = readFileSync(new URL('../src/ui/panel/panel-world-progression.js', import.meta.url), 'utf8');

        expect(source.match(/import\('\.\.\/\.\.\/\.\.\/router\.js'\)/g)).toHaveLength(2);
        expect(source).not.toContain("import('./router.js')");
    });

    it('exposes a status updater that reflects the current tracker setting', () => {
        const last = { textContent: '' };
        const next = { textContent: '' };
        const badge = { textContent: '', style: {}, addEventListener: vi.fn() };
        const elements = new Map([
            ['#rt-agent-world-last-fired', last],
            ['#rt-agent-world-next-fire', next],
            ['#rt-agent-world-enabled-badge', badge],
        ]);
        const settings = {
            worldProgressionEnabled: true,
            worldProgressionIntervalHours: 24,
            worldProgressionLastFiredPeriodLabel: '',
            currentMemo: '',
        };

        const controls = wireAgentWorldProgression({
            agentPanel: { querySelector: (selector) => elements.get(selector) || null },
            confirmAndPurgeWorldHistory: vi.fn(),
            extractCurrentTimeStr: () => '',
            formatInWorldTime: () => '',
            getSettings: () => settings,
            parseInWorldTime: () => null,
            saveChatState: vi.fn(),
            saveSettings: vi.fn(),
            syncCampaignPrefixAndWorldsForChat: vi.fn(),
        });

        controls.updateStatus();

        expect(last.textContent).toBe('从未');
        expect(next.textContent).toBe('—');
        expect(badge.textContent).toBe('开');
        expect(badge.style.cssText).toContain('#34a853');
    });
});
