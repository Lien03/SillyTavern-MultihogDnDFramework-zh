import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    CHARACTER_CREATOR_NAME_ADDITIONS,
    CHARACTER_NAME_POOLS,
    pickGenreCharacterName,
} from '../src/state/character-names.js';

describe('genre character-name pools', () => {
    it('keeps the supplied names in their matching genre pools', () => {
        expect(CHARACTER_NAME_POOLS.fantasy.firstNames).toContain('Aurelia');
        expect(CHARACTER_NAME_POOLS.fantasy.surnames).toContain('Moonwhisper');
        expect(CHARACTER_NAME_POOLS.realistic.firstNames).toContain('Harper');
        expect(CHARACTER_NAME_POOLS.realistic.surnames).toContain('Callahan');
        expect(CHARACTER_NAME_POOLS.scifi.firstNames).toContain('ARIA-7');
        expect(CHARACTER_NAME_POOLS.scifi.surnames).toContain('Nova Prime');
        expect(CHARACTER_NAME_POOLS.horror.firstNames).toContain('Bartholomew');
        expect(CHARACTER_NAME_POOLS.horror.surnames).toContain('Wormwood');
    });

    it('chooses a first-name / surname combination from the requested genre', () => {
        expect(pickGenreCharacterName('fantasy', () => 0)).toBe('Aurelia Blackwood');
        expect(pickGenreCharacterName('realistic', () => 0)).toBe('Eleanor Miller');
        expect(pickGenreCharacterName('scifi', () => 0)).toBe('Jax Vance');
        expect(pickGenreCharacterName('horror', () => 0)).toBe('Abigail Blackwood');
        expect(pickGenreCharacterName('unknown', () => 0)).toBe('Aurelia Blackwood');
    });

    it('makes every genre pool available to the Character Creator random-name button', () => {
        expect(CHARACTER_CREATOR_NAME_ADDITIONS.firstNames).toEqual(expect.arrayContaining([
            'Aurelia', 'Harper', 'ARIA-7', 'Bartholomew',
        ]));
        expect(CHARACTER_CREATOR_NAME_ADDITIONS.surnames).toEqual(expect.arrayContaining([
            'Blackwood', 'Hayes', 'Nexus', 'Wormwood',
        ]));
    });

    it('does not retain excluded names in any generated pool', () => {
        const allNames = Object.values(CHARACTER_NAME_POOLS)
            .flatMap(pool => [...pool.firstNames, ...pool.surnames])
            .concat(CHARACTER_CREATOR_NAME_ADDITIONS.firstNames, CHARACTER_CREATOR_NAME_ADDITIONS.surnames);
        for (const excluded of ['Vane', 'Kaelen', 'Thorne', 'Valerius']) {
            expect(allNames).not.toContain(excluded);
            expect(allNames.some(name => name.includes(excluded))).toBe(false);
        }
    });

    it('lets Instant Action use an optional typed/rolled name or let the AI choose', () => {
        const quickStartSource = readFileSync(new URL('../quickstart.js', import.meta.url), 'utf8');
        const creatorSource = readFileSync(new URL('../character-creator.js', import.meta.url), 'utf8');
        const rendererSource = readFileSync(new URL('../renderer.js', import.meta.url), 'utf8');

        expect(rendererSource).toContain('id="rt-quickstart-name" placeholder="可选——输入、掷骰或让 AI 选择"');
        expect(rendererSource).toContain('id="rt-quickstart-roll-name"');
        expect(rendererSource).toContain('id="rt-quickstart-begin"');
        expect(quickStartSource).toMatch(/selectedName = pickGenreCharacterName\(selectedGenre\)/);
        expect(quickStartSource).toMatch(/selectedName = nameInput\.value\.trim\(\)/);
        expect(quickStartSource).toMatch(/runQuickStart\(selectedGenre, rootEl, selectedName, instructionsInput\?\.value \|\| ''\)/);
        expect(quickStartSource).toMatch(/const nameVal = String\(selectedName \|\| ''\)\.trim\(\)/);
        expect(quickStartSource).not.toContain('Roll a character name before starting.');
        expect(quickStartSource).toMatch(/if \(!selectedGenre\) return;/);
        expect(quickStartSource).not.toMatch(/if \(!selectedGenre \|\| !selectedName\) return;/);
        expect(quickStartSource).toMatch(/generateQuickStartCharacter\(\{[\s\S]*?\bnameVal,/);
        expect(creatorSource).toMatch(/buildCharacterGenerationPrompt\(\{\s*nameVal: opts\.nameVal,/);
    });

    it('lets Other Ways reroll by selected genre and reuse the accepted name', () => {
        const cardEventsSource = readFileSync(new URL('../src/ui/panel/card-events.js', import.meta.url), 'utf8');

        expect(cardEventsSource).toMatch(/selectedOnboardingName = pickGenreCharacterName\(genre\)/);
        expect(cardEventsSource).toMatch(/selectedOnboardingName = onboardingRolledName\.value\.trim\(\)/);
        expect(cardEventsSource).toMatch(/const selectedName = selectedOnboardingName/);
        expect(cardEventsSource).toMatch(/clearOnboardingName\(\)/);
        expect(cardEventsSource).toContain('生成角色前请先掷一个角色名称。');
    });
});
