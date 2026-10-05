import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateChatCommitGuards } from '../src/state/pass-affinity.js';
import { runtimeState } from '../src/app/runtime-state.js';
import { wireAgentActivity } from '../src/ui/panel/panel-agent-activity.js';

beforeEach(() => {
    runtimeState.currentChatId = 'Chat A';
    runtimeState.loreRedoStack = [];
});

beforeEach(() => { globalThis._rpgCurrentChatId = () => runtimeState.currentChatId; });

afterEach(() => {
    delete globalThis._rpgCurrentChatId;
    delete globalThis.document;
    delete globalThis.toastr;
    runtimeState.currentChatId = null;
    runtimeState.loreRedoStack = [];
});

describe('Agent activity controls', () => {
    it.each(['snapshot', 'undo', 'redo'])('does not repopulate history after a round trip during %s', async phase => {
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const handlers = {};
        const button = id => ({ addEventListener: (_, fn) => { handlers[id] = fn; } });
        const back = button('undo'), forward = button('redo');
        const history = [{ chatId: 'Chat A', campaignPrefix: 'A', bookSnapshots: {} }];
        const postPassState = { chatId: 'Chat A', campaignPrefix: 'A' };
        runtimeState.loreRedoStack = [{ prePassSnapshot: history[0], postPassState }];
        globalThis.document = { addEventListener: vi.fn() };
        globalThis.toastr = { error: vi.fn() };
        const rollback = vi.fn(() => phase === 'undo' ? gate : true);
        const refreshManifest = vi.fn();
        wireAgentActivity({
            agentPanel: { querySelector: id => id === '#rt-agent-nav-back' ? back : id === '#rt-agent-nav-fwd' ? forward : null },
            getSettings: () => ({ routerHistory: history, routerCampaignPrefix: 'A' }), getRouterTick: () => 0,
            captureRouterLoreState: () => phase === 'snapshot' ? gate : postPassState,
            rollbackRouterPass: rollback, reapplyRouterPass: () => gate, refreshManifest, saveSettings() {},
        });
        const pending = handlers[phase === 'redo' ? 'redo' : 'undo']();
        // Let the snapshot continuation reach undo before invalidating its owner.
        if (phase === 'undo') await Promise.resolve();
        invalidateChatCommitGuards();
        invalidateChatCommitGuards();
        runtimeState.loreRedoStack = [];
        release(phase === 'snapshot' ? postPassState : phase !== 'redo');
        await pending;
        expect(runtimeState.loreRedoStack).toEqual([]);
        expect(refreshManifest).not.toHaveBeenCalled();
        if (phase === 'snapshot') expect(rollback).not.toHaveBeenCalled();
    });

    it('wires lifecycle listeners even when optional Agent controls are absent', () => {
        const addEventListener = vi.fn();
        globalThis.document = { addEventListener };

        const activity = wireAgentActivity({
            agentPanel: { querySelector: () => null },
            getRouterTick: () => 0,
            getSettings: () => ({}),
            reapplyRouterPass: vi.fn(),
            refreshManifest: vi.fn(),
            rollbackRouterPass: vi.fn(),
            saveSettings: vi.fn(),
        });

        expect(typeof activity.syncAgentNav).toBe('function');
        expect(typeof activity.syncLastRunDisplay).toBe('function');
        expect(addEventListener).toHaveBeenCalledWith('rt_lore_agent_updated', expect.any(Function));
        expect(addEventListener).toHaveBeenCalledWith('rt_generation_tick', expect.any(Function));
    });

    it('captures the complete live state before undoing an empty first-pass baseline', async () => {
        const handlers = {};
        const back = {
            disabled: false,
            addEventListener: (name, handler) => { handlers[name] = handler; },
        };
        const forward = { disabled: false, addEventListener: vi.fn() };
        const history = [{ chatId: 'Chat A', bookSnapshots: {}, campaignBookNames: [] }];
        const captureRouterLoreState = vi.fn().mockResolvedValue({
            campaignBookNames: ['Campaign_NPCs'],
            bookSnapshots: { Campaign_NPCs: { entries: { 0: { content: 'Initial world' } } } },
        });
        const rollbackRouterPass = vi.fn().mockResolvedValue(true);
        const refreshManifest = vi.fn().mockResolvedValue(undefined);
        globalThis.document = { addEventListener: vi.fn() };
        globalThis.toastr = { error: vi.fn() };

        wireAgentActivity({
            agentPanel: {
                querySelector: selector => selector === '#rt-agent-nav-back'
                    ? back
                    : selector === '#rt-agent-nav-fwd' ? forward : null,
            },
            captureRouterLoreState,
            getRouterTick: () => 0,
            getSettings: () => ({ routerHistory: history, routerCampaignPrefix: 'Campaign' }),
            reapplyRouterPass: vi.fn(),
            refreshManifest,
            rollbackRouterPass,
            saveSettings: vi.fn(),
        });

        await handlers.click();

        expect(captureRouterLoreState).toHaveBeenCalledOnce();
        expect(rollbackRouterPass).toHaveBeenCalledWith(0, expect.objectContaining({
            campaignBookNames: ['Campaign_NPCs'],
        }));
        expect(refreshManifest).toHaveBeenCalledWith('rollback');
    });

    it('does not undo another chat\'s Lorebook Agent pass after a chat switch', async () => {
        const handlers = {};
        const back = {
            disabled: false,
            addEventListener: (name, handler) => { handlers[name] = handler; },
        };
        const forward = { disabled: false, addEventListener: vi.fn() };
        const history = [
            { chatId: 'Chat B', campaignPrefix: 'B', bookSnapshots: { B_NPCs: { entries: {} } } },
            { chatId: 'Chat A', campaignPrefix: 'A', bookSnapshots: { A_NPCs: { entries: {} } } },
        ];
        const postPassState = { chatId: 'Chat A', campaignBookNames: ['A_NPCs'], bookSnapshots: {} };
        const captureRouterLoreState = vi.fn().mockResolvedValue(postPassState);
        const rollbackRouterPass = vi.fn().mockResolvedValue(true);
        const refreshManifest = vi.fn().mockResolvedValue(undefined);
        globalThis.document = { addEventListener: vi.fn() };
        globalThis.toastr = { error: vi.fn() };
        runtimeState.currentChatId = 'Chat A';

        const activity = wireAgentActivity({
            agentPanel: {
                querySelector: selector => selector === '#rt-agent-nav-back'
                    ? back
                    : selector === '#rt-agent-nav-fwd' ? forward : null,
            },
            captureRouterLoreState,
            getRouterTick: () => 0,
            getSettings: () => ({ routerHistory: history, routerCampaignPrefix: 'A' }),
            reapplyRouterPass: vi.fn(),
            refreshManifest,
            rollbackRouterPass,
            saveSettings: vi.fn(),
        });

        activity.syncAgentNav();
        expect(back.disabled).toBe(false);

        await handlers.click();

        expect(captureRouterLoreState).toHaveBeenCalledOnce();
        expect(rollbackRouterPass).toHaveBeenCalledWith(1, postPassState);
        expect(refreshManifest).toHaveBeenCalledWith('rollback');
    });

    it('disables undo when the only history entries belong to another chat', () => {
        const back = {
            disabled: false,
            addEventListener: vi.fn(),
        };
        const forward = { disabled: false, addEventListener: vi.fn() };
        globalThis.document = { addEventListener: vi.fn() };
        runtimeState.currentChatId = 'Chat A';

        const activity = wireAgentActivity({
            agentPanel: {
                querySelector: selector => selector === '#rt-agent-nav-back'
                    ? back
                    : selector === '#rt-agent-nav-fwd' ? forward : null,
            },
            captureRouterLoreState: vi.fn(),
            getRouterTick: () => 0,
            getSettings: () => ({
                routerHistory: [{ chatId: 'Chat B', campaignPrefix: 'B' }],
                routerCampaignPrefix: 'A',
            }),
            reapplyRouterPass: vi.fn(),
            refreshManifest: vi.fn(),
            rollbackRouterPass: vi.fn(),
            saveSettings: vi.fn(),
        });

        activity.syncAgentNav();
        expect(back.disabled).toBe(true);
        expect(forward.disabled).toBe(true);
    });
});
