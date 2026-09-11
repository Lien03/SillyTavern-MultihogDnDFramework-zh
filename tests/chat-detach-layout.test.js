import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Adventure Companion layout', () => {
    it('keeps CHAT navigation visible while Lorebook Agent is detached', async () => {
        const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

        expect(css).toContain(
            '.rpg-tracker-panel.rt-agent-detached-mode:not(.rt-tutorial-active) #rt-panel-mode-switch-wrap',
        );
        expect(css).not.toContain(
            '.rpg-tracker-panel.rt-agent-detached-mode #rt-panel-mode-switch-wrap {',
        );
    });

    it('uses one Companion with an explained Tutorial Mode toggle', async () => {
        const source = await readFile(new URL('../adventure-companion.js', import.meta.url), 'utf8');
        const markup = await readFile(new URL('../src/ui/panel/panel-markup.js', import.meta.url), 'utf8');
        const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

        expect(source).toContain('id="rt-chat-tutorial-mode"');
        expect(source).toContain('id="rt-chat-tutorial-info-btn"');
        expect(source).toContain('documentation Markdown file into every Adventure Companion request');
        expect(source).toContain("const doc = _prefs.tutorialMode ? await loadDocumentation() : ''");
        expect(source).not.toContain(['Tutorial', 'Bot'].join(' '));
        expect(source).not.toContain("mode === 'companion'");
        expect(markup).toContain('id="rt-adventure-companion-header"');
        expect(markup).toContain('<span>冒险伙伴</span>');
        expect(source).toContain("const COMPANION_HEADER_TITLE = '冒险伙伴'");
        expect(css).toMatch(/\.rt-adventure-companion-header\s*\{[^}]*font-size:\s*0\.9em;[^}]*text-transform:\s*none;/s);
        expect(source).toContain("trackerTab.style.display = 'none'");
        expect(source).toContain("companionHeader.style.display = 'flex'");
    });

    it('moves the live CHAT view into a restorable floating panel', async () => {
        const source = await readFile(new URL('../adventure-companion.js', import.meta.url), 'utf8');
        const panelBuilder = await readFile(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
        const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

        expect(source).toContain('export function detachAdventureCompanion(');
        expect(source).toContain('export function reattachAdventureCompanion');
        expect(source).toContain("floating.id = 'rpg-tracker-adventure-companion'");
        expect(source).toContain('body.appendChild(view)');
        expect(source).toContain('trackerPane.appendChild(view)');
        expect(source).toContain("makeDraggable(floating, header, DETACHED_CHAT_GEO_KEY)");
        expect(source).toContain('if (_detachedChatPanel) restorePanelModeTabs({ preserveActive: true });');
        expect(source).toContain('if (isMobileLayout()) {');
        expect(source).toContain('detachAdventureCompanion({ persist: restoreManualDetach })');
        expect(panelBuilder).not.toContain('if (chatOpen) refreshAdventureCompanionLayout();');
        expect(panelBuilder).toContain('refreshAdventureCompanionLayout();');
        expect(css).toContain('.rt-adventure-companion-detached');
        expect(css).toContain('#rpg-tracker-adventure-companion.rt-detached-panel');
        expect(css).toContain('#rt-chat-detach-btn,');
        expect(css).toContain('#rt-chat-reattach-btn');
        expect(source).toContain('id="rt-chat-collapse-btn"');
        expect(source).toContain("const CHAT_COLLAPSED_KEY = 'rpg_tracker_adventure_companion_collapsed'");
        expect(source).toContain('toggleDetachedChatCollapse()');
        expect(source).toContain('syncMobileDetachedMainPanelVisibility()');
        expect(source).toContain("rt-chat-mobile-detached-owner");
        expect(css).toContain('.rpg-tracker-panel.rt-panel-collapsed .rt-chat-detached-body');
        expect(css).toContain('#rpg-tracker-adventure-companion.rt-detached-panel.rt-panel-collapsed');
        expect(css).toContain('#rpg-tracker-panel.rt-chat-mobile-detached-owner');
    });
});
