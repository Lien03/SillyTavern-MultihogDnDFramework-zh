// Presentation only: memo tags, numeric values and HTML attributes stay unchanged.
export const STATE_LABELS_ZH = {
    CHARACTER: '角色', INVENTORY: '背包', ABILITIES: '能力', SPELLS: '法术',
    TIME: '时间', QUESTS: '任务', PARTY: '队伍', COMBAT: '战斗', XP: '经验',
    STATUS: '状态', EQUIPMENT: '装备', 'BENCHED PARTY': '待命队友',
};

export function stateLabelZh(tag, customLabel) {
    return customLabel && customLabel !== tag ? customLabel : (STATE_LABELS_ZH[tag] || tag);
}

const labels = {
    Combat: '战斗', BAB: '基础攻击加值', Ranged: '远程', Melee: '近战',
    'Base AC': '基础护甲等级', 'Total AC': '总护甲等级', AC: '护甲等级',
    Gear: '装备', Proficiencies: '熟练项', Attr: '属性', Saves: '豁免',
    Skills: '技能', Traits: '特质', HD: '生命骰', Status: '状态',
    Spells: '法术', Info: '信息', Other: '其他', Res: '抗性', Currency: '现金',
    'Last Rest': '上次休息', 'Current Time': '当前时间',
};

export function localizeStateHtml(html) {
    return html.split(/(<[^>]*>)/g).map((part, index) => {
        if (index % 2) return part;
        let text = part.replace(/\b(Base AC|Total AC|Last Rest|Current Time|Combat|BAB|Gear|Proficiencies|Attr|Saves|Skills|Traits|HD|Status|Spells|Info|Other|Res|Currency)\s*:/g,
            (_, label) => `${labels[label]}：`);
        text = text.replace(/\b(Ranged|Melee)(?=\s*\()/g, (_, label) => labels[label]);
        text = text.replace(/\bAC(?=\s*(?:[+:]|$))/g, '护甲等级');
        text = text.replace(/\b(STR|DEX|CON|INT|WIS|CHA)(?=\s*\d)/g,
            (_, key) => ({ STR: '力量', DEX: '敏捷', CON: '体质', INT: '智力', WIS: '感知', CHA: '魅力' })[key]);
        text = text.replace(/\b(Fort|Ref|Will)(?=\s*(?:[+-]|$))/g,
            (_, key) => ({ Fort: '强韧', Ref: '反射', Will: '意志' })[key]);
        text = text.replace(/\battacks?\b/g, '次攻击');
        text = text.replace(/^(\s*)(Gear|Other Items)(\s*)$/i,
            (_, before, label, after) => before + (label.toLowerCase() === 'gear' ? '装备' : '其他物品') + after);
        return text.replace(/No active quests\./g, '暂无进行中的任务。');
    }).join('');
}
