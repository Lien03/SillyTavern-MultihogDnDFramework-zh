import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSkeletonLorebookSourceContext } from '../src/features/world-progression/skeleton-lorebooks.js';
import { getSettings } from '../state-manager.js';
import { testExtensionSettings } from './setup.js';

const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
const persistenceSource = readFileSync(new URL('../src/state/chat-persistence.js', import.meta.url), 'utf8');

describe('World Skeleton lorebook source context', () => {
    beforeEach(() => {
        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
    });

    it('injects full selected lorebook entries as established canon', async () => {
        const loadWorldInfo = vi.fn(async name => ({
            entries: {
                1: { comment: 'The Brass Court', content: 'A mercantile council controls the harbor.', disable: true },
                2: { key: ['Glassward'], content: 'A district built over volcanic glass.' },
            },
            name,
        }));

        const result = await buildSkeletonLorebookSourceContext(['Existing World'], loadWorldInfo);

        expect(result).toContain('## EXISTING LOREBOOK SOURCE MATERIAL');
        expect(result).toContain('### LOREBOOK: Existing World');
        expect(result).toContain('#### The Brass Court');
        expect(result).toContain('A mercantile council controls the harbor.');
        expect(result).toContain('#### Glassward');
        expect(result).toContain('established world canon');
    });

    it('excludes skeleton books and tolerates unavailable selected books', async () => {
        const loadWorldInfo = vi.fn(async name => {
            if (name === 'Missing') throw new Error('not found');
            return { entries: { 0: { comment: 'Canon', content: 'Kept.' } } };
        });

        const result = await buildSkeletonLorebookSourceContext(
            ['Campaign_Skeleton', 'Missing', 'Canon Book', 'Canon Book'],
            loadWorldInfo,
        );

        expect(result).toContain('### LOREBOOK: Canon Book');
        expect(result).not.toContain('Campaign_Skeleton');
        expect(loadWorldInfo).toHaveBeenCalledTimes(2);
    });

    it('can prohibit extrapolation and ignore requested counts', async () => {
        const result = await buildSkeletonLorebookSourceContext(
            ['Canon Book'],
            async () => ({ entries: { 0: { comment: 'Known Faction', content: 'Explicit source entity.' } } }),
            { lorebookOnly: true },
        );

        expect(result).toContain('only for factions, locations, and conflicts explicitly mentioned');
        expect(result).toContain('Named individuals remain source constraints');
        expect(result).toContain('Do not invent, infer, or extrapolate');
        expect(result).toContain('Ignore the requested category counts');
        expect(result).not.toContain('create compatible additions');
    });

    it('wires a dedicated per-chat lorebook selector into skeleton generation', () => {
        expect(settingsMarkup).toContain('>骨架源');
        expect(settingsMarkup).not.toContain('>氛围栏');
        expect(settingsMarkup).toContain('id="rpg_world_progression_skeleton_use_lorebooks"');
        expect(settingsMarkup).toContain('id="rpg_world_progression_skeleton_lorebook_list"');
        expect(settingsMarkup).toContain('id="rpg_world_progression_skeleton_lorebook_only"');
        expect(settingsMarkup).toContain('id="rpg_world_progression_skeleton_counts"');
        expect(settingsMarkup).not.toContain('id="rpg_world_progression_skeleton_npcs"');
        expect(routerSource).toContain('buildSkeletonLorebookSourceContext');
        expect(routerSource).toContain('MACRO-ONLY SKELETON CONTRACT (AUTHORITATIVE)');
        expect(routerSource).not.toContain('runSkeletonGeneratorAgent');
        expect(routerSource).not.toContain('promoteSkeletonEntity');
        expect(routerSource).not.toContain("'NPCS': 'NPC'");
        expect(routerSource).toContain('worldProgressionSkeletonLorebookFilter');
        expect(routerSource).toContain('LOREBOOK-ONLY MODE — OVERRIDES EXACT COUNTS');
        expect(persistenceSource).toContain('worldProgressionSkeletonUseLorebooks:');
        expect(persistenceSource).toContain('worldProgressionSkeletonLorebookFilter:');
        expect(persistenceSource).toContain('worldProgressionSkeletonLorebookOnly:');
        expect(persistenceSource).not.toContain('worldProgressionSkeletonNPCs:');
    });

    it('migrates the shipped NPC skeleton prompt and scrubs retired entity-focus state', () => {
        testExtensionSettings.rpg_tracker = {
            worldProgressionSkeletonNPCs: 5,
            worldProgressionRandomizeNPCs: true,
            worldProgressionRandomSkeletonFactionCount: 4,
            worldProgressionSkeletonSystemPrompt: `## NPCS
### NPC Name
Generate exactly {factionCount} factions and {npcCount} NPCs.`,
            chatStates: {
                campaign: { worldProgressionSkeletonNPCs: 2, worldProgressionRandomizeConflicts: true },
            },
            profiles: {
                legacy: { worldProgressionSkeletonNPCs: 3, worldProgressionRandomNarrativeNPCCount: 6 },
            },
        };

        const settings = getSettings();
        expect(settings.worldProgressionSkeletonSystemPrompt).not.toContain('## NPCS');
        expect(settings.worldProgressionSkeletonSystemPrompt).not.toContain('{npcCount}');
        expect(settings.worldProgressionSkeletonSystemPrompt).toContain('## CONFLICTS');
        expect(settings).not.toHaveProperty('worldProgressionSkeletonNPCs');
        expect(settings).not.toHaveProperty('worldProgressionRandomizeNPCs');
        expect(settings).not.toHaveProperty('worldProgressionRandomSkeletonFactionCount');
        expect(settings.chatStates.campaign).not.toHaveProperty('worldProgressionSkeletonNPCs');
        expect(settings.chatStates.campaign).not.toHaveProperty('worldProgressionRandomizeConflicts');
        expect(settings.profiles.legacy).not.toHaveProperty('worldProgressionSkeletonNPCs');
        expect(settings.profiles.legacy).not.toHaveProperty('worldProgressionRandomNarrativeNPCCount');
    });

    it('keeps chat-based Skeleton Source generation free of named story entities', () => {
        expect(routerSource).toContain('Generalize from the setting rather than copying story entities verbatim.');
        expect(routerSource).toContain('Do NOT name or identify player characters, party members, NPCs, factions, institutions, locations, quests, or conflicts');
        expect(routerSource).toContain('Never turn a party member or current story participant into Skeleton Source material.');
        expect(routerSource).toContain('Output ONLY the single-paragraph Skeleton Source.');
    });
});
