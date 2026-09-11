import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const panelBuilderSource = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');

describe('display-time macro substitution ({{user}} etc.)', () => {
    it('State Tracker rendering substitutes macros in displayMemo, not the raw editable memo', () => {
        expect(indexSource).toContain('export function substituteDisplayMacros(text)');
        expect(indexSource).toContain('const displayMemo = substituteDisplayMacros(runtimeState.historyViewIndex === -1');
        // The raw memo passed to bindRenderedCardEvents (used for editing) must stay untouched.
        expect(indexSource).toContain('bindRenderedCardEvents(el, memo, false)');
    });

    it('quest log rendering also uses the macro-substituted memo', () => {
        expect(indexSource).toContain('getDisplayQuests(displayMemo)');
        expect(indexSource).not.toContain('getDisplayQuests(memo)');
    });

    it('Lorebook Agent panel substitutes macros for read-only summaries/sections', () => {
        expect(panelBuilderSource).toContain('function substituteDisplayMacros(text)');
        expect(panelBuilderSource).toContain('lines.map(l => escapeHtmlWithColor(substituteDisplayMacros(l)))');
        expect(panelBuilderSource).toContain('escapeHtmlWithColor(substituteDisplayMacros(match[2]))');
    });

    it('Lorebook Agent tree-view expanded entry (Permanent + campaign history) substitutes macros', () => {
        expect(panelBuilderSource).toContain("coreRead.innerHTML = `<div class=\"rt-agent-core-label\">永久</div><div class=\"rt-agent-core-text\">${escapeHtmlWithColor(substituteDisplayMacros(coreMatch[1].trim()))}</div>`;");
        expect(panelBuilderSource).toContain("contentRead.textContent = substituteDisplayMacros(dynamic) || '（尚未记录战役历史）';");
        expect(panelBuilderSource).toContain('contentRead.textContent = substituteDisplayMacros(dynamic);');
        expect(panelBuilderSource).toContain("contentRead.textContent = substituteDisplayMacros(raw) || '（空）';");
    });

    it('Lorebook Agent edit textareas still load the raw, unsubstituted content', () => {
        // Editing must always start from the literal stored text so macros round-trip on save.
        expect(panelBuilderSource).toContain("contentArea.value = item.content || '';");
        expect(panelBuilderSource).toContain("textarea.value = item.content || '';");
    });
});

import { buildDefaultSettings } from '../src/state/defaults.js';

describe('Lorebook Agent player-character naming rules', () => {
    it('instructs the agent to write the bare {{user}} macro without class/profession parentheticals', () => {
        const defaults = buildDefaultSettings();
        expect(defaults.routerBasicSystemPromptTemplate).toContain('Write `{{user}}` bare — never followed by a class, profession, title, or parenthetical');
    });
});
