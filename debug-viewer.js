/**
 * debug-viewer.js — Multihog D&D Framework
 * A high-fidelity context viewer for inspecting LLM input and output.
 */

import { escapeHtml } from './memo-processor.js';

let transactions = [];
let isOpen = false;
let debugPanel = null;
const expandedSections = new Set();
const PREVIEW_CHARS = 280;

export function initializeDebugViewer() {
    if (debugPanel) return;

    debugPanel = document.createElement('div');
    debugPanel.id = 'rpg-debug-viewer';
    debugPanel.className = 'rpg-debug-viewer';
    debugPanel.style.display = 'none';

    debugPanel.innerHTML = `
        <div class="rt-resizer-tr" id="rt-debug-resizer-tr" title="从右上角调整大小"></div>
        <div class="rt-resizer-br" id="rt-debug-resizer-br" title="从右下角调整大小"></div>
        <div class="rpg-debug-header">
            <div class="rpg-debug-header-left">
                <span class="rpg-debug-icon">🛠️</span>
                <span class="rpg-debug-title">上下文调试器</span>
            </div>
            <div class="rpg-debug-header-right">
                <button type="button" id="rpg-debug-expand-all" title="展开全部区块">▾▾</button>
                <button type="button" id="rpg-debug-collapse-all" title="折叠全部区块">▸▸</button>
                <button type="button" id="rpg-debug-clear" title="清除历史记录">🧹</button>
                <button type="button" id="rpg-debug-close">✕</button>
            </div>
        </div>
        <div class="rpg-debug-content">
            <div class="rpg-debug-empty">暂无交易记录。</div>
        </div>
    `;

    document.body.appendChild(debugPanel);

    const GEO_KEY = 'rpg_tracker_geometry_debug_viewer';

    try {
        const saved = JSON.parse(localStorage.getItem(GEO_KEY));
        if (saved && saved.left !== undefined) {
            const left = Math.max(0, Math.min(window.innerWidth - 50, saved.left));
            const top = Math.max(0, Math.min(window.innerHeight - 50, saved.top));
            debugPanel.style.left = left + 'px';
            debugPanel.style.top = top + 'px';
            if (saved.width) debugPanel.style.width = saved.width + 'px';
            if (saved.height) debugPanel.style.height = saved.height + 'px';
        }
    } catch (_) {}

    const saveGeometry = () => {
        const rect = debugPanel.getBoundingClientRect();
        localStorage.setItem(GEO_KEY, JSON.stringify({
            left: rect.left, top: rect.top,
            width: rect.width, height: rect.height,
        }));
    };

    debugPanel.querySelector('#rpg-debug-close').onclick = () => toggleDebugViewer(false);
    debugPanel.querySelector('#rpg-debug-clear').onclick = () => {
        transactions = [];
        expandedSections.clear();
        renderTransactions();
    };
    debugPanel.querySelector('#rpg-debug-expand-all').onclick = () => {
        for (const key of collectSectionKeys()) expandedSections.add(key);
        renderTransactions();
    };
    debugPanel.querySelector('#rpg-debug-collapse-all').onclick = () => {
        expandedSections.clear();
        renderTransactions();
    };

    debugPanel.addEventListener('click', (e) => {
        const section = e.target.closest('.rpg-debug-section');
        if (!section || !debugPanel.contains(section)) return;
        if (e.target.closest('button') && !e.target.closest('.rpg-debug-section-toggle')) return;
        const key = section.getAttribute('data-section-key');
        if (!key) return;
        const clickingText = e.target.closest('.rpg-debug-text');
        if (clickingText && section.classList.contains('rpg-debug-section-open')) return;
        if (expandedSections.has(key)) expandedSections.delete(key);
        else expandedSections.add(key);
        renderTransactions();
    });

    const header = debugPanel.querySelector('.rpg-debug-header');
    let isDragging = false;
    let dragStartX, dragStartY, dragStartLeft, dragStartTop;

    header.onpointerdown = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('button')) return;
        isDragging = true;
        header.setPointerCapture(e.pointerId);
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = debugPanel.getBoundingClientRect();
        dragStartLeft = rect.left;
        dragStartTop = rect.top;
        e.preventDefault();
    };

    header.onpointermove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        debugPanel.style.left = (dragStartLeft + dx) + 'px';
        debugPanel.style.top = (dragStartTop + dy) + 'px';
    };

    const stopDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        if (e) {
            try { header.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        saveGeometry();
    };

    header.onpointerup = stopDrag;
    header.onpointercancel = stopDrag;

    const resizerTR = debugPanel.querySelector('#rt-debug-resizer-tr');
    const resizerBR = debugPanel.querySelector('#rt-debug-resizer-br');

    const setupResizer = (handle, type) => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startTop, startLeft;

        const stopResize = (e) => {
            if (!isResizing) return;
            isResizing = false;
            if (e) {
                try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
            }
            saveGeometry();
        };

        handle.onpointerdown = (e) => {
            if (e.button !== 0) return;
            isResizing = true;
            handle.setPointerCapture(e.pointerId);
            const rect = debugPanel.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startWidth = rect.width;
            startHeight = rect.height;
            startTop = rect.top;
            startLeft = rect.left;
            debugPanel.style.left = startLeft + 'px';
            debugPanel.style.top = startTop + 'px';
            e.preventDefault();
            e.stopPropagation();
        };

        handle.onpointermove = (e) => {
            if (!isResizing) return;
            if (e.buttons === 0) {
                stopResize(e);
                return;
            }
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (type === 'TR') {
                const newWidth = Math.max(300, startWidth + dx);
                const newHeight = Math.max(200, startHeight - dy);
                const newTop = startTop + dy;
                debugPanel.style.width = newWidth + 'px';
                if (newHeight > 200) {
                    debugPanel.style.height = newHeight + 'px';
                    debugPanel.style.top = newTop + 'px';
                }
            } else if (type === 'BR') {
                const newWidth = Math.max(300, startWidth + dx);
                const newHeight = Math.max(200, startHeight + dy);
                debugPanel.style.width = newWidth + 'px';
                debugPanel.style.height = newHeight + 'px';
            }
        };

        handle.onpointerup = stopResize;
        handle.onpointercancel = stopResize;
    };

    if (resizerTR) setupResizer(resizerTR, 'TR');
    if (resizerBR) setupResizer(resizerBR, 'BR');
}

