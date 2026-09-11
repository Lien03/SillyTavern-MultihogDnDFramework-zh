import { getSettings, getNpcRelationshipMaxDefault, DEFAULT_NPC_SECTIONS, DEFAULT_PC_SECTIONS, recordDeletedCustomTags, clearDeletedCustomTagTombstones, removeChatSetupCatalogEntries, getChatSetupItemScope, setChatSetupItemScope, setChatSetupItemEnabled } from './state-manager.js';
import { sendStateRequest } from './llm-client.js';
import { BLOCK_ICONS, BLOCK_ORDER, DEFAULT_STOCK_PROMPTS, PAGE_SIZE, resolveTimePromptKey, resolveTimePromptDisplayTag } from './constants.js';
import { escapeHtml } from './memo-processor.js';
import { makeDraggable, makeResizableBR } from './ui-geometry.js';
import { 
    saveSettings, 
    refreshRenderedView, 
    setUse24hTime, 
    setUseDdMmYyFormat, 
    updateStatusIndicator,
    syncNpcPortraitDependentUi,
    syncLocationImageDependentUi,
    syncTimeFormatSettingsUi,
    refreshQuestPrompt,
    syncMemoView,
    bindRenderedCardEvents,
    sectionPages as _sectionPages,
    rebuildNpcInstructionIfNeeded,
    autoApplySysprompt
} from './src/app/runtime-bridge.js';
import { renderMemoAsCards, MARKER_TYPE_MAP, getMarkerLibraryKeys } from './renderer.js';
import { moveDisplayGroupInOrder, normalizeDisplayGroups } from './src/features/display-groups.js';
import { applyMapArchitectOpenerToUi, syncMapArchitectOpenerNestedVisibility } from './map-architect-opener.js';
import { LOCATION_MAPPING_SECTION_TAG } from './src/state/section-enabled.js';

