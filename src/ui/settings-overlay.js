/**
 * settings-overlay.js — Multihog D&D Framework
 *
 * External (floating) settings window with a left tab rail.
 * Directionally based on the Fatbody full-screen overlay prototype, but sized
 * as a centered panel rather than a literal fullscreen takeover.
 *
 * The extensions-panel stub keeps a short entry point; the full settings.html
 * markup is injected here once at init — before index.js binds controls by ID.
 *
 * Imports: state-manager.js, FOLDER_NAME via deps
 * Imported by: index.js
 */

import { getSettings } from '../../state-manager.js';
import { saveSettings } from '../app/runtime-bridge.js';
import {
    clearSettingsSearch,
    handleSettingsSearchKeydown,
    installSettingsSearch,
} from './settings-search.js';

/** @type {{ id: string, icon: string, label: string, match: RegExp }[]} */
const TAB_DEFS = [
    { id: 'general', icon: 'fa-gears', label: '通用与视觉', match: /General\s*&\s*Visuals|常规与外观/i },
    { id: 'connections', icon: 'fa-plug', label: '连接', match: /Connections|连接与模型/i },
    { id: 'gamesystems', icon: 'fa-dice-d20', label: '游戏系统', match: /Game Systems|游戏系统与自定义/i },
    { id: 'statetracker', icon: 'fa-brain', label: '状态追踪器', match: /State Tracker|状态追踪器与模块/i },
    { id: 'agent', icon: 'fa-route', label: '世界书代理', match: /Lorebook Agent|世界书代理/i },
    { id: 'maparchitect', icon: 'fa-map', label: '持久地图', match: /Persistent Maps|持久地图/i },
    { id: 'worldprog', icon: 'fa-globe', label: '世界进展', match: /World Progression|世界进程/i },
    { id: 'companion', icon: 'fa-comments', label: '冒险伙伴', match: /Adventure Companion|冒险伙伴/i },
];

let _lastTab = 'general';
let _folderName = 'SillyTavern-MultihogDnDFramework';

/**
 * @returns {'dark'|'light'}
 */
export function getSettingsOverlayAppearance() {
    const raw = String(getSettings()?.settingsOverlayAppearance || 'light').toLowerCase();
    return raw === 'dark' ? 'dark' : 'light';
}

/**
 * Apply locked dark/light chrome to the overlay (never inherits ST / tracker theme colors).
 * @param {'dark'|'light'} [mode]
 */
export function applySettingsOverlayAppearance(mode) {
    const overlay = document.getElementById('rt-settings-overlay');
    if (!overlay) return;
    const resolved = mode === 'light' || mode === 'dark' ? mode : getSettingsOverlayAppearance();
    overlay.classList.remove('rt-so-mode-dark', 'rt-so-mode-light');
    overlay.classList.add(`rt-so-mode-${resolved}`);
    overlay.querySelectorAll('.rt-so-appearance-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === resolved);
    });
}

/**
 * Persist + apply locked settings-window appearance.
 * @param {'dark'|'light'} mode
 */
export function setSettingsOverlayAppearance(mode) {
    const resolved = mode === 'light' ? 'light' : 'dark';
    const s = getSettings();
    s.settingsOverlayAppearance = resolved;
    applySettingsOverlayAppearance(resolved);
    try { void saveSettings(); } catch (_) { /* non-fatal */ }
}

/**
 * Appearance toggle pinned to the top of the General & Visuals tab.
 * @param {HTMLElement} tabsHost
 */
function installAppearanceToggle(tabsHost) {
    const general = tabsHost.querySelector('.rt-settings-tab[data-tab="general"]');
    if (!(general instanceof HTMLElement)) return;
    if (general.querySelector('.rt-so-appearance-bar')) return;

    const bar = document.createElement('div');
    bar.className = 'rt-so-appearance-bar';
    bar.innerHTML = `
        <div class="rt-so-appearance-label">
            <span>设置窗口外观</span>
            <i class="fa-solid fa-circle-question" title="仅为该设置窗口锁定深色/浅色外观，防止 SillyTavern / 追踪器主题色让菜单无法阅读。"></i>
        </div>
        <div class="rt-so-appearance-seg" role="group" aria-label="设置窗口外观">
            <button type="button" class="rt-so-appearance-btn" data-mode="dark"><i class="fa-solid fa-moon"></i> 深色</button>
            <button type="button" class="rt-so-appearance-btn" data-mode="light"><i class="fa-solid fa-sun"></i> 浅色</button>
        </div>`;
    general.insertBefore(bar, general.firstChild);

    bar.querySelectorAll('.rt-so-appearance-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            setSettingsOverlayAppearance(btn.dataset.mode === 'light' ? 'light' : 'dark');
        });
    });
    applySettingsOverlayAppearance(getSettingsOverlayAppearance());
}