export function toggleDebugViewer(force) {
    if (!debugPanel) initializeDebugViewer();
    isOpen = force !== undefined ? force : !isOpen;
    if (debugPanel) {
        debugPanel.style.display = isOpen ? 'flex' : 'none';
        if (isOpen) renderTransactions();
    }
}

export function logTransaction(source, messages, response = null) {
    const transaction = {
        timestamp: new Date().toLocaleTimeString(),
        source,
        messages,
        response,
        id: Date.now(),
    };

    transactions.unshift(transaction);
    if (transactions.length > 10) {
        const dropped = transactions.pop();
        for (const key of [...expandedSections]) {
            if (String(key).startsWith(`${dropped.id}:`)) expandedSections.delete(key);
        }
    }

    if (isOpen) renderTransactions();
}

function sourceBadgeStyle(source) {
    const label = String(source || 'Tracker');
    if (/architect/i.test(label)) return { bg: 'rgba(212, 169, 64, 0.2)', fg: '#d4a940' };
    if (/evolution/i.test(label)) return { bg: 'rgba(80, 140, 255, 0.2)', fg: '#7eb0ff' };
    if (/tracker/i.test(label)) return { bg: 'rgba(0, 255, 170, 0.2)', fg: '#00ffaa' };
    return { bg: 'rgba(255, 150, 0, 0.2)', fg: '#ffaa00' };
}

function previewText(text) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (compact.length <= PREVIEW_CHARS) return compact;
    return compact.slice(0, PREVIEW_CHARS) + '…';
}

function sectionKey(transactionId, kind) {
    return `${transactionId}:${kind}`;
}

function collectSectionKeys() {
    const keys = [];
    for (const t of transactions) {
        (t.messages || []).forEach((m, i) => {
            keys.push(sectionKey(t.id, `${m.role === 'system' ? 'system' : 'user'}:${i}`));
        });
        if (t.response) keys.push(sectionKey(t.id, 'response'));
    }
    return keys;
}

function renderSection(transactionId, kind, label, roleClass, text) {
    const key = sectionKey(transactionId, kind);
    const open = expandedSections.has(key);
    const body = String(text || '');
    return `
        <div class="rpg-debug-section${kind === 'response' ? ' rpg-debug-section-response' : ''}${open ? ' rpg-debug-section-open' : ''}" data-section-key="${escapeHtml(key)}">
            <button type="button" class="rpg-debug-section-toggle rpg-debug-label ${roleClass}" aria-expanded="${open ? 'true' : 'false'}">
                <i class="fa-solid fa-chevron-right rpg-debug-chevron" aria-hidden="true"></i>
                <span>${label}</span>
                <span class="rpg-debug-section-chars">${body.length.toLocaleString()} chars</span>
            </button>
            <div class="rpg-debug-text-preview">${escapeHtml(previewText(body))}</div>
            <div class="rpg-debug-text${kind === 'response' ? ' response' : ''}">${escapeHtml(body)}</div>
        </div>`;
}

function renderTransactions() {
    if (!debugPanel) return;
    const content = debugPanel.querySelector('.rpg-debug-content');
    if (!content) return;
    if (transactions.length === 0) {
        content.innerHTML = '<div class="rpg-debug-empty">暂无交易记录。</div>';
        return;
    }

    const scrollTop = content.scrollTop;
    content.innerHTML = transactions.map(t => {
        const badge = sourceBadgeStyle(t.source);
        const messageHtml = (t.messages || []).map((m, i) => renderSection(
            t.id,
            `${m.role === 'system' ? 'system' : 'user'}:${i}`,
            m.role === 'system' ? '系统提示词' : '用户消息',
            m.role === 'system' ? 'system' : 'input',
            m.content,
        )).join('');
        const responseHtml = t.response
            ? renderSection(t.id, 'response', 'AI 响应', 'output', t.response)
            : '';
        return `
        <div class="rpg-debug-transaction" data-id="${t.id}">
            <div class="rpg-debug-trans-header">
                <span class="rpg-debug-time">${escapeHtml(String(t.timestamp || ''))}</span>
                <span class="rpg-debug-source" style="background:${badge.bg};color:${badge.fg};">${escapeHtml(String(t.source || 'Tracker').toUpperCase())}</span>
            </div>
            <div class="rpg-debug-trans-body">
                ${messageHtml}
                ${responseHtml}
            </div>
        </div>`;
    }).join('');
    content.scrollTop = scrollTop;
}