export function handleCategorySettings(tag, targetEl) {
    const existing = document.getElementById('rt-cat-settings-popup');
    if (existing) {
        const oldTag = existing.getAttribute('data-tag');
        existing.remove();
        if (oldTag === tag) return;
    }
    const s = getSettings();
    if (!s.categoryRenderOptions) s.categoryRenderOptions = {};
    if (!s.categoryRenderOptions[tag]) {
        const noBullets = (tag === 'TIME' || tag === 'XP' || tag === 'QUESTS' || tag === 'SPELLS' || tag === 'CHARACTER' || tag === 'PARTY' || tag === 'COMBAT' || tag === 'ABILITIES');
        s.categoryRenderOptions[tag] = {
            fontSize: (tag === 'TIME' || tag === 'INVENTORY') ? 12 : 13,
            italic: false,
            bold: false,
            bullets: !noBullets,
            bulletStyle: tag === 'INVENTORY' ? '▪' : '•',
            bulletColor: 'inherit',
            fontFamily: 'inherit',
            textColor: 'inherit'
        };
    } else if (s.categoryRenderOptions[tag].bullets === undefined) {
        if (tag === 'TIME' || tag === 'XP' || tag === 'QUESTS' || tag === 'SPELLS' || tag === 'CHARACTER' || tag === 'PARTY' || tag === 'COMBAT' || tag === 'ABILITIES') {
            s.categoryRenderOptions[tag].bullets = false;
        } else {
            s.categoryRenderOptions[tag].bullets = true;
        }
    }
    const cfg = s.categoryRenderOptions[tag];
    const initialCfg = JSON.stringify(cfg);

    let applyTimeout = null;
    const applyLive = () => {
        if (applyTimeout) clearTimeout(applyTimeout);
        applyTimeout = setTimeout(() => {
            saveSettings();
            refreshRenderedView();
        }, 50);
    };

    const popup = document.createElement('div');
    popup.id = 'rt-cat-settings-popup';
    popup.setAttribute('data-tag', tag);
    popup.style.cssText = `
            position: fixed; z-index: 999999; background: #252535; border: 1px solid rgba(255,255,255,0.3);
            border-radius: 12px; padding: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.75);
            backdrop-filter: blur(16px); color: #ffffff !important; font-family: sans-serif; width: 280px;
        `;

    const renderContent = () => {
        const symbols = ['•', '○', '●', '▪', '▫', '▶', '➤', '—', '*', '>', '✓', '⚡'];
        popup.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="font-size:0.85em; font-weight:bold; opacity:0.8; letter-spacing:0.05em; text-transform:uppercase;">${tag} 设置</div>
                    
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <span style="font-size:0.85em; opacity:0.8;">字号</span>
                            <span id="rt-cat-fs-val" style="font-size:0.85em; font-weight:bold; color:var(--rt-accent, #00ffaa);">${cfg.fontSize || '13'}</span>
                        </div>
                        <input id="rt-cat-fs" type="range" value="${cfg.fontSize || 13}" min="8" max="24" step="1" style="width:100%; cursor:pointer; accent-color:var(--rt-accent, #00ffaa);">
                    </div>

                    <div style="display:flex; gap:6px;">
                        <button id="rt-cat-bold" style="flex:1; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:${cfg.bold ? 'rgba(255,255,255,0.15)' : 'transparent'}; color:white; cursor:pointer; font-weight:bold;">B</button>
                        <button id="rt-cat-italic" style="flex:1; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:${cfg.italic ? 'rgba(255,255,255,0.15)' : 'transparent'}; color:white; cursor:pointer; font-style:italic;">I</button>
                        ${(tag !== 'QUESTS' && tag !== 'SPELLS' && tag !== 'CHARACTER' && tag !== 'PARTY' && tag !== 'COMBAT' && tag !== 'ABILITIES') ? `<button id="rt-cat-bullets" style="flex:2; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:${cfg.bullets ? 'rgba(255,255,255,0.15)' : 'transparent'}; color:white; cursor:pointer; font-size:0.85em;">${cfg.bullets ? '项目符号：开' : '项目符号：关'}</button>` : ''}
                    </div>

                    <div style="display:${(cfg.bullets && tag !== 'QUESTS' && tag !== 'SPELLS' && tag !== 'CHARACTER' && tag !== 'PARTY' && tag !== 'COMBAT' && tag !== 'ABILITIES') ? 'flex' : 'none'}; flex-direction:column; gap:8px;">
                        <div style="font-size:0.75em; opacity:0.6; font-weight:bold; text-transform:uppercase;">项目符号样式</div>
                        <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:4px;">
                            ${symbols.map(s => `
                                <button class="symbol-btn" data-symbol="${s}" style="aspect-ratio:1; border:1px solid ${cfg.bulletStyle === s ? 'var(--rt-accent, #00ffaa)' : 'rgba(255,255,255,0.1)'}; background:${cfg.bulletStyle === s ? 'rgba(0,255,170,0.1)' : 'rgba(0,0,0,0.2)'}; color:white; border-radius:4px; cursor:pointer; font-size:1em;">${s}</button>
                            `).join('')}
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:4px;">
                            <span style="font-size:0.85em; opacity:0.8;">项目符号颜色</span>
                            <input id="rt-cat-bullet-color" type="color" value="${cfg.bulletColor === 'inherit' ? '#ffffff' : cfg.bulletColor}" style="width:40px; height:24px; border:none; border-radius:4px; cursor:pointer; background:none;">
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <span style="font-size:0.85em; opacity:0.8;">字体</span>
                            <select id="rt-cat-family" style="background:#151525; color:white; border:1px solid rgba(255,255,255,0.2); border-radius:4px; font-size:0.85em; padding:2px 4px;">
                                <option value="inherit" ${cfg.fontFamily === 'inherit' ? 'selected' : ''}>继承</option>
                                <option value="sans-serif" ${cfg.fontFamily === 'sans-serif' ? 'selected' : ''}>无衬线</option>
                                <option value="serif" ${cfg.fontFamily === 'serif' ? 'selected' : ''}>衬线</option>
                                <option value="monospace" ${cfg.fontFamily === 'monospace' ? 'selected' : ''}>等宽</option>
                            </select>
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.85em; opacity:0.8;">文字颜色</span>
                                <button id="rt-cat-color-reset" style="font-size:0.7em; background:rgba(255,255,255,0.1); border:none; color:#aaa; border-radius:3px; padding:1px 4px; cursor:pointer;">重置</button>
                            </div>
                            <input id="rt-cat-text-color" type="color" value="${cfg.textColor === 'inherit' ? '#ffffff' : cfg.textColor}" style="width:40px; height:24px; border:none; border-radius:4px; cursor:pointer; background:none;">
                        </div>
                    </div>

                    <div style="display:flex; gap:6px; margin-top:4px;">
                        <button id="rt-cat-ok" style="flex:1.5; padding:8px; border-radius:6px; border:none; background:var(--rt-accent-bg, #00ffaa); color:#000; font-weight:bold; cursor:pointer; font-size:0.85em;">完成</button>
                        <button id="rt-cat-reset" style="flex:1; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:white; cursor:pointer; font-size:0.85em;">重置</button>
                    </div>
                </div>
            `;

        popup.querySelector('#rt-cat-fs').addEventListener('mousedown', (e) => e.stopPropagation());
        popup.querySelector('#rt-cat-fs').addEventListener('input', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            const val = parseInt(target.value);
            cfg.fontSize = val;
            const display = popup.querySelector('#rt-cat-fs-val');
            if (display) display.textContent = val.toString() + 'px';
            applyLive();
        });

        popup.querySelector('#rt-cat-bold').addEventListener('click', () => {
            cfg.bold = !cfg.bold;
            applyLive();
            renderContent();
        });

        popup.querySelector('#rt-cat-italic').addEventListener('click', () => {
            cfg.italic = !cfg.italic;
            applyLive();
            renderContent();
        });

        const bulletsBtn = popup.querySelector('#rt-cat-bullets');
        if (bulletsBtn) {
            bulletsBtn.addEventListener('click', () => {
                cfg.bullets = !cfg.bullets;
                applyLive();
                renderContent();
            });
        }

        popup.querySelectorAll('.symbol-btn').forEach(btn => {
            const el = /** @type {HTMLElement} */ (btn);
            el.addEventListener('click', () => {
                cfg.bulletStyle = el.dataset.symbol;
                applyLive();
                renderContent();
            });
        });

        const colorInp = popup.querySelector('#rt-cat-bullet-color');
        if (colorInp) {
            colorInp.addEventListener('mousedown', (e) => e.stopPropagation());
            colorInp.addEventListener('input', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                cfg.bulletColor = target.value;
                applyLive();
            });
        }

        popup.querySelector('#rt-cat-family').addEventListener('change', (e) => {
            const target = /** @type {HTMLSelectElement} */ (e.target);
            cfg.fontFamily = target.value;
            applyLive();
        });

        const textColorInp = popup.querySelector('#rt-cat-text-color');
        if (textColorInp) {
            textColorInp.addEventListener('mousedown', (e) => e.stopPropagation());
            textColorInp.addEventListener('input', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                cfg.textColor = target.value;
                applyLive();
            });
        }

        popup.querySelector('#rt-cat-color-reset').addEventListener('click', () => {
            cfg.textColor = 'inherit';
            applyLive();
            renderContent();
        });

        popup.querySelector('#rt-cat-ok').addEventListener('click', () => {
            popup.remove();
        });

        popup.querySelector('#rt-cat-reset').addEventListener('click', () => {
            const noBullets = (tag === 'TIME' || tag === 'XP' || tag === 'QUESTS' || tag === 'SPELLS' || tag === 'CHARACTER' || tag === 'PARTY' || tag === 'COMBAT' || tag === 'ABILITIES');
            cfg.fontSize = (tag === 'TIME' || tag === 'INVENTORY') ? 12 : 13;
            cfg.italic = false;
            cfg.bold = false;
            cfg.bullets = !noBullets;
            cfg.bulletStyle = tag === 'INVENTORY' ? '▪' : '•';
            cfg.bulletColor = 'inherit';
            cfg.fontFamily = 'inherit';
            cfg.textColor = 'inherit';
            applyLive();
            renderContent();
        });
    };

    renderContent();
    document.body.appendChild(popup);

    const rect = targetEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - 140;
    let top = rect.bottom + 10;
    left = Math.max(8, Math.min(left, window.innerWidth - 288));
    if (top + 300 > window.innerHeight) top = rect.top - 300;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    const onOutside = (e) => {
        if (!popup.contains(e.target) && !targetEl.contains(e.target)) {
            popup.remove();
            document.removeEventListener('mouseup', onOutside);
        }
    };
    setTimeout(() => document.addEventListener('mouseup', onOutside), 50);
}

function buildExistingFieldsContextForAi(settings) {
    const stock = ['COMBAT', 'CHARACTER', 'PARTY', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME'].map(t => `[${t}]`);
    const custom = (settings.customFields || []).map(f => `[${f.tag.toUpperCase()}] (${f.label})`);
    return `Currently configured modules/sections:\n- Built-in (Stock):\n  ${stock.join('\n  ')}\n- Custom Modules:\n  ${custom.length ? custom.join('\n  ') : '(none yet)'}`;
}

function parseAiJsonResponse(result) {
    const match = result.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not contain a JSON block');
    return JSON.parse(match[0]);
}

async function showAiCustomModulePreviewPopup(parsed, settings) {
    const { Popup } = SillyTavern.getContext();
    const isEditing = (settings.customFields || []).some(f => f.tag.toUpperCase() === parsed.tag.toUpperCase());
    const actionLabel = isEditing ? '覆盖现有' : '创建自定义模块';

    const body = `
        <div class="flex-container flexFlowColumn gap-1" style="font-family:sans-serif; text-align:left; max-width:480px;">
            <div style="font-size:0.9em; line-height:1.4; opacity:0.8;">AI 生成了以下自定义模块结构。确认后将应用到你的设置。</div>
            <div class="flex-container gap-1 alignitemscenter" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); margin-top:4px;">
                <span style="font-size:1.6em;">${escapeHtml(parsed.icon || '📄')}</span>
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:1.1em;">${escapeHtml(parsed.label || parsed.tag)}</div>
                    <div style="font-family:monospace; font-size:0.85em; opacity:0.6;">[${escapeHtml(parsed.tag.toUpperCase())}]</div>
                </div>
            </div>
            <div style="font-size:0.8em; font-weight:bold; text-transform:uppercase; margin-top:8px; opacity:0.5;">提示词指令</div>
            <textarea readonly class="text_pole" rows="5" style="font-size:11px; width:100%; resize:vertical; background:rgba(0,0,0,0.1);">${escapeHtml(parsed.prompt)}</textarea>
            
            <div style="font-size:0.8em; font-weight:bold; text-transform:uppercase; margin-top:6px; opacity:0.5;">沙盒预览格式</div>
            <textarea readonly class="text_pole" rows="3" style="font-family:monospace; font-size:11px; width:100%; resize:vertical; background:rgba(0,0,0,0.1);">${escapeHtml(parsed.template)}</textarea>
        </div>
    `;

    const choice = await Popup.show.confirm('🤖 AI 自定义模块预览', body, {
        okButton: actionLabel,
        cancelButton: '放弃修改'
    });
    return choice === 1 ? parsed : null;
}

async function promptForAiModuleEditDescription(moduleLabel) {
    const { Popup, POPUP_TYPE, POPUP_RESULT } = SillyTavern.getContext();
    const body = `
        <div style="display:flex; flex-direction:column; gap:8px; min-width:360px; text-align:left;">
            <div style="font-size:12px; opacity:0.8; line-height:1.4;">
                用自然语言描述你想对 <b>${escapeHtml(moduleLabel)}</b> 指令做出的修改。
            </div>
            <textarea id="rt_pe_edit_desc" class="text_pole" rows="5" style="width:100%; resize:vertical;" placeholder="示例：让它也追踪任务进度比例，显示 '进度：已收集 2/5'。为金币、银币、铜币添加钱包徽章。"></textarea>
        </div>
    `;

    // Capture the textarea value via onClosing, which fires while the DOM is still live —
    // before the popup dialog element is removed. Reading the element AFTER show() resolves
    // is too late: Popup removes its DOM before settling the promise.
    let capturedDescription = null;
    const popup = new Popup(body, POPUP_TYPE.CONFIRM, null, {
        okButton: '修订指令',
        cancelButton: '取消',
        onClosing: (p) => {
            const ta = /** @type {HTMLTextAreaElement|null} */ (p.dlg.querySelector('#rt_pe_edit_desc'));
            capturedDescription = ta ? ta.value.trim() : null;
            return true; // allow close
        },
    });
    const result = await popup.show();
    if (result !== POPUP_RESULT.AFFIRMATIVE) return null;
    return capturedDescription || null;
}

async function showAiStockPromptPreviewPopup(displayTag, promptText) {
    const { Popup } = SillyTavern.getContext();
    const body = `
        <div class="flex-container flexFlowColumn gap-1" style="font-family:sans-serif; text-align:left; max-width:480px;">
            <div style="font-size:0.9em; line-height:1.4; opacity:0.8;">查看 AI 生成的修订后提示词指令。确认后将应用到你的编辑器。</div>
            <div style="font-size:0.8em; font-weight:bold; text-transform:uppercase; margin-top:8px; opacity:0.5;">提示词指令</div>
            <textarea readonly class="text_pole" rows="12" style="font-size:11px; width:100%; resize:vertical; background:rgba(0,0,0,0.1);">${escapeHtml(promptText)}</textarea>
        </div>
    `;
    const choice = await Popup.show.confirm(`🤖 AI 提示词预览 [${displayTag}]`, body, {
        okButton: '应用到编辑器',
        cancelButton: '放弃更改'
    });
    return choice === 1 ? promptText : null;
}

function buildAiCustomModuleRules(existingTags, editingTag = null) {
    const filter = editingTag ? existingTags.filter(t => t.toUpperCase() !== editingTag.toUpperCase()) : existingTags;
    const list = filter.map(t => `[${t.toUpperCase()}]`).join(', ');

    const markerExamples = getMarkerLibraryKeys().map(key => {
        const rule = MARKER_TYPE_MAP[key];
        const example = rule.example || 'Example text';
        return `  - ((${key})) ${example}`;
    }).join('\n');

    return `Instructions:
- Output ONLY the JSON block. Do NOT include markdown fences, preambles, or postscripts.
- The tag name must be short, alpha-numeric, uppercase, and UNIQUE. Avoid clashes with existing custom tags: ${list || '(none)'} or stock tags: [COMBAT], [CHARACTER], [PARTY], [INVENTORY], [ABILITIES], [SPELLS], [XP], [TIME].
- Choose a beautiful, fitting single emoji icon.
- Write precise, concise instructions for the tracking model. Explain what state properties/values to increment, decrement, or add.
- Define a realistic, matching sample block template in the "template" key matching your instructions. Use inline rendering tags for visuals:
${markerExamples}`;
}

async function runAiEditCustomModule(settings, field, description) {
    const existingTags = (settings.customFields || []).map(f => f.tag.toUpperCase());
    const rules = buildAiCustomModuleRules(existingTags, field.tag);
    const existingFieldsContext = buildExistingFieldsContextForAi(settings);

    const systemPrompt = `You are a custom plugin/module creator for a state tracking framework. Based on the user's description, write a JSON definition for a custom tracking module.

Output ONLY a single valid JSON block with these exact keys:
{
  "icon": "<single emoji icon>",
  "tag": "<short uppercase alpha-numeric tag, e.g. FACTION>",
  "label": "<display name label, e.g. Faction Standing>",
  "prompt": "<detailed prompt instructions explaining what variables the AI should track, how to update them, and their formatting layout>",
  "template": "<sample output rendering using inline rendering tags>"
}

${rules}`;

    const context = `${existingFieldsContext}

CURRENT STATE:
Icon:  ${field.icon || '📄'}
Tag:   ${field.tag.toUpperCase()}
Label: ${field.label || field.tag}
Prompt:
${field.prompt}
Template:
${field.template}

USER REQUESTED CHANGES:
${description}`;

    const raw = await sendStateRequest(settings, systemPrompt, context);
    const parsed = parseAiJsonResponse(raw);
    return await showAiCustomModulePreviewPopup(parsed, settings);
}

async function runAiEditStockModulePrompt(settings, modKey, blockTag, displayTag, currentPrompt, description) {
    const existingFieldsContext = buildExistingFieldsContextForAi(settings);
    const systemPrompt = `You are an expert system-prompt designer for a RPG tracking system. Your task is to revise the instruction prompt for the stock module [${displayTag}].

Your revision must:
1. Explain what variables to track, when to increment/decrement them, and how to format their values.
2. Rely heavily on the user's requested changes to shape the rules.
3. Keep instructions concise, direct, and authoritative (written for an AI system).
4. Do NOT output any markdown fences, HTML wrapper tags, or code blocks. Output the raw text of the revised instructions ONLY.`;

    const context = `${existingFieldsContext}

CURRENT PROMPT FOR [${displayTag}]:
${currentPrompt}

USER REQUESTED REVISIONS:
${description}`;

    const raw = await sendStateRequest(settings, systemPrompt, context);
    const parsedText = (raw || '').replace(/```[\s\S]*?```/g, '').trim();
    if (!parsedText) return null;
    return await showAiStockPromptPreviewPopup(displayTag, parsedText);
}

function buildRowTypeSelect(selectedVal) {
    const options = [
        ['Text (Plain text)', 'text'],
        ['Text Area (Multi-line)', 'textarea'],
        ['Number Counter', 'number'],
        ['HP Bar (Crimson)', 'hpbar'],
        ['Blue Mana Bar', 'manabar'],
        ['XP Progress Bar (Gold)', 'xpbar'],
        ['Status Pills (Comma-separated)', 'pills'],
        ['Coins Badge (Economy)', 'coins'],
        ['Quest Objectives (List)', 'objectives'],
    ];
    return `<select class="rt-cfe-row-type-select text_pole" style="font-size:12px; height:24px; padding:2px; width:130px;">` +
        options.map(([lbl, val]) => `<option value="${val}"${val === selectedVal ? ' selected' : ''}>${lbl}</option>`).join('') +
        `</select>`;
}

/**
 * Re-resolve a custom field after catalog sync may have recloned `customFields`.
 * Alt-tab / saveSettings → syncChatSetupCatalogs replaces array identities; a
 * closure-captured field object becomes an orphan. Mutating it + removing the
 * old tag then deletes the live module.
 * @param {string} openedTag
 * @param {number} openedIndex
 */
function resolveLiveCustomField(openedTag, openedIndex) {
    const live = getSettings();
    const fields = Array.isArray(live.customFields) ? live.customFields : [];
    const want = String(openedTag || '').toUpperCase();
    let liveIndex = fields.findIndex(f => String(f?.tag || '').toUpperCase() === want);
    if (liveIndex < 0 && openedIndex >= 0 && openedIndex < fields.length) {
        liveIndex = openedIndex;
    }
    return { live, liveIndex, liveField: liveIndex >= 0 ? fields[liveIndex] : null };
}

export function openCustomFieldEditor(index) {
    const isSmallScreen = window.innerWidth <= 700;
    const s = getSettings();
    const field = s.customFields[index];
    // Tag identity at open time. saveSettings → syncChatSetupCatalogs reclones
    // customFields (e.g. alt-tab visibility flush), so the closed-over `field`
    // object can become an orphan. Always re-resolve by this tag before mutate.
    const openedTag = String(field?.tag || '').toUpperCase();
    const overlay = document.createElement('div');
    overlay.id = 'rt_cfe_overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);backdrop-filter:blur(2px);z-index:10000000;display:none;align-items:center;justify-content:center;overflow-y:auto;';

    overlay.innerHTML = `
            <div id="rt_cfe_modal" class="popup shadowBase" style="
                width: min(540px, 94vw);
                height: ${isSmallScreen ? '85vh' : 'auto'};
                max-height: ${isSmallScreen ? '90vh' : '850px'};
                margin: auto;
                display: flex;
                flex-direction: column;
                padding: 0;
                overflow: hidden;
            ">
                <div class="popup-header">
                    <h3 class="margin0" style="font-size:14px; flex:1;">自定义模块编辑器</h3>
                    <div id="rt_cfe_close" class="popup-close interactable" title="关闭"><i class="fa-solid fa-times"></i></div>
                </div>
                <div class="popup-body flex-container flexFlowColumn gap-1" style="padding:10px 14px; overflow-y:auto; flex:1;">
                    <!-- Identity row -->
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                        <input type="text" id="rt_cfe_icon" class="text_pole" style="width:44px;text-align:center;" title="图标（表情）">
                        <input type="text" id="rt_cfe_tag"  class="text_pole" style="width:100px;font-family:monospace;" placeholder="标签">
                        <input type="text" id="rt_cfe_label" class="text_pole" style="flex:1;min-width:80px;" placeholder="显示名称">
                    </div>

                    <!-- Layout Options -->
                    <div style="display:flex; align-items:center; gap:10px; margin-top:4px; padding:2px 4px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:12px; font-weight:bold; opacity:0.8;">分页阈值：</span>
                            <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt_cfe_pagesize" class="text_pole" style="width:50px; height:24px; text-align:center;" min="1" max="99" title="超过该数量时添加分页按钮">
                            <span style="font-size:11px; opacity:0.6;">条目</span>
                        </div>
                    </div>

                    <!-- AI Instructions -->
                    <div style="margin-top:12px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                            <i class="fa-solid fa-robot" style="opacity:0.7;"></i>
                            <b style="font-size:12px;">AI 指令</b>
                        </div>
                        <textarea id="rt_cfe_prompt" class="text_pole" rows="10" style="resize:vertical; width:100%;" placeholder="AI 应追踪什么、以什么格式？在此定义指令。你可以使用下方带实时预览的输入框（目前仅桌面端！）生成并粘贴格式化指令模板。&#10;&#10;示例：追踪主角的极限突破充能等级。使用时「使用次数」+1；每次使用等级 +1。&#10;&#10;格式：&#10;[LIMIT BREAK]&#10;((XPBAR)) 极限突破：10/100 等级 4&#10;使用次数：3&#10;[/LIMIT BREAK]"></textarea>
                    </div>

                    <!-- Testing Sandbox -->
                    <div style="margin-top:15px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                             <b style="font-size:13px;">测试沙盒（仅桌面端） <i class="fa-solid fa-circle-question" style="opacity:0.5; cursor:help; font-size:11px;" title="此框仅供测试 UI 如何渲染你的格式，内容不会发送给 AI。如需将格式示例加入指令，必须手动粘贴到上方「AI 指令」框中。"></i></b>
                        </div>
                        <textarea id="rt_cfe_template" class="text_pole" rows="8" style="resize:vertical; width:100%; font-family:monospace; font-size:12px;" placeholder="示例：\n((PILLS)) 技能：潜行、欺瞒\nHP: 10/100"></textarea>
                    </div>
                </div>
                <!-- Footer -->
                <div class="popup-footer flex-container gap-1" style="display: flex; justify-content: flex-end; padding:8px 14px; border-top:1px solid rgba(255,255,255,0.08); flex-shrink:0;">
                    <button id="rt_cfe_delete" class="menu_button interactable" style="color:#ff5555;font-size:12px;"><i class="fa-solid fa-trash"></i> 删除</button>
                    <button id="rt_cfe_export" class="menu_button interactable" style="font-size:12px;margin-right:auto;" title="将本模块导出为可分享的代码"><i class="fa-solid fa-file-export"></i> 导出</button>
                    <button id="rt_cfe_edit_ai" class="menu_button interactable" style="font-size:12px; background:rgba(180,100,255,0.15); border-color:rgba(180,100,255,0.4);" title="描述需要修改的内容，让 AI 修订本模块"><i class="fa-solid fa-wand-magic-sparkles"></i> 用 AI 编辑</button>
                    <button id="rt_cfe_cancel" class="menu_button interactable" style="font-size:12px;">取消</button>
                    <button id="rt_cfe_save" class="menu_button interactable" style="font-size:12px;">保存更改</button>
                </div>
            </div>
            <!-- Floating preview -->
            <div id="rt_cfe_preview" class="rpg-tracker-panel" style="margin:0;display:none;flex-direction:column;cursor:default;height:auto;min-width:220px;min-height:44px;width:300px;position:fixed;overflow:hidden;">
                <div id="rt_cfe_preview_header" class="rpg-tracker-header" style="cursor:move;user-select:none;font-size:0.75em;opacity:0.7;padding:5px 10px;"><i class="fa-solid fa-grip-lines" style="margin-right:6px;"></i>UI 实时预览</div>
                <div id="rt_cfe_preview_view" class="rpg-tracker-render-view" style="flex:1;min-height:0;overflow:auto;"></div>
                <div id="rt_cfe_preview_resizer" class="rt-resizer-br" title="从右下角调整预览大小"></div>
            </div>
        `;
    document.body.appendChild(overlay);
    overlay.addEventListener('mousedown', e => e.stopPropagation());
    overlay.addEventListener('click', e => e.stopPropagation());

    const iconEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_cfe_icon'));
    const tagEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_cfe_tag'));
    const labelEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_cfe_label'));
    const promptEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_cfe_prompt'));
    const templateEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_cfe_template'));
    const pageSizeEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_cfe_pagesize'));

    iconEl.value = field.icon || '📄';
    tagEl.value = field.tag.toUpperCase();
    labelEl.value = field.label || field.tag;
    promptEl.value = field.prompt || '';
    templateEl.value = field.template || '';
    pageSizeEl.value = String(s.modulePageSizes?.[field.tag.toUpperCase()] ?? PAGE_SIZE);

    overlay.style.display = 'flex';

    // Preview HUD positioning logic
    let destroyPreviewDraggable = null;
    const previewEl = document.getElementById('rt_cfe_preview');
    if (previewEl && !isSmallScreen) {
        previewEl.style.display = 'flex';
        const modalRect = document.getElementById('rt_cfe_modal').getBoundingClientRect();
        previewEl.style.left = (modalRect.right + 20) + 'px';
        previewEl.style.top = modalRect.top + 'px';
        const previewHeader = document.getElementById('rt_cfe_preview_header');
        if (previewHeader) {
            destroyPreviewDraggable = makeDraggable(previewEl, previewHeader, 'rpg_tracker_geometry_custom_module_preview');
        }
        const previewResizer = document.getElementById('rt_cfe_preview_resizer');
        if (previewResizer) makeResizableBR(previewEl, previewResizer, 'rpg_tracker_geometry_custom_module_preview');
    }

    const renderPreviewInto = (targetEl) => {
        const renderView = targetEl || document.getElementById('rt_cfe_preview_view');
        if (!renderView) return;

        const live = getSettings();
        const testContent = templateEl.value || '测试沙盒中暂无内容';
        const previewTag = '__PREVIEW__';
        const fakeMemo = `[${previewTag}]\n${testContent}\n[/${previewTag}]`;

        const ghostField = {
            tag: previewTag,
            label: labelEl.value || tagEl.value || '预览',
            icon: iconEl.value || '📄',
            template: templateEl.value,
            prompt: '',
            enabled: true
        };
        const savedCustomFields = live.customFields;
        live.customFields = [...savedCustomFields, ghostField];
        if (!live.modulePageSizes) live.modulePageSizes = {};
        const savedPageSize = live.modulePageSizes[previewTag];
        live.modulePageSizes[previewTag] = 99999;
        try {
            renderView.innerHTML = renderMemoAsCards(fakeMemo, previewTag, _sectionPages);
            bindRenderedCardEvents(renderView, fakeMemo, true, () => renderPreviewInto(targetEl));
        } finally {
            live.customFields = savedCustomFields;
            if (savedPageSize === undefined) {
                delete live.modulePageSizes[previewTag];
            } else {
                live.modulePageSizes[previewTag] = savedPageSize;
            }
        }
    };

    /** Live customFields entry for this editor — never the possibly-orphaned open-time object. */
    const resolveLiveField = () => {
        const live = getSettings();
        const fields = live.customFields || [];
        const liveIndex = fields.findIndex(f => String(f?.tag || '').toUpperCase() === openedTag);
        return { live, liveIndex, liveField: liveIndex >= 0 ? fields[liveIndex] : null };
    };

    const updatePreview = () => renderPreviewInto(null);

    let previewTimer;
    let bgRefreshTimer;
    const schedulePreview = () => {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(updatePreview, 180);
        clearTimeout(bgRefreshTimer);
        bgRefreshTimer = setTimeout(refreshRenderedView, 300);
    };

    templateEl.oninput = schedulePreview;
    iconEl.oninput = schedulePreview;
    labelEl.oninput = schedulePreview;
    tagEl.oninput = schedulePreview;
    updatePreview();

    const close = () => {
        if (destroyPreviewDraggable) destroyPreviewDraggable();
        overlay.remove();
    };

    document.getElementById('rt_cfe_save').onclick = () => {
        const rawTag = tagEl.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (!rawTag) { toastr['warning']('模块标签不能为空。'); return; }
        const rawLabel = labelEl.value.trim();

        const { live, liveIndex, liveField } = resolveLiveField();
        if (!liveField || liveIndex < 0) {
            toastr['warning']('该模块已不在设置中（可能被其他保存操作移除）。请关闭并重新打开编辑器。');
            return;
        }

        const duplicate = (live.customFields || []).some((f, i) => i !== liveIndex && String(f.tag || '').toUpperCase() === rawTag);
        if (duplicate) {
            toastr['warning'](`已存在标签为 [${rawTag}] 的模块。`);
            return;
        }

        // Rename on the live object FIRST, then prune the old catalog key.
        // removeChatSetupCatalogEntries filters by tag — after rename it won't
        // delete the live entry (only the stale database/chat-state FOO key).
        const oldTag = String(liveField.tag || '').toUpperCase();
        liveField.icon = iconEl.value.trim() || '📄';
        liveField.tag = rawTag;
        liveField.label = rawLabel || rawTag;
        liveField.prompt = promptEl.value;
        liveField.template = templateEl.value;

        if (!live.modulePageSizes) live.modulePageSizes = {};
        const ps = parseInt(pageSizeEl.value, 10);
        if (!isNaN(ps) && ps >= 1) {
            live.modulePageSizes[rawTag] = ps;
        }

        if (oldTag !== rawTag) {
            removeChatSetupCatalogEntries(live, { customFieldTags: [oldTag] });
            for (const gameSystem of live.gameSystems || []) {
                if (String(gameSystem.customFieldTag || '').toUpperCase() === oldTag) {
                    gameSystem.customFieldTag = rawTag;
                }
            }
            recordDeletedCustomTags(oldTag);
            clearDeletedCustomTagTombstones(rawTag);
            if (live.blockOrder) {
                const idx = live.blockOrder.indexOf(oldTag);
                if (idx !== -1) live.blockOrder[idx] = rawTag;
            }
            // Display Groups are global render metadata keyed by module tag.
            // Renaming a module updates references without touching group behavior.
            for (const group of live.displayGroups || []) {
                if (!Array.isArray(group.members)) continue;
                group.members = group.members.map(tag => String(tag).toUpperCase() === oldTag ? rawTag : tag);
            }
            if (live.modulePageSizes && live.modulePageSizes[oldTag]) {
                live.modulePageSizes[rawTag] = live.modulePageSizes[oldTag];
                delete live.modulePageSizes[oldTag];
            }
            // Migrate any category render options
            if (live.categoryRenderOptions && live.categoryRenderOptions[oldTag]) {
                live.categoryRenderOptions[rawTag] = live.categoryRenderOptions[oldTag];
                delete live.categoryRenderOptions[oldTag];
            }
        }

        saveSettings(true);
        refreshOrderList();
        refreshRenderedView();
        toastr['success'](`模块 "${liveField.label}" 已更新。`);
        close();
    };

    document.getElementById('rt_cfe_delete').onclick = () => {
        const { live, liveIndex, liveField } = resolveLiveField();
        const label = liveField?.label || liveField?.tag || openedTag || '模块';
        if (!liveField || liveIndex < 0) {
            toastr['warning']('该模块已不在设置中，请关闭编辑器。');
            close();
            return;
        }
        if (confirm(`确定删除自定义模块 "${label}" 吗？此操作无法撤销。`)) {
            const deletedTag = liveField.tag;
            live.customFields.splice(liveIndex, 1);
            if (live.blockOrder) {
                live.blockOrder = live.blockOrder.filter(t => t.toUpperCase() !== String(deletedTag).toUpperCase());
            }
            removeChatSetupCatalogEntries(live, { customFieldTags: [deletedTag] });
            recordDeletedCustomTags(deletedTag);
            saveSettings(true);
            refreshOrderList();
            refreshRenderedView();
            toastr['info'](`模块 "${label}" 已删除。`);
            close();
        }
    };

    document.getElementById('rt_cfe_cancel').onclick = close;
    document.getElementById('rt_cfe_close').onclick = close;
    document.getElementById('rt_cfe_export').onclick = () => {
        const { liveField } = resolveLiveField();
        exportModules([liveField || {
            tag: tagEl.value.trim().toUpperCase() || openedTag,
            label: labelEl.value.trim(),
            icon: iconEl.value.trim() || '📄',
            prompt: promptEl.value,
            template: templateEl.value,
        }]);
    };
    document.getElementById('rt_cfe_edit_ai').onclick = async () => {
        const { live, liveField } = resolveLiveField();
        const contextField = liveField || {
            tag: tagEl.value.trim().toUpperCase() || openedTag,
            label: labelEl.value.trim(),
            icon: iconEl.value.trim() || '📄',
            prompt: promptEl.value,
            template: templateEl.value,
        };
        const description = await promptForAiModuleEditDescription(`[${contextField.tag}] ${contextField.label || contextField.tag}`);
        if (!description) return;
        try {
            const parsed = await runAiEditCustomModule(live, contextField, description);
            if (!parsed) return;
            iconEl.value = parsed.icon;
            tagEl.value = parsed.tag;
            labelEl.value = parsed.label;
            promptEl.value = parsed.prompt;
            templateEl.value = parsed.template;
            schedulePreview();
            toastr['success'](`模块 "${parsed.label}" 已修订。请检查后点击「保存更改」。`, 'AI 模块编辑器');
        } catch (err) {
            console.error('[RPG Tracker] AI Module Editor error:', err);
            toastr['error'](`模块编辑失败：${err.message}`, 'AI 模块编辑器');
        }
    };
}

const STOCK_MODULE_PREVIEW_SAMPLES = Object.freeze({
    COMBAT: `COMBAT ROUND 2
ENEMIES:
Goblin Scout: 8/12 HP
Att/def: Shortsword (1 attack, +4 / 1d6+2 Piercing) | Leather Armor (AC: 13)
Saves: Fort +2, Ref +4, Will +0
Abilities: Nimble Escape
Other: Minion Tier
Status: Wounded`,
    CHARACTER: `Adventurer (Ranger): 28/36 HP
Combat: BAB: +4 | Ranged (1 attack): +7 | Melee (1 attack): +5 | Base AC: 13 | Total AC: 15
Gear: Longbow (1d8 Piercing) | Leather Armor (+2 AC)
Attr: STR 12 (+1), DEX 16 (+3), CON 14 (+2), INT 10 (+0), WIS 15 (+2), CHA 10 (+0)
Status: Healthy`,
    PARTY: `Elara (Cleric): 24/30 HP
Combat: BAB: +3 | Ranged (1 attack): +3 | Melee (1 attack): +5 | Base AC: 10 | Total AC: 16
Gear: Mace (1d6+2 Bludgeoning) | Chain Shirt (+4 AC) | Shield (+2 AC)
Abilities: Channel Divinity (1/1)
Spells: Level 1 (3/4): Bless, Cure Wounds
Status: Healthy`,
    INVENTORY: `Gear:
- 🗡️ [Rare] [E] Flame Dagger +1 (1d6+2 Fire, +1 to hit) (~350 GP)
- 🛡️ [Common] Iron Buckler (AC +2) (~15 GP)
Other Items:
- 🧪 [Uncommon] Healing Potion (Restores 2d4+2 HP) (~50 GP)
- 💰 1,200 GP`,
    ABILITIES: `Second Wind (Regain 1d10+4 HP, 1/1 per rest)
Action Surge (Take one additional action, 1/1 per rest)
Fighting Style: Archery (+2 to ranged attack rolls)`,
    SPELLS: `Cantrips: Light, Mage Hand
Level 1 (3/4): Hunter's Mark, Longstrider, Detect Magic
Level 2 (2/3): Pass Without Trace, Lesser Restoration`,
    XP: 'Level: 4 | XP: 3,250/6,500',
    TIME: `Last Rest: 10:00 PM, Day 2
Current Time: 08:35 AM, Day 3`,
    QUESTS: `QUEST: The Missing Sheep
  ID: quest_1746703200000
  STATUS: active
  GIVER: Farmer Hemwick @ Crestwood Mill
  ACCEPTED: 08:00 AM, Day 1
  REWARD: 100 GP
  OBJ_ACTIVE: Find the missing sheep`,
    'BENCHED PARTY': `Gareth (Fighter): 30/38 HP
Status: Benched (08:08 AM, Day 1, investigating the docks)`,
});

function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Return the first complete block body for `tag`, or an empty string. */
export function extractStockModulePreviewContent(source, tag) {
    const normalizedTag = String(tag || '').trim().toUpperCase();
    if (!normalizedTag) return '';
    const pattern = new RegExp(`\\[${escapeRegExp(normalizedTag)}\\]([\\s\\S]*?)\\[\\/${escapeRegExp(normalizedTag)}\\]`, 'i');
    return String(source || '').match(pattern)?.[1]?.trim() || '';
}

/** Build the isolated memo rendered by the stock-module editor's preview. */
export function buildStockModulePreviewMemo(content, tag) {
    const normalizedTag = String(tag || '').trim().toUpperCase();
    if (!normalizedTag) return '';
    const unwrapped = extractStockModulePreviewContent(content, normalizedTag);
    const body = unwrapped || String(content || '').trim() || '测试沙箱中暂无内容';
    return `[${normalizedTag}]\n${body}\n[/${normalizedTag}]`;
}

function getInitialStockModulePreviewContent(settings, blockTag, promptText) {
    const normalizedTag = String(blockTag || '').trim().toUpperCase();
    return extractStockModulePreviewContent(settings?.currentMemo, normalizedTag)
        || STOCK_MODULE_PREVIEW_SAMPLES[normalizedTag]
        || extractStockModulePreviewContent(promptText, normalizedTag)
        || '示例预览内容';
}

export function openPromptEditor(blockTag, title, currentText, defaultText, onSave, promptModKey) {
    const isSmallScreen = window.innerWidth <= 700;
    let overlay = document.getElementById('rt_pe_overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'rt_pe_overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        overlay.style.zIndex = '10000000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.overflowY = 'auto';
        overlay.innerHTML = `
                <div id="rt_pe_modal" class="popup shadowBase" style="width:min(600px,94vw);max-height:${isSmallScreen ? '90vh' : '850px'};margin:auto;display:flex;flex-direction:column;overflow:hidden;">
                    <div class="popup-header">
                        <h3 class="margin0" id="rt_pe_title">编辑提示词</h3>
                        <div id="rt_pe_close" class="popup-close interactable" title="关闭"><i class="fa-solid fa-times"></i></div>
                    </div>
                    <div class="popup-body flex-container flexFlowColumn gap-1" style="padding:10px;overflow-y:auto;flex:1;">
                        <!-- Layout Options -->
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:0 4px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:12px; font-weight:bold; opacity:0.8;">分页阈值：</span>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt_pe_pagesize" class="text_pole" style="width:50px; height:24px; text-align:center;" min="1" max="99" title="添加分页按钮前显示的项目数量">
                                <span style="font-size:11px; opacity:0.6;">条</span>
                            </div>
                        </div>
                        <textarea id="rt_pe_text" class="text_pole" rows="10" style="width: 100%; resize: vertical;"></textarea>
                        <div style="margin-top:8px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                                <b style="font-size:13px;">测试沙箱（仅桌面端） <i class="fa-solid fa-circle-question" style="opacity:0.5;cursor:help;font-size:11px;" title="此框仅用于测试该内置模块的渲染效果。其中的内容不会发送给 AI，也不会随提示词保存。"></i></b>
                            </div>
                            <textarea id="rt_pe_template" class="text_pole" rows="7" style="resize:vertical;width:100%;font-family:monospace;font-size:12px;" placeholder="输入示例模块内容，用于在实时预览中渲染。"></textarea>
                        </div>
                        <div class="flex-container gap-1" style="display: flex; justify-content: flex-end;">
                            <button id="rt_pe_edit_ai" class="menu_button interactable" style="background:rgba(180,100,255,0.15); border-color:rgba(180,100,255,0.4);"><i class="fa-solid fa-wand-magic-sparkles"></i> 使用 AI 编辑</button>
                            <button id="rt_pe_reset" class="menu_button interactable" style="margin-right: auto;"><i class="fa-solid fa-arrow-rotate-left"></i> 重置</button>
                            <button id="rt_pe_cancel" class="menu_button interactable">取消</button>
                            <button id="rt_pe_save" class="menu_button interactable">保存更改</button>
                        </div>
                    </div>
                </div>
                <div id="rt_pe_preview" class="rpg-tracker-panel" style="margin:0;display:none;flex-direction:column;cursor:default;height:auto;min-width:220px;min-height:44px;max-height:calc(100vh - 24px);width:300px;position:fixed;overflow:hidden;">
                    <div id="rt_pe_preview_header" class="rpg-tracker-header" style="cursor:move;user-select:none;font-size:0.75em;opacity:0.7;padding:5px 10px;"><i class="fa-solid fa-grip-lines" style="margin-right:6px;"></i>UI 实时预览</div>
                    <div id="rt_pe_preview_view" class="rpg-tracker-render-view" style="flex:1;min-height:0;overflow:auto;"></div>
                    <div id="rt_pe_preview_resizer" class="rt-resizer-br" title="从右下角调整预览大小"></div>
                </div>
            `;
        document.body.appendChild(overlay);
    }

    const titleEl = document.getElementById('rt_pe_title');
    const textEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_pe_text'));
    const templateEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_pe_template'));
    const pageSizeEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_pe_pagesize'));
    const saveBtn = document.getElementById('rt_pe_save');
    const resetBtn = document.getElementById('rt_pe_reset');
    const closeBtn = document.getElementById('rt_pe_close');
    const cancelBtn = document.getElementById('rt_pe_cancel');

    const modKey = promptModKey || blockTag.toLowerCase();
    const s = getSettings();
    templateEl.value = getInitialStockModulePreviewContent(s, blockTag, currentText);
    titleEl.textContent = title;
    textEl.value = currentText;
    overlay.style.display = 'flex';
    pageSizeEl.value = String(s.modulePageSizes?.[blockTag.toUpperCase()] ?? (blockTag.toUpperCase() === 'SPELLS' ? 5 : PAGE_SIZE));
    pageSizeEl.oninput = () => {
        if (!s.modulePageSizes) s.modulePageSizes = {};
        const val = parseInt(String(pageSizeEl.value), 10);
        if (!isNaN(val) && val >= 1) {
            s.modulePageSizes[blockTag.toUpperCase()] = val;
            saveSettings();
            refreshRenderedView();
            schedulePreview();
        }
    };

    let destroyPreviewDraggable = null;
    const previewEl = document.getElementById('rt_pe_preview');
    if (previewEl && !isSmallScreen) {
        previewEl.style.display = 'flex';
        const modalRect = document.getElementById('rt_pe_modal').getBoundingClientRect();
        const previewWidth = 300;
        const gap = 20;
        const rightSide = modalRect.right + gap;
        const leftSide = modalRect.left - gap - previewWidth;
        previewEl.style.left = (rightSide + previewWidth <= window.innerWidth - 8
            ? rightSide
            : Math.max(8, leftSide)) + 'px';
        previewEl.style.top = Math.max(8, modalRect.top) + 'px';
        const previewHeader = document.getElementById('rt_pe_preview_header');
        if (previewHeader) destroyPreviewDraggable = makeDraggable(previewEl, previewHeader, 'rpg_tracker_geometry_stock_module_preview');
        const previewResizer = document.getElementById('rt_pe_preview_resizer');
        if (previewResizer) makeResizableBR(previewEl, previewResizer, 'rpg_tracker_geometry_stock_module_preview');
    }

    const renderPreview = () => {
        const renderView = document.getElementById('rt_pe_preview_view');
        if (!renderView) return;
        const previewMemo = buildStockModulePreviewMemo(templateEl.value, blockTag);
        renderView.innerHTML = renderMemoAsCards(previewMemo, blockTag.toUpperCase(), _sectionPages);
        bindRenderedCardEvents(renderView, previewMemo, true, renderPreview);
    };

    let previewTimer;
    const schedulePreview = () => {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(renderPreview, 180);
    };

    templateEl.oninput = schedulePreview;

    const close = () => {
        clearTimeout(previewTimer);
        if (destroyPreviewDraggable) destroyPreviewDraggable();
        destroyPreviewDraggable = null;
        overlay.remove();
    };

    renderPreview();

    const saveHandler = () => {
        if (!s.modulePageSizes) s.modulePageSizes = {};
        const ps = parseInt(String(pageSizeEl.value), 10);
        if (!isNaN(ps) && ps >= 1) {
            s.modulePageSizes[blockTag.toUpperCase()] = ps;
        }
        // Apply text first, then persist so the checkpoint captures the completed edit.
        onSave(textEl.value);
        close();
    };

    const resetHandler = () => {
        if (confirm("将此提示词重置为出厂默认值？")) {
            textEl.value = defaultText;
            templateEl.value = getInitialStockModulePreviewContent(s, blockTag, defaultText);
            schedulePreview();
        }
    };

    const editAiHandler = async () => {
        const displayTag = blockTag === 'TIME' ? resolveTimePromptDisplayTag(modKey) : blockTag;
        const description = await promptForAiModuleEditDescription(`[${displayTag}]`);
        if (!description) return;
        try {
            const revisedPrompt = await runAiEditStockModulePrompt(s, modKey, blockTag, displayTag, textEl.value, description);
            if (!revisedPrompt) return;
            textEl.value = revisedPrompt;
            toastr['success'](`[${displayTag}] 提示词已修订。请检查后点击“保存更改”。`, 'AI Module Editor');
        } catch (err) {
            console.error('[RPG Tracker] AI Module Editor error:', err);
            toastr['error'](`编辑提示词失败：${err.message}`, 'AI Module Editor');
        }
    };

    saveBtn.onclick = saveHandler;
    resetBtn.onclick = resetHandler;
    document.getElementById('rt_pe_edit_ai').onclick = editAiHandler;
    document.getElementById('rt_pe_close').onclick = close;
    document.getElementById('rt_pe_cancel').onclick = close;
}

export function exportModules(fields) {
    if (!fields || fields.length === 0) {
        toastr['warning']('未指定要导出的模块。', 'Multihog Framework');
        return;
    }
    const cleanFields = fields.map(f => ({
        icon: f.icon,
        tag: f.tag.toUpperCase(),
        label: f.label || f.tag,
        prompt: f.prompt || '',
        template: f.template || '',
    }));
    const exportObj = {
        format: 'multihog-custom-module',
        version: 1,
        exportedAt: new Date().toISOString(),
        modules: cleanFields,
    };
    openShareModal(JSON.stringify(exportObj, null, 2));
}

function openShareModal(jsonString) {
    const { Popup } = SillyTavern.getContext();
    const escaped = jsonString
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const content = `
            <div style="display:flex; flex-direction:column; gap:8px; min-width:360px;">
                <p style="margin:0; font-size:12px; opacity:0.7;">
                    复制此代码并分享到任何地方。其他人可通过 <b>导入</b> 按钮粘贴使用它。
                </p>
                <textarea id="rt_share_blob" readonly rows="12" class="text_pole"
                    style="font-family:monospace; font-size:11px; resize:vertical; width:100%;"
                >${escaped}</textarea>
                <div style="display:flex; gap:8px;">
                    <button id="rt_share_copy" class="menu_button interactable" style="flex:1;">
                        <i class="fa-solid fa-copy"></i> 复制到剪贴板
                    </button>
                    <button id="rt_share_download" class="menu_button interactable" style="flex:1;">
                        <i class="fa-solid fa-file-download"></i> 导出 .json
                    </button>
                </div>
            </div>
        `;
    Popup.show.confirm('📤 分享自定义模块', content, {
        okButton: '完成',
        cancelButton: false,
    });
    setTimeout(() => {
        const copyBtn = document.getElementById('rt_share_copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(jsonString);
                        toastr['success']('模块代码已复制到剪贴板！', 'Multihog Framework');
                        return;
                    }

                    const ta = document.createElement('textarea');
                    ta.value = jsonString;
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    ta.style.top = '0';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    ta.setSelectionRange(0, 99999);

                    const success = document.execCommand('copy');
                    document.body.removeChild(ta);

                    if (success) {
                        toastr['success']('模块代码已复制到剪贴板！', 'Multihog Framework');
                    } else {
                        throw new Error('execCommand returned false');
                    }
                } catch (err) {
                    console.error('[Multihog Framework] clipboard copy failed:', err);
                    toastr['error']('无法自动复制。请手动选择文本。', 'Multihog Framework');
                }
            });
        }

        const downloadBtn = document.getElementById('rt_share_download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `multihog_module_${new Date().getTime()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }
    }, 50);
}