/** Soft night gradient for the panel chrome (not a fullscreen stage). */
function backgroundSvg() {
    return `
<svg class="rt-so-bg-svg" viewBox="0 0 960 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="rtso-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0e18"/>
      <stop offset="0.55" stop-color="#151222"/>
      <stop offset="1" stop-color="#1c1410"/>
    </linearGradient>
    <radialGradient id="rtso-glow" cx="0.72" cy="0.28" r="0.55">
      <stop offset="0" stop-color="#ff9a2a" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#e0561a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="960" height="640" fill="url(#rtso-sky)"/>
  <ellipse cx="700" cy="180" rx="320" ry="220" fill="url(#rtso-glow)"/>
  <path d="M0,520 L120,500 L260,518 L400,492 L560,516 L720,490 L960,520 L960,640 L0,640 Z" fill="#06070c" opacity="0.9"/>
</svg>`;
}

/**
 * Map a primary settings drawer to a tab id via its header label.
 * @param {Element} drawer
 */
function resolveTabId(drawer) {
    const label = drawer.querySelector(':scope > .inline-drawer-toggle b')?.textContent?.trim() || '';
    const hit = TAB_DEFS.find(t => t.match.test(label));
    return hit?.id || null;
}

/**
 * @param {HTMLElement} tabsHost
 * @param {string} tabId
 * @returns {HTMLElement}
 */
function ensureTabPane(tabsHost, tabId) {
    let tab = tabsHost.querySelector(`.rt-settings-tab[data-tab="${tabId}"]`);
    if (!tab) {
        tab = document.createElement('div');
        tab.className = 'rt-settings-tab';
        tab.dataset.tab = tabId;
        tabsHost.appendChild(tab);
    }
    const def = TAB_DEFS.find(t => t.id === tabId);
    tab.dataset.tabLabel = def?.label || tabId;
    return tab;
}

/**
 * Expand the top-level drawer inside a tab so its content is immediately usable.
 * @param {HTMLElement} tab
 */
function expandPrimaryDrawer(tab) {
    const drawer = tab.querySelector(':scope > .inline-drawer');
    if (!drawer) return;
    drawer.classList.add('open');
    const content = drawer.querySelector(':scope > .inline-drawer-content');
    if (content instanceof HTMLElement) {
        content.style.display = 'block';
        content.style.overflow = 'visible';
        content.style.height = 'auto';
    }
    drawer.querySelector(':scope > .inline-drawer-toggle .inline-drawer-icon')?.classList.add('down');
}

/**
 * Build the floating settings window and inject settings markup into tab panes.
 * Must run BEFORE index.js binds settings controls by ID.
 *
 * @param {string} settingsHtml - rendered settings.html
 * @param {{ folderName?: string }} [opts]
 */
