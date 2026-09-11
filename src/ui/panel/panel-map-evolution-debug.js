import { getSettings } from '../../../state-manager.js';
import {
    MAP_ASSET_KINDS,
    advanceCampaignTime,
    currentCampaignTimeLabel,
    debugAddAsset,
    debugClearEvolutionHistory,
    debugRedoLastEvolutionPass,
    debugRunEvolution,
    debugSetAsset,
    debugSimulateTicks,
    debugUndoLastEvolutionPass,
    describeEvolutionSandbox,
    peekTestingGroundLastPass,
    setCampaignTimeLabel,
} from '../../../map-evolution-debug.js';
import { collectEvolutionArcSubjects, describeEvolutionAssetArc, stripEvolutionDigestSitePrefix } from '../../../map-evolution-lib.js';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function optionList(values, selected = '') {
    return values.map(value => {
        const label = typeof value === 'string' ? value : value.label;
        const id = typeof value === 'string' ? value : value.id;
        return `<option value="${escapeHtml(id)}"${id === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
}

function prettyJson(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value ?? '');
    }
}

function formatTokenCount(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return String(n);
}

function renderMemoryBar(memory) {
    const mem = memory || {};
    const closed = formatTokenCount(mem.closedTokens);
    const threshold = formatTokenCount(mem.threshold);
    const over = !!mem.overThreshold;
    const enabled = mem.compressEnabled !== false;
    const status = !enabled
        ? '压缩已关闭'
        : over
            ? '达到或超过阈值 — 本次演化流程会在记录后压缩已关闭的线程'
            : '未达阈值 — 已关闭的历史将被原样保留';
    return `
        <div class="rt-map-evo-debug-memory-bar${over ? ' is-over' : ''}${enabled ? '' : ' is-off'}">
            <div class="rt-map-evo-debug-stat">
                <span>已关闭线程令牌</span>
                <strong data-debug="closed-tokens">${escapeHtml(closed)} / ${escapeHtml(threshold)}</strong>
            </div>
            <div class="rt-map-evo-debug-stat">
                <span>开放线程（保留）</span>
                <strong>${escapeHtml(formatTokenCount(mem.openTokens))} tok · ${escapeHtml(String(mem.openCount || 0))}</strong>
            </div>
            <div class="rt-map-evo-debug-stat">
                <span>演化待办</span>
                <strong>${escapeHtml(formatTokenCount(mem.backlogTokens))} tok · ${escapeHtml(String(mem.backlogCount || 0))}</strong>
            </div>
            <div class="rt-map-evo-debug-stat">
                <span>存储记忆总量</span>
                <strong>${escapeHtml(formatTokenCount(mem.totalTokens))} tok · ${escapeHtml(String(mem.entryCount || 0))} 条事件${mem.digestCount ? ` · ${escapeHtml(String(mem.digestCount))} 条 digest` : ''}</strong>
            </div>
        </div>
        <p class="rt-map-evo-debug-memory-status">${escapeHtml(status)}</p>
    `;
}

function renderMemoryLedger(memory) {
    const mem = memory || {};
    const threadJson = prettyJson(mem.storedThreads || []);
    const backlogJson = prettyJson(mem.storedBacklog || []);
    const threadText = String(mem.threadText || '').trim() || '（未存储因果线程文本。）';
    const backlogText = String(mem.backlogText || '').trim() || '（未存储演化待办。）';
    return `
        <section class="rt-map-evo-debug-memory">
            <div class="rt-map-evo-debug-subtitle">存储的演化记忆</div>
            <p class="rt-map-evo-debug-lead">这是站点账本的实际存储内容。压缩衡量的是已关闭事件；DIGEST 行是压缩器的输出；当前打开的线程保持原样。</p>
            <div class="rt-map-evo-debug-memory-grid">
                <section>
                    <div class="rt-map-evo-debug-subtitle">因果线程（存储的 JSON）</div>
                    <pre class="rt-map-evo-debug-memory-pre" data-debug="threads-json">${escapeHtml(threadJson)}</pre>
                </section>
                <section>
                    <div class="rt-map-evo-debug-subtitle">演化待办（存储的 JSON）</div>
                    <pre class="rt-map-evo-debug-memory-pre" data-debug="backlog-json">${escapeHtml(backlogJson)}</pre>
                </section>
            </div>
            <div class="rt-map-evo-debug-subtitle">Evolution 读取到的因果线程</div>
            <pre class="rt-map-evo-debug-memory-pre" data-debug="threads-text">${escapeHtml(threadText)}</pre>
            <div class="rt-map-evo-debug-subtitle">Evolution 读取到的待办</div>
            <pre class="rt-map-evo-debug-memory-pre" data-debug="backlog-text">${escapeHtml(backlogText)}</pre>
        </section>
    `;
}

function renderThreads(threads) {
    const open = threads?.open || [];
    if (!open.length && !(threads?.entries || []).length) {
        return '<div class="rt-map-evo-debug-empty">尚无因果线程。为某人赋予原因进行击杀、伤害或移动即可开启一条。</div>';
    }
    const openHtml = open.length
        ? open.map(entry => `<li><span class="rt-map-evo-debug-open">OPEN</span> <code>${escapeHtml(entry.subjectId)}</code>${entry.actor ? ` by ${escapeHtml(entry.actor)}` : ''}: ${escapeHtml(entry.cause)} <time>${escapeHtml(entry.at)}</time></li>`).join('')
        : '<li class="rt-map-evo-debug-empty">没有开放的线程。</li>';
    const recentEntries = [...(threads?.entries || [])].reverse();
    const recent = recentEntries.map(entry => {
        const kind = entry.compressed ? 'compressed' : (entry.status || 'open');
        const label = entry.compressed ? 'DIGEST' : String(entry.status || 'open').toUpperCase();
        const badgeClass = entry.compressed ? 'rt-map-evo-debug-compressed' : `rt-map-evo-debug-${kind}`;
        return `<li><span class="${badgeClass}">${escapeHtml(label)}</span> ${escapeHtml(entry.summary)} <time>${escapeHtml(entry.at)}</time></li>`;
    }).join('');
    const truncated = threads?.truncated
        ? `<div class="rt-map-evo-debug-empty">较早的事件已超出存储历史上限而被丢弃。</div>`
        : '';
    return `<div class="rt-map-evo-debug-subtitle">开放线程</div><ul class="rt-map-evo-debug-list">${openHtml}</ul>
        <div class="rt-map-evo-debug-subtitle">已归属事件</div><ul class="rt-map-evo-debug-list">${recent || '<li class="rt-map-evo-debug-empty">无。</li>'}</ul>${truncated}`;
}

function renderAssets(document, selectedId = '') {
    const assets = Array.isArray(document?.assets) ? document.assets : [];
    if (!assets.length) return '<div class="rt-map-evo-debug-empty">此地图上没有资产。</div>';
    return `<ul class="rt-map-evo-debug-list">${assets.map(asset => {
        const cause = asset.cause ? ` — ${escapeHtml(asset.cause)}` : '';
        const actor = asset.actor ? ` by ${escapeHtml(asset.actor)}` : '';
        const since = asset.changed_at ? ` <time>${escapeHtml(asset.changed_at)}</time>` : '';
        const count = Number.isInteger(asset.count) ? ` ×${asset.count}` : '';
        const selected = asset.id === selectedId ? ' is-selected' : '';
        return `<li class="rt-map-evo-debug-asset${selected}" data-debug-arc="${escapeHtml(asset.id)}" title="跟踪此资产的轨迹"><code>${escapeHtml(asset.id)}</code> ${escapeHtml(asset.name)}${count} [${escapeHtml(asset.kind)} / ${escapeHtml(asset.state)} / ${escapeHtml(asset.location || '—')}]${actor}${cause}${since}</li>`;
    }).join('')}</ul>`;
}

function arcSubjectOptions(subjects, selectedId) {
    const blank = [{ id: '', label: '选择要跟踪的资产' }, ...subjects.map(subject => {
        const bits = [];
        if (subject.kind) bits.push(subject.kind);
        if (subject.state) bits.push(subject.state);
        if (!subject.onMap) bits.push('地图外');
        if (subject.open) bits.push('OPEN');
        if (subject.eventCount) bits.push(`${subject.eventCount} 个事件`);
        const extra = bits.length ? ` — ${bits.join(' · ')}` : '';
        return { id: subject.id, label: `${subject.name} (${subject.id})${extra}` };
    })];
    return optionList(blank, selectedId);
}

function renderAssetArc(sandbox, selectedId) {
    const storedThreads = sandbox?.memory?.storedThreads || [];
    const storedBacklog = sandbox?.memory?.storedBacklog || [];
    const subjects = collectEvolutionArcSubjects(storedThreads, sandbox?.document);
    if (!subjects.length) {
        return `<section class="rt-map-evo-debug-arc" data-debug="arc">
            <div class="rt-map-evo-debug-subtitle">资产轨迹</div>
            <div class="rt-map-evo-debug-empty">尚无资产或已归属事件可跟踪。</div>
        </section>`;
    }
    const chosen = String(selectedId || '').trim();
    const arc = chosen
        ? describeEvolutionAssetArc(storedThreads, chosen, { storedBacklog, document: sandbox?.document })
        : null;
    const occupancy = arc?.asset
        ? `<code>${escapeHtml(arc.asset.id)}</code> ${escapeHtml(arc.asset.name)}${Number.isInteger(arc.asset.count) ? ` ×${arc.asset.count}` : ''} [${escapeHtml(arc.asset.kind)} / ${escapeHtml(arc.asset.state)} / ${escapeHtml(arc.asset.location || '—')}]${arc.open ? ' · <span class="rt-map-evo-debug-open">OPEN</span>' : ''}`
        : chosen
            ? `<code>${escapeHtml(chosen)}</code> 不在当前地图上。${arc?.open ? ' 该线程仍处于 <span class="rt-map-evo-debug-open">OPEN</span> 状态。' : ''}`
            : '从列表或下拉框中选择一个资产。仅显示该主体的相关事件，包括它作用于他人之时，以及压缩后的 DIGEST 提及。';
    const events = (arc?.events || []).map(entry => {
        const kind = entry.compressed ? 'compressed' : (entry.status || 'open');
        const label = entry.compressed ? 'DIGEST' : String(entry.status || 'open').toUpperCase();
        const badgeClass = entry.compressed ? 'rt-map-evo-debug-compressed' : `rt-map-evo-debug-${kind}`;
        const role = entry.role === 'actor' ? '作为行动者' : entry.role === 'digest' ? '被提及' : '作为主体';
        return `<li>
            <time>${escapeHtml(entry.at)}</time>
            <span class="${badgeClass}">${escapeHtml(label)}</span>
            <span class="rt-map-evo-debug-arc-role">${escapeHtml(role)}</span>
            ${escapeHtml(stripEvolutionDigestSitePrefix(entry.summary, sandbox?.siteRoot))}
        </li>`;
    }).join('');
    const backlog = (arc?.backlogHits || []).map(entry => (
        `<li><time>${escapeHtml(entry.at)}</time> <span class="rt-map-evo-debug-transformed">BACKLOG</span> ${escapeHtml(stripEvolutionDigestSitePrefix(entry.summary, sandbox?.siteRoot))}</li>`
    )).join('');
    const empty = chosen && !events && !backlog
        ? '<div class="rt-map-evo-debug-empty">尚无存储事件提及此资产。</div>'
        : '';
    return `<section class="rt-map-evo-debug-arc" data-debug="arc">
        <div class="rt-map-evo-debug-subtitle">资产轨迹</div>
        <p class="rt-map-evo-debug-lead">跟踪一个资产经历占位变化的全过程。点击右侧的资产，或在此处选择。</p>
        <label class="rt-map-evo-debug-site">跟踪
            <select data-debug="arc-subject">${arcSubjectOptions(subjects, chosen)}</select>
        </label>
        <div class="rt-map-evo-debug-arc-now">${occupancy}</div>
        ${events ? `<ol class="rt-map-evo-debug-arc-list">${events}</ol>` : ''}
        ${backlog ? `<div class="rt-map-evo-debug-subtitle">匹配的演化待办</div><ul class="rt-map-evo-debug-list">${backlog}</ul>` : ''}
        ${empty}
    </section>`;
}

function areaOptions(document) {
    return (document?.areas || []).map(area => ({ id: area.id, label: `${area.name} (${area.id})` }));
}

function assetOptions(document) {
    return (document?.assets || []).map(asset => ({ id: asset.id, label: `${asset.name} [${asset.state}]` }));
}

/**
 * Open the Map Evolution testing ground for simulation and balancing.
 * @param {{ siteRoot?: string }} [options]
 */
export async function openMapEvolutionTestingGround({ siteRoot = '' } = {}) {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx?.callGenericPopup) return;

    const popup = document.createElement('div');
    popup.className = 'rt-map-evo-debug';
    let sandbox = await describeEvolutionSandbox(siteRoot);
    const settings = getSettings();
    let selectedArcId = '';

    const paint = () => {
        const areas = areaOptions(sandbox.document);
        const assets = assetOptions(sandbox.document);
        const lastPass = peekTestingGroundLastPass();
        popup.innerHTML = `
            <div class="rt-map-evo-debug-title"><i class="fa-solid fa-flask"></i> 地图演化测试场</div>
            <p class="rt-map-evo-debug-lead">无需通关战役即可推进时间、以原因生成或击杀实体并运行演化。 更改会写入本聊天的地图与 [TIME] 区块。 流程结束后，撤销可将地图、[TIME]、上次演化与演化记忆恢复到该次运行之前，以便你重做同一流程。 在比较提示词之前请先清除演化历史，以免先前的 tick 影响下一次流程。</p>
            <label class="rt-map-evo-debug-site">站点
                <select data-debug="site">${optionList(sandbox.sites.map(site => ({
                    id: site.siteRoot,
                    label: `${site.siteRoot}${site.current ? '（当前）' : ''}`,
                })), sandbox.siteRoot)}</select>
            </label>
            <div class="rt-map-evo-debug-stats">
                <div class="rt-map-evo-debug-stat">
                    <span>世界内时间</span>
                    <strong data-debug="time">${escapeHtml(sandbox.timeLabel || '未知')}</strong>
                </div>
                <div class="rt-map-evo-debug-stat">
                    <span>上次演化</span>
                    <strong>${escapeHtml(sandbox.lastEvolved || '从未')}</strong>
                </div>
                <div class="rt-map-evo-debug-stat">
                    <span>已流逝</span>
                    <strong>${escapeHtml(sandbox.timeWindow?.elapsed || '未知')}</strong>
                </div>
            </div>
            ${renderMemoryBar(sandbox.memory)}
            <div class="rt-map-evo-debug-row">
                <input type="text" data-debug="set-time" class="text_pole" placeholder="设置时间，例如 第 3 天 08:00" value="${escapeHtml(currentCampaignTimeLabel())}">
                <button type="button" class="menu_button" data-debug-action="set-time">设置时间</button>
                <input type="number" data-debug="hours" class="text_pole" min="1" max="168" value="${escapeHtml(String(settings.mapEvolutionIntervalHours ?? 8))}" title="要推进的小时数">
                <button type="button" class="menu_button" data-debug-action="advance-hours">推进小时</button>
                <button type="button" class="menu_button" data-debug-action="advance-day">+1 天</button>
            </div>
            <div class="rt-map-evo-debug-row">
                <button type="button" class="menu_button" data-debug-action="evolve"><i class="fa-solid fa-wand-magic-sparkles"></i> 立即演化此地图</button>
                <input type="number" data-debug="ticks" class="text_pole" min="1" max="20" value="3" title="模拟多少个 tick">
                <button type="button" class="menu_button" data-debug-action="simulate"><i class="fa-solid fa-forward"></i> 模拟 tick</button>
                <button type="button" class="menu_button" data-debug-action="undo-pass" title="将地图、[TIME]、上次演化与演化记忆恢复到最近一次演化或模拟运行之前。" ${!lastPass || lastPass.undone ? 'disabled' : ''}><i class="fa-solid fa-rotate-left"></i> 撤销上一次流程</button>
                <button type="button" class="menu_button" data-debug-action="redo-pass" title="恢复流程前的快照，然后再次运行相同的演化或模拟。" ${!lastPass ? 'disabled' : ''}><i class="fa-solid fa-rotate-right"></i> 重做上一次流程</button>
                <button type="button" class="menu_button" data-debug-action="clear-history" title="清除此站点的待办与因果线程。不会改变地图、[TIME] 或上次演化。"><i class="fa-solid fa-eraser"></i> 清除演化历史</button>
            </div>
            <div class="rt-map-evo-debug-status" data-debug="status" role="status"></div>
            <details class="rt-map-evo-debug-form" open>
                <summary>创建实体</summary>
                <div class="rt-map-evo-debug-form-grid">
                    <input type="text" data-debug="add-name" class="text_pole" placeholder="名称">
                    <select data-debug="add-kind">${optionList(MAP_ASSET_KINDS, 'CREATURE')}</select>
                    <select data-debug="add-location">${optionList(areas)}</select>
                    <input type="number" data-debug="add-count" class="text_pole" min="1" max="99" placeholder="数量（群组：2–99）">
                    <input type="text" data-debug="add-faction" class="text_pole" placeholder="阵营（可选）">
                    <input type="text" data-debug="add-cause" class="text_pole" placeholder="原因（必填）">
                    <input type="text" data-debug="add-actor" class="text_pole" placeholder="行动者（可选）">
                </div>
                <div class="rt-map-evo-debug-row">
                    <button type="button" class="menu_button" data-debug-action="add">添加到地图</button>
                </div>
            </details>
            <details class="rt-map-evo-debug-form" open>
                <summary>击杀 / 变更实体</summary>
                <div class="rt-map-evo-debug-form-grid">
                    <select data-debug="set-asset">${optionList(assets)}</select>
                    <select data-debug="set-state">${optionList(['DESTROYED', 'DEAD', 'DEACTIVATED', 'DAMAGED', 'FLEEING', 'LEFT', 'ACTIVE', 'ALERT'], 'DESTROYED')}</select>
                    <input type="number" data-debug="set-count" class="text_pole" min="1" max="99" placeholder="数量（损耗）">
                    <input type="text" data-debug="set-actor" class="text_pole" placeholder='行动者：队伍、资产 id 或 "salt-road-delvers"'>
                    <input type="text" data-debug="set-cause" class="text_pole" placeholder="原因，例如 被队伍击杀">
                </div>
                <div class="rt-map-evo-debug-row">
                    <button type="button" class="menu_button" data-debug-action="set">应用变更</button>
                </div>
            </details>
            <div class="rt-map-evo-debug-columns">
                <section>
                    <div class="rt-map-evo-debug-subtitle">因果线程</div>
                    <div class="rt-map-evo-debug-pane" data-debug="threads">${renderThreads(sandbox.threads)}</div>
                </section>
                <section>
                    <div class="rt-map-evo-debug-subtitle">资产</div>
                    <div class="rt-map-evo-debug-pane" data-debug="assets">${renderAssets(sandbox.document, selectedArcId)}</div>
                </section>
            </div>
            ${renderAssetArc(sandbox, selectedArcId)}
            ${renderMemoryLedger(sandbox.memory)}
        `;
        bind();
    };

    const setStatus = (text) => {
        const status = popup.querySelector('[data-debug="status"]');
        if (status) status.textContent = text || '';
    };

    const reload = async (root = popup.querySelector('[data-debug="site"]')?.value || sandbox.siteRoot) => {
        sandbox = await describeEvolutionSandbox(root);
        const subjects = collectEvolutionArcSubjects(sandbox?.memory?.storedThreads || [], sandbox?.document);
        if (selectedArcId && !subjects.some(subject => subject.id === selectedArcId)) selectedArcId = '';
        paint();
    };

    const bind = () => {
        popup.querySelector('[data-debug="site"]')?.addEventListener('change', async (event) => {
            await reload(event.target.value);
        });
        popup.querySelector('[data-debug-action="set-time"]')?.addEventListener('click', async () => {
            const result = setCampaignTimeLabel(popup.querySelector('[data-debug="set-time"]')?.value);
            setStatus(result.ok ? `已将时间设置为 ${result.timeLabel}。` : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="advance-hours"]')?.addEventListener('click', async () => {
            const hours = Number(popup.querySelector('[data-debug="hours"]')?.value) || 12;
            const result = advanceCampaignTime(hours * 60);
            setStatus(result.ok ? `已推进至 ${result.timeLabel}。` : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="advance-day"]')?.addEventListener('click', async () => {
            const result = advanceCampaignTime(1440);
            setStatus(result.ok ? `已推进至 ${result.timeLabel}。` : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="evolve"]')?.addEventListener('click', async () => {
            setStatus(`正在为 ${sandbox.siteRoot} 运行地图演化…`);
            const result = await debugRunEvolution(sandbox.siteRoot);
            if (result?.skipped === 'busy') setStatus('已有代理正在运行。');
            else if (result?.ok && result?.applied) setStatus(`演化应用了 ${result.applied} 项实质性更新。撤销可回退该流程。`);
            else if (result?.ok) setStatus('演化已运行；无实质性变化。撤销可回退该流程。');
            else setStatus(result?.error || '演化失败。');
            await reload();
        });
        popup.querySelector('[data-debug-action="simulate"]')?.addEventListener('click', async () => {
            const ticks = Number(popup.querySelector('[data-debug="ticks"]')?.value) || 3;
            const hours = Number(popup.querySelector('[data-debug="hours"]')?.value) || Number(getSettings().mapEvolutionIntervalHours) || 8;
            setStatus(`正在以 ${hours} 小时模拟 ${ticks} 个 tick…`);
            const result = await debugSimulateTicks({
                siteRoot: sandbox.siteRoot,
                ticks,
                hoursPerTick: hours,
                onTick: ({ index, count, timeLabel, phase }) => {
                    setStatus(`tick ${index + 1}/${count}（${phase}）于 ${timeLabel}…`);
                },
            });
            if (!result.ok) setStatus(result.error || '模拟已停止。');
            else setStatus(`已模拟 ${result.ticks} 个 tick（每个 ${result.hoursPerTick} 小时）。撤销可回退该次运行。`);
            await reload();
        });
        popup.querySelector('[data-debug-action="undo-pass"]')?.addEventListener('click', async () => {
            setStatus('正在恢复流程前的快照…');
            const result = await debugUndoLastEvolutionPass();
            if (result?.skipped === 'busy') setStatus('已有代理正在运行。');
            else if (result.ok) {
                const kind = result.action?.type === 'simulate' ? '模拟 tick' : '演化';
                setStatus(`已在 ${result.siteRoot} 上撤销${kind}。重做可再次运行同一流程。`);
            } else setStatus(result.error || '撤销失败。');
            await reload();
        });
        popup.querySelector('[data-debug-action="redo-pass"]')?.addEventListener('click', async () => {
            const prior = peekTestingGroundLastPass();
            const kind = prior?.action?.type === 'simulate' ? '模拟 tick' : '演化';
            setStatus(`正在重做${kind}…`);
            const result = await debugRedoLastEvolutionPass({
                onTick: ({ index, count, timeLabel, phase }) => {
                    setStatus(`重做 tick ${index + 1}/${count}（${phase}）于 ${timeLabel}…`);
                },
            });
            if (result?.skipped === 'busy') setStatus('已有代理正在运行。');
            else if (result?.ok && result?.action?.type === 'simulate') setStatus(`已重做模拟：${result.ticks} 个 tick（每个 ${result.hoursPerTick} 小时）。`);
            else if (result?.ok && result?.applied) setStatus(`已重做演化：应用了 ${result.applied} 项实质性更新。`);
            else if (result?.ok) setStatus('已重做演化；无实质性变化。');
            else setStatus(result?.error || '重做失败。');
            await reload();
        });
        popup.querySelector('[data-debug-action="clear-history"]')?.addEventListener('click', async () => {
            const root = sandbox.siteRoot;
            const confirmed = window.confirm(`确定要为 "${root}" 清除演化待办与因果线程吗？\n\n地图占位、[TIME] 与上次演化时钟保持不变。这只会移除提示历史，使后续演化流程不会受到先前提示中 tick 的影响。`);
            if (!confirmed) return;
            const result = debugClearEvolutionHistory(root);
            setStatus(result.ok ? `已清除 ${root} 的演化历史。` : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="add"]')?.addEventListener('click', async () => {
            const result = await debugAddAsset({
                siteRoot: sandbox.siteRoot,
                name: popup.querySelector('[data-debug="add-name"]')?.value,
                kind: popup.querySelector('[data-debug="add-kind"]')?.value,
                location: popup.querySelector('[data-debug="add-location"]')?.value,
                count: popup.querySelector('[data-debug="add-count"]')?.value,
                faction: popup.querySelector('[data-debug="add-faction"]')?.value,
                cause: popup.querySelector('[data-debug="add-cause"]')?.value,
                actor: popup.querySelector('[data-debug="add-actor"]')?.value,
            });
            setStatus(result.ok ? '实体已添加。' : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="set"]')?.addEventListener('click', async () => {
            const result = await debugSetAsset({
                siteRoot: sandbox.siteRoot,
                assetId: popup.querySelector('[data-debug="set-asset"]')?.value,
                state: popup.querySelector('[data-debug="set-state"]')?.value,
                count: popup.querySelector('[data-debug="set-count"]')?.value,
                actor: popup.querySelector('[data-debug="set-actor"]')?.value,
                cause: popup.querySelector('[data-debug="set-cause"]')?.value,
            });
            setStatus(result.ok ? '实体已更新。' : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug="arc-subject"]')?.addEventListener('change', (event) => {
            selectedArcId = String(event.target.value || '').trim();
            paintArc();
        });
        popup.querySelectorAll('[data-debug-arc]').forEach(node => {
            node.addEventListener('click', () => {
                selectedArcId = String(node.getAttribute('data-debug-arc') || '').trim();
                paintArc();
            });
        });
    };

    const paintArc = () => {
        const host = popup.querySelector('[data-debug="arc"]');
        if (host) host.outerHTML = renderAssetArc(sandbox, selectedArcId);
        popup.querySelectorAll('[data-debug-arc]').forEach(node => {
            node.classList.toggle('is-selected', node.getAttribute('data-debug-arc') === selectedArcId);
        });
        popup.querySelector('[data-debug="arc-subject"]')?.addEventListener('change', (event) => {
            selectedArcId = String(event.target.value || '').trim();
            paintArc();
        });
    };

    paint();
    await ctx.callGenericPopup(popup, ctx.POPUP_TYPE?.TEXT ?? 1, '', {
        okButton: '关闭', cancelButton: false, wide: true, large: true,
        allowVerticalScrolling: true,
        leftAlign: true,
    });
}
