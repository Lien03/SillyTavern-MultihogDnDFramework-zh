import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');

function sliceSyncDungeonMaps() {
    const start = routerSource.indexOf('export async function syncDungeonMapsToLocationLorebook(');
    expect(start).toBeGreaterThan(-1);
    const end = routerSource.indexOf('\nfunction rootEntryByExactSite(', start);
    expect(end).toBeGreaterThan(start);
    return routerSource.slice(start, end);
}

describe('Dungeon map capture chat ownership', () => {
    it('pins chat/prefix and skips live history when affinity is lost', () => {
        const fn = sliceSyncDungeonMaps();
        expect(routerSource).toMatch(/import \{[^}]*\bcreateChatCommitGuard\b[^}]*\} from '\.\/src\/state\/pass-affinity\.js'/);
        expect(fn).toContain('chatId = null');
        expect(fn).toContain('campaignPrefix = null');
        expect(fn).toContain('const passChatId = chatId != null && String(chatId).length > 0');
        expect(fn).toContain("const prefix = String(campaignPrefix || getLivePrefix() || '').trim()");
        expect(fn).toContain('const ownsChat = createChatCommitGuard(passChatId, getActiveChatId, { canCommit })');

        const knownAt = fn.indexOf('await isWorldInfoBookKnown(');
        const loadAt = fn.indexOf('await loadWorldInfoFresh(');
        const saveAt = fn.indexOf("await saveWorldInfoSnapshot(bookName, bookData, ctx, 'Dungeon map persistence', ownsChat)");
        expect(knownAt).toBeGreaterThan(fn.indexOf('const passChatId'));
        expect(knownAt).toBeGreaterThan(fn.indexOf('const prefix'));
        expect(loadAt).toBeGreaterThan(knownAt);
        expect(saveAt).toBeGreaterThan(loadAt);

        // Live history must not run unconditionally after the lorebook awaits.
        const historyAt = fn.indexOf('recordLiveDungeonMapSnapshot(');
        expect(historyAt).toBeGreaterThan(saveAt);
        expect(fn.lastIndexOf('ownsChat()', historyAt)).toBeGreaterThan(saveAt);
        expect(fn.indexOf('if (ownsChat())', saveAt)).toBeGreaterThan(-1);
        expect(fn.indexOf('if (ownsChat())', saveAt)).toBeLessThan(historyAt);
    });

    it('pins capture callers and refuses live activation after a chat switch', () => {
        expect(hookSource).toContain('chatId: passChatId');
        expect(hookSource).toContain("stage: 'dungeon_map_capture'");
        expect(hookSource).toContain('resolveActiveDungeonSite(dungeonState, currentLocation)');

        const genStart = hookSource.indexOf('export async function onGenerationEnded(');
        expect(genStart).toBeGreaterThan(-1);
        const genFn = hookSource.slice(genStart, genStart + 9000);
        const pinAt = genFn.indexOf('const passChatId = getActiveChatId()');
        const syncAt = genFn.indexOf('await syncDungeonMapsToLocationLorebook(chat,');
        const guardAt = genFn.indexOf("reason: 'chat_changed'");
        const activateAt = genFn.indexOf('syncDungeonLoreAgentActivation(settings, state, findLatestDungeonLocation(chat))');
        expect(pinAt).toBeGreaterThan(-1);
        expect(syncAt).toBeGreaterThan(pinAt);
        expect(guardAt).toBeGreaterThan(syncAt);
        expect(activateAt).toBeGreaterThan(guardAt);

        const interceptStart = hookSource.indexOf('globalThis.rpgTrackerInterceptor = async function');
        expect(interceptStart).toBeGreaterThan(-1);
        const interceptFn = hookSource.slice(interceptStart, interceptStart + 5000);
        expect(interceptFn).toContain('const passChatId = dungeonChatId');
        expect(interceptFn).toContain('chatId: passChatId');
        expect(interceptFn).toContain('ownsCaptureChat');
        expect(interceptFn).toContain('syncDungeonLoreAgentActivation(settings, dungeonState, currentLocation, mentionedSites)');
    });
});