export async function importModulesFromJson(jsonString) {
    const STOCK_TAGS = new Set(['COMBAT', 'CHARACTER', 'PARTY', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME']);

    let parsed;
    try {
        parsed = JSON.parse(jsonString.trim());
    } catch {
        toastr['error']('JSON 无效。请粘贴有效的模块导出内容。', 'Multihog Framework');
        return;
    }

    if (parsed?.format !== 'multihog-custom-module' && parsed?.format !== 'fatbody-custom-module' || !Array.isArray(parsed?.modules)) {
        toastr['error']('这看起来不像是 Multihog 模块导出。', 'Multihog Framework');
        return;
    }

    const incoming = parsed.modules.filter(m => {
        if (!m.tag || typeof m.tag !== 'string') return false;
        m.tag = m.tag.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase();
        return m.tag.length > 0;
    });

    if (incoming.length === 0) {
        toastr['warning']('导出内容中未找到有效模块。', 'Multihog Framework');
        return;
    }

    const s = getSettings();
    const existingTags = new Set((s.customFields || []).map(f => f.tag.toUpperCase()));

    const stockConflicts = incoming.filter(m => STOCK_TAGS.has(m.tag));
    if (stockConflicts.length > 0) {
        toastr['error'](
            `无法导入：[${stockConflicts.map(m => m.tag).join('], [')}] 与内置模块冲突。`,
            'Multihog Framework'
        );
        return;
    }

    const softConflicts = incoming.filter(m => existingTags.has(m.tag));
    let overwriteConflicts = false;

    if (softConflicts.length > 0) {
        const { Popup } = SillyTavern.getContext();
        const tagList = softConflicts.map(m => `<b>[${m.tag}]</b>`).join(', ');
        const choice = await Popup.show.confirm(
            '⚠️ 导入冲突',
            `<p>已有 ${softConflicts.length} 个模块存在：${tagList}</p><p>您希望如何处理？</p>`,
            { okButton: '覆盖现有', cancelButton: '跳过冲突' }
        );
        if (choice === null || choice === undefined) return;
        overwriteConflicts = (choice === 1);
    }

    if (!s.blockOrder) s.blockOrder = ['COMBAT', 'CHARACTER', 'PARTY', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME'];

    let importedCount = 0;
    for (const m of incoming) {
        const isConflict = existingTags.has(m.tag);
        if (isConflict && !overwriteConflicts) continue;
        const existingField = isConflict
            ? s.customFields.find(f => f.tag.toUpperCase() === m.tag)
            : null;

        const newField = {
            icon: m.icon || '📄',
            tag: m.tag,
            label: m.label || m.tag,
            prompt: m.prompt || '',
            template: '',
            enabled: true,
            scope: existingField?.scope || 'chat',
        };

        if (isConflict) {
            const idx = s.customFields.findIndex(f => f.tag.toUpperCase() === m.tag);
            if (idx !== -1) s.customFields[idx] = newField;
        } else {
            s.customFields.push(newField);
            if (!s.blockOrder.includes(m.tag)) s.blockOrder.push(m.tag);
        }
        clearDeletedCustomTagTombstones(m.tag);
        importedCount++;
    }

    if (importedCount === 0) {
        toastr['info']('未导入任何模块（所有冲突均已被跳过）。', 'Multihog Framework');
        return;
    }

    saveSettings();
    refreshOrderList();
    syncMemoView();
    toastr['success'](`已导入 ${importedCount} 个自定义模块。`, 'Multihog Framework');
}

export function syncSettingsAndUI(updateFn) {
    const fresh = getSettings();
    updateFn(fresh);

    const rngHybrid = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_rng_hybrid'));
    const rngLegacy = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_rng_legacy'));
    const rngNone = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_rng_none'));
    const questsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_sysprompt_mod_quests'));
    const deadlinesCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_deadlines'));
    const frustrationCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_frustration'));

    if (rngHybrid && rngLegacy && rngNone) {
        rngHybrid.checked = fresh.rngEnabled && !!fresh.diceFunctionTool;
        rngLegacy.checked = fresh.rngEnabled && !fresh.diceFunctionTool;
        rngNone.checked = !fresh.rngEnabled;
    }
    if (questsCb) questsCb.checked = fresh.syspromptModules?.quests !== false;
    if (deadlinesCb) deadlinesCb.checked = !!fresh.syspromptModules?.questsDeadlines;
    if (frustrationCb) frustrationCb.checked = !!fresh.syspromptModules?.questsFrustration;
    const frustrationWrapEl = /** @type {HTMLElement|null} */ (document.getElementById('rpg_quests_frustration_wrap'));
    if (frustrationWrapEl) frustrationWrapEl.style.display = !!fresh.syspromptModules?.questsDeadlines ? '' : 'none';
    const showArchiveCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_show_archive'));
    if (showArchiveCb) showArchiveCb.checked = fresh.syspromptModules?.questsShowArchive !== false;

    const mods = {
        loot: '#rpg_sysprompt_mod_loot',
        random_events: '#rpg_sysprompt_mod_random_events',
        resting: '#rpg_sysprompt_mod_resting',
        party_bench: '#rpg_sysprompt_mod_party_bench',
        dungeon_reality_and_hidden_mapping: '#rpg_sysprompt_mod_dungeon_reality_and_hidden_mapping',
        CYOA_mode: '#rpg_sysprompt_mod_cyoa_mode',
    };
    for (const [key, id] of Object.entries(mods)) {
        const cb = /** @type {HTMLInputElement|null} */ (document.getElementById(id.replace('#', '')));
        if (cb) {
            cb.checked = key === 'CYOA_mode'
                ? fresh.syspromptModules?.CYOA_mode === true
                : (fresh.syspromptModules?.[key] ?? true);
        }
    }
    applyMapArchitectOpenerToUi(fresh.mapArchitectOpener);
    syncMapArchitectOpenerNestedVisibility(fresh.syspromptModules?.[LOCATION_MAPPING_SECTION_TAG] ?? true);

    const relBarsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_npc_rel_bars'));
    if (relBarsCb) relBarsCb.checked = !!fresh.npcRelationshipBars;
    const syspromptRelBarsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_sysprompt_mod_npc_rel_bars'));
    if (syspromptRelBarsCb) syspromptRelBarsCb.checked = !!fresh.npcRelationshipBars;
    const onboardingRelBarsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rt_onboarding_mod_npc_rel_bars'));
    if (onboardingRelBarsCb) onboardingRelBarsCb.checked = !!fresh.npcRelationshipBars;
    const relToastUICb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_npc_rel_toast'));
    if (relToastUICb) relToastUICb.checked = fresh.npcRelationshipToast !== false;
    const relMaxDefaultUICb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_npc_rel_max_default'));
    if (relMaxDefaultUICb) relMaxDefaultUICb.value = String(getNpcRelationshipMaxDefault(fresh));
    const npcPortraitsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_npc_portraits'));
    if (npcPortraitsCb) npcPortraitsCb.checked = fresh.npcPortraits !== false;
    syncNpcPortraitDependentUi(fresh);
    const locationImagesCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_location_images'));
    if (locationImagesCb) locationImagesCb.checked = !!fresh.locationImages;
    syncLocationImageDependentUi(fresh);
    const stateSwipeRollbackUICb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_state_swipe_rollback'));
    if (stateSwipeRollbackUICb) stateSwipeRollbackUICb.checked = fresh.stateTrackerSwipeRollback !== false;

    const customSyspromptEl = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_custom_sysprompt'));
    if (customSyspromptEl) customSyspromptEl.checked = !!fresh.customSysprompt;
    syncTimeFormatSettingsUi(fresh);
    const narratorBlockEl = document.getElementById('rpg_narrator_config_block');
    if (narratorBlockEl) narratorBlockEl.style.display = !!fresh.customSysprompt ? 'none' : '';

    saveSettings();

    refreshQuestPrompt(fresh);
    refreshOrderList();
    saveSettings();
    if (!document.querySelector('.rt-empty')) {
        refreshRenderedView();
    }
}

export function refreshOrderList() {
    const s = getSettings();
    const list = document.getElementById('rpg_tracker_order_list');
    if (!list) return;

    list.innerHTML = '';

    const getIcon = (tag) => {
        if (BLOCK_ICONS[tag]) return BLOCK_ICONS[tag];
        const custom = (s.customFields || []).find(f => f.tag.toUpperCase() === tag);
        return custom?.icon || '📄';
    };

    if (!s.blockOrder) s.blockOrder = [...BLOCK_ORDER];

    const seenTags = new Set(BLOCK_ORDER);
    (s.customFields || []).forEach(f => {
        let baseTag = f.tag.toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (!baseTag) baseTag = 'CUSTOM';
        let finalTag = baseTag;
        let counter = 1;
        while (seenTags.has(finalTag)) {
            finalTag = `${baseTag}_${counter++}`;
        }
        if (f.tag !== finalTag) {
            console.log(`[RPG Tracker] Sanitized tag: ${f.tag} -> ${finalTag}`);
            f.tag = finalTag;
        }
        seenTags.add(finalTag);
    });

    const allCustomTags = (s.customFields || []).map(f => f.tag.toUpperCase());
    [...BLOCK_ORDER, ...allCustomTags].forEach(tag => {
        if (!s.blockOrder.includes(tag)) s.blockOrder.push(tag);
    });

    const validCustomTags = new Set(allCustomTags);
    const order = s.blockOrder.filter(tag => {
        const isStock = BLOCK_ORDER.includes(tag);
        if (!isStock && !validCustomTags.has(tag)) return false;
        if (tag === 'QUESTS' && s.syspromptModules?.quests === false) return false;
        return true;
    });
    s.blockOrder = order;

    const isTagEnabled = (tag) => {
        const isStock = BLOCK_ORDER.includes(tag);
        if (isStock) return s.modules[tag.toLowerCase()] ?? false;
        const field = s.customFields.find(f => f.tag.toUpperCase() === tag);
        return field?.enabled ?? false;
    };
    const groups = [
        { label: '已启用模块', tags: order.filter(isTagEnabled), active: true },
        { label: '未启用模块池', tags: order.filter(tag => !isTagEnabled(tag)), active: false },
    ];
    // Render a Display Group at its first member so its position is visible
    // and editable without hiding the members' existing module controls.
    const displayGroupsByFirstMember = new Map();
    normalizeDisplayGroups(s.displayGroups).forEach(displayGroup => {
        const firstMember = order.find(tag => displayGroup.members.includes(tag));
        if (firstMember) displayGroupsByFirstMember.set(firstMember, displayGroup);
    });

    groups.forEach(group => {
        if (!group.tags.length) return;
        const heading = document.createElement('div');
        heading.className = 'rt-module-pool-heading';
        heading.textContent = group.label;
        heading.style.cssText = `font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.55px;margin:${group.active ? '3px' : '12px'} 2px 4px;opacity:${group.active ? '.8' : '.55'};`;
        list.appendChild(heading);

        group.tags.forEach((tag, groupIndex) => {
        const displayGroup = displayGroupsByFirstMember.get(tag);
        if (displayGroup) list.appendChild(buildDisplayGroupOrderRow(s, order, displayGroup));

        const index = order.indexOf(tag);
        const isStock = BLOCK_ORDER.includes(tag);
        const customIndex = s.customFields.findIndex(f => f.tag.toUpperCase() === tag);
        const field = isStock ? null : s.customFields[customIndex];

        const isEnabled = isStock ? (s.modules[tag.toLowerCase()] ?? false) : (field?.enabled ?? false);

        const item = document.createElement('div');
        item.className = 'flex-container gap-1 alignitemscenter rt-order-item';
        item.style.padding = '5px';
        item.style.background = isEnabled ? 'var(--black30a)' : 'transparent';
        item.style.opacity = isEnabled ? '1' : '0.6';
        item.style.borderRadius = '4px';
        item.style.border = '1px solid var(--smartThemeBorderColor)';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isEnabled;
        cb.style.margin = '0 5px';
        cb.onchange = async () => {
            if (isStock) {
                s.modules[tag.toLowerCase()] = cb.checked;
                // Benched Party is a sub-module of PARTY — the two toggles stay coupled.
                if (tag === 'PARTY' && !cb.checked && (s.modules['benched party'] ?? true)) {
                    s.modules['benched party'] = false;
                    if (!s.syspromptModules) s.syspromptModules = {};
                    s.syspromptModules.party_bench = false;
                }
            } else {
                setChatSetupItemEnabled(s, 'customField', field, cb.checked);
            }
            saveSettings();
            refreshOrderList();
            refreshRenderedView();
            if (linkedGameSystem) await autoApplySysprompt(true);
        };

        const label = document.createElement('span');
        label.style.flex = '1';
        label.style.fontSize = '12px';
        label.style.cursor = 'default';
        label.textContent = `${getIcon(tag)} ${tag}`;
        const linkedGameSystem = !isStock
            ? (s.gameSystems || []).find(gs => String(gs.customFieldTag || '').toUpperCase() === tag)
            : null;
        const isWizardField = !isStock && (field?.origin === 'wizard' || !!linkedGameSystem);
        if (isWizardField) {
            const wizardBadge = document.createElement('span');
            wizardBadge.className = 'rt-module-wizard-badge';
            wizardBadge.textContent = '向导';
            wizardBadge.title = linkedGameSystem?.name
                ? `通过游戏系统向导创建：${linkedGameSystem.name}`
                : '通过游戏系统向导创建';
            wizardBadge.style.cssText = 'font-size:9px;padding:1px 5px;border-radius:3px;margin-left:6px;background:rgba(180,100,255,0.2);color:#c9a0ff;';
            label.appendChild(wizardBadge);
        }

        let scopeControl = null;
        if (!isStock && field) {
            const scope = getChatSetupItemScope(s, 'customField', field);
            const bypassed = !s.chatLinkEnabled || !s.chatSetupLinkEnabled;
            if (isWizardField) {
                scopeControl = document.createElement('span');
                scopeControl.className = 'rt-module-wizard-scope';
                scopeControl.textContent = scope === 'global' ? '全局' : '对话绑定';
                scopeControl.title = `${scope === 'global' ? '全局' : '对话绑定'}作用域继承自游戏系统"${linkedGameSystem?.name || '未命名'}"。点击查看说明。${bypassed ? ' 当前主设置链接正在绕过各条目的作用域。' : ''}`;
                scopeControl.setAttribute('role', 'button');
                scopeControl.setAttribute('tabindex', '0');
                scopeControl.style.cssText = 'font-size:9px;padding:2px 5px;border-radius:3px;white-space:nowrap;background:rgba(180,100,255,0.13);color:#c9a0ff;border:1px solid rgba(180,100,255,0.25);cursor:pointer;';
                const showWizardScopeRedirect = () => {
                    toastr['info'](
                        '此模块属于通过向导创建的游戏系统包。打开“管理游戏系统”可将该包设为全局或对话绑定。',
                        'RPG Tracker',
                        { timeOut: 6000 },
                    );
                };
                scopeControl.onclick = showWizardScopeRedirect;
                scopeControl.onkeydown = (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    showWizardScopeRedirect();
                };
            } else {
                scopeControl = document.createElement('select');
                scopeControl.className = 'text_pole rt-module-scope';
                scopeControl.title = `选择此模块是在所有对话中共享同一个启用状态，还是按对话分别记忆激活状态。${bypassed ? ' 当前主设置链接正在绕过各条目的作用域。' : ''}`;
                scopeControl.style.cssText = 'width:auto;max-width:105px;height:24px;font-size:9px;padding:1px 4px;';
                scopeControl.innerHTML = '<option value="chat">对话绑定</option><option value="global">全局</option>';
                scopeControl.value = scope;
                scopeControl.onchange = () => {
                    setChatSetupItemScope(s, 'customField', field, scopeControl.value);
                    saveSettings();
                    refreshOrderList();
                };
            }
        }

        const btnGroup = document.createElement('div');
        btnGroup.className = 'flex-container gap-1';

        const editBtn = document.createElement('button');
        editBtn.className = 'menu_button interactable rt-order-btn';
        editBtn.style.padding = '2px 6px';
        editBtn.title = isStock ? '编辑提示词' : '编辑自定义字段';
        editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
        editBtn.onclick = () => {
            if (isStock) {
                let mod = tag.toLowerCase();
                let displayTag = tag;
                if (tag === 'TIME') {
                    mod = resolveTimePromptKey(s);
                    displayTag = resolveTimePromptDisplayTag(mod);
                }

                if (!s.stockPrompts) s.stockPrompts = { ...DEFAULT_STOCK_PROMPTS };
                openPromptEditor(
                    tag,
                    `编辑默认 [${displayTag}] 提示词`,
                    s.stockPrompts[mod] || DEFAULT_STOCK_PROMPTS[mod],
                    DEFAULT_STOCK_PROMPTS[mod],
                    (newVal) => {
                        s.stockPrompts[mod] = newVal;
                        saveSettings();
                        toastr['success'](`[${displayTag}] 提示词已更新。`, 'RPG Tracker');
                    },
                    mod
                );
            } else {
                openCustomFieldEditor(customIndex);
            }
        };

        let resetBtn = null;
        if (isStock) {
            resetBtn = document.createElement('button');
            resetBtn.className = 'menu_button interactable rt-order-btn';
            resetBtn.style.padding = '2px 6px';
            resetBtn.title = '重置提示词为默认';
            resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
            resetBtn.onclick = () => {
                let mod = tag.toLowerCase();
                if (tag === 'TIME') mod = resolveTimePromptKey(s);

                if (confirm(`确定将 [${tag}] 提示词重置为默认？此操作将丢失所有自定义修改。`)) {
                    if (!s.stockPrompts) s.stockPrompts = { ...DEFAULT_STOCK_PROMPTS };
                    s.stockPrompts[mod] = DEFAULT_STOCK_PROMPTS[mod];
                    saveSettings();
                    toastr['success'](`[${tag}] 提示词已重置。`, 'RPG Tracker');
                }
            };
        }

        const upBtn = document.createElement('button');
        upBtn.className = 'menu_button interactable rt-order-btn';
        upBtn.style.padding = '2px 6px';
        upBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        upBtn.disabled = groupIndex === 0;
        upBtn.onclick = () => {
            const newOrder = [...order];
            const previousIndex = order.indexOf(group.tags[groupIndex - 1]);
            [newOrder[previousIndex], newOrder[index]] = [newOrder[index], newOrder[previousIndex]];
            s.blockOrder = newOrder;
            saveSettings();
            refreshOrderList();
            refreshRenderedView();
        };

        const downBtn = document.createElement('button');
        downBtn.className = 'menu_button interactable rt-order-btn';
        downBtn.style.padding = '2px 6px';
        downBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
        downBtn.disabled = groupIndex === group.tags.length - 1;
        downBtn.onclick = () => {
            const newOrder = [...order];
            const nextIndex = order.indexOf(group.tags[groupIndex + 1]);
            [newOrder[nextIndex], newOrder[index]] = [newOrder[index], newOrder[nextIndex]];
            s.blockOrder = newOrder;
            saveSettings();
            refreshOrderList();
            refreshRenderedView();
        };

        item.appendChild(cb);
        item.appendChild(label);
        if (scopeControl) item.appendChild(scopeControl);

        if (tag === 'TIME' && isStock) {
            const pill = document.createElement('label');
            pill.title = '在 12 小时制（AM/PM）与 24 小时制之间切换 [TIME] 模块提示词及所有时间显示的格式。';
            pill.style.cssText = 'display:inline-flex; align-items:center; gap:4px; font-size:10px; opacity:0.8; cursor:pointer; user-select:none; margin-right:4px; white-space:nowrap;';

            const cb24h = document.createElement('input');
            cb24h.id = 'rpg_time_24h_toggle';
            cb24h.type = 'checkbox';
            cb24h.checked = !!s.use24hTime;
            cb24h.style.cssText = 'margin:0; cursor:pointer;';
            cb24h.onchange = () => setUse24hTime(cb24h.checked);

            const lbl24h = document.createElement('span');
            lbl24h.textContent = '24h';

            pill.appendChild(cb24h);
            pill.appendChild(lbl24h);
            item.appendChild(pill);

            const pillDate = document.createElement('label');
            pillDate.title = '在 [Day X] 与 [DD/MM/YYYY] 日期格式之间切换时间显示与提示词。';
            pillDate.style.cssText = 'display:inline-flex; align-items:center; gap:4px; font-size:10px; opacity:0.8; cursor:pointer; user-select:none; margin-right:4px; white-space:nowrap;';

            const cbDate = document.createElement('input');
            cbDate.id = 'rpg_time_ddmmyy_toggle';
            cbDate.type = 'checkbox';
            cbDate.checked = !!s.useDdMmYyFormat;
            cbDate.style.cssText = 'margin:0; cursor:pointer;';
            cbDate.onchange = () => setUseDdMmYyFormat(cbDate.checked);

            const lblDate = document.createElement('span');
            lblDate.textContent = 'DD/MM/YYYY';

            pillDate.appendChild(cbDate);
            pillDate.appendChild(lblDate);
            item.appendChild(pillDate);
        }

        btnGroup.appendChild(editBtn);
        if (resetBtn) btnGroup.appendChild(resetBtn);
        btnGroup.appendChild(upBtn);
        btnGroup.appendChild(downBtn);
        item.appendChild(btnGroup);
        list.appendChild(item);

        // [BENCHED PARTY] is a sub-module of PARTY — it gets its own enable toggle +
        // editable prompt, but is rendered nested directly under PARTY's row (indented,
        // muted, no up/down/reorder controls) rather than as a normal flat peer entry,
        // since it's never independently positioned or rendered as its own module.
        if (tag === 'PARTY') {
            list.appendChild(buildBenchedPartySubRow(s));
        }
        });
    });
}

/** Builds the compact, reorderable row for a display-only module group. */
function buildDisplayGroupOrderRow(settings, order, group) {
    const memberSet = new Set(group.members);
    const firstIndex = order.findIndex(tag => memberSet.has(tag));
    const lastIndex = Math.max(...order.map((tag, index) => memberSet.has(tag) ? index : -1));
    const isActive = settings.displayGroupsEnabled && group.enabled;

    const item = document.createElement('div');
    item.className = 'flex-container gap-1 alignitemscenter rt-order-item rt-display-group-order-item';
    item.style.cssText = `padding:5px;border-radius:4px;border:1px dashed rgba(255,196,92,.55);background:${isActive ? 'rgba(255,196,92,.10)' : 'transparent'};opacity:${isActive ? '1' : '.6'};`;
    item.title = '仅展示分组：它的箭头会一起移动所有列出的成员模块。';

    const marker = document.createElement('span');
    marker.textContent = '🗂️';
    marker.style.margin = '0 5px';
    const label = document.createElement('span');
    label.style.cssText = 'flex:1;font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    label.textContent = `${group.icon} ${group.name} (${group.members.length})`;
    const badge = document.createElement('span');
    badge.textContent = '显示分组';
    badge.style.cssText = 'font-size:8px;color:#ffc45c;border:1px solid rgba(255,196,92,.45);border-radius:3px;padding:1px 4px;white-space:nowrap;';

    const controls = document.createElement('div');
    controls.className = 'flex-container gap-1';
    const move = (direction) => {
        settings.blockOrder = moveDisplayGroupInOrder(order, group.members, direction);
        saveSettings();
        refreshOrderList();
        refreshRenderedView();
    };
    const upBtn = document.createElement('button');
    upBtn.className = 'menu_button interactable rt-order-btn';
    upBtn.style.padding = '2px 6px';
    upBtn.title = '上移显示分组';
    upBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    upBtn.disabled = firstIndex <= 0;
    upBtn.onclick = () => move('up');
    const downBtn = document.createElement('button');
    downBtn.className = 'menu_button interactable rt-order-btn';
    downBtn.style.padding = '2px 6px';
    downBtn.title = '下移显示分组';
    downBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
    downBtn.disabled = lastIndex >= order.length - 1;
    downBtn.onclick = () => move('down');

    controls.append(upBtn, downBtn);
    item.append(marker, label, badge, controls);
    return item;
}

/** Builds the nested "⛺ Benched Party" sub-row shown directly under PARTY in the module list. */
function buildBenchedPartySubRow(s) {
    const modKey = 'benched party';
    if (!s.modules) s.modules = {};
    const isEnabled = s.modules[modKey] ?? true;

    const item = document.createElement('div');
    item.className = 'flex-container gap-1 alignitemscenter rt-order-item rt-order-subitem';
    item.style.padding = '4px 5px';
    item.style.marginLeft = '18px';
    item.style.background = isEnabled ? 'var(--black30a)' : 'transparent';
    item.style.opacity = isEnabled ? '0.9' : '0.55';
    item.style.borderRadius = '4px';
    item.style.border = '1px dashed var(--smartThemeBorderColor)';

    const connector = document.createElement('span');
    connector.textContent = '\u2514\u2500';
    connector.style.opacity = '0.5';
    connector.style.fontSize = '11px';
    connector.style.marginRight = '2px';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isEnabled;
    cb.style.margin = '0 5px';
    cb.title = 'PARTY 的子模块——追踪器会发出 [BENCH]/[UNBENCH] 指令；代码会将完整状态表移动到营地名册。';
    cb.onchange = () => {
        s.modules[modKey] = cb.checked;
        if (cb.checked) {
            s.modules.party = true;
        }
        if (!s.syspromptModules) s.syspromptModules = {};
        s.syspromptModules.party_bench = cb.checked;
        const quickAccessCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_sysprompt_mod_party_bench'));
        if (quickAccessCb) quickAccessCb.checked = cb.checked;
        const onboardingCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rt_onboarding_mod_party_bench'));
        if (onboardingCb) onboardingCb.checked = cb.checked;
        saveSettings();
        refreshOrderList();
        refreshRenderedView();
    };

    const label = document.createElement('span');
    label.style.flex = '1';
    label.style.fontSize = '11px';
    label.style.cursor = 'default';
    label.textContent = `${BLOCK_ICONS['BENCHED PARTY'] || '⛺'} BENCHED PARTY`;
    label.title = 'PARTY 的子模块——以紧凑的营地名册形式折叠进 PARTY 卡片中，而非独立的标签页。';

    const editBtn = document.createElement('button');
    editBtn.className = 'menu_button interactable rt-order-btn';
    editBtn.style.padding = '2px 6px';
    editBtn.title = '编辑提示词';
    editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
    editBtn.onclick = () => {
        if (!s.stockPrompts) s.stockPrompts = { ...DEFAULT_STOCK_PROMPTS };
        openPromptEditor(
            'BENCHED PARTY',
            '编辑默认 [BENCHED PARTY] 提示词',
            s.stockPrompts[modKey] || DEFAULT_STOCK_PROMPTS[modKey],
            DEFAULT_STOCK_PROMPTS[modKey],
            (newVal) => {
                s.stockPrompts[modKey] = newVal;
                saveSettings();
                toastr['success'](`[BENCHED PARTY] 提示词已更新。`, 'RPG Tracker');
            },
            modKey
        );
    };

    const resetBtn = document.createElement('button');
    resetBtn.className = 'menu_button interactable rt-order-btn';
    resetBtn.style.padding = '2px 6px';
    resetBtn.title = '将提示词重置为默认值';
    resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
    resetBtn.onclick = () => {
        if (confirm('将 [BENCHED PARTY] 提示词重置为默认值？任何自定义修改都将丢失。')) {
            if (!s.stockPrompts) s.stockPrompts = { ...DEFAULT_STOCK_PROMPTS };
            s.stockPrompts[modKey] = DEFAULT_STOCK_PROMPTS[modKey];
            saveSettings();
            toastr['success']('[BENCHED PARTY] 提示词已重置。', 'RPG Tracker');
        }
    };

    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex-container gap-1';
    btnGroup.appendChild(editBtn);
    btnGroup.appendChild(resetBtn);

    item.appendChild(connector);
    item.appendChild(cb);
    item.appendChild(label);
    item.appendChild(btnGroup);
    return item;
}

export function openNpcSectionEditor() {
    openSectionEditor('npc');
}

export function openPcSectionEditor() {
    openSectionEditor('pc');
}

function openSectionEditor(targetType) {
    const s = getSettings();
    const isNPC = targetType === 'npc';
    const settingsKey = isNPC ? 'npcCoreSections' : 'pcCoreSections';
    const presetsKey = isNPC ? 'npcSectionPresets' : 'pcSectionPresets';
    if (!s[presetsKey]) s[presetsKey] = {};
    const defaultSections = isNPC ? DEFAULT_NPC_SECTIONS : DEFAULT_PC_SECTIONS;
    const titleText = isNPC ? '🧩 编辑 NPC 分区' : '👤 编辑 PC 分区';
    const descriptionText = isNPC 
        ? '自定义所有 NPC 的 <b>[CORE]</b> 身份分区。您可以编辑名称、颜色、表情符号，以及告知 AI 需要追踪什么的提示词指令。拖动把手可重新排序。'
        : '自定义玩家角色的角色卡分区。生成新角色或导入现有卡片时都会使用这些字段。拖动把手可重新排序。';

    if (!s[settingsKey] || !Array.isArray(s[settingsKey]) || s[settingsKey].length === 0) s[settingsKey] = JSON.parse(JSON.stringify(defaultSections));
    let workingSections = JSON.parse(JSON.stringify(s[settingsKey]));

    // Tracks which preset is currently "active" so render() never resets the dropdown.
    // Persisted between opens by stashing on the settings object under a side-channel key.
    const _activeKey = `_activePreset_${presetsKey}`;
    let activePresetName = s[_activeKey] || '';

    let overlay = document.getElementById('rt_sec_se_overlay');
    let inner;
    if (!overlay) {
        overlay = document.createElement('dialog');
        overlay.id = 'rt_sec_se_overlay';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.maxWidth = '100vw';
        overlay.style.maxHeight = '100vh';
        overlay.style.margin = '0';
        overlay.style.padding = '0';
        overlay.style.border = 'none';
        overlay.style.backgroundColor = 'transparent';
        
        inner = document.createElement('div');
        inner.id = 'rt_sec_se_inner';
        inner.style.width = '100%';
        inner.style.height = '100%';
        inner.style.backgroundColor = 'rgba(0,0,0,0.7)';
        inner.style.display = 'flex';
        inner.style.alignItems = 'center';
        inner.style.justifyContent = 'center';
        overlay.appendChild(inner);
        
        document.body.appendChild(overlay);
    } else {
        inner = document.getElementById('rt_sec_se_inner');
    }

    const renderList = () => {
        return workingSections.map((sec, idx) => `
            <div class="sec-section-row" data-idx="${idx}" style="display:flex; flex-direction:column; gap:4px; padding:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:6px; margin-bottom:8px;">
                <div style="display:flex; gap:8px; align-items:center;">
                    <div style="cursor:move; opacity:0.5; padding:4px;" class="drag-handle" title="拖动排序"><i class="fa-solid fa-grip-vertical"></i></div>
                    <input type="text" class="text_pole sec-icon" value="${escapeHtml(sec.icon)}" style="width:36px; text-align:right;" title="图标（表情符号）">
                    <input type="color" class="sec-color" value="${sec.color}" style="width:28px; height:28px; padding:0; border:none; border-radius:4px; cursor:pointer;" title="颜色">
                    <input type="text" class="text_pole sec-name" value="${escapeHtml(sec.name)}" style="flex:1; font-weight:bold;" placeholder="分区名称">
                    <div class="menu_button interactable sec-delete" style="padding:4px 8px; color:#ff5555;" title="删除"><i class="fa-solid fa-trash"></i></div>
                </div>
                <input type="text" class="text_pole sec-desc" value="${escapeHtml(sec.description)}" style="width:100%; font-size:11px; margin-top:2px;" placeholder="本分区提示词指令…">
            </div>
        `).join('');
    };

    // Helper: does the current workingSections differ from what the preset stores?
    const hasUnsavedChanges = () => {
        if (!activePresetName || !s[presetsKey][activePresetName]) return false;
        return JSON.stringify(workingSections) !== JSON.stringify(s[presetsKey][activePresetName]);
    };

    const render = () => {
        // Ensure activePresetName still exists (preset may have been deleted)
        if (activePresetName && !s[presetsKey][activePresetName]) activePresetName = '';

        inner.innerHTML = `
            <div class="popup shadowBase" style="min-width: 480px; max-width: 600px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;">
                <div class="popup-header" style="flex-shrink:0;">
                    <h3 class="margin0">${titleText}</h3>
                    <div id="rt_sec_se_close" class="popup-close interactable" title="关闭"><i class="fa-solid fa-times"></i></div>
                </div>
                <div style="padding: 14px 14px 0 14px; flex-shrink:0;">
                    <div style="font-size:11px; opacity:0.7; margin-bottom:10px; line-height:1.4;">
                        ${descriptionText}
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding-bottom:10px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <strong style="font-size:0.85em; opacity:0.8;">预设</strong>
                        <select id="rt_sec_se_preset_select" class="text_pole" style="flex:1; font-size:12px; height:24px; padding:2px 4px;">
                            <option value="" disabled${!activePresetName ? ' selected' : ''}>-- 选择预设 --</option>
                            ${Object.keys(s[presetsKey]).map(k => `<option value="${escapeHtml(k)}"${k === activePresetName ? ' selected' : ''}>${escapeHtml(k)}</option>`).join('')}
                        </select>
                        <button id="rt_sec_se_preset_save_overwrite" class="menu_button interactable" style="padding:2px 8px; font-size:11px; background:rgba(100,180,255,0.12);${activePresetName ? '' : ' opacity:0.4; cursor:not-allowed;'}" title="${activePresetName ? `用当前分区覆盖预设“${activePresetName}”` : '请先选择预设'}">保存</button>
                        <button id="rt_sec_se_preset_save" class="menu_button interactable" style="padding:2px 8px; font-size:11px; background:rgba(100,180,255,0.15);" title="将当前分区另存为新预设或重命名后的预设">另存为…</button>
                        <button id="rt_sec_se_reset" class="menu_button interactable" style="padding:2px 8px; font-size:11px; color:#ffaa00;" title="将当前编辑器分区重置为默认值">重置</button>
                        <button id="rt_sec_se_preset_delete" class="menu_button interactable" style="padding:2px 8px; font-size:11px; color:#ff5555;" title="删除所选预设">删除</button>
                    </div>
                </div>
                <div id="rt_sec_se_list" style="overflow-y:auto; max-height:40vh; padding: 0 14px;">
                    ${renderList()}
                </div>
                <div style="padding: 8px 14px; flex-shrink:0;">
                    <button id="rt_sec_se_add" class="menu_button interactable" style="width:100%; border: 1px dashed rgba(255,255,255,0.2); background:transparent;">
                        <i class="fa-solid fa-plus"></i> 添加自定义分区
                    </button>
                </div>
                <div class="popup-footer flex-container gap-1" style="display: flex; justify-content: flex-end; padding:10px 14px; border-top:1px solid rgba(255,255,255,0.08); flex-shrink:0;">
                    <button id="rt_sec_se_cancel" class="menu_button interactable" style="font-size:12px;">取消</button>
                    <button id="rt_sec_se_save" class="menu_button interactable" style="font-size:12px; background:rgba(180,100,255,0.15); border-color:rgba(180,100,255,0.4);">保存并重建</button>
                </div>
            </div>
        `;
        
        // Bindings
        document.getElementById('rt_sec_se_close').onclick = close;
        document.getElementById('rt_sec_se_cancel').onclick = close;

        // Preset select: load immediately on change
        document.getElementById('rt_sec_se_preset_select').onchange = (e) => {
            const chosen = e.target.value;
            if (!chosen) { activePresetName = ''; s[_activeKey] = ''; return; }
            if (!s[presetsKey][chosen]) return;
            if (hasUnsavedChanges() && !confirm(`加载预设“${chosen}”？当前分区未保存的更改将丢失。`)) {
                // Revert dropdown to old value
                e.target.value = activePresetName;
                return;
            }
            workingSections = JSON.parse(JSON.stringify(s[presetsKey][chosen]));
            activePresetName = chosen;
            s[_activeKey] = chosen;
            render();
            toastr['success'](`已加载预设：${chosen}`);
        };

        // Save — overwrite active preset silently
        document.getElementById('rt_sec_se_preset_save_overwrite').onclick = () => {
            if (!activePresetName) { toastr['warning']('请先选择预设，或使用“另存为…”新建一个。'); return; }
            s[presetsKey][activePresetName] = JSON.parse(JSON.stringify(workingSections));
            s[presetsKey] = { ...s[presetsKey] };
            s[_activeKey] = activePresetName;
            saveSettings();
            render();
            toastr['success'](`预设已保存：${activePresetName}`);
        };

        // Save As… — prompt for a (new) name
        document.getElementById('rt_sec_se_preset_save').onclick = () => {
            const presetName = prompt('为此预设输入名称：', activePresetName || '');
            if (!presetName || !presetName.trim()) return;
            const nameTrimmed = presetName.trim();
            s[presetsKey][nameTrimmed] = JSON.parse(JSON.stringify(workingSections));
            // Force top-level reassignment so SillyTavern's shallow proxy detects the change
            s[presetsKey] = { ...s[presetsKey] };
            activePresetName = nameTrimmed;
            s[_activeKey] = nameTrimmed;
            saveSettings();
            render();
            toastr['success'](`预设已保存：${nameTrimmed}`);
        };

        document.getElementById('rt_sec_se_preset_delete').onclick = () => {
            const presetName = document.getElementById('rt_sec_se_preset_select').value;
            if (!presetName || !s[presetsKey][presetName]) return;
            if (confirm(`删除预设“${presetName}”？`)) {
                delete s[presetsKey][presetName];
                // Force top-level reassignment so SillyTavern's shallow proxy detects the change
                s[presetsKey] = { ...s[presetsKey] };
                if (activePresetName === presetName) { activePresetName = ''; s[_activeKey] = ''; }
                saveSettings();
                render();
                toastr['info'](`已删除预设：${presetName}`);
            }
        };
        
        document.getElementById('rt_sec_se_reset').onclick = () => {
            if (confirm("将编辑器分区重置为默认值？（这会覆盖下方列表中的当前编辑内容；点击“保存并重建”可将更改应用到游戏，或使用“另存为…”保存为预设。）")) {
                workingSections = JSON.parse(JSON.stringify(defaultSections));
                activePresetName = '';
                s[_activeKey] = '';
                render();
                toastr['info']("编辑器分区已重置为默认值。");
            }
        };

        document.getElementById('rt_sec_se_add').onclick = () => {
            workingSections.push({
                id: 'custom_' + Date.now(),
                name: 'New Section',
                description: 'Description of what goes here.',
                icon: '📌',
                color: '#aaaaaa'
            });
            render();
            // Scroll to bottom
            setTimeout(() => {
                const list = document.querySelector('.popup-body');
                if (list) list.scrollTop = list.scrollHeight;
            }, 50);
        };

        // Sync inputs back to working array on change
        document.querySelectorAll('.sec-section-row').forEach(row => {
            const idx = parseInt(row.getAttribute('data-idx'));
            row.querySelector('.sec-name').addEventListener('input', e => workingSections[idx].name = e.target.value);
            row.querySelector('.sec-icon').addEventListener('input', e => workingSections[idx].icon = e.target.value);
            row.querySelector('.sec-color').addEventListener('input', e => workingSections[idx].color = e.target.value);
            row.querySelector('.sec-desc').addEventListener('input', e => workingSections[idx].description = e.target.value);
            row.querySelector('.sec-delete').onclick = () => {
                if(confirm("移除该分区？")) {
                    workingSections.splice(idx, 1);
                    render();
                }
            };
        });

        document.getElementById('rt_sec_se_save').onclick = () => {
            // Validate
            for (let sec of workingSections) {
                if (!sec.name.trim()) {
                    toastr['warning']('所有分区都必须填写名称。', isNPC ? 'NPC 设置' : 'PC 设置');
                    return;
                }
                // Ensure IDs exist for legacy custom ones, or create simple sluggified IDs
                if (!sec.id) {
                    sec.id = sec.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
                }
            }
            s[settingsKey] = JSON.parse(JSON.stringify(workingSections));
            saveSettings();
            rebuildNpcInstructionIfNeeded(); // Handles NPC rebuilds, safe to call always
            refreshRenderedView();
            toastr['success'](`${isNPC ? 'NPC 身份' : 'PC 角色'}分区已更新！`, isNPC ? 'NPC 设置' : 'PC 设置');
            close();
        };

        // Simple Drag and Drop
        let draggedRow = null;
        const listContainer = document.getElementById('rt_sec_se_list');
        document.querySelectorAll('.sec-section-row').forEach(row => {
            const handle = row.querySelector('.drag-handle');
            row.setAttribute('draggable', 'false');
            
            handle.addEventListener('mousedown', () => row.setAttribute('draggable', 'true'));
            handle.addEventListener('mouseup', () => row.setAttribute('draggable', 'false'));
            handle.addEventListener('mouseleave', () => row.setAttribute('draggable', 'false'));
            
            row.addEventListener('dragstart', e => {
                draggedRow = row;
                e.dataTransfer.effectAllowed = 'move';
                row.style.opacity = '0.5';
            });
            
            row.addEventListener('dragend', () => {
                draggedRow = null;
                row.style.opacity = '1';
                // Read back new order
                const newArr = [];
                listContainer.querySelectorAll('.sec-section-row').forEach(r => {
                    newArr.push(workingSections[r.getAttribute('data-idx')]);
                });
                workingSections = newArr;
                render();
            });

            row.addEventListener('dragover', e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const bounding = row.getBoundingClientRect();
                const offset = bounding.y + (bounding.height / 2);
                if (e.clientY - offset > 0) {
                    row.style.borderBottom = '2px solid var(--rt-accent, #b464ff)';
                    row.style.borderTop = '';
                } else {
                    row.style.borderTop = '2px solid var(--rt-accent, #b464ff)';
                    row.style.borderBottom = '';
                }
            });

            row.addEventListener('dragleave', e => {
                row.style.borderTop = '';
                row.style.borderBottom = '';
            });

            row.addEventListener('drop', e => {
                e.preventDefault();
                row.style.borderTop = '';
                row.style.borderBottom = '';
                if (draggedRow && draggedRow !== row) {
                    const bounding = row.getBoundingClientRect();
                    const offset = bounding.y + (bounding.height / 2);
                    if (e.clientY - offset > 0) {
                        row.after(draggedRow);
                    } else {
                        row.before(draggedRow);
                    }
                }
            });
        });
    };

    const close = () => { overlay.close(); };
    
    render();
    overlay.showModal();
}
