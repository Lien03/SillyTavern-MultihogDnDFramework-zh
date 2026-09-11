import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rendererSource = readFileSync(new URL('../renderer.js', import.meta.url), 'utf8');
const creatorSource = readFileSync(new URL('../character-creator.js', import.meta.url), 'utf8');

describe('Character Creator fields', () => {
    it('exposes Orientation to the right of Age, with a relationship-system help tip', () => {
        expect(rendererSource).toContain('id="rt-cr-orientation"');
        // Field must sit after Age in the same Name/Gender/Age row.
        const ageIdx = rendererSource.indexOf('id="rt-cr-age"');
        const orientIdx = rendererSource.indexOf('id="rt-cr-orientation"');
        expect(ageIdx).toBeGreaterThan(-1);
        expect(orientIdx).toBeGreaterThan(ageIdx);
        expect(rendererSource).toContain('关系系统与 CYOA 浪漫选项需要此项');
        expect(creatorSource).toContain('orientationVal');
        expect(creatorSource).toContain('Sexual Orientation:');
        expect(creatorSource).toContain("setVal('#rt-cr-orientation'");
    });

    it('only requests an Abilities preference when the [ABILITIES] module is enabled', () => {
        expect(creatorSource).toMatch(/hasAbilities\s*\?\s*`Abilities:/);
        expect(creatorSource).not.toMatch(/^Abilities:\s/m);
    });

    it('instructs the model to defer entirely to the module instructions, never a generic D&D fallback', () => {
        expect(creatorSource).toContain('do not invent, omit, rename, or substitute fields');
        expect(creatorSource).toContain('do not fall back to a generic D&D template');
        expect(creatorSource).toContain('it is disabled — do NOT output that block or its concept');
    });

    it('labels the CHARACTER header control Create PC Card', () => {
        expect(rendererSource).toContain('class="rt-char-to-persona-btn"');
        expect(rendererSource).toContain('创建 PC 卡');
        const btnBlock = rendererSource.slice(
            rendererSource.indexOf('class="rt-char-to-persona-btn"'),
            rendererSource.indexOf('class="rt-char-to-persona-btn"') + 500,
        );
        expect(btnBlock).not.toMatch(/>\s*👤\s*</);
    });

    it('keeps the main creator boxes free of example placeholders', () => {
        const ids = [
            'rt-cr-name',
            'rt-cr-gender',
            'rt-cr-age',
            'rt-cr-orientation',
            'rt-cr-species',
            'rt-cr-ethnicity',
            'rt-cr-background',
            'rt-cr-appearance',
        ];

        for (const id of ids) {
            const input = rendererSource.match(new RegExp(`<input id="${id}"[^>]*>`))?.[0];
            expect(input, `missing ${id}`).toBeTruthy();
            expect(input).not.toContain('placeholder=');
        }
    });
});
