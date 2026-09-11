import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../portrait-storage.js', () => ({
    lookupCustomPortraitSrc: () => '',
}));

import {
    buildGameSystemWizardPreviewMemo,
    extractGameSystemWizardTemplate,
} from '../src/features/game-system-wizard-preview.js';
import { renderMemoAsCards } from '../renderer.js';

describe('Game System Wizard UI live preview', () => {
    const output = `Track fuel accurately.

Output each turn:
[FUEL]
- Fuel: ((BAR)) 650/1000
Status: ((PILLS)) Adequate
[/FUEL]`;

    it('extracts the matching sample block from tracker instructions', () => {
        expect(extractGameSystemWizardTemplate(output, 'FUEL')).toBe(
            '- Fuel: ((BAR)) 650/1000\nStatus: ((PILLS)) Adequate',
        );
        expect(extractGameSystemWizardTemplate(output, 'OXYGEN')).toBe('');
    });

    it('uses the last complete matching block when instructions contain multiple examples', () => {
        const content = `${output}\n\n[FUEL]\nFuel: ((BARREL)) 900/1000\n[/FUEL]`;
        expect(buildGameSystemWizardPreviewMemo(content, 'fuel')).toBe(
            '[FUEL]\nFuel: ((BARREL)) 900/1000\n[/FUEL]',
        );
    });

    it('does not preview a different tag that saving would discard', () => {
        expect(buildGameSystemWizardPreviewMemo(output, 'OXYGEN')).toBe('');
    });

    it('wires the editable tracker source into the read-only renderer and saved template', () => {
        const source = readFileSync(new URL('../game-systems.js', import.meta.url), 'utf8');
        expect(source).toContain('id="rt-gs-ui-live-preview"');
        expect(source).not.toContain('id="rt-gs-ui-live-preview" class="rpg-tracker-render-view" contenteditable="true"');
        expect(source).toContain('编辑该源块即可更新此只读预览');
        expect(source).toContain("$id('rt-gs-trkcontent')?.addEventListener('input'");
        expect(source).toContain('preview.innerHTML = renderMemoAsCards(previewMemo, trackerTag, previewSectionPages, {');
        expect(source).toContain("preview.querySelector('.rt-fullview-btn')?.addEventListener('click'");
        expect(source).toContain("preview.querySelectorAll('.rt-page-btn').forEach");
        expect(source).toContain('field.template = extractGameSystemWizardTemplate(result.trackerContent, result.trackerTag);');
        expect(source).toContain('template: extractGameSystemWizardTemplate(result.trackerContent, result.trackerTag),');
    });

    it('can hide persistent category controls and override full-list mode for previews', () => {
        const memo = `[FUEL]\n${Array.from({ length: 12 }, (_, index) => `Item ${index + 1}`).join('\n')}\n[/FUEL]`;
        const paged = renderMemoAsCards(memo, 'FUEL', {}, {
            fullViewSections: [],
            showCategorySettings: false,
        });
        expect(paged).not.toContain('rt-category-settings-btn');
        expect(paged).toContain('rt-fullview-btn');
        expect(paged).toContain('rt-pagination');

        const full = renderMemoAsCards(memo, 'FUEL', {}, {
            fullViewSections: ['FUEL'],
            showCategorySettings: false,
        });
        expect(full).toContain('rt-fullview-btn active');
        expect(full).not.toContain('rt-pagination');
    });
});
