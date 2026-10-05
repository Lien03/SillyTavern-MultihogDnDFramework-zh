import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const characterCreatorSource = readFileSync(new URL('../character-creator.js', import.meta.url), 'utf8');
const quickStartSource = readFileSync(new URL('../quickstart.js', import.meta.url), 'utf8');
const cardEventsSource = readFileSync(new URL('../src/ui/panel/card-events.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

function sliceFunction(source, signature) {
    const start = source.indexOf(signature);
    expect(start).toBeGreaterThanOrEqual(0);
    const nextExport = source.indexOf('\nexport ', start + signature.length);
    const nextAsync = source.indexOf('\nasync function ', start + signature.length);
    const nextFunction = source.indexOf('\nfunction ', start + signature.length);
    const candidates = [nextExport, nextAsync, nextFunction].filter((idx) => idx > start);
    const end = candidates.length ? Math.min(...candidates) : start + 8000;
    return source.slice(start, end);
}

describe('Character creation chat ownership', () => {
    it('Quick Start refuses cancelled/chat-changed direct prompts and pins Player Card writes', () => {
        const gen = sliceFunction(characterCreatorSource, 'export async function generateQuickStartCharacter');
        expect(characterCreatorSource).toContain("import { createChatCommitGuard } from './src/state/pass-affinity.js';");
        expect(gen).toContain('const passChatId = opts.chatId ?? getActiveChatId();');
        expect(gen).toContain('assertDirectPromptOwned(result)');
        expect(gen).toContain('ownsChat()');

        expect(quickStartSource).toContain("import { createChatCommitGuard } from './src/state/pass-affinity.js';");
        expect(quickStartSource).toContain('addPlayerCardToLorebookAgent(charName, bio, wordCount, { chatId: passChatId, canCommit: ownsChat })');
        expect(quickStartSource).toContain('Quick Start stopped because the active chat changed.');
    });

    it('Character Creator and PC Import stop follow-up writes after affinity loss', () => {
        const roll = sliceFunction(characterCreatorSource, 'async function handleCharRollGenerate');
        expect(roll).toContain('assertDirectPromptOwned(result)');
        expect(roll).toContain('ownsChat()');
        expect(roll).toMatch(/await generatePersonaBio\([\s\S]*?ownsChat\(\)/);

        const importFn = sliceFunction(characterCreatorSource, 'async function importPcFromCard');
        expect(importFn).toContain('const passChatId = getActiveChatId();');
        expect(importFn).toContain('assertDirectPromptOwned(result, \'PC Import\')');
        expect(importFn).toContain('saveChatState(passChatId)');
        expect(importFn).toMatch(/customPortraits[\s\S]*?ownsChat\(\)/);
    });

    it('addPlayerCardToLorebookAgent refuses writes when the originating chat is no longer live', () => {
        const add = sliceFunction(characterCreatorSource, 'export async function addPlayerCardToLorebookAgent');
        expect(add).toContain('opts.chatId');
        expect(add).toContain('ownsChat()');
        expect(add).toContain('saveChatState(passChatId)');
        expect(add).not.toContain('SillyTavern.getContext().chatId');
    });

    it('onboarding archetype buttons require sendDirectPrompt success before persona follow-ups', () => {
        expect(cardEventsSource).toContain('if (!result?.success)');
        expect(cardEventsSource).toMatch(/await sendDirectPrompt\([\s\S]*?if \(!result\?\.success\)[\s\S]*?maybeCreateOnboardingPersona/);

        const personaFn = sliceFunction(indexSource, 'async function maybeCreateOnboardingPersona');
        expect(personaFn).toContain('const passChatId = options.chatId ?? getActiveChatId();');
        expect(personaFn).toContain('ownsChat()');
        expect(personaFn).toMatch(/await generatePersonaBio\([\s\S]*?ownsChat\(\)/);
    });

    it('invalidates guards on a real switch before the live chat projection changes', () => {
        const switchStart = indexSource.indexOf('function onChatChanged(');
        const sameChatReturn = indexSource.indexOf('if (!emitHadId || oldChatId === resolvedId)', switchStart);
        const invalidateAt = indexSource.indexOf('invalidateChatCommitGuards();', sameChatReturn);
        const flipAt = indexSource.indexOf('runtimeState.currentChatId = resolvedId', invalidateAt);
        expect(invalidateAt).toBeGreaterThan(sameChatReturn);
        expect(flipAt).toBeGreaterThan(invalidateAt);
    });
});
