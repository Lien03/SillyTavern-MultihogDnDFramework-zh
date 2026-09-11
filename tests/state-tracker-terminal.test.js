import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('State Tracker Agent Console wiring', () => {
    it('broadcasts State Tracker lifecycle steps from index.js', () => {
        const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(index).toContain("import { broadcastStateTrackerStep } from './src/ui/panel/agent-terminal.js'");
        expect(index).toContain("broadcastStateTrackerStep('start', isFullContext ? '正在初始化 State Tracker 完整审计…' : '正在初始化 State Tracker 扫描…')");
        expect(index).toContain("broadcastStateTrackerStep('finish', isFullContext ? 'State Tracker 完整审计完成。' : 'State Tracker 扫描完成。')");
        expect(index).toContain("broadcastStateTrackerStep('start', 'Processing direct State Tracker instruction...')");
    });

    it('keeps State Tracker terminal side effects separate from Lorebook Agent Stop button', () => {
        const panelBuilder = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
        expect(panelBuilder).toContain('AGENT_PANEL_RUNNING_SOURCES.has(source)');
        expect(panelBuilder).toContain('MANIFEST_REFRESH_SOURCES.has(source)');
    });
});
