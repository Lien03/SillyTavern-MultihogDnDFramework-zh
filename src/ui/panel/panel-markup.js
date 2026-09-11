/** Produces the static Tracker and Lorebook Agent panel structure. */
import { AGENT_TERMINAL_TABS, resolveActiveTerminalTab } from './agent-terminal.js';

export function buildPanelMarkup({ settings, agentPanelCollapsedClass }) {
    return `
            <div class="rt-resizer-tr" id="rt-resizer-tr" title="从右上角调整大小"></div>
            <div class="rpg-tracker-header" id="rpg-tracker-header">
                <div class="rt-header-starfield" aria-hidden="true"></div>
                <div class="rt-header-face rt-header-face-active" id="rt-header-face-tracker">
                <div class="rpg-tracker-header-left">
                    <div class="rpg-tracker-status-indicator active" id="rpg-tracker-status"></div>
                    <span class="rt-header-title-desktop">Multihog D&D Framework</span>
                    <span class="rt-header-title-mobile" style="display: none;">Multihog D&D</span>
                    <div id="rt-daynight-badge-slot"></div>
                    <button class="rpg-tracker-stop-btn" id="rpg-tracker-stop-btn" title="停止生成" style="display:none;">■</button>
                </div>
                <div class="rpg-tracker-header-center" id="rpg-tracker-pause-banner"></div>
                <div class="rpg-tracker-header-right">
                    <button type="button" class="rpg-tracker-icon-btn" id="rpg-tracker-settings-btn" title="打开设置"><i class="fa-solid fa-wrench" aria-hidden="true"></i></button>
                    <button class="rpg-tracker-icon-btn rt-tutorial-help-btn" id="rpg-tracker-help-btn" title="聊天">聊天</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-view-btn" title="切换渲染视图">⊞</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-enable-btn" title="${settings.enabled ? '禁用 Multihog 框架' : '启用 Multihog 框架'}" style="${settings.enabled ? '' : 'opacity:0.4;'}" >⏻</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-update-btn" title="立即更新状态">🔄</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-pause-btn" title="暂停追踪器">⏸</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-portraits-menu-btn" title="AI 肖像操作">🖼️</button>
                    <button class="rpg-tracker-icon-btn rt-overflow-trigger" id="rt-overflow-btn" title="更多操作">⋯</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-collapse-btn" title="折叠面板"><i class="fa-solid ${settings.trackerCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-close-btn" title="隐藏面板">✕</button>
                </div>
                </div>
                <div class="rt-header-face rt-header-face-inactive" id="rt-header-face-agent">
                    <div class="rpg-tracker-header-left">
                        <i class="fa-solid fa-robot"></i> <span>世界书代理与地图</span>
                    </div>
                    <div class="rpg-tracker-header-center" id="rt-agent-pause-banner" style="color:#ffa500; font-size:0.7em; font-weight:bold; letter-spacing:0.04em;">${settings.routerPaused ? '代理已暂停' : ''}</div>
                    <div class="rpg-tracker-header-right">
                        <div id="rt-research-menu-wrap" style="position:relative; display:inline-flex;">
                            <button class="rpg-tracker-icon-btn" id="rt-agent-router-manual-run" title="立即运行研究 — 世界书代理、地图更新器或地图演化" style="color: var(--rt-accent);"><i class="fa-solid fa-play"></i></button>
                            <div id="rt-research-dropdown" class="rt-update-menu rt-research-dropdown" style="display:none;">
                                <div class="rt-menu-item" id="rt-research-lorebook"><b>世界书代理</b><small>NPC、地点、关系</small></div>
                                <div class="rt-menu-item" id="rt-research-map-updater"><b>地图更新器</b><small>地下城与城镇占据</small></div>
                                <div class="rt-menu-item" id="rt-research-map-evolution"><b>地图演化</b><small>选择要立即演化的地图</small></div>
                            </div>
                        </div>
                        <button class="rpg-tracker-stop-btn" id="rt-agent-stop-btn" title="停止代理" style="display:none;">■</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-full-audit-panel" title="运行完整审计（分块）" style="color: #ff5555;"><i class="fa-solid fa-book-journal-whills"></i></button>
                         <div id="rt-cleanup-menu-wrap" style="position:relative; display:inline-flex;">
                             <button class="rpg-tracker-icon-btn" id="rt-agent-router-cleanup" title="清理菜单" style="color: #e67e22;"><i class="fa-solid fa-broom"></i></button>
                             <div id="rt-cleanup-dropdown" class="rt-cleanup-dropdown" style="display:none;">
                                 <button id="rt-cleanup-run-btn" style="display:block; width:100%; text-align:left; padding:7px 14px; background:none; border:none; color:var(--rt-text,#e0e0e0); font-size:12px; cursor:pointer; white-space:nowrap;">🧹 运行清理</button>
                                 <div style="height:1px; background:rgba(255,255,255,0.06); margin:2px 0;"></div>
                                 <button id="rt-cleanup-settings-toggle" style="display:block; width:100%; text-align:left; padding:7px 14px; background:none; border:none; color:var(--rt-text,#e0e0e0); font-size:12px; cursor:pointer; white-space:nowrap;">⚙ 清理设置</button>
                                 <div id="rt-cleanup-settings-panel" style="display:none; padding:8px 12px; border-top:1px solid rgba(255,255,255,0.07); margin-top:2px;">
                                     <label style="display:flex; align-items:center; gap:6px; font-size:10px; opacity:0.75; margin-bottom:8px; cursor:pointer; user-select:none;">
                                         <input id="rt-cleanup-use-threshold-chk" type="checkbox" ${settings.routerCleanupUseThreshold !== false ? 'checked' : ''} style="margin:0; cursor:pointer; accent-color:#e67e22;">
                                         使用 Token 阈值
                                     </label>
                                     <div id="rt-cleanup-threshold-row" style="transition:opacity 0.15s; opacity:${settings.routerCleanupUseThreshold !== false ? '1' : '0.35'}; pointer-events:${settings.routerCleanupUseThreshold !== false ? 'auto' : 'none'};">
                                         <label style="font-size:10px; opacity:0.6; display:block; margin-bottom:2px;">Token 阈值</label>
                                         <input id="rt-cleanup-threshold-inp" type="text" inputmode="numeric" pattern="[0-9]*" min="50" max="5000" step="50" value="${settings.routerCleanupTokenThreshold || 300}" style="width:100%; background:rgba(0,0,0,0.35); color:var(--rt-text,#e0e0e0); border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:3px 6px; font-size:11px; box-sizing:border-box; margin-bottom:8px;">
                                     </div>
                                     <label style="font-size:10px; opacity:0.6; display:block; margin-bottom:2px;">每 N 轮自动清理 <span style="opacity:0.45;">（0 = 关闭）</span></label>
                                     <input id="rt-cleanup-every-inp" type="text" inputmode="numeric" pattern="[0-9]*" min="0" max="100" step="1" value="${settings.routerCleanupEvery || 0}" style="width:100%; background:rgba(0,0,0,0.35); color:var(--rt-text,#e0e0e0); border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:3px 6px; font-size:11px; box-sizing:border-box;">
                                 </div>
                             </div>
                         </div>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-pause-btn" title="${settings.routerPaused ? '恢复代理（自动运行已暂停）' : '暂停代理（跳过自动运行）'}" style="${settings.routerPaused ? 'color:#ffa500;' : ''}">${settings.routerPaused ? '▶' : '⏸'}</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-detach" title="分离世界书代理">⧉</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-collapse-btn" title="折叠面板"><i class="fa-solid ${settings.agentCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                        <button class="rpg-tracker-icon-btn" id="rpg-tracker-agent-close" title="关闭">✕</button>
                    </div>
                </div>
            </div>
            <div class="rpg-tracker-content">
                <div class="rt-panel-mode-switch-wrap" id="rt-panel-mode-switch-wrap">
                    <div class="rt-adventure-companion-header" id="rt-adventure-companion-header" style="display:none;" aria-hidden="true">
                        <i class="fa-solid fa-compass" aria-hidden="true"></i>
                        <span>冒险伙伴</span>
                    </div>
                    <div class="rt-agent-view-mode-switch rt-panel-mode-switch" id="rt-panel-mode-switch" role="tablist" aria-label="面板内容模式">
                        <button type="button" id="rt-panel-mode-tracker" class="rt-agent-view-mode-btn rt-agent-view-mode-btn-active" role="tab" aria-selected="true">状态追踪器</button>
                        <button type="button" id="rt-panel-mode-agent" class="rt-agent-view-mode-btn" role="tab" aria-selected="false">世界书代理与地图</button>
                    </div>
                </div>
                <div class="rt-panel-mode-pane" id="rt-panel-tracker-pane">
                <textarea class="rpg-tracker-memo-area" id="rpg-tracker-memo">${settings.currentMemo}</textarea>
                <div class="rpg-tracker-render-view" id="rpg-tracker-render" style="display:none;"></div>
                <div class="rt-tutorial-view" id="rt-tutorial-view" style="display:none;" aria-label="聊天"></div>
                <div class="rt-bottom-xp-bar" id="rt-bottom-xp-bar" style="display:none;" aria-label="经验进度"></div>
                </div>
                <div class="rt-panel-mode-pane" id="rt-panel-agent-pane" style="display:none;">
            <div class="rpg-tracker-panel rpg-tracker-agent-panel rt-agent-integrated ${agentPanelCollapsedClass}${settings.trackerTheme || 'rt-theme-native'}" id="rpg-tracker-agent">
                <div class="rpg-tracker-content" style="flex: 1; min-height: 0; resize: none; padding: 10px; color: var(--rt-text); display: flex; flex-direction: column;">
                    <!-- Quick Settings Collapsible Header -->
                    <div id="rt-agent-settings-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); user-select: none; flex-shrink: 0;">
                        <div style="font-weight: bold; font-size: 0.846em; display: flex; align-items: center; gap: 6px; color: var(--rt-text-muted);">
                            <i class="fa-solid ${settings.agentSettingsOpen !== false ? 'fa-chevron-down' : 'fa-chevron-right'}" id="rt-agent-settings-toggle-icon"></i> 快速设置
                        </div>
                        <button id="rt-agent-help-btn" style="background: var(--rt-accent-bg); border: 1px solid var(--rt-accent-dim); color: var(--rt-accent); border-radius: 12px; width: 18px; height: 18px; font-size: 0.769em; cursor: pointer; display: flex; align-items: center; justify-content: center; margin: 0; flex-shrink: 0;" title="什么是世界书代理？">?</button>
                    </div>

                    <!-- Quick Settings Drawer -->
                    <div id="rt-agent-settings-drawer" style="display: ${settings.agentSettingsOpen !== false ? 'block' : 'none'}; margin-bottom: 10px; flex-shrink: 0;">
                        <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: pointer; opacity: 0.8; font-size: 0.846em;" title="使用简单文本标签 [[NPC: Name | Desc]] 代替复杂工具。更适合小模型。">
                            基础模式（基于标签，无工具调用）
                            <input type="checkbox" id="rt-agent-router-basic" ${settings.routerBasicMode ? 'checked' : ''}>
                        </label>

                        <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: pointer; opacity: 0.8; font-size: 0.846em;" title="启用后，扩展的关键词扫描器将完全禁用。由 SillyTavern 原生知识库关键词系统负责所有基于关键词的词条激活。代理不会根据关键词自动激活或自动过期词条。">
                            原生关键词激活
                            <input type="checkbox" id="rt-agent-router-native-kw" ${settings.routerNativeKeywordActivation ? 'checked' : ''}>
                        </label>

                        ${(() => {
            const mode = settings.routerLookbackSinceLastRun !== false ? 'since_last_run'
                : settings.routerLookbackSinceLastUser === true ? 'since_last_user' : 'fixed';
            return `
                        <div style="margin-bottom: 8px;">
                            <div style="font-size: 0.769em; opacity: 0.7; margin-bottom: 4px;">回溯模式：</div>
                            <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px; cursor: pointer; font-size: 0.769em; opacity: 0.85;" title="读取自上次代理成功运行以来的所有消息 — 当“每 N 条运行”> 1 时最合适。">
                                <input type="radio" name="rt-lookback-mode" id="rt-agent-lookback-mode-run" value="since_last_run" ${mode === 'since_last_run' ? 'checked' : ''}>
                                <span>上次运行以来</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px; cursor: pointer; font-size: 0.769em; opacity: 0.75;" title="从最近的用户消息一直读取到最新的 AI 回复。">
                                <input type="radio" name="rt-lookback-mode" id="rt-agent-lookback-mode-user" value="since_last_user" ${mode === 'since_last_user' ? 'checked' : ''}>
                                <span>上次用户消息以来</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px; cursor: pointer; font-size: 0.769em; opacity: 0.75;" title="读取固定数量的最近用户回合。">
                                <input type="radio" name="rt-lookback-mode" id="rt-agent-lookback-mode-fixed" value="fixed" ${mode === 'fixed' ? 'checked' : ''}>
                                <span>固定回合数：</span>
                            </label>
                            <div id="rt-agent-router-lookback-container" style="display: inline-flex; align-items: center; gap: 6px; margin-left: 20px; transition: opacity 0.2s; ${mode !== 'fixed' ? 'opacity: 0.35; pointer-events: none;' : ''}" title="读取最近 N 个用户回合（包含每个回合中的所有工具消息）。">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-lookback" value="${settings.routerLookback || 4}" min="1" max="100" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 3px; text-align: center; font-size: 0.769em; padding: 1px;">
                                <span style="font-size: 0.769em; opacity: 0.5;">条</span>
                            </div>
                        </div>`;
        })()}

                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 6px; flex: 1;" title="每 N 条消息运行：1 = 每轮触发（始终最新，但词条粒度可能过细）。3+ = 触发频率较低，但能看到更多叙事上下文，更新更连贯。关键词命中仍会立即触发，不受影响。">
                                <span style="font-size: 0.769em; opacity: 0.7;">每 N 条运行：</span>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-run-every" value="${settings.routerRunEvery || 3}" min="1" max="50" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 3px; text-align: center; font-size: 0.769em; padding: 1px;">
                                <span style="font-size: 0.769em; opacity: 0.5;">条</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; flex: 1;" title="地图更新器在已绘制的地下城或定居点内的运行节奏。独立于世界书代理。1 = 每轮更新占据情况。">
                                <span style="font-size: 0.769em; opacity: 0.7;">地图每 N 条：</span>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-map-updater-run-every" value="${settings.mapUpdaterRunEvery ?? 1}" min="1" max="50" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 3px; text-align: center; font-size: 0.769em; padding: 1px;">
                                <span style="font-size: 0.769em; opacity: 0.5;">条</span>
                            </div>
                        </div>

                        <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px; cursor: pointer; font-size: 0.769em; opacity: 0.75;" title="在代理的回溯窗口中包含隐藏消息（例如被摘要器折叠的消息）。">
                            <input type="checkbox" id="rt-agent-router-include-hidden" ${settings.routerIncludeHidden ? 'checked' : ''}>
                            <span>包含隐藏消息（摘要器）</span>
                        </label>

                        <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px; cursor: pointer; font-size: 0.769em; opacity: 0.75;" title="启用后，从触发过代理的生成结果滑动离开将撤销该次知识库处理。无论是否回滚，滑动都不会推进“每 N 条运行”计数器。">
                            <input type="checkbox" id="rt-agent-router-swipe-rollback" ${settings.routerSwipeRollback !== false ? 'checked' : ''}>
                            <span>滑动时自动回滚</span>
                        </label>

                        <div style="display: flex; gap: 8px; margin-bottom: 10px; align-items: flex-end;">
                            <div style="flex: 1;" title="最大回合数：代理超时前可执行的思考/行动循环次数（仅高级模式）。">
                                <div style="margin-bottom: 5px; opacity: 0.8; font-size: 0.846em; color: var(--rt-text-muted);">代理最大回合数：</div>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-max-turns" value="${settings.routerMaxTurns || 5}" style="width: 100%; background: var(--rt-card-bg); color: var(--rt-text); border: var(--rt-border); border-radius: 4px; padding: 4px; font-size: 0.846em; box-sizing: border-box;">
                            </div>
                            <div style="flex: 1;" title="最大激活键数：代理在活跃记忆中最多可保留的知识词条数。达到上限后，必须先停用旧词条才能添加新词条。">
                                <div style="margin-bottom: 5px; opacity: 0.8; font-size: 0.846em; color: var(--rt-text-muted);">最大激活键数：</div>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-max-activations" value="${settings.routerMaxActivations || 12}" min="1" max="20" style="width: 100%; background: var(--rt-card-bg); color: var(--rt-text); border: var(--rt-border); border-radius: 4px; padding: 4px; font-size: 0.846em; box-sizing: border-box;">
                            </div>
                            <div style="flex: 1;" title="关键词溢出上限：允许超过最大激活键数的关键词触发词条数（0 = 无上限）。超出后，最旧的关键词词条会优先被清除。示例：最大激活 = 12，上限 = 6 → 总硬上限为 18。">
                                <div style="margin-bottom: 5px; opacity: 0.8; font-size: 0.846em; color: var(--rt-text-muted); line-height: 1.2;">关键词溢出上限<br><span style="font-size: 0.75em; opacity: 0.5; font-weight: normal;">（0 = 无上限）</span>：</div>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-kw-overflow-cap" value="${settings.routerMaxKeywordOverflow ?? 6}" min="0" max="50" style="width: 100%; background: var(--rt-card-bg); color: var(--rt-text); border: var(--rt-border); border-radius: 4px; padding: 4px; font-size: 0.846em; box-sizing: border-box;">
                            </div>
                        </div>
                        


                    </div>

                    <!-- Modular Repertoire Collapsible Header -->
                    <div id="rt-agent-modules-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); user-select: none; flex-shrink: 0;">
                        <div style="font-weight: bold; font-size: 0.846em; display: flex; align-items: center; gap: 6px; color: var(--rt-text-muted);">
                            <i class="fa-solid ${settings.agentModulesOpen !== false ? 'fa-chevron-down' : 'fa-chevron-right'}" id="rt-agent-modules-toggle-icon"></i> 模块库（提示词规则）
                        </div>
                    </div>

                    <!-- Modular Repertoire Drawer -->
                    <div id="rt-agent-modules-drawer" style="display: ${settings.agentModulesOpen !== false ? 'block' : 'none'}; margin-bottom: 10px; flex-shrink: 0;">
                        <div style="margin-bottom: 5px; font-weight: bold; opacity: 0.8; font-size: 0.846em;">已启用模块（内置）：</div>
                        <div id="rt-agent-stock-modules-list" style="margin-bottom: 10px;"></div>

                        <div style="margin-bottom: 5px; font-weight: bold; opacity: 0.8; font-size: 0.846em;">自定义标签：</div>
                        <div id="rt-agent-custom-tags-list"></div>
                        <button id="rt-agent-add-custom-tag" style="width: 100%; background: #333; border: 1px solid #444; color: #ddd; font-size: 0.769em; padding: 2px; border-radius: 3px; cursor: pointer; margin-top: 4px; flex-shrink: 0;">+ 添加自定义标签</button>
                    </div>

                    <!-- Terminal/Direct Prompt Collapsible Header -->
                    <div id="rt-agent-console-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); user-select: none; flex-shrink: 0;">
                        <div style="font-weight: bold; font-size: 0.846em; display: flex; align-items: center; gap: 6px; color: var(--rt-text-muted);">
                            <i class="fa-solid ${settings.agentConsoleOpen !== false ? 'fa-chevron-down' : 'fa-chevron-right'}" id="rt-agent-console-toggle-icon"></i> 终端/直接指令
                        </div>
                    </div>

                    <!-- Terminal/Direct Prompt Section Drawer -->
                    <div id="rt-agent-console-drawer" style="display: ${settings.agentConsoleOpen !== false ? 'block' : 'none'}; margin-bottom: 10px; flex-shrink: 0;">
                        ${(() => {
            const activeTab = resolveActiveTerminalTab(settings.agentTerminalTab);
            const directConfig = {
                state_tracker: {
                    draft: settings.stateTrackerDirectPrompt || '',
                    lookback: settings.directPromptContext ?? 5,
                    lookbackMax: 50,
                    lookbackMin: 0,
                    placeholder: '指示追踪模型…（回车发送，Shift+回车换行）',
                },
                lorebook_agent: {
                    draft: settings.routerDirectPrompt || '',
                    lookback: settings.routerDirectLookback || 10,
                    lookbackMax: 100,
                    lookbackMin: 1,
                    placeholder: '指示世界书代理…（回车发送，Shift+回车换行）',
                },
                map_updater: {
                    draft: settings.mapUpdaterDirectPrompt || '',
                    lookback: settings.mapUpdaterDirectLookback ?? 10,
                    lookbackMax: 100,
                    lookbackMin: 0,
                    placeholder: '指示地图更新器处理当前地图…（回车发送，Shift+回车换行）',
                },
                map_evolution: {
                    draft: settings.mapEvolutionDirectPrompt || '',
                    lookback: settings.mapEvolutionDirectLookback ?? 10,
                    lookbackMax: 100,
                    lookbackMin: 0,
                    placeholder: '指示地图演化…（回车发送，Shift+回车换行）',
                },
                map_architect: {
                    draft: settings.mapArchitectDirectPrompt || '',
                    lookback: settings.mapArchitectDirectLookback ?? 10,
                    lookbackMax: 100,
                    lookbackMin: 0,
                    placeholder: '指示地图架构师处理当前地点…（回车发送，Shift+回车换行）',
                },
            };
            const tabButtons = AGENT_TERMINAL_TABS.map(tab => {
                const isActive = tab.id === activeTab;
                return `<button type="button" class="rt-agent-view-mode-btn rt-agent-terminal-tab-btn${isActive ? ' rt-agent-view-mode-btn-active' : ''}" data-terminal-tab="${tab.id}" role="tab" aria-selected="${isActive ? 'true' : 'false'}">${tab.label}</button>`;
            }).join('');
            const panes = AGENT_TERMINAL_TABS.map(tab => {
                const isActive = tab.id === activeTab;
                const cfg = directConfig[tab.id] || { draft: '', lookback: 10, lookbackMax: 100, lookbackMin: 0, placeholder: '指示…' };
                return `<div id="rt-agent-terminal-${tab.id}" class="rt-agent-terminal-pane${isActive ? ' rt-agent-terminal-pane-active' : ''}">
                            <div class="rt-agent-terminal-shell">
                                <div class="rt-agent-terminal-feed"></div>
                                <div class="rt-agent-terminal-direct-bar">
                                    <span class="rt-agent-terminal-direct-prompt" aria-hidden="true">$</span>
                                    <textarea class="rt-agent-terminal-direct-input" id="rt-terminal-direct-${tab.id}" rows="1" data-terminal-tab="${tab.id}" placeholder="${cfg.placeholder}">${cfg.draft}</textarea>
                                    <div class="rt-agent-terminal-direct-actions">
                                        <label class="rt-lookback-field rt-agent-terminal-direct-lookback-label" title="本次直接运行的最近消息回溯">
                                            <span class="rt-lookback-field-label rt-agent-terminal-direct-lookback-text">回溯：</span>
                                            <input type="text" inputmode="numeric" pattern="[0-9]*" class="rt-lookback-field-input rt-agent-terminal-direct-lookback" id="rt-terminal-direct-lookback-${tab.id}" data-terminal-tab="${tab.id}" min="${cfg.lookbackMin}" max="${cfg.lookbackMax}" value="${cfg.lookback}">
                                        </label>
                                        <button type="button" class="rt-agent-terminal-direct-run" data-terminal-tab="${tab.id}" title="运行指令">↵</button>
                                    </div>
                                </div>
                            </div>
                        </div>`;
            }).join('');
            return `
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <div class="rt-agent-view-mode-switch rt-agent-terminal-tabs" id="rt-agent-terminal-tabs" role="tablist" aria-label="终端/直接指令">${tabButtons}</div>
                            <button id="rt-agent-terminal-clear" style="background: transparent; border: none; color: #ff5555; font-size: 0.692em; cursor: pointer; opacity: 0.7; flex-shrink: 0;">清除</button>
                        </div>
                        <div id="rt-agent-terminal-panes">${panes}</div>`;
        })()}

                        <div id="rt-agent-terminal-log-history" style="display: ${resolveActiveTerminalTab(settings.agentTerminalTab) === 'lorebook_agent' ? 'block' : 'none'};">
                        <hr style="border-color: rgba(255,255,255,0.05); margin: 10px 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <div style="font-weight: bold; opacity: 0.8; font-size: 0.846em;">代理日志历史：</div>
                            <button id="rt-agent-router-log-clear" style="background: transparent; border: none; color: #ff5555; font-size: 0.692em; cursor: pointer; opacity: 0.7;">清除</button>
                        </div>
                        <div id="rt-agent-router-log" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px; max-height: 150px; overflow-y: auto;">
                        </div>
                        </div>
                    </div>

                    <!-- Map Evolution Collapsible Header -->
                    <div id="rt-agent-map-evo-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); user-select: none; flex-shrink: 0;">
                        <div style="font-weight: bold; font-size: 0.846em; display: flex; align-items: center; gap: 6px; color: var(--rt-text-muted);">
                            <i class="fa-solid ${settings.agentMapEvolutionOpen ? 'fa-chevron-down' : 'fa-chevron-right'}" id="rt-agent-map-evo-toggle-icon"></i>
                            🗺️ 地图演化
                        </div>
                        <span id="rt-agent-map-evo-enabled-badge" style="font-size:0.692em; padding:1px 7px; border-radius:10px; font-weight:bold; cursor:pointer; user-select:none; ${settings.mapEvolutionEnabled !== false ? 'background:rgba(52,168,83,0.18); color:#34a853; border:1px solid rgba(52,168,83,0.3);' : 'background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.1);'}" title="点击切换地图演化">${settings.mapEvolutionEnabled !== false ? '开' : '关'}</span>
                    </div>

                    <!-- Map Evolution Drawer -->
                    <div id="rt-agent-map-evo-drawer" style="display: ${settings.agentMapEvolutionOpen ? 'block' : 'none'}; margin-bottom: 10px; flex-shrink: 0;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
                            <div style="background:var(--rt-card-bg); border:var(--rt-border); border-radius:4px; padding:5px 8px;">
                                <div style="font-size:0.692em; opacity:0.5; color:var(--rt-text-muted); margin-bottom:2px;">上次演化</div>
                                <div id="rt-agent-map-evo-last-fired" style="font-size:0.769em; color:var(--rt-text);">—</div>
                            </div>
                            <div style="background:var(--rt-card-bg); border:var(--rt-border); border-radius:4px; padding:5px 8px;">
                                <div style="font-size:0.692em; opacity:0.5; color:var(--rt-text-muted); margin-bottom:2px;">下次演化</div>
                                <div id="rt-agent-map-evo-next-fire" style="font-size:0.769em; color:var(--rt-text);">—</div>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span style="font-size:0.769em; opacity:0.7; white-space:nowrap;">其他地图：</span>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-map-evo-interval" value="${settings.mapEvolutionIntervalHours ?? 8}" style="width:50px; background:var(--rt-card-bg); color:var(--rt-text); border:var(--rt-border); border-radius:3px; text-align:center; font-size:0.769em; padding:2px;" title="队伍不在其中的已绘制地点的间隔。">
                                <span style="font-size:0.769em; opacity:0.5;">小时</span>
                                <span style="font-size:0.769em; opacity:0.7; white-space:nowrap;">当前地图：</span>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-map-evo-onsite-interval" value="${settings.mapEvolutionOnSiteIntervalHours ?? 1}" style="width:42px; background:var(--rt-card-bg); color:var(--rt-text); border:var(--rt-border); border-radius:3px; text-align:center; font-size:0.769em; padding:2px;" title="当前地图间隔小时数。如需不足一小时的间隔，请将小时设为 0 并设置非零分钟数。">
                                <span style="font-size:0.769em; opacity:0.5;">小时</span>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-map-evo-onsite-minutes" value="${settings.mapEvolutionOnSiteIntervalMinutes ?? 0}" style="width:42px; background:var(--rt-card-bg); color:var(--rt-text); border:var(--rt-border); border-radius:3px; text-align:center; font-size:0.769em; padding:2px;" title="当前地图间隔的附加分钟数（0–59）。0 小时 0 分钟将跳过当前地图的自动推进。">
                                <span style="font-size:0.769em; opacity:0.5;">世界内分钟</span>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
                            <label style="font-size:0.769em; opacity:0.7; display:flex; flex-direction:column; gap:3px;">
                                每次刻度地图数
                                <select id="rt-agent-map-evo-tick-scope" style="width:100%; background:var(--rt-card-bg); color:var(--rt-text); border:var(--rt-border); border-radius:3px; font-size:0.769em; padding:3px 4px;">
                                    <option value="active"${(settings.mapEvolutionTickScope || 'all') === 'active' ? ' selected' : ''}>仅当前地图</option>
                                    <option value="count"${settings.mapEvolutionTickScope === 'count' ? ' selected' : ''}>每个已绘制地点取 N 张地图</option>
                                    <option value="all"${(settings.mapEvolutionTickScope || 'all') === 'all' ? ' selected' : ''}>所有已绘制地点（每轮 N 张）</option>
                                    <option value="selected"${settings.mapEvolutionTickScope === 'selected' ? ' selected' : ''}>选中的地图</option>
                                </select>
                            </label>
                            <div id="rt-agent-map-evo-n-row" style="display:${(settings.mapEvolutionTickScope || 'all') === 'active' ? 'none' : 'flex'}; align-items:center; gap:8px; flex-wrap:wrap;">
                                <label style="font-size:0.769em; opacity:0.7; display:flex; align-items:center; gap:5px;">
                                    数量
                                    <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-map-evo-tick-count" value="${settings.mapEvolutionTickCount ?? 2}" style="width:44px; background:var(--rt-card-bg); color:var(--rt-text); border:var(--rt-border); border-radius:3px; text-align:center; font-size:0.769em; padding:2px;" title="超过此数量的到期地图将等待后续轮次。当前地图到期时始终占用一个名额。0 = 本轮处理所有到期地图。">
                                </label>
                                <label style="font-size:0.769em; opacity:0.7; display:flex; align-items:center; gap:5px; cursor:pointer; user-select:none;">
                                    <input type="checkbox" id="rt-agent-map-evo-tick-randomize" ${settings.mapEvolutionTickRandomize !== false ? 'checked' : ''} style="margin:0; cursor:pointer;">
                                    随机抽取到期地图
                                </label>
                            </div>
                            <div id="rt-agent-map-evo-selected-hint" style="display:${settings.mapEvolutionTickScope === 'selected' ? 'block' : 'none'}; font-size:0.692em; opacity:0.55; line-height:1.35;">
                                选中的地图使用“设置 → 持久地图 → 地图演化”中的清单。
                            </div>
                        </div>
                        <button id="rt-agent-map-evo-fire-now" style="width:100%; background:rgba(156,39,176,0.15); border:1px solid rgba(156,39,176,0.3); color:#ce93d8; border-radius:4px; padding:5px; font-size:0.769em; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                            <i class="fa-solid fa-map-location-dot"></i> 立即演化
                        </button>
                        <button id="rt-agent-map-evo-reset-timeline" title="清除各地点的上次演化时间戳，使地图演化从现在重新开始" style="width:100%; background:rgba(234,67,53,0.1); border:1px solid rgba(234,67,53,0.25); color:rgba(234,67,53,0.75); border-radius:4px; padding:4px; font-size:0.692em; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; margin-top:5px;">
                            <i class="fa-solid fa-clock-rotate-left"></i> 重置时间线
                        </button>
                        <button id="rt-agent-map-evo-testing-ground" title="在不游玩的情况下推进时间、生成实体并运行演化刻度" style="width:100%; background:rgba(125,211,252,0.1); border:1px solid rgba(125,211,252,0.28); color:#7dd3fc; border-radius:4px; padding:4px; font-size:0.692em; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; margin-top:5px;">
                            <i class="fa-solid fa-flask"></i> 测试场地
                        </button>
                    </div>

                    <!-- World Progression Collapsible Header -->
                    <div id="rt-agent-world-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); user-select: none; flex-shrink: 0;">
                        <div style="font-weight: bold; font-size: 0.846em; display: flex; align-items: center; gap: 6px; color: var(--rt-text-muted);">
                            <i class="fa-solid ${settings.agentWorldOpen ? 'fa-chevron-down' : 'fa-chevron-right'}" id="rt-agent-world-toggle-icon"></i>
                            🌍 世界进程
                        </div>
                        <span id="rt-agent-world-enabled-badge" style="font-size:0.692em; padding:1px 7px; border-radius:10px; font-weight:bold; cursor:pointer; user-select:none; ${settings.worldProgressionEnabled ? 'background:rgba(52,168,83,0.18); color:#34a853; border:1px solid rgba(52,168,83,0.3);' : 'background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.1);'}" title="点击切换世界进程">${settings.worldProgressionEnabled ? '开' : '关'}</span>
                    </div>

                    <!-- World Progression Drawer -->
                    <div id="rt-agent-world-drawer" style="display: ${settings.agentWorldOpen ? 'block' : 'none'}; margin-bottom: 10px; flex-shrink: 0;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
                            <div style="background:var(--rt-card-bg); border:var(--rt-border); border-radius:4px; padding:5px 8px;">
                                <div style="font-size:0.692em; opacity:0.5; color:var(--rt-text-muted); margin-bottom:2px;">上次触发</div>
                                <div id="rt-agent-world-last-fired" style="font-size:0.769em; color:var(--rt-text);">—</div>
                            </div>
                            <div style="background:var(--rt-card-bg); border:var(--rt-border); border-radius:4px; padding:5px 8px;">
                                <div style="font-size:0.692em; opacity:0.5; color:var(--rt-text-muted); margin-bottom:2px;">下次触发</div>
                                <div id="rt-agent-world-next-fire" style="font-size:0.769em; color:var(--rt-text);">—</div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                            <span style="font-size:0.769em; opacity:0.7; white-space:nowrap;">间隔：</span>
                            <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-world-interval" value="${settings.worldProgressionIntervalHours || 24}" style="width:50px; background:var(--rt-card-bg); color:var(--rt-text); border:var(--rt-border); border-radius:3px; text-align:center; font-size:0.769em; padding:2px;">
                            <span style="font-size:0.769em; opacity:0.5;">世界内小时</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                            <span style="font-size:0.769em; opacity:0.7; white-space:nowrap;">地点数：</span>
                            <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-world-locations" value="${settings.worldProgressionLocationsPerReport ?? 3}" style="width:50px; background:var(--rt-card-bg); color:var(--rt-text); border:var(--rt-border); border-radius:3px; text-align:center; font-size:0.769em; padding:2px;" title="每个报告中有多少个地点档案获得独立章节。">
                            <span style="font-size:0.769em; opacity:0.5;">每份报告</span>
                        </div>
                        <button id="rt-agent-world-fire-now" style="width:100%; background:rgba(52,168,83,0.15); border:1px solid rgba(52,168,83,0.3); color:#34a853; border-radius:4px; padding:5px; font-size:0.769em; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                            <i class="fa-solid fa-globe"></i> 立即触发
                        </button>
                        <button id="rt-agent-world-fire-extra" style="width:100%; background:rgba(0,180,216,0.15); border:1px solid rgba(0,180,216,0.3); color:#00b4d8; border-radius:4px; padding:5px; font-size:0.769em; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; margin-top:5px;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> 附带额外指示触发
                        </button>
                        <button id="rt-agent-world-reset-timeline" title="清除上次触发时间戳，使世界进程从现在重新开始" style="width:100%; background:rgba(234,67,53,0.1); border:1px solid rgba(234,67,53,0.25); color:rgba(234,67,53,0.75); border-radius:4px; padding:4px; font-size:0.692em; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; margin-top:5px;">
                            <i class="fa-solid fa-clock-rotate-left"></i> 重置时间线
                        </button>
                        <button id="rt-agent-world-purge-history" title="删除此战役前缀的所有世界进程报告与骨架数据，并重置此聊天的计时器状态" style="width:100%; background:rgba(234,67,53,0.14); border:1px solid rgba(234,67,53,0.35); color:rgba(234,67,53,0.9); border-radius:4px; padding:4px; font-size:0.692em; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; margin-top:5px;">
                            <i class="fa-solid fa-trash-can"></i> 清除此聊天的世界历史
                        </button>
                    </div>

                    <div id="rt-agent-keys-toggle" style="display: flex; align-items: center; gap: 6px; margin-bottom: 5px; flex-shrink: 0; cursor: pointer; user-select: none;">
                        <div style="font-weight: bold; opacity: 0.8; font-size: 0.846em; display: flex; align-items: center; gap: 4px;">
                            <span id="rt-agent-keys-chevron" style="display: inline-block; width: 10px; transition: transform 0.2s; font-size: 0.9em; opacity: 0.7;"><i class="fa-solid fa-chevron-down"></i></span>
                            活跃知识键：
                            <span id="rt-agent-active-tokens" style="font-weight: normal; opacity: 0.55; color: var(--rt-text-muted); font-size: 0.95em;">(0t)</span>
                        </div>
                        <button id="rt-agent-keys-refresh" title="从磁盘刷新活跃键" style="background: none; border: none; color: var(--rt-accent); font-size: 0.769em; cursor: pointer; opacity: 0.6; padding: 0;" ><i class="fa-solid fa-arrows-rotate"></i></button>
                    </div>
                    <div id="rt-agent-router-active-keys" style="margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; flex-shrink: 0;">
                    </div>

                    <div id="rt-agent-campaign-section" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; display: flex; flex-direction: column; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-shrink: 0; gap: 8px;">
                            <div id="rt-agent-campaign-header-title" style="font-weight: bold; opacity: 0.8; font-size: 0.846em; flex: 1; min-width: 0;${settings.locationImages ? ' display: none;' : ''}">战役记录</div>
                            <div class="rt-agent-view-mode-switch" id="rt-agent-view-mode-switch" role="tablist" aria-label="战役记录或视觉/地图"${settings.locationImages ? '' : ' style="display: none;"'}>
                                <button type="button" class="rt-agent-view-mode-btn${settings.agentImmersionMode ? '' : ' rt-agent-view-mode-btn-active'}" id="rt-agent-view-mode-records" role="tab" aria-selected="${settings.agentImmersionMode ? 'false' : 'true'}">战役记录</button>
                                <button type="button" class="rt-agent-view-mode-btn rt-agent-view-mode-btn-visualization${settings.agentImmersionMode ? ' rt-agent-view-mode-btn-active' : ''}" id="rt-agent-view-mode-visualization" role="tab" aria-selected="${settings.agentImmersionMode ? 'true' : 'false'}">
                                    <span class="rt-agent-view-mode-glow" aria-hidden="true"></span>
                                    <span class="rt-agent-view-mode-label">视觉/地图</span>
                                </button>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                <button class="rpg-tracker-icon-btn" id="rt-agent-activate-books" title="立即激活战役知识库" style="font-size: 0.769em; opacity: 0.5;"><i class="fa-solid fa-book-open"></i></button>
                                <button class="rpg-tracker-icon-btn" id="rt-agent-manifest-refresh" title="刷新清单" style="font-size: 0.769em; opacity: 0.5;"><i class="fa-solid fa-arrows-rotate"></i></button>
                            </div>
                        </div>
                        <div id="rt-agent-immersion-view" style="display: ${settings.agentImmersionMode ? 'flex' : 'none'}; flex-direction: column; flex-shrink: 0;"></div>
                        <div id="rt-agent-manifest-list" style="display: ${settings.agentImmersionMode ? 'none' : 'flex'}; flex-direction: column; gap: 6px; flex-shrink: 0;">
                            <div style="text-align: center; opacity: 0.5; font-size: 0.769em; padding: 10px;">点击刷新以加载知识…</div>
                        </div>
                    </div>
                </div>
                <div class="rpg-tracker-footer" id="rt-agent-footer">
                    <div class="rt-footer-starfield" aria-hidden="true"></div>
                    <div class="rt-agent-footer-left">
                        <div class="rpg-tracker-nav">
                            <button class="rpg-tracker-nav-btn" id="rt-agent-nav-back" title="撤销上次知识库操作">←</button>
                            <span class="rpg-tracker-nav-label" id="rt-agent-nav-label">[ 实时 ]</span>
                            <button class="rpg-tracker-nav-btn" id="rt-agent-nav-fwd" title="重做知识库操作">→</button>
                        </div>
                    </div>
                    <div class="rt-agent-footer-center">
                        <div id="rt-agent-footer-location" class="rt-footer-location-text" title="当前位置（主区域、子区域）"></div>
                    </div>
                    <div class="rt-agent-footer-right">
                        <div id="rt-agent-last-run"></div>
                    </div>
                </div>
                <div class="rt-resizer-br" id="rt-agent-resizer-br" title="从右下角调整大小"></div>
                <div class="rt-resizer-bl" id="rt-agent-resizer-bl" title="从左下角调整大小"></div>
            </div>
                </div>
            </div>
            <div class="rpg-tracker-delta-resize-handle" id="rpg-tracker-delta-handle" style="display:none;"></div>
            <div class="rpg-tracker-delta-panel" id="rpg-tracker-delta" style="display:none;">
                <div class="rpg-tracker-delta-toolbar">
                    <span class="rpg-tracker-delta-title">变更日志</span>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-delta-clear" title="清除日志">✕</button>
                </div>
                <div id="rpg-tracker-delta-content">${settings.lastDelta || '<span class="delta-empty">尚无变更。</span>'}</div>
            </div>
            <div class="rpg-tracker-prompt-bar" id="rpg-tracker-prompt-bar" style="display:none;">
                <textarea class="rpg-tracker-prompt-input" id="rpg-tracker-prompt-input" rows="2" placeholder="指示追踪模型…（回车发送，Shift+回车换行）"></textarea>
                <div class="rpg-tracker-prompt-actions">
                    <label class="rt-lookback-field rt-prompt-ctx-control" title="回溯：要包含的最近消息数量">
                        <span class="rt-lookback-field-label">回溯：</span>
                        <input type="text" inputmode="numeric" pattern="[0-9]*" class="rt-lookback-field-input" id="rt-prompt-context-val" value="${settings.directPromptContext || 5}" min="0" max="50">
                    </label>
                    <button class="rpg-tracker-prompt-send" id="rpg-tracker-prompt-send" title="发送指令">▶</button>
                </div>
            </div>
            <div class="rpg-tracker-footer" id="rt-main-footer">
                <div class="rt-footer-starfield" aria-hidden="true"></div>
                <div class="rt-mobile-top-row">
                    <button class="rt-footer-toggle-btn" id="rt-footer-expand-btn" title="切换设置抽屉"><i class="fa-solid fa-chevron-up"></i></button>
                    <div class="rpg-tracker-nav">
                        <button class="rpg-tracker-nav-btn" id="rpg-tracker-nav-back" title="查看上一个快照">←</button>
                        <span class="rpg-tracker-nav-label" id="rpg-tracker-nav-label">实时</span>
                        <button class="rpg-tracker-nav-btn" id="rpg-tracker-nav-fwd" title="查看下一个快照">→</button>
                    </div>
                </div>
                <div class="flex-container gap-1 alignitemscenter rt-rng-footer-group" style="display:none;">
                    <!-- Removed inline RNG toggles, now located in extension settings -->
                </div>
                <div class="rt-footer-center-group" id="rt-footer-center-group" style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                    <div id="rt-footer-time" style="display: none; font-size: 0.769em; color: var(--rt-accent); white-space: nowrap; flex-shrink: 0; opacity: 0.9; cursor: help;" title="当前世界内时间"></div>
                    <div id="rt-footer-location" class="rt-footer-location-text" title="当前位置（主区域、子区域）"></div>
                </div>
                <div class="flex-container gap-1 alignitemscenter rt-utility-footer-group">
                    <span id="rpg-tracker-count">约${Math.round(settings.currentMemo.length / 2.62)} tokens</span>
                    <button class="rpg-tracker-nav-btn" id="rpg-tracker-delta-btn" title="切换变更日志" style="padding: 1px 5px; font-size: 0.692em; opacity: 0.8; margin-left: 5px;">δ</button>
                    <button class="rpg-tracker-nav-btn" id="rpg-tracker-memo-clear" style="padding: 1px 5px; font-size: 0.692em; opacity: 0.8; margin-left: 5px;" title="清除备忘录与历史">清除</button>
                </div>
                <button class="rpg-tracker-icon-btn rt-footer-prompt-btn" id="rpg-tracker-prompt-btn" title="切换直接指令">💬</button>
            </div>
        `;
}
