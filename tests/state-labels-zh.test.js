import { describe, expect, it, vi } from 'vitest';
vi.mock('../portrait-storage.js', () => ({ lookupCustomPortraitSrc: () => '' }));
import { blockToItems, renderMemoAsCards } from '../renderer.js';
import { localizeStateHtml, stateLabelZh } from '../src/ui/state-labels-zh.js';

describe('Chinese state panel', () => {
    it('renders existing English-format stats in Chinese without changing machine tags', () => {
        const memo = `[CHARACTER]
L: 7/7 HP
Combat: BAB: +0 | Ranged (1 attack): +1 | Melee (1 attack): +0 | Base AC: 11 | Total AC: 11
Gear: 徒手 (1d3 钝击) | 无护甲 (AC +0)
Proficiencies: 徒手
Attr: STR 10 (+0), DEX 12 (+1), CON 12 (+1), INT 16 (+3), WIS 13 (+1), CHA 12 (+1)
Saves: Fort +1 | Ref +1 | Will +3
Skills: 分析推理 +5
Traits: 前世记忆
HD: d6 (1/1)
Status: 健康
[/CHARACTER]
[INVENTORY]
Currency: 30 CP
[/INVENTORY]`;
        const html = renderMemoAsCards(memo, null, {});
        for (const label of ['角色', '背包', '战斗', '基础攻击加值', '远程', '近战', '基础护甲等级', '总护甲等级', '装备', '熟练项', '力量', '敏捷', '体质', '智力', '感知', '魅力', '强韧', '反射', '意志', '技能', '特质', '生命骰', '状态']) expect(html).toContain(label);
        expect(html).toContain('data-tag="CHARACTER"');
        expect(html).toContain('1d3');
        expect(memo).toContain('STR 10');
        expect(blockToItems('INVENTORY', 'Currency: 30 CP').totalValueGP).toBeTruthy();
    });
    it('preserves custom titles and HTML attributes', () => {
        expect(stateLabelZh('CHARACTER', '我的角色')).toBe('我的角色');
        expect(stateLabelZh('CHARACTER', 'CHARACTER')).toBe('角色');
        expect(localizeStateHtml('<span data-label="Status:" title="Will">Status:</span>')).toBe('<span data-label="Status:" title="Will">状态：</span>');
    });
});
