import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');

function divDepthAt(marker) {
    const beforeMarker = settingsMarkup.slice(0, settingsMarkup.indexOf(marker));
    const tags = beforeMarker.match(/<\/?div(?:\s[^>]*)?>/g) || [];
    return tags.reduce((depth, tag) => depth + (tag.startsWith('</') ? -1 : 1), 0);
}

describe('General & Visuals settings', () => {
    it('keeps every primary section inside the framework drawer', () => {
        const primaryHeaders = [
            '<b>常规与外观</b>',
            '<b>连接与模型</b>',
            '<b>游戏系统与自定义</b>',
            '<b>状态追踪器与模块</b>',
            '<b>世界书代理</b>',
            '<b>持久地图</b>',
            '<b>世界进程</b>',
            '<b>冒险伙伴</b>',
        ];
        const expectedDepth = divDepthAt(primaryHeaders[0]);

        expect(primaryHeaders.map(divDepthAt)).toEqual(primaryHeaders.map(() => expectedDepth));
        expect((settingsMarkup.match(/<div(?:\s|>)/g) || []).length)
            .toBe((settingsMarkup.match(/<\/div>/g) || []).length);
    });

    it('organizes settings into Core & Branching, UI Appearance, and Portraits and Location Images drawers', () => {
        expect(settingsMarkup).toContain('<b>核心与分支</b>');
        expect(settingsMarkup).toContain('<b>界面外观</b>');
        expect(settingsMarkup).toContain('<b>肖像与地点图片</b>');
    });

    it('can reopen the API setup checklist from Core & Branching Help', () => {
        const generalStart = settingsMarkup.indexOf('<b>常规与外观</b>');
        const connectionsStart = settingsMarkup.indexOf('<b>连接与模型</b>');
        const generalMarkup = settingsMarkup.slice(generalStart, connectionsStart);
        expect(generalMarkup).toContain('id="rpg_tracker_api_setup_checklist"');
        expect(generalMarkup).toContain('反博物馆游览');
        expect(generalMarkup).toContain('id="rpg_tracker_game_master_name"');
        expect(generalMarkup).toContain('id="rpg_tracker_create_game_master_card"');
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(indexSource).toContain('showApiSetupGate');
        expect(indexSource).toContain("$('#rpg_tracker_api_setup_checklist')");
        expect(indexSource).toContain('createOrSelectGameMasterCard');
        expect(indexSource).toContain("$('#rpg_tracker_create_game_master_card')");
    });

    it('links General & Visuals to the canonical Map Themes controls', () => {
        const generalStart = settingsMarkup.indexOf('<b>常规与外观</b>');
        const connectionsStart = settingsMarkup.indexOf('<b>连接与模型</b>');
        const generalMarkup = settingsMarkup.slice(generalStart, connectionsStart);
        expect(generalMarkup).toContain('<b>地图外观</b>');
        expect(generalMarkup).toContain('id="rpg_open_map_themes"');
        expect(generalMarkup).toContain('在「持久地图」中管理');
    });

    it('places Connections & Models immediately after General & Visuals', () => {
        const general = settingsMarkup.indexOf('<b>常规与外观</b>');
        const connections = settingsMarkup.indexOf('<b>连接与模型</b>');
        const gameSystems = settingsMarkup.indexOf('<b>游戏系统与自定义</b>');

        expect(general).toBeGreaterThanOrEqual(0);
        expect(connections).toBeGreaterThan(general);
        expect(gameSystems).toBeGreaterThan(connections);
    });

    it('provides one central slot for every feature connection', () => {
        [
            'rpg_connection_slot_state_tracker',
            'rpg_connection_slot_combat_override',
            'rpg_connection_slot_lorebook_agent',
            'rpg_connection_slot_character_creation',
            'rpg_connection_slot_adventure_companion',
            'rpg_connection_slot_game_system_wizard',
            'rpg_connection_slot_map_architect',
            'rpg_connection_slot_map_runtime',
            'rpg_connection_slot_map_evolution',
            'rpg_connection_slot_world_progression',
            'rpg_connection_slot_portraits',
        ].forEach(id => expect(settingsMarkup).toContain(`id="${id}"`));

        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(indexSource).toContain('organizeConnectionSettingsUI();');
        expect(indexSource).toContain('initSettingsOverlay(');
        expect(indexSource).toContain("settings-stub");
        expect(indexSource).toContain("control: '#rpg_tracker_connection_source'");
        expect(indexSource).toContain("control: '#rpg_tracker_router_source'");
        expect(indexSource).toContain("control: '#rpg_adventure_companion_connection_source'");
        expect(indexSource).toContain("control: '#rpg_gs_wizard_connection_source'");
        expect(indexSource).toContain("control: '#rpg_map_architect_connection_source'");
        expect(indexSource).toContain("control: '#rpg_map_runtime_connection_source'");
        expect(indexSource).toContain("control: '#rpg_map_evolution_connection_source'");
        expect(indexSource).toContain("control: '#rpg_world_connection_source'");
        expect(indexSource).toContain("control: '#rpg_portrait_connection_source'");
        expect(indexSource).toContain('建议选择廉价的中端模型，例如 GPT-5.6 Luna、Gemini Flash/Flash-Lite 系列或最新的 Deepseek V4 Flash。');
        expect(indexSource).toContain('这里使用与状态追踪器相同的模型即可。');
        expect(indexSource).toContain('建议在此使用稍好一些的模型（例如 Sonnet 5 及以上），以支持更稳健、更复杂的系统。效果因系统而异，请多尝试。');
        expect(indexSource).toContain('轻量级模型即可胜任。');
        expect(indexSource).not.toContain('Prefer a fast model above all');
        expect(indexSource).toContain("chevron.className = 'inline-drawer-icon fa-solid fa-circle-chevron-down rt-central-connection-chevron'");
        expect(settingsMarkup).toContain('id="rpg_connection_apply_all_box"');
        expect(settingsMarkup).toContain('将连接设置应用到全部');

        const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        expect(style).toContain('.rpg-tracker-settings .rt-central-connection-header');
        expect(style).toContain('font-size: 0.88em !important;');
        expect(style).toContain('.rt-central-connection-chevron');
        expect(style).toContain('transform: rotate(-90deg) !important;');
        expect(style).toContain('.rt-central-connection-drawer.open');
        expect(style).toContain('transform: rotate(0deg) !important;');
    });

    it('centers the State Tracker utility drawer labels without moving their arrows', () => {
        expect(settingsMarkup).toContain('<b>连接设置</b>');
        expect(settingsMarkup).toContain('<b>战斗 API 覆盖</b>');
        expect(settingsMarkup).toContain('<b>核心提示词</b>');
        const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        expect(style).toContain('.rpg-tracker-settings .rt-centered-drawer-header');
        expect(style).toContain('justify-content: center;');
        expect(style).toContain('right: 14px;');
    });

    it('keeps portrait-specific drawers and the emergency purge within Portraits and Location Images', () => {
        const portraitsStart = settingsMarkup.indexOf('<b>肖像与地点图片</b>');
        const developerStart = settingsMarkup.indexOf('调试与出厂重置');
        const portraitsMarkup = settingsMarkup.slice(portraitsStart, developerStart);

        expect(portraitsMarkup).toContain('<b>肖像 LLM 连接</b>');
        expect(portraitsMarkup).toContain('<b>肖像与地点图片风格</b>');
        expect(portraitsMarkup).toContain('<b>肖像提示词模板</b>');
        expect(portraitsMarkup).toContain('id="rpg_portrait_prompt_presets_container"');
        expect(portraitsMarkup).toContain('id="rpg_portrait_prompt_preset_save_btn"');
        expect(portraitsMarkup).toContain('id="rpg_tracker_purge_all_portraits"');
        expect(portraitsMarkup).toContain('id="rpg_tracker_portrait_use_story_lookback"');
        expect(portraitsMarkup).toContain('id="rpg_tracker_portrait_story_lookback"');
        expect(portraitsMarkup.indexOf('>肖像与地点图片风格<'))
            .toBeLessThan(portraitsMarkup.indexOf('<b>肖像提示词模板</b>'));
        expect(portraitsMarkup).not.toContain('<b>Portrait Prompt Presets</b>');
        expect(portraitsMarkup).toContain('加载到下方的<b>肖像提示词模板</b>');
        expect(portraitsMarkup).toContain('保存设置到库');
    });

    it('mirrors every Adventure Companion option and gives it a dedicated connection', () => {
        const companionStart = settingsMarkup.indexOf('<b>冒险伙伴</b>');
        const companionMarkup = settingsMarkup.slice(companionStart);

        expect(companionMarkup).toContain('使用状态追踪器顶部的 <b>CHAT</b> 按钮打开冒险伙伴。启用 <b>TUTORIAL MODE</b>（教程模式）后，它能帮助你进行冒险，让你上手这个扩展。');
        expect(companionMarkup).toContain('否则，当你只是想聊聊冒险或进行头脑风暴等时，它也在那里。');
        expect(companionMarkup).toContain('你也可以请它在状态追踪器、世界书代理或地图更新器中做出更改，只要你开口（通过输入消息或替你做出 CYOA 模式选择），它就能为你执行操作。');

        [
            'rpg_adventure_companion_tutorial_mode',
            'rpg_adventure_companion_lookback',
            'rpg_adventure_companion_lookback_all',
            'rpg_adventure_companion_inject_lore',
            'rpg_adventure_companion_inject_memo',
            'rpg_adventure_companion_inject_map',
            'rpg_adventure_companion_connection_source',
            'rpg_adventure_companion_connection_profile',
            'rpg_adventure_companion_ollama_url',
            'rpg_adventure_companion_ollama_model',
            'rpg_adventure_companion_openai_url',
            'rpg_adventure_companion_openai_key',
            'rpg_adventure_companion_openai_model',
            'rpg_adventure_companion_openai_model_manual',
            'rpg_adventure_companion_completion_preset',
        ].forEach((id) => expect(companionMarkup).toContain(`id="${id}"`));
    });

    it('places Persistent Maps directly below Lorebook Agent', () => {
        const agentStart = settingsMarkup.indexOf('<b>世界书代理</b>');
        const mapStart = settingsMarkup.indexOf('<b>持久地图</b>');
        const worldStart = settingsMarkup.indexOf('<b>世界进程</b>');

        expect(agentStart).toBeGreaterThanOrEqual(0);
        expect(mapStart).toBeGreaterThan(agentStart);
        expect(worldStart).toBeGreaterThan(mapStart);
        expect(settingsMarkup.indexOf('<b>Map Architect</b>')).toBeGreaterThan(mapStart);
        expect(settingsMarkup.indexOf('<b>Architect Prompt</b>')).toBeLessThan(0);
    });

    it('places editable map themes at the bottom of Persistent Maps', () => {
        const mapStart = settingsMarkup.indexOf('<b>持久地图</b>');
        const evolutionStart = settingsMarkup.indexOf('<b>Map Evolution</b>', mapStart);
        const themesStart = settingsMarkup.indexOf('<b>地图主题</b>', mapStart);
        const worldStart = settingsMarkup.indexOf('<b>世界进程</b>');
        const mapMarkup = settingsMarkup.slice(mapStart, worldStart);

        expect(themesStart).toBeGreaterThan(evolutionStart);
        expect(themesStart).toBeLessThan(worldStart);
        expect(mapMarkup).toContain('id="rpg_map_theme_preset"');
        expect(mapMarkup).toContain('id="rpg_map_theme_load"');
        expect(mapMarkup).toContain('id="rpg_map_theme_save"');
        expect(mapMarkup).toContain('id="rpg_map_theme_delete"');
        expect(mapMarkup).toContain('id="rpg_map_theme_colors"');
        expect(mapMarkup).toContain('id="rpg_map_theme_bg_upload"');
        expect(mapMarkup).toContain('id="rpg_map_theme_bg_clear"');
        expect(mapMarkup).toContain('id="rpg_map_theme_bg_url"');
        expect(mapMarkup).toContain('id="rpg_map_theme_bg_overlay"');
    });

    it('places Adventure Companion directly below World Progression', () => {
        const worldStart = settingsMarkup.indexOf('<b>世界进程</b>');
        const companionStart = settingsMarkup.indexOf('<b>冒险伙伴</b>');

        expect(worldStart).toBeGreaterThanOrEqual(0);
        expect(companionStart).toBeGreaterThan(worldStart);
        expect(settingsMarkup.indexOf('<b>世界书代理</b>')).toBeLessThan(worldStart);
    });

    it('places the global custom-bar animation toggle beside the Rendering Tags Library', () => {
        const library = settingsMarkup.indexOf('id="rt_btn_tag_library"');
        const animation = settingsMarkup.indexOf('id="rpg_tracker_animate_all_custom_bars"');
        const moduleExport = settingsMarkup.indexOf('id="rpg_tracker_export_all_modules"');

        expect(library).toBeGreaterThanOrEqual(0);
        expect(animation).toBeLessThan(library);
        expect(animation).toBeLessThan(moduleExport);
        expect(settingsMarkup.slice(animation, library)).toContain('在状态追踪器中动画显示所有自定义条形的变化');
        expect(settingsMarkup).not.toContain('âˆ’value');
    });
});
