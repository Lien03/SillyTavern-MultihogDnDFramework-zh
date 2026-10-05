import * as chatAffinity from '../src/state/pass-affinity.js';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { canCommitPassForChat } from '../src/state/pass-affinity.js';
import { resolveBooksToScan } from '../src/state/lorebook-keyring.js';
import { getActiveChatId } from '../src/state/chat-persistence.js';

const source = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');
function install(context, name, code = source) {
    const match = code.match(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));
    if (!match) throw new Error(`Missing function ${name}`);
    runInContext(code.slice(match.index, code.indexOf('\n}', match.index) + 2).replace(/^export /, ''), context);
    return context[name];
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

describe('auto-generation lorebook affinity', () => {
    it.each(['forceCheckAutoGenerations', 'checkAndTriggerAutoGenerations', 'checkAndTriggerLocationAutoGenerations'])('%s stops after a mid-load chat switch', async name => {
        let chatId = 'A';
        const gate = deferred();
        const entered = deferred();
        const load = () => { entered.resolve(); return gate.promise; };
        const trigger = vi.fn();
        const known = new Set();
        const context = createContext({
        ...chatAffinity,
            console: { log() {}, error() {} }, getActiveChatId: () => chatId, canCommitPassForChat,
            getSettings: () => ({ portraitAutoGenerateNpcs: true, portraitAutoGenerateLocations: true, locationImages: true }),
            SillyTavern: { getContext: () => ({ chatId, loadWorldInfo: load }) },
            getEffectiveRouterCampaignPrefix: () => 'A', getPartyMembers: () => [], getEnemyEntities: () => [],
            reconcileMemoPortraitRenames() {}, triggerPlayerPortraitAutoGenIfNeeded() {},
            knownEntities: known, isFirstCheck: true,
            loadLocationLorebookEntries: load,
            triggerBackgroundPortraitGeneration: trigger, triggerBackgroundLocationGeneration: trigger,
        });
        const run = install(context, name);
        const pending = run(() => {});
        await entered.promise;
        chatId = 'B';
        gate.resolve(name === 'checkAndTriggerLocationAutoGenerations' ? [{ label: 'Town' }] : { entries: { 0: { comment: 'Alice' } } });
        await pending;
        expect(trigger).not.toHaveBeenCalled();
        expect(known.size).toBe(0);
        expect(context.isFirstCheck).toBe(true);
    });

    it.each([
        ['checkAndTriggerAutoGenerations', 'A'], ['checkAndTriggerAutoGenerations', undefined],
        ['forceCheckAutoGenerations', 'A'], ['forceCheckAutoGenerations', undefined],
    ])('%s loads the pinned NPC book when ctx.chatId is %s', async (name, ctxChatId) => {
        let tracked = 'B';
        const loadWorldInfo = vi.fn(async (bookName) => {
            expect(bookName).toBe('CampaignB_NPCs');
            return { entries: { 0: { comment: 'Bob', content: 'from B' } } };
        });
        const trigger = vi.fn();
        const prefixFor = vi.fn((id) => (id === 'B' ? 'CampaignB' : 'CampaignA'));
        const context = createContext({
            ...chatAffinity,
            console: { log() {}, error() {} },
            getActiveChatId: () => tracked,
            canCommitPassForChat,
            getSettings: () => ({
                enablePortraits: true,
                portraitAutoGenerateNpcs: true,
                npcPortraits: true,
                portraitAutoGenerateParty: false,
                portraitAutoGenerateEnemies: false,
                portraitAutoGenerateLocations: false,
            }),
            SillyTavern: { getContext: () => ({ chatId: ctxChatId, loadWorldInfo }) },
            getEffectiveRouterCampaignPrefix: prefixFor,
            getPartyMembers: () => [],
            getEnemyEntities: () => [],
            reconcileMemoPortraitRenames() {},
            triggerPlayerPortraitAutoGenIfNeeded() {},
            seedPlayerCharacterKnownEntities() {},
            getPrimaryCharacterBlockName: () => '',
            knownEntities: new Set(),
            isFirstCheck: false,
            hasPortrait: () => false,
            loadLocationLorebookEntries: async () => [],
            checkAndTriggerLocationAutoGenerations: async () => {},
            triggerBackgroundPortraitGeneration: trigger,
            triggerBackgroundLocationGeneration: vi.fn(),
        });
        const run = install(context, name);
        await run(() => {});
        expect(prefixFor).toHaveBeenCalledWith('B');
        expect(prefixFor).not.toHaveBeenCalledWith('A');
        expect(loadWorldInfo).toHaveBeenCalledWith('CampaignB_NPCs');
        expect(trigger).toHaveBeenCalledWith('Bob', expect.any(Function), 'from B', { chatId: 'B' });
    });

    it.each([undefined, 'Pinned'])('keeps the location book pinned across registry refresh (explicit id: %s)', async explicitId => {
        let tracked = 'B';
        const expectedId = explicitId || 'B';
        const loadWorldInfo = vi.fn(async () => ({ entries: { 0: { comment: 'Town', content: 'right town' } } }));
        const context = createContext({
            console, getActiveChatId: () => tracked,
            getEffectiveRouterCampaignPrefix: id => `Campaign${id}`,
            normalizeLocationPath: x => x,
            getSettings: () => ({ portraitAutoGenerateLocations: true, locationImages: true }),
            SillyTavern: { getContext: () => ({ chatId: 'A', loadWorldInfo,
                updateWorldInfoList: async () => { tracked = 'C'; },
            }) },
        });
        install(context, 'loadLocationLorebookMap');
        const run = install(context, 'loadLocationLorebookEntries');
        expect(await run(explicitId)).toEqual([{ label: 'Town', content: 'right town' }]);
        expect(loadWorldInfo).toHaveBeenCalledExactlyOnceWith(`Campaign${expectedId}_Locations`);
    });

    function sceneHarness() {
        const settings = { portraitLocationIncludePresentNpcs: true, chatStates: {
            A: { playerCharacter: { name: 'Alice', bio: 'wrong PC' }, campaignBooks: ['CampaignA_NPCs'] },
            B: { playerCharacter: { name: 'Bob', bio: 'right PC' }, campaignBooks: ['CampaignB_NPCs'] },
        } };
        const loadWorldInfo = vi.fn(async book => ({ entries: { 0: book === 'CampaignB_NPCs'
            ? { comment: 'Companion', content: 'right NPC' }
            : book === 'CampaignB_Locations' ? { comment: 'Region', content: 'right parent' }
                : { comment: 'Companion', content: 'wrong campaign' } } }));
        const request = vi.fn(async () => 'image prompt');
        const context = createContext({
            ...chatAffinity, console, getSettings: () => settings,
            _rpgCurrentChatId: () => 'B',
            SillyTavern: { getContext: () => ({ chatId: 'A', getCurrentChatId: () => 'A', loadWorldInfo }) },
            getEffectiveRouterCampaignPrefix: id => `Campaign${id}`,
            normalizeLocationPath: x => x, getAncestorLocationPaths: () => ['Region'], hasLocationImage: () => false,
            getMostRecentNarrativeText: () => 'Companion approaches.', stripCyoaChoiceBlocks: x => x,
            getWorldInfoNamesSafe: async () => ['CampaignA_NPCs', 'CampaignB_NPCs'],
            resolveBooksToScan, isNpcBookName: name => name.endsWith('_NPCs'),
            getRecentlyRecordedNpcIds: () => new Set(),
            getPortraitConnectionSettings: () => ({}), sendStateRequest: request,
        });
        runInContext(getActiveChatId.toString(), context);
        const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
        for (const name of ['getLivePrefix', 'narrativeMentionsNpcName', 'scanRecentOutputForPresentNpcs']) install(context, name, routerSource);
        for (const name of ['loadLocationLorebookMap', 'getLinkedPlayerCharacter', 'normalizeCharacterLabel',
            'formatRecentNarratorOutputs', 'loadPresentNpcsFromRecentOutput', 'loadPresentCharactersForLocationPrompt']) install(context, name);
        return { context, loadWorldInfo, request, run: install(context, 'generateLocationImagePrompt') };
    }

    it('builds scene prompts from the tracked campaign, including PC, NPCs and parent locations', async () => {
        const h = sceneHarness();
        expect(await h.run('Region :: Town', 'town')).toBe('image prompt');
        expect(h.loadWorldInfo.mock.calls.map(([book]) => book)).toEqual(['CampaignB_Locations', 'CampaignB_NPCs']);
        const prompt = h.request.mock.calls[0][2];
        expect(prompt).toContain('Player Character: Bob');
        expect(prompt).toContain('right PC');
        expect(prompt).toContain('right NPC');
        expect(prompt).toContain('right parent');
        expect(prompt).not.toContain('wrong');
        expect(prompt).not.toContain('Alice');
    });

    it.each([false, true])('does not send a scene prompt after a switch during the NPC scan (round trip: %s)', async roundTrip => {
        const h = sceneHarness();
        const gate = deferred();
        const entered = deferred();
        h.context.getWorldInfoNamesSafe = () => { entered.resolve(); return gate.promise; };
        const pending = h.run('Town', 'town');
        await entered.promise;
        chatAffinity.invalidateChatCommitGuards();
        h.context._rpgCurrentChatId = () => roundTrip ? 'B' : 'C';
        gate.resolve(['CampaignA_NPCs', 'CampaignB_NPCs']);
        await pending;
        expect(h.request).not.toHaveBeenCalled();
    });
});