export function initSettingsOverlay(settingsHtml, opts = {}) {
    if (opts.folderName) _folderName = opts.folderName;

    document.getElementById('rt-settings-overlay')?.remove();

    const host = document.createElement('div');
    host.innerHTML = settingsHtml;
    const settingsRoot = host.querySelector('.rpg-tracker-settings');
    if (!settingsRoot) {
        console.warn('[RPG Tracker] settings-overlay: .rpg-tracker-settings missing from markup');
        return;
    }

    const frameworkContent = settingsRoot.querySelector(':scope > .inline-drawer > .inline-drawer-content')
        || settingsRoot;
    const primaryDrawers = [...frameworkContent.children].filter(
        (el) => el instanceof HTMLElement && el.classList.contains('inline-drawer'),
    );

    const tabsHost = document.createElement('div');
    tabsHost.className = 'rpg-tracker-settings rt-so-settings-root';

    for (const drawer of primaryDrawers) {
        const tabId = resolveTabId(drawer);
        if (!tabId) {
            // Unmatched primary drawers still ship (appended under general).
            ensureTabPane(tabsHost, 'general').appendChild(drawer);
            continue;
        }
        const tab = ensureTabPane(tabsHost, tabId);
        tab.appendChild(drawer);
        expandPrimaryDrawer(tab);
    }

    // Preserve any non-drawer nodes (comments / whitespace ignored).
    for (const node of [...frameworkContent.childNodes]) {
        if (node.nodeType === Node.ELEMENT_NODE && !(/** @type {Element} */ (node)).classList?.contains('inline-drawer')) {
            ensureTabPane(tabsHost, 'general').appendChild(node);
        }
    }

    const overlay = document.createElement('div');
    overlay.id = 'rt-settings-overlay';
    overlay.className = 'rt-settings-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="rt-so-dim" data-rt-so-close="1"></div>
        <div class="rt-so-panel" role="dialog" aria-modal="true" aria-label="Multihog D&D 框架设置">
            <div class="rt-so-bg">${backgroundSvg()}</div>
            <div class="rt-so-header">
                <div class="rt-so-title"><i class="fa-solid fa-dungeon"></i> Multihog D&amp;D 框架 — 设置</div>
                <div class="rt-so-search">
                    <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    <input type="search" id="rt-so-search-input" placeholder="搜索设置…" autocomplete="off" spellcheck="false" aria-label="搜索设置" />
                    <button type="button" id="rt-so-search-clear" class="rt-so-search-clear" hidden title="清除搜索" aria-label="清除搜索">&times;</button>
                </div>
                <button type="button" id="rt-so-close" class="menu_button interactable" title="关闭 (Esc)">✕</button>
            </div>
            <div class="rt-so-body">
                <nav class="rt-so-tabs" aria-label="设置分区"></nav>
                <div class="rt-so-content">
                    <div class="rt-so-search-empty" hidden role="status" aria-live="polite"></div>
                </div>
            </div>
        </div>`;

    const nav = overlay.querySelector('.rt-so-tabs');
    for (const t of TAB_DEFS) {
        // Only show tabs that have content.
        if (!tabsHost.querySelector(`.rt-settings-tab[data-tab="${t.id}"]`)) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rt-so-tab-btn';
        btn.dataset.tab = t.id;
        btn.innerHTML = `<i class="fa-solid ${t.icon}"></i><span>${t.label}</span><span class="rt-so-tab-count" hidden></span>`;
        nav.appendChild(btn);
    }

    overlay.querySelector('.rt-so-content').appendChild(tabsHost);
    installAppearanceToggle(tabsHost);
    document.body.appendChild(overlay);
    applySettingsOverlayAppearance(getSettingsOverlayAppearance());
    installSettingsSearch(overlay, { onCleared: () => switchSettingsOverlayTab(_lastTab) });

    overlay.querySelectorAll('.rt-so-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => switchSettingsOverlayTab(btn.dataset.tab));
    });
    overlay.querySelector('#rt-so-close')?.addEventListener('click', closeSettingsOverlay);
    overlay.querySelector('.rt-so-dim')?.addEventListener('click', closeSettingsOverlay);

    if (!globalThis.__rtSettingsOverlayEscBound) {
        globalThis.__rtSettingsOverlayEscBound = true;
        document.addEventListener('keydown', (e) => {
            const open = document.getElementById('rt-settings-overlay');
            handleSettingsSearchKeydown(e, open, {
                close: closeSettingsOverlay,
                restoreTab: () => switchSettingsOverlayTab(_lastTab),
            });
        });
    }

    installPanelDrag(overlay);
    switchSettingsOverlayTab(_lastTab);
}

function isCompactSettingsViewport() {
    return typeof window !== 'undefined'
        && !!window.matchMedia?.('(max-width: 720px)')?.matches;
}

/**
 * Clear drag-pinned coords so flex/safe-area centering can place the panel again.
 * @param {HTMLElement} overlay
 */
function resetSettingsPanelGeometry(overlay) {
    const panel = overlay.querySelector('.rt-so-panel');
    if (!(panel instanceof HTMLElement)) return;
    panel.style.left = '';
    panel.style.top = '';
    panel.style.transform = '';
    panel.style.width = '';
    panel.style.height = '';
    panel.classList.remove('rt-so-panel-positioned', 'rt-so-panel-dragging');
}

/**
 * Lightweight drag by header so the window feels external/detached.
 * Disabled on compact/mobile viewports (near-fullscreen sheet).
 * @param {HTMLElement} overlay
 */
function installPanelDrag(overlay) {
    const panel = overlay.querySelector('.rt-so-panel');
    const header = overlay.querySelector('.rt-so-header');
    if (!(panel instanceof HTMLElement) || !(header instanceof HTMLElement)) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    header.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('button, input, textarea, .rt-so-search')) return;
        if (isCompactSettingsViewport()) return;
        const rect = panel.getBoundingClientRect();
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        origLeft = rect.left;
        origTop = rect.top;
        panel.style.left = `${origLeft}px`;
        panel.style.top = `${origTop}px`;
        panel.style.transform = 'none';
        panel.classList.add('rt-so-panel-positioned', 'rt-so-panel-dragging');
        header.setPointerCapture?.(e.pointerId);
    });

    header.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const maxL = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
        const maxT = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
        panel.style.left = `${Math.min(maxL, Math.max(8, origLeft + dx))}px`;
        panel.style.top = `${Math.min(maxT, Math.max(8, origTop + dy))}px`;
    });

    const endDrag = () => {
        dragging = false;
        panel.classList.remove('rt-so-panel-dragging');
    };
    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);

    if (!globalThis.__rtSettingsOverlayResizeBound) {
        globalThis.__rtSettingsOverlayResizeBound = true;
        window.addEventListener('resize', () => {
            const open = document.getElementById('rt-settings-overlay');
            if (open?.classList.contains('rt-so-open') && isCompactSettingsViewport()) {
                resetSettingsPanelGeometry(open);
            }
        });
    }
}

/**
 * @param {string} [tabId]
 */
export function switchSettingsOverlayTab(tabId) {
    const overlay = document.getElementById('rt-settings-overlay');
    if (!overlay) return;
    if (!TAB_DEFS.some(t => t.id === tabId) || !overlay.querySelector(`.rt-settings-tab[data-tab="${tabId}"]`)) {
        tabId = overlay.querySelector('.rt-so-tab-btn')?.dataset?.tab || TAB_DEFS[0].id;
    }
    _lastTab = tabId;
    overlay.querySelectorAll('.rt-so-tab-btn').forEach((b) => {
        b.classList.toggle('rt-so-tab-active', b.dataset.tab === tabId);
    });
    if (overlay.classList.contains('rt-so-searching')) {
        overlay.querySelector(`.rt-settings-tab[data-tab="${tabId}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    overlay.querySelectorAll('.rt-settings-tab').forEach((s) => {
        const show = s.dataset.tab === tabId;
        s.style.display = show ? 'block' : 'none';
        if (show) expandPrimaryDrawer(/** @type {HTMLElement} */ (s));
    });
}

export function openSettingsOverlay(tabId) {
    const overlay = document.getElementById('rt-settings-overlay');
    if (!overlay) return;
    resetSettingsPanelGeometry(overlay);
    overlay.classList.add('rt-so-open');
    overlay.setAttribute('aria-hidden', 'false');
    applySettingsOverlayAppearance(getSettingsOverlayAppearance());
    if (tabId) switchSettingsOverlayTab(tabId);
    else switchSettingsOverlayTab(_lastTab);
}

export function closeSettingsOverlay() {
    const overlay = document.getElementById('rt-settings-overlay');
    if (!overlay) return;
    clearSettingsSearch(overlay);
    switchSettingsOverlayTab(_lastTab);
    overlay.classList.remove('rt-so-open');
    overlay.setAttribute('aria-hidden', 'true');
}

/** @returns {HTMLElement|null} */
export function getSettingsOverlayRoot() {
    return document.querySelector('#rt-settings-overlay .rpg-tracker-settings');
}
