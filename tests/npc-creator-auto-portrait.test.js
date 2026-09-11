import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');

describe('NPC Manager portrait generation', () => {
    it('queues the saved NPC entry when NPC auto-generation is enabled', () => {
        const creatorStart = source.indexOf('const createNpcFromCharCard = async');
        const creatorEnd = source.indexOf('const minimalReviewNpcWithAI = async', creatorStart);
        const creator = source.slice(creatorStart, creatorEnd);

        expect(creatorStart).toBeGreaterThanOrEqual(0);
        expect(creator).toContain('s.portraitAutoGenerateNpcs');
        expect(creator).toContain('triggerBackgroundPortraitGeneration(name, refreshAll, content)');
        expect(creator.indexOf("fetch('/api/worldinfo/edit'")).toBeLessThan(
            creator.indexOf('triggerBackgroundPortraitGeneration(name, refreshAll, content)'),
        );
        expect(creator).toContain('charCard.portraitSrc');
        expect(creator).toContain('!appliedPortrait');
    });

    it('attaches NPC Manager to the NPCs header with a Library tab', () => {
        expect(source).toContain("{ id: 'library', label: '📚 角色库' }");
        expect(source).toContain('saveCampaignNpcToLibrary');
        expect(source).toContain('extractLibraryIdentityContent');
        expect(source).toContain('sanitizeNpcLibraryRecords');
        expect(source).toContain('rt-npc-manager-btn');
        expect(source).toContain('NPC/PC Manager');
        expect(source).not.toContain('rt-npc-add-btn');
    });

    it('opens a Full NPC Card from the library list without campaign relationship bars', () => {
        const cardStart = source.indexOf('const openLibraryNpcCard = async');
        const cardEnd = source.indexOf('const performManifestRefresh = async', cardStart);
        const card = source.slice(cardStart, cardEnd);
        expect(cardStart).toBeGreaterThanOrEqual(0);
        expect(card).toContain('📚 资料库');
        expect(card).toContain('renderSectionsHtml(record.content, false, { omitDynamic: true })');
        expect(card).toContain("okButton: '关闭'");
        expect(card).not.toContain('Friendship/Rapport');
        expect(card).not.toContain('rt-npc-popup-ai-edit-btn');
        expect(card).toContain('showPortraitSettingsMenu(record.name');
        expect(card).toContain('applyPortrait:');
        expect(card).toContain('更换立绘');
        expect(card).not.toContain('pointer-events:none');
        expect(source).toContain("viewBtn.innerHTML = '<i class=\"fa-solid fa-address-card\"></i> 完整卡片'");
        expect(source).toContain('openLibraryNpcCard(rec)');
        expect(source).toContain("item.className = 'rt-charpicker-item rt-npc-library-item'");
        expect(source.split('const parseNpcSections = ').length - 1).toBe(1);
        expect(source.split('const renderSectionsHtml = ').length - 1).toBe(1);
    });

    it('adds a library NPC to [PARTY] via a State Tracker Direct Prompt', () => {
        expect(source).toContain("partyBtn.textContent = '+ 加入队伍'");
        expect(source).toContain('buildAddLibraryNpcToPartyPrompt(rec)');
        expect(source).toContain('sendDirectPrompt(buildAddLibraryNpcToPartyPrompt(rec))');
        expect(source).toContain('getCardLibraryBlurb(rec.content');
        expect(source).toContain("iconRow.className = 'rt-npc-library-icon-row'");
    });

    it('treats library cards as role-agnostic PC or NPC identities', () => {
        expect(source).toContain("addBtn.textContent = '+ 原样添加'");
        expect(source).toContain("pcBtn.textContent = '▶ 扮演 PC'");
        expect(source).toContain('installLibraryCardAsPlayerCharacter');
        expect(source).toContain('buildApplyLibraryCardAsPcPrompt(rec)');
        expect(source).toContain('playerCharacter = {');
        expect(source).toContain("roleRow.className = 'rt-npc-library-split-row'");
        expect(source).toContain("title=\"保存到资料库\"");
    });

    it('sizes library portraits to the action stack and splits export/delete 50/50', () => {
        const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        const avatarStart = css.indexOf('.rt-npc-library-item .rt-charpicker-avatar {');
        const avatarBlock = css.slice(avatarStart, css.indexOf('}', avatarStart) + 1);
        expect(avatarStart).toBeGreaterThanOrEqual(0);
        expect(avatarBlock).toContain('aspect-ratio: 1 / 1');
        expect(avatarBlock).toContain('height: 0');
        expect(avatarBlock).toContain('min-height: 100%');
        expect(avatarBlock).not.toContain('min-width: 0');
        expect(avatarBlock).not.toContain('width: 140px');
        const infoStart = css.indexOf('.rt-npc-library-item .rt-charpicker-info {');
        const infoBlock = css.slice(infoStart, css.indexOf('}', infoStart) + 1);
        expect(infoStart).toBeGreaterThanOrEqual(0);
        expect(infoBlock).toContain('height: 0');
        expect(infoBlock).toContain('min-height: 100%');
        expect(css).toContain('.rt-npc-library-item .rt-charpicker-avatar img');
        expect(css).toContain('position: absolute');
        expect(css).toContain('.rt-npc-library-icon-row .rt-npc-library-icon-btn');
        const iconStart = css.indexOf('.rt-npc-library-icon-row .rt-npc-library-icon-btn {');
        const iconBlock = css.slice(iconStart, css.indexOf('}', iconStart) + 1);
        expect(iconBlock).toContain('flex: 1 1 0');
        const addBtnStart = css.indexOf('.rt-npc-library-item .rt-charpicker-add-btn {');
        const addBtnBlock = css.slice(addBtnStart, css.indexOf('}', addBtnStart) + 1);
        expect(addBtnStart).toBeGreaterThanOrEqual(0);
        expect(css).toContain('.rt-npc-library-split-row');
        expect(addBtnBlock).toContain('width: 100%');
        expect(css).toContain('.rt-npc-library-item .rt-charpicker-desc::-webkit-scrollbar-thumb');
        expect(css).toContain('scrollbar-color: #d4a940 transparent');
    });
});