describe.each(['portrait', 'location'])('%s queue affinity', kind => {
    function harness() {
        let chatId = 'A';
        const queue = [];
        const prompt = vi.fn().mockResolvedValue('prompt');
        const image = vi.fn().mockResolvedValue('image');
        const apply = vi.fn();
        const disable = vi.fn();
        const active = new Set();
        const context = createContext({
        ...chatAffinity,
            console: { log() {}, warn() {}, error() {} }, getActiveChatId: () => chatId, canCommitPassForChat,
            getSettings: () => ({ portraitAutoGenerateSceneView: kind === 'location' }),
            hasPortrait: () => false, hasLocationImage: () => false,
            activeGenerations: active, activeLocationGenerations: active,
            _imageGenQueue: queue, _imageGenQueueRunning: false, enqueueImageGen: job => queue.push(job),
            imageGenToast() {}, generatePortraitPrompt: prompt, generateNpcPortraitPrompt: prompt,
            generateLocationImagePrompt: prompt, generatePortraitDirect: image,
            scaleImageTo512Square: async x => x, scaleImageToLandscape: async x => x,
            applyPortraitData: apply, applyLocationImageData: apply,
            normalizeLocationPath: x => x, realtimeLocationGenerationFailed: false,
            activeRealtimeLocationAbortController: null, AbortController,
            disableRealtimeLocationGenerationAfterFailure: disable, stopRealtimeLocationGeneration() {},
        });
        const run = install(context, kind === 'portrait' ? 'triggerBackgroundPortraitGeneration' : 'triggerBackgroundLocationGeneration');
        return { queue, prompt, image, apply, disable, active,
            switchChat: () => { chatId = 'B'; },
            run: () => run('Alice', () => {}, '', { chatId: 'A', realtimeArrival: kind === 'location' }),
        };
    }
    it('rejects a stale caller pin before enqueueing', () => {
        const h = harness(); h.switchChat(); h.run();
        expect(h.queue).toHaveLength(0);
        expect(h.active.size).toBe(0);
    });
    it('does not build a prompt in another chat when the queue advances', async () => {
        const h = harness(); h.run(); h.switchChat(); await h.queue[0]();
        expect(h.prompt).not.toHaveBeenCalled();
        expect(h.active.size).toBe(0);
    });
    it('does not start image generation after switching during prompt generation', async () => {
        const h = harness(); const gate = deferred(); h.prompt.mockReturnValue(gate.promise);
        h.run(); const pending = h.queue[0](); h.switchChat(); gate.resolve('prompt'); await pending;
        expect(h.image).not.toHaveBeenCalled();
        expect(h.active.size).toBe(0);
    });
    it('still writes a completed image to the original chat', async () => {
        const h = harness(); const gate = deferred(); const entered = deferred();
        h.image.mockImplementation(() => { entered.resolve(); return gate.promise; });
        h.run(); const pending = h.queue[0](); await entered.promise; h.switchChat(); gate.resolve('image'); await pending;
        expect(h.apply).toHaveBeenCalledWith('Alice', 'image', { chatId: 'A' });
    });
    it('does not disable the arriving chat on a late image-generation failure', async () => {
        const h = harness(); const gate = deferred(); const entered = deferred();
        h.image.mockImplementation(() => { entered.resolve(); return gate.promise; });
        h.run(); const pending = h.queue[0](); await entered.promise; h.switchChat(); gate.reject(new Error('late failure')); await pending;
        expect(h.disable).not.toHaveBeenCalled();
        expect(h.apply).not.toHaveBeenCalled();
        expect(h.active.size).toBe(0);
    });
});
