import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    loadPortraitMapsForChat,
    migrateLegacyPortraitMapsToChat,
    portraitWriteMode,
    snapshotPortraitMapsForChat,
} from '../src/state/portrait-chat-scope.js';

describe('per-chat portrait ownership', () => {
    it('keeps identical entity names isolated between chats', () => {
        const settings = {
            chatStates: {},
            customPortraits: { Drazog: 'chat-a-drazog.png' },
            customLocationImages: { Camp: 'chat-a-camp.png' },
        };

        snapshotPortraitMapsForChat(settings, 'chat-a');
        settings.customPortraits = { Drazog: 'chat-b-drazog.png' };
        settings.customLocationImages = {};
        snapshotPortraitMapsForChat(settings, 'chat-b');

        loadPortraitMapsForChat(settings, 'chat-a');
        expect(settings.customPortraits.Drazog).toBe('chat-a-drazog.png');
        expect(settings.customLocationImages.Camp).toBe('chat-a-camp.png');

        loadPortraitMapsForChat(settings, 'chat-b');
        expect(settings.customPortraits.Drazog).toBe('chat-b-drazog.png');
        expect(settings.customLocationImages).toEqual({});
    });

    it('starts an unseen chat with empty maps instead of inheriting the previous chat', () => {
        const settings = {
            chatStates: { existing: { customPortraits: { Alice: 'alice.png' } } },
            customPortraits: { Alice: 'alice.png' },
            customLocationImages: { Town: 'town.png' },
        };

        expect(loadPortraitMapsForChat(settings, 'unseen')).toBe(false);
        expect(settings.customPortraits).toEqual({});
        expect(settings.customLocationImages).toEqual({});
    });

    it('preserves legacy live maps under the active chat exactly once', () => {
        const settings = {
            portraitChatScopeVersion: 0,
            chatStates: {},
            customPortraits: { Legacy: 'legacy.png' },
            customLocationImages: {},
        };

        expect(migrateLegacyPortraitMapsToChat(settings, 'current-chat')).toBe(true);
        expect(settings.chatStates['current-chat'].customPortraits).toEqual({ Legacy: 'legacy.png' });
        settings.customPortraits.Legacy = 'changed.png';
        expect(migrateLegacyPortraitMapsToChat(settings, 'current-chat')).toBe(false);
        expect(settings.chatStates['current-chat'].customPortraits.Legacy).toBe('legacy.png');
    });

    it('routes late Horde/auto-gen writes to the pinned chat partition after a switch', () => {
        expect(portraitWriteMode('chat-a', 'chat-a')).toBe('live');
        expect(portraitWriteMode('chat-b', 'chat-a')).toBe('partition');
        expect(portraitWriteMode(null, 'chat-a')).toBe('partition');
        expect(portraitWriteMode('chat-b', null)).toBe('live');
        expect(portraitWriteMode('chat-b', '')).toBe('live');
    });

    it('pins interactive portrait/location Apply to the opening chat, without Horde bypassing into portraits', () => {
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        const portraitsSource = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');
        const cardEventsSource = readFileSync(new URL('../src/ui/panel/card-events.js', import.meta.url), 'utf8');

        // Default chat portrait/location writers pin passChatId into apply*Data.
        expect(indexSource).toContain('applyPortraitData(entityName, src, { chatId: passChatId })');
        expect(indexSource).toContain('applyLocationImageData(normPath, finalSrc, { chatId: passChatId })');
        expect(cardEventsSource).toContain('applyPortraitData(entityName, src, { chatId: passChatId })');

        // Lorebook Agent panel drops / library imports pin before file/network awaits.
        const panelBuilderSource = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
        expect(panelBuilderSource).toContain("import { getActiveChatId } from '../../state/chat-persistence.js'");
        expect(panelBuilderSource).toContain('await applyPortraitData(item.label, scaled, { chatId: passChatId })');
        expect(panelBuilderSource).toContain('await applyLocationImageData(locFullPath, scaled, { chatId: passChatId })');
        expect(panelBuilderSource).toContain('await applyPortraitData(name, src, { chatId: passChatId })');
        expect(panelBuilderSource).toContain('await applyPortraitData(name, avatarUrl, { chatId: passChatId })');
        // Unpinned apply*Data calls must not remain in panel-builder (except the
        // function dependency destructure / type references).
        const applyCalls = panelBuilderSource.match(/await apply(?:Portrait|LocationImage)Data\([^)]*\)/g) || [];
        expect(applyCalls.length).toBeGreaterThan(0);
        for (const call of applyCalls) {
            expect(call).toContain('chatId: passChatId');
        }

        // generateWithHorde must call the supplied localApply — never applyPortraitData —
        // so location-image and NPC-library Apply cannot land in customPortraits after a switch.
        const hordeFn = portraitsSource.slice(
            portraitsSource.indexOf('export async function generateWithHorde(prompt'),
            portraitsSource.indexOf('export function getCharacterBlockNames'),
        );
        expect(hordeFn).toContain('await localApply(finalUrl)');
        expect(hordeFn).not.toContain('applyPortraitData(');
        expect(hordeFn).not.toContain('pinnedApply');
    });

    it('re-checks live vs partition after persist await so a mid-upload chat switch cannot poison live maps', () => {
        const portraitsSource = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');

        for (const [startMarker, endMarker] of [
            ['export async function applyPortraitData', 'function migratePortraitMapKey'],
            ['export async function applyLocationImageData', 'export function scaleImageToLandscape'],
        ]) {
            const fn = portraitsSource.slice(
                portraitsSource.indexOf(startMarker),
                portraitsSource.indexOf(endMarker),
            );
            const persistAt = fn.indexOf('await persistPortraitSrc');
            const writeModeAt = fn.indexOf('portraitWriteMode(');
            expect(persistAt).toBeGreaterThan(-1);
            expect(writeModeAt).toBeGreaterThan(persistAt);
            // Destination must be pinned from call-time chat, not re-read opts.chatId alone
            // after the await (empty opts.chatId must still treat liveAtStart as the owner).
            expect(fn).toContain('const liveAtStart = getActiveChatId()');
            expect(fn).toContain('portraitWriteMode(liveNow, targetChatId)');
        }
    });

    it('syncs the current location image to the chat background only when opted in', () => {
        const immersionSource = readFileSync(new URL('../immersion.js', import.meta.url), 'utf8');
        const portraitsSource = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');
        expect(immersionSource).toContain('syncCurrentLocationBackground({ locationImage });');
        expect(immersionSource).toContain('portraitAutoApplyLocationBackground');
        expect(portraitsSource).toContain('_rpgSyncCurrentLocationBackground?.(normPath)');
        expect(portraitsSource).toContain('applyLocationImageToChatBackground');
    });

    it('aborts Real-Time scene-art checks after a mid-await chat switch', () => {
        const immersionSource = readFileSync(new URL('../immersion.js', import.meta.url), 'utf8');
        const fn = immersionSource.slice(
            immersionSource.indexOf('export async function runRealtimeSceneArtCheck'),
            immersionSource.indexOf('export function maybeAutoGenerateImmersionSceneArt'),
        );
        expect(immersionSource).toMatch(/import \{[^}]*\bcreateChatCommitGuard\b[^}]*\} from '\.\/src\/state\/pass-affinity\.js'/);
        expect(fn).toContain('const passChatId = getActiveChatId()');
        expect(fn).toContain('const memoAtStart = s.currentMemo');
        expect(fn.indexOf('await buildImmersionSceneState')).toBeGreaterThan(fn.indexOf('const passChatId'));
        expect(fn.indexOf('canCommitPassForChat(passChatId, getActiveChatId())')).toBeGreaterThan(
            fn.indexOf('await buildImmersionSceneState'),
        );
        expect(fn.indexOf("canUseSceneMemo(getSettings(), passChatId, memoAtStart)")).toBeGreaterThan(
            fn.indexOf('await buildImmersionSceneState'),
        );
        expect(fn.indexOf('maybeAutoGenerateImmersionSceneArt')).toBeGreaterThan(
            fn.indexOf('canCommitPassForChat(passChatId, getActiveChatId())'),
        );
        expect(fn).toContain('await buildImmersionSceneState(memoAtStart, s, { chatId: passChatId })');
        expect(fn).toContain('maybeAutoGenerateImmersionSceneArt(scene,');
        expect(fn).toContain('{ chatId: passChatId }');
        expect(immersionSource).toContain('getEffectiveRouterCampaignPrefix(backgroundChatId');
        expect(immersionSource).not.toContain('getEffectiveRouterCampaignPrefix(ctx.chatId)');
        expect(immersionSource).toContain('chatId: passChatId');
        const genFn = immersionSource.slice(
            immersionSource.indexOf('export function maybeAutoGenerateImmersionSceneArt'),
            immersionSource.indexOf('export function maybeAutoGenerateImmersionSceneArt') + 2200,
        );
        expect(genFn).toContain('chatId: passChatId');
    });

    it('pins auto-gen kickoffs before lorebook awaits and aborts when affinity is lost', () => {
        const portraitsSource = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

        expect(portraitsSource).toMatch(/import \{[^}]*\bcreateChatCommitGuard\b[^}]*\} from '\.\/src\/state\/pass-affinity\.js'/);

        const forceFn = portraitsSource.slice(
            portraitsSource.indexOf('export async function forceCheckAutoGenerations'),
            portraitsSource.indexOf('export async function checkAndTriggerAutoGenerations'),
        );
        expect(forceFn.indexOf('const passChatId = getActiveChatId()')).toBeGreaterThan(-1);
        const forceLoadAt = forceFn.indexOf('await ctx.loadWorldInfo');
        expect(forceLoadAt).toBeGreaterThan(forceFn.indexOf('const passChatId'));
        expect(forceFn.indexOf('canCommitPassForChat(passChatId, getActiveChatId())', forceLoadAt))
            .toBeGreaterThan(forceLoadAt);
        expect(forceFn).toContain('getEffectiveRouterCampaignPrefix(passChatId)');
        expect(forceFn).not.toContain('getEffectiveRouterCampaignPrefix(ctx.chatId)');
        expect(forceFn).toContain('triggerBackgroundPortraitGeneration(name, refresh, entry.content || \'\', pinnedOpts)');
        expect(forceFn).toContain('triggerBackgroundLocationGeneration(path, refresh, entry.content, pinnedOpts)');
        expect(forceFn).toContain('await loadLocationLorebookEntries(passChatId)');

        const checkFn = portraitsSource.slice(
            portraitsSource.indexOf('export async function checkAndTriggerAutoGenerations'),
            portraitsSource.indexOf('// ── Location images (hierarchical lore paths)'),
        );
        expect(checkFn.indexOf('const passChatId = getActiveChatId()')).toBeGreaterThan(-1);
        const checkLoadAt = checkFn.indexOf('await ctx.loadWorldInfo');
        expect(checkLoadAt).toBeGreaterThan(checkFn.indexOf('const passChatId'));
        expect(checkFn.indexOf('canCommitPassForChat(passChatId, getActiveChatId())', checkLoadAt))
            .toBeGreaterThan(checkLoadAt);
        expect(checkFn).toContain('chatId: passChatId');
        expect(checkFn).toContain('getEffectiveRouterCampaignPrefix(passChatId)');
        expect(checkFn).not.toContain('getEffectiveRouterCampaignPrefix(ctx.chatId)');

        const locFn = portraitsSource.slice(
            portraitsSource.indexOf('export async function checkAndTriggerLocationAutoGenerations'),
            portraitsSource.indexOf('export async function checkAndTriggerLocationAutoGenerations') + 1200,
        );
        const locLoadAt = locFn.indexOf('await loadLocationLorebookEntries(passChatId)');
        expect(locLoadAt).toBeGreaterThan(locFn.indexOf('passChatId'));
        expect(locFn.indexOf('canCommitPassForChat(passChatId, getActiveChatId())', locLoadAt))
            .toBeGreaterThan(locLoadAt);

        const mapFn = portraitsSource.slice(
            portraitsSource.indexOf('async function loadLocationLorebookMap'),
            portraitsSource.indexOf('async function loadLocationLorebookMap') + 900,
        );
        expect(mapFn).toContain('getEffectiveRouterCampaignPrefix(id)');
        expect(mapFn).not.toContain('getEffectiveRouterCampaignPrefix(ctx.chatId)');
        expect(mapFn).not.toContain('if (!ctx.chatId)');

        const portraitTrigger = portraitsSource.slice(
            portraitsSource.indexOf('export function triggerBackgroundPortraitGeneration'),
            portraitsSource.indexOf('export function resetAutoGenerationTracking'),
        );
        expect(portraitTrigger).toContain('opts.chatId');
        expect(portraitTrigger).toContain('await applyPortraitData(name, scaled, { chatId: passChatId })');

        const locationTrigger = portraitsSource.slice(
            portraitsSource.indexOf('export function triggerBackgroundLocationGeneration'),
            portraitsSource.indexOf('async function loadLocationLorebookEntries'),
        );
        expect(locationTrigger).toContain('opts.chatId');
        expect(locationTrigger).toContain('await applyLocationImageData(normPath, scaled, { chatId: passChatId })');

        // Chat-link-off switches must also clear the session-known auto-gen set.
        const offBranch = indexSource.slice(
            indexSource.indexOf('if (!s.chatLinkEnabled) {'),
            indexSource.indexOf('// saveChatState(oldChatId) already called above'),
        );
        expect(offBranch).toContain('resetAutoGenerationTracking()');
    });

    it('wires chat switching, persistence, and renames to the active portrait partition only', () => {
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        const portraitsSource = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');

        expect(indexSource).toContain('snapshotPortraitMapsForChat(s, oldChatId)');
        expect(indexSource).toContain('loadPortraitMapsForChat(s, resolvedId)');
        expect(indexSource).toContain('migrateLegacyPortraitMapsToChat(settings, bootChatId)');
        expect(indexSource).toContain('stopRealtimeLocationGeneration()');
        expect(portraitsSource).toContain('snapshotPortraitMapsForChat(s, getActiveChatId())');
        expect(portraitsSource).toContain('portraitWriteMode(');
        expect(portraitsSource).toContain('{ chatId: passChatId }');
        expect(portraitsSource).toContain('r2: false');
        expect(portraitsSource).not.toContain('part.customPortraits[newKey] = part.customPortraits[oldKey]');
    });
});
