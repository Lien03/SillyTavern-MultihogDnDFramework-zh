import { describe, expect, it, beforeEach } from 'vitest';
import {
    copyChatStatePartition,
    remapBookKeyedKey,
    remapBookKeyedList,
    remapBookKeyedMap,
} from '../src/features/chat/branch-campaign-utils.js';
import { testExtensionSettings } from './setup.js';

describe('branch campaign key remapping', () => {
    const rename = { Eldoria_NPCs: 'Eldoria_Branch_NPCs', Eldoria: 'Eldoria_Branch' };

    it('rewrites book::uid keys onto cloned book names', () => {
        expect(remapBookKeyedKey('Eldoria_NPCs::42', rename)).toBe('Eldoria_Branch_NPCs::42');
        expect(remapBookKeyedKey('Eldoria', rename)).toBe('Eldoria_Branch');
        expect(remapBookKeyedKey('Other_NPCs::1', rename)).toBe('Other_NPCs::1');
        expect(remapBookKeyedKey('Eldoria_NPCs::42', {})).toBe('Eldoria_NPCs::42');
    });

    it('rewrites relationship maps without mutating the source', () => {
        const source = {
            'Eldoria_NPCs::7': { friendship: 18, affection: -4 },
            'Other_NPCs::3': { friendship: 1, affection: 0 },
        };
        const remapped = remapBookKeyedMap(source, rename);

        expect(remapped).toEqual({
            'Eldoria_Branch_NPCs::7': { friendship: 18, affection: -4 },
            'Other_NPCs::3': { friendship: 1, affection: 0 },
        });
        expect(source['Eldoria_NPCs::7'].friendship).toBe(18);
        remapped['Eldoria_Branch_NPCs::7'].friendship = 99;
        expect(source['Eldoria_NPCs::7'].friendship).toBe(18);
        expect(remapBookKeyedList(['Eldoria_NPCs::7', 'Eldoria'], rename))
            .toEqual(['Eldoria_Branch_NPCs::7', 'Eldoria_Branch']);
    });
});

describe('copyChatStatePartition relationship copy', () => {
    beforeEach(() => {
        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
    });

    it('does not inherit the source campaign rename pin', () => {
        const s = { chatStates: { source: { renamedCampaignPrefix: 'Original', campaignBooks: ['Original_NPCs'] } } };
        const copy = copyChatStatePartition(s, 'source', 'branch', 'Branch', { Original_NPCs: 'Branch_NPCs' });
        expect(copy.renamedCampaignPrefix).toBeUndefined();
        expect(copy.routerCampaignPrefix).toBe('Branch');
        expect(copy.campaignBooks).toEqual(['Branch_NPCs']);
        expect(s.chatStates.source.renamedCampaignPrefix).toBe('Original');
    });

    it('copies and remaps relationship stats onto the cloned lorebook names', () => {
        const s = {
            npcRelationshipValues: { 'Live_NPCs::1': { friendship: 5, affection: 0 } },
            chatStates: {
                source: {
                    currentMemo: '[CHARACTER]Hero[/CHARACTER]',
                    campaignBooks: ['Eldoria_NPCs'],
                    activeRouterKeys: ['Eldoria_NPCs::7'],
                    npcRelationshipValues: {
                        'Eldoria_NPCs::7': { friendship: 22, affection: 9 },
                    },
                    npcRelationshipLog: {
                        'Eldoria_NPCs::7': [{ field: 'friendship', delta: 2, newValue: 22 }],
                    },
                },
            },
        };

        const copy = copyChatStatePartition(
            s,
            'source',
            'source - Branch #1',
            'source_Branch_1',
            { Eldoria_NPCs: 'source_Branch_1_NPCs' },
        );

        expect(copy.npcRelationshipValues).toEqual({
            'source_Branch_1_NPCs::7': { friendship: 22, affection: 9 },
        });
        expect(copy.npcRelationshipLog).toEqual({
            'source_Branch_1_NPCs::7': [{ field: 'friendship', delta: 2, newValue: 22 }],
        });
        expect(copy.activeRouterKeys).toEqual(['source_Branch_1_NPCs::7']);
        expect(s.chatStates.source.npcRelationshipValues).toEqual({
            'Eldoria_NPCs::7': { friendship: 22, affection: 9 },
        });
        expect(s.chatStates['source - Branch #1']).toBe(copy);
    });

    it('falls back to live relationship maps when the source partition lacks them', () => {
        const s = {
            npcRelationshipValues: {
                'Eldoria_NPCs::7': { friendship: 40, affection: 12 },
            },
            npcRelationshipLog: {
                'Eldoria_NPCs::7': [{ field: 'affection', delta: 1, newValue: 12 }],
            },
            chatStates: {
                source: {
                    currentMemo: 'memo',
                    activeRouterKeys: ['Eldoria_NPCs::7'],
                },
            },
        };

        const copy = copyChatStatePartition(
            s,
            'source',
            'branch',
            'branch',
            { Eldoria_NPCs: 'branch_NPCs' },
        );

        expect(copy.npcRelationshipValues).toEqual({
            'branch_NPCs::7': { friendship: 40, affection: 12 },
        });
        expect(copy.npcRelationshipLog).toEqual({
            'branch_NPCs::7': [{ field: 'affection', delta: 1, newValue: 12 }],
        });
        expect(s.npcRelationshipValues['Eldoria_NPCs::7'].friendship).toBe(40);
    });
});
