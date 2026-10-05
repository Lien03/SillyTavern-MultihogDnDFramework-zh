import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { canCommitPassForChat, createChatCommitGuard, invalidateChatCommitGuards } from '../src/state/pass-affinity.js';

const creator = readFileSync(new URL('../character-creator.js', import.meta.url), 'utf8');
const quickstart = readFileSync(new URL('../quickstart.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
function fn(source, name) {
    const start = source.search(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));
    if (start < 0) throw new Error(`Missing ${name}`);
    return source.slice(start, source.indexOf('\n}', start) + 2).replace(/^export /, '');
}
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function chatScope() {
    let chatId = 'A';
    return {
        getActiveChatId: () => chatId,
        switchTo(id) { invalidateChatCommitGuards(); chatId = id; },
        createChatCommitGuard,
        canCommitPassForChat,
    };
}
const noop = () => {};
const quietConsole = { log: noop, warn: noop, error: noop };
const toastr = { info: noop, warning: noop, error: noop, success: noop };

describe('character creation async ownership', () => {
    it('invalidates old guards on round trips and allows fresh work', () => {
        const scope = chatScope();
        const old = createChatCommitGuard('A', scope.getActiveChatId);
        expect(old()).toBe(true);
        scope.switchTo('B');
        scope.switchTo('A');
        expect(old()).toBe(false);
        expect(createChatCommitGuard('A', scope.getActiveChatId)()).toBe(true);
    });

    it.each(['configuration', 'character', 'bio', 'card', 'persona', 'unchanged'])('Quick Start owns its %s continuation', async phase => {
        const scope = chatScope();
        const gate = deferred(), entered = deferred();
        const wait = async (at, result) => {
            if (phase === at) { entered.resolve(); await gate.promise; }
            return result;
        };
        const character = vi.fn(() => wait('character', { charName: 'Ada' }));
        const card = vi.fn(() => wait('card', true));
        const persona = vi.fn(() => wait('persona', 'ada.png'));
        const send = vi.fn();
        const settings = { onboardingGenre: 'original' };
        const context = createContext({
            ...scope, console: quietConsole, toastr, getSettings: () => settings,
            setQuickStartBusy: noop, setQuickStartStatus: noop, saveSettings: noop,
            normalizeInstantActionInstructions: text => text, getArchetypesForGenre: () => ['Fighter'],
            pickRandomArchetype: () => 'Fighter', resolveInstantActionStartingLevel: () => 1,
            resolveInstantActionPlayerCardWords: () => 150, extractInstantActionLevel: () => null,
            secureRandom: () => 0, GENRE_LABELS: {},
            applyQuickStartConfiguration: () => wait('configuration'),
            generateQuickStartCharacter: character, generatePersonaBio: () => wait('bio', 'Bio'),
            buildInstantActionPromptSection: () => '', addPlayerCardToLorebookAgent: card,
            activateSillyTavernPersona: persona, sendOutgoingChatMessage: send,
            buildInstantActionOpeningMessage: () => 'Begin',
        });
        runInContext(`let _quickStartRunning = false; ${fn(quickstart, 'runQuickStart')}`, context);
        const pending = context.runQuickStart('fantasy', {});
        if (phase !== 'unchanged') {
            await entered.promise;
            scope.switchTo('B');
            gate.resolve();
        }
        await pending;
        if (phase === 'unchanged') expect(send).toHaveBeenCalledWith('Begin');
        else expect(send).not.toHaveBeenCalled();
        if (phase === 'configuration') {
            expect(character).not.toHaveBeenCalled();
            expect(settings.onboardingGenre).toBe('original');
        }
        if (['configuration', 'character', 'bio'].includes(phase)) expect(card).not.toHaveBeenCalled();
        if (phase === 'card') expect(persona).not.toHaveBeenCalled();
    });

    it.each(['cancelled', 'chat_changed', 'failed', 'success', 'roundtrip'])('handles the %s generation result', async status => {
        const scope = chatScope(), gate = deferred();
        const settings = { currentMemo: '' };
        const context = createContext({
            ...scope, getSettings: () => settings, buildCharacterGenerationPrompt: () => ({ prompt: 'Create' }),
            getCharacterCreationConnectionSettings: () => ({}), sendDirectPrompt: () => gate.promise,
            extractCharNameFromMemo: () => 'Ada',
        });
        runInContext(`${fn(creator, 'assertDirectPromptOwned')} ${fn(creator, 'generateQuickStartCharacter')}`, context);
        const pending = context.generateQuickStartCharacter({ className: 'Fighter' });
        settings.currentMemo = '[CHARACTER]Ada[/CHARACTER]';
        if (status === 'roundtrip') { scope.switchTo('B'); scope.switchTo('A'); }
        gate.resolve({ success: ['success', 'roundtrip'].includes(status), status });
        if (status === 'success') expect((await pending).charName).toBe('Ada');
        else await expect(pending).rejects.toThrow();
    });

    it.each(['imports', 'init', 'upload', 'avatar', 'settings', 'avatars', 'unchanged'])('persona setup stops after %s loses ownership', async phase => {
        const scope = chatScope(), gate = deferred(), entered = deferred();
        const wait = async (at, value) => {
            if (phase === at) { entered.resolve(); await gate.promise; }
            return value;
        };
        const avatar = vi.fn(() => wait('avatar'));
        const description = vi.fn();
        const save = vi.fn(() => wait('settings'));
        const lock = vi.fn(async () => {});
        const upload = vi.fn(() => wait('upload'));
        const modules = {
            '../../../personas.js': {
                initPersona: () => wait('init'), setUserAvatar: avatar,
                getUserAvatars: () => wait('avatars'), setPersonaDescription: description,
            },
            '../../../utils.js': { findPersona: () => null },
            '../../../power-user.js': { power_user: {} },
            '../../../../script.js': { default_user_avatar: 'default.png' },
        };
        const context = createContext({
            ...scope, loadModule: path => wait('imports', modules[path]),
            buildNameOnlyPersonaIdentity: name => ({ name, description: '' }),
            uploadDefaultPersonaAvatar: upload, saveSettings: save,
            SillyTavern: { getContext: () => ({ executeSlashCommandsWithOptions: lock }) },
        });
        // Supply the host module loader while preserving the production async control flow.
        runInContext(`${fn(creator, 'assertPersonaChatOwned')}
            ${fn(creator, 'injectAsSillyTavernPersona').replaceAll('import(', 'loadModule(')}
            ${fn(creator, 'activateSillyTavernPersona')}`, context);
        const pending = context.activateSillyTavernPersona('Ada');
        if (phase === 'unchanged') {
            await pending;
            expect(lock).toHaveBeenCalledWith('/persona-lock');
        } else {
            await entered.promise;
            scope.switchTo('B');
            gate.resolve();
            await expect(pending).rejects.toThrow(/chat changed/);
            expect(lock).not.toHaveBeenCalled();
            if (['imports', 'init', 'upload'].includes(phase)) expect(avatar).not.toHaveBeenCalled();
            if (phase === 'avatar') expect(description).not.toHaveBeenCalled();
        }
    });

    it.each(['fetch', 'blob', 'upload', 'json', 'unchanged'])('avatar upload checks ownership after %s', async phase => {
        const scope = chatScope(), gate = deferred(), entered = deferred();
        const wait = async (at, value) => {
            if (phase === at) { entered.resolve(); await gate.promise; }
            return value;
        };
        const refresh = vi.fn();
        const fetch = vi.fn(url => url === 'default.png'
            ? wait('fetch', { blob: () => wait('blob', {}) })
            : wait('upload', { ok: true, json: () => wait('json', { path: 'ada.png' }) }));
        const context = createContext({
            fetch, File: class {}, FormData: class { append() {} }, getRequestHeaders: () => ({}),
        });
        runInContext(`${fn(creator, 'assertPersonaChatOwned')} ${fn(creator, 'uploadDefaultPersonaAvatar')}`, context);
        const pending = context.uploadDefaultPersonaAvatar('default.png', 'ada.png', refresh,
            createChatCommitGuard('A', scope.getActiveChatId));
        if (phase === 'unchanged') {
            await pending;
            expect(refresh).toHaveBeenCalledWith(true, 'ada.png');
        } else {
            await entered.promise;
            scope.switchTo('B');
            gate.resolve();
            await expect(pending).rejects.toThrow(/chat changed/);
            expect(refresh).not.toHaveBeenCalled();
            if (['fetch', 'blob'].includes(phase)) expect(fetch).toHaveBeenCalledTimes(1);
        }
    });

    it.each(['same', 'switch', 'roundtrip'])('Player Card preview keeps its origin (%s)', async change => {
        const scope = chatScope();
        const nodes = new Map();
        const element = () => ({
            style: {}, value: 'Ada biography', callbacks: {}, appendChild: noop, remove: vi.fn(),
            addEventListener(event, callback) { this.callbacks[event] = callback; },
            querySelector(selector) {
                if (!nodes.has(selector)) nodes.set(selector, element());
                return nodes.get(selector);
            },
        });
        const settings = {};
        const save = vi.fn();
        const context = createContext({
            ...scope, toastr, getSettings: () => settings, saveChatState: save,
            refreshAgentManifestNow: async () => {}, escapeHtml: text => text,
            document: { getElementById: () => null, createElement: element, body: { appendChild: noop } },
        });
        runInContext(`${fn(creator, 'addPlayerCardToLorebookAgent')} ${fn(creator, 'showPersonaConfirmOverlay')}`, context);
        context.showPersonaConfirmOverlay('Ada biography', 'Ada', 100);
        if (change !== 'same') scope.switchTo('B');
        if (change === 'roundtrip') scope.switchTo('A');
        await nodes.get('#rt-pco-add-pc').callbacks.click();
        if (change === 'same') {
            expect(settings.chatStates.A.playerCharacter.name).toBe('Ada');
            expect(save).toHaveBeenCalledWith('A');
        } else {
            expect(settings.chatStates).toBeUndefined();
            expect(save).not.toHaveBeenCalled();
        }
    });

    it('does not let onboarding recapture an already-lost originating chat', async () => {
        const scope = chatScope();
        const canCommit = createChatCommitGuard('A', scope.getActiveChatId);
        scope.switchTo('B');
        const activate = vi.fn();
        const context = createContext({
            ...scope, getSettings: () => ({ onboardingCreateSillyTavernPersona: true }),
            runtimeState: { currentChatId: 'B' }, activateSillyTavernPersona: activate,
            extractCharNameFromMemo: () => 'Wrong name',
        });
        runInContext(fn(index, 'maybeCreateOnboardingPersona'), context);
        await context.maybeCreateOnboardingPersona('', { chatId: 'A', canCommit });
        expect(activate).not.toHaveBeenCalled();
    });

    it('does not apply Quick Start configuration after its prompt fetch loses ownership', async () => {
        const scope = chatScope(), gate = deferred();
        const write = vi.fn();
        const context = createContext({
            getSettings: () => ({}), syncLocationMappingRuntime: noop,
            fetchBaseSyspromptRaw: () => gate.promise, buildSysprompt: text => text,
            setLiveMainSyspromptText: write,
        });
        runInContext(`let _stashDeferCount = 0; ${fn(index, 'autoApplySysprompt')}`, context);
        const pending = context.autoApplySysprompt(true, { canCommit: createChatCommitGuard('A', scope.getActiveChatId) });
        scope.switchTo('B');
        gate.resolve('Departing prompt');
        await pending;
        expect(write).not.toHaveBeenCalled();
    });
});
