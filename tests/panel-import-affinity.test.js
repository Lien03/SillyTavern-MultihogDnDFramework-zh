import * as chatAffinity from '../src/state/pass-affinity.js';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { parseAst } from 'rollup/parseAst';
import { canCommitPassForChat } from '../src/state/pass-affinity.js';
import { canUseSceneMemo } from '../src/state/scene-affinity.js';

const source = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
// Execute the production closures with controlled host I/O, without mounting the
// entire panel or loading SillyTavern's browser-only dependencies.
function closure(name) {
    let declaration;
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'VariableDeclarator' && node.id.name === name) declaration = node;
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        }
    }
    visit(parseAst(source));
    if (!declaration) throw new Error(`Missing closure ${name}`);
    return `const ${source.slice(declaration.start, declaration.end)}; globalThis.run = ${name};`;
}
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

describe('panel import chat ownership', () => {
    it.each([false, true])('guards Real-Time generation after scene loading (switched=%s)', async switched => {
        const immersion = readFileSync(new URL('../immersion.js', import.meta.url), 'utf8');
        const start = immersion.indexOf('export async function runRealtimeSceneArtCheck');
        const end = immersion.indexOf('\n}', start) + 2;
        const gate = deferred();
        let chatId = 'A';
        const generate = vi.fn();
        const context = createContext({
        ...chatAffinity, ownsChat: chatAffinity.createChatCommitGuard('A', () => chatId),
            getSettings: () => ({ portraitAutoGenerateSceneView: true, locationImages: true }),
            getActiveChatId: () => chatId, canCommitPassForChat, canUseSceneMemo,
            buildImmersionSceneState: () => gate.promise,
            maybeAutoGenerateImmersionSceneArt: generate, console,
        });
        runInContext(immersion.slice(start, end).replace(/^export /, ''), context);
        const pending = context.runRealtimeSceneArtCheck();
        if (switched) chatId = 'B';
        gate.resolve({ storagePath: 'A location' });
        await pending;
        expect(generate).toHaveBeenCalledTimes(switched ? 0 : 1);
    });

    it.each(['portrait', 'location'])('pins a %s drop before reading the file', async kind => {
        const gate = deferred();
        let chatId = 'A';
        const apply = vi.fn();
        const marker = kind === 'portrait' ? 'portraitWrap.addEventListener(\'drop\'' : 'locThumbWrap.addEventListener(\'drop\'';
        const start = source.indexOf(marker);
        const end = source.indexOf('\n                                        });', start);
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        let handler;
        const element = { style: {}, classList: { remove() {} }, addEventListener: (_event, fn) => { handler = fn; } };
        const context = createContext({
        ...chatAffinity, ownsChat: chatAffinity.createChatCommitGuard('A', () => chatId),
            portraitWrap: element, locThumbWrap: element,
            getActiveChatId: () => chatId,
            fileToDataUrl: () => gate.promise,
            scaleImageTo512Square: async x => x, scaleImageToLandscape: async x => x,
            applyPortraitData: apply, applyLocationImageData: apply,
            item: { label: 'Alice' }, locFullPath: 'Town',
            toastr: { success() {}, error() {} }, console,
            refreshManifest: async () => {}, refreshRenderedView() {},
        });
        runInContext(source.slice(start, end) + '\n});', context);
        const pending = handler({ preventDefault() {}, stopPropagation() {}, dataTransfer: { files: [{ type: 'image/png' }] } });
        chatId = 'B';
        gate.resolve('image');
        await pending;
        expect(apply).toHaveBeenCalledWith(kind === 'portrait' ? 'Alice' : 'Town', 'image', { chatId: 'A' });
    });

    it('pins a library portrait before fetching it', async () => {
        const gate = deferred();
        let chatId = 'A';
        const apply = vi.fn();
        const context = createContext({
        ...chatAffinity, ownsChat: chatAffinity.createChatCommitGuard('A', () => chatId), getActiveChatId: () => chatId, fetchSrcAsDataUrl: () => gate.promise, applyPortraitData: apply, console });
        runInContext(closure('applyLibraryPortrait', 16), context);
        const pending = context.run('Alice', 'portrait.png');
        chatId = 'B';
        gate.resolve('data:image/png;base64,test');
        await pending;
        expect(apply).toHaveBeenCalledWith('Alice', 'data:image/png;base64,test', { chatId: 'A' });
    });

    it.each([true, false])('keeps NPC import follow-ups out of the arriving chat (portrait=%s)', async withPortrait => {
        const gate = deferred();
        const entered = deferred();
        let chatId = 'A';
        const settings = { activeRouterKeys: [], npcRelationshipValues: {}, portraitAutoGenerateNpcs: true };
        const apply = vi.fn();
        const generate = vi.fn();
        const activate = vi.fn();
        const remember = vi.fn();
        const context = createContext({
        ...chatAffinity, ownsChat: chatAffinity.createChatCommitGuard('A', () => chatId),
            SillyTavern: { getContext: () => ({ loadWorldInfo: async () => ({ entries: {} }), executeSlashCommandsWithOptions: activate }) },
            getSettings: () => settings, getActiveChatId: () => chatId, canCommitPassForChat,
            fetch: () => { entered.resolve(); return gate.promise; }, getRequestHeaders: () => ({}),
            updateWorldInfoCache: async () => true, rememberCampaignBook: remember,
            saveSettings: vi.fn(), applyPortraitData: apply, triggerBackgroundPortraitGeneration: generate,
            refreshAll() {}, console,
        });
        runInContext(closure('createNpcFromCharCard', 8), context);
        const pending = context.run({ name: 'Alice', ...(withPortrait ? { avatar: 'alice.png' } : {}) }, 'A_NPCs');
        await entered.promise;
        chatId = 'B';
        gate.resolve({ ok: true });
        await pending;
        expect(settings.activeRouterKeys).toEqual([]);
        expect(settings.npcRelationshipValues).toEqual({});
        expect(activate).not.toHaveBeenCalled();
        expect(remember).not.toHaveBeenCalled();
        expect(generate).not.toHaveBeenCalled();
        if (withPortrait) expect(apply).toHaveBeenCalledWith('Alice', '/characters/alice.png', { chatId: 'A' });
    });

    it('does not start a Player Card prompt in another chat after applying its portrait', async () => {
        const gate = deferred();
        let chatId = 'A';
        const prompt = vi.fn();
        const settings = { chatStates: {} };
        const context = createContext({
        ...chatAffinity, ownsChat: chatAffinity.createChatCommitGuard('A', () => chatId),
            runtimeState: { currentChatId: 'A' }, getSettings: () => settings,
            getActiveChatId: () => chatId, canCommitPassForChat,
            saveChatState() {}, applyLibraryPortrait: () => gate.promise, sendDirectPrompt: prompt,
        });
        runInContext(closure('installLibraryCardAsPlayerCharacter', 16), context);
        const pending = context.run({ name: 'Alice', content: 'bio' });
        chatId = 'B';
        gate.resolve();
        expect(await pending).toBe(true);
        expect(settings.chatStates.A.playerCharacter.name).toBe('Alice');
        expect(prompt).not.toHaveBeenCalled();
    });
});
