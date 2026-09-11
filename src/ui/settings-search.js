/**
 * settings-search.js — Multihog D&D Framework
 *
 * Keyword search for the floating settings window. Filters nested drawers
 * across tabs so a setting can be found without knowing which section it lives in.
 *
 * Imported by: settings-overlay.js
 */

const HIDDEN_CLASS = 'rt-so-search-hidden';
const HIT_CLASS = 'rt-so-search-hit';
const TAB_MATCH_CLASS = 'rt-so-tab-has-match';
const SEARCHING_CLASS = 'rt-so-searching';

const ATOMIC_SELECTOR = [
    'label',
    'button',
    'select',
    'textarea',
    'small',
    'input',
    '.checkbox_label',
    '.rt-seg-toggle',
    '.rt-so-appearance-bar',
    '.rt-so-appearance-seg',
    '.rt-connection-recommendation',
    '.rt-loc-settings-intro',
    '.rt-loc-realtime-feature-title',
].join(',');

/**
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeQuery(query) {
    return String(query || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(token => token.length > 0);
}

/**
 * AND-match: every token must appear in the haystack.
 * @param {string} haystack
 * @param {string[]} tokens
 */
export function haystackMatches(haystack, tokens) {
    if (!tokens.length) return true;
    const hay = String(haystack || '').toLowerCase();
    if (!hay) return false;
    return tokens.every(token => hay.includes(token));
}

/**
 * Visible labels, help titles, and placeholders — not live textarea/input values
 * (those are user/prompt payloads and would drown the results).
 * @param {Element} el
 * @returns {string}
 */
export function haystackFrom(el) {
    if (!(el instanceof Element)) return '';
    const bits = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (parent?.closest('textarea, script, style, .rt-so-search-tab-caption')) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        },
    });
    let node = walker.nextNode();
    while (node) {
        const text = node.nodeValue?.trim();
        if (text) bits.push(text);
        node = walker.nextNode();
    }
    el.querySelectorAll('[title], [placeholder], [aria-label]').forEach((item) => {
        for (const attr of ['title', 'placeholder', 'aria-label']) {
            const value = item.getAttribute(attr);
            if (value?.trim()) bits.push(value.trim());
        }
    });
    for (const attr of ['title', 'placeholder', 'aria-label']) {
        const value = el.getAttribute(attr);
        if (value?.trim()) bits.push(value.trim());
    }
    return bits.join(' ');
}

function ownHaystack(el) {
    if (!(el instanceof Element)) return '';
    const bits = [];
    for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && child.nodeValue?.trim()) {
            bits.push(child.nodeValue.trim());
        }
    }
    for (const attr of ['title', 'placeholder', 'aria-label']) {
        const value = el.getAttribute(attr);
        if (value?.trim()) bits.push(value.trim());
    }
    return bits.join(' ');
}

function isAtomicUnit(el) {
    if (!(el instanceof Element)) return false;
    if (el.matches(ATOMIC_SELECTOR)) return true;
    return isControlRow(el);
}

function isControlRow(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.classList.contains('inline-drawer')) return false;
    if (el.classList.contains('flexFlowColumn')) return false;
    if (el.classList.contains('rt-settings-tab')) return false;
    if (el.classList.contains('rt-so-settings-root')) return false;
    if (el.querySelector(':scope > .inline-drawer, :scope .checkbox_label')) return false;
    const controls = el.querySelectorAll(':scope > input, :scope > select, :scope > textarea, :scope > button, :scope > label');
    if (!controls.length) return false;
    return el.children.length > 0 && el.children.length <= 6;
}

function stopDrawerAnimation(content) {
    try {
        globalThis.$?.(content).stop?.(true, true);
    } catch (_) { /* jquery optional */ }
}

function expandDrawer(drawer) {
    if (!(drawer instanceof HTMLElement)) return;
    drawer.classList.add('open');
    const content = drawer.querySelector(':scope > .inline-drawer-content');
    if (content instanceof HTMLElement) {
        stopDrawerAnimation(content);
        content.style.display = 'block';
        content.style.overflow = 'visible';
        content.style.height = 'auto';
    }
    drawer.querySelector(':scope > .inline-drawer-toggle .inline-drawer-icon')?.classList.add('down');
}

function collapseDrawer(drawer) {
    if (!(drawer instanceof HTMLElement)) return;
    drawer.classList.remove('open');
    const content = drawer.querySelector(':scope > .inline-drawer-content');
    if (content instanceof HTMLElement) {
        stopDrawerAnimation(content);
        content.style.display = 'none';
        content.style.overflow = '';
        content.style.height = '';
    }
    drawer.querySelector(':scope > .inline-drawer-toggle .inline-drawer-icon')?.classList.remove('down');
}

/** Remember open/closed state once per search session, before matches are expanded. */
function snapshotDrawerStates(root) {
    if (!(root instanceof Element) || root.dataset.rtSoDrawerSnap === '1') return;
    root.dataset.rtSoDrawerSnap = '1';
    root.querySelectorAll('.inline-drawer').forEach((drawer) => {
        if (!(drawer instanceof HTMLElement) || drawer.dataset.rtSoWasOpen != null) return;
        drawer.dataset.rtSoWasOpen = drawer.classList.contains('open') ? '1' : '0';
    });
}

function restoreDrawerStates(root) {
    if (!(root instanceof Element)) return;
    root.querySelectorAll('.inline-drawer[data-rt-so-was-open]').forEach((drawer) => {
        if (!(drawer instanceof HTMLElement)) return;
        const wasOpen = drawer.dataset.rtSoWasOpen === '1';
        delete drawer.dataset.rtSoWasOpen;
        if (wasOpen) expandDrawer(drawer);
        else collapseDrawer(drawer);
    });
    delete root.dataset.rtSoDrawerSnap;
}

function clearSearchMarks(root) {
    if (!(root instanceof Element)) return;
    root.querySelectorAll(`.${HIDDEN_CLASS}, .${HIT_CLASS}, .${TAB_MATCH_CLASS}`).forEach((el) => {
        el.classList.remove(HIDDEN_CLASS, HIT_CLASS, TAB_MATCH_CLASS);
    });
}

/**
 * @param {Element} el
 * @param {string[]} tokens
 * @param {boolean} forceShow
 * @returns {boolean}
 */
function applyFilter(el, tokens, forceShow) {
    if (!(el instanceof Element)) return false;
    if (el.matches('script, style, input[type="hidden"], input[type="file"]')) return false;

    if (el.classList.contains('inline-drawer')) {
        const header = el.querySelector(':scope > .inline-drawer-toggle');
        const content = el.querySelector(':scope > .inline-drawer-content');
        const headerHit = !!(header && haystackMatches(haystackFrom(header), tokens));
        if (headerHit) header.classList.add(HIT_CLASS);
        const contentHit = content ? applyFilter(content, tokens, forceShow || headerHit) : false;
        const hit = forceShow || headerHit || contentHit;
        el.classList.toggle(HIDDEN_CLASS, !hit);
        if (hit) expandDrawer(el);
        return hit;
    }

    if (isAtomicUnit(el)) {
        const hit = haystackMatches(haystackFrom(el), tokens);
        el.classList.toggle(HIT_CLASS, hit);
        el.classList.toggle(HIDDEN_CLASS, !forceShow && !hit);
        return forceShow || hit;
    }

    let any = false;
    for (const child of [...el.children]) {
        if (applyFilter(child, tokens, forceShow)) any = true;
    }
    const ownHit = haystackMatches(ownHaystack(el), tokens);
    if (ownHit) {
        any = true;
        el.classList.add(HIT_CLASS);
    }
    const hit = forceShow || any;
    el.classList.toggle(HIDDEN_CLASS, !hit);
    return hit;
}

function revealGroupHeaders(root) {
    root.querySelectorAll('small').forEach((small) => {
        let sib = small.nextElementSibling;
        while (sib && sib.tagName !== 'SMALL') {
            const visibleHit = !sib.classList.contains(HIDDEN_CLASS)
                && (sib.classList.contains(HIT_CLASS) || sib.querySelector?.(`.${HIT_CLASS}`));
            if (visibleHit) {
                small.classList.remove(HIDDEN_CLASS);
                unhideAncestors(small, root);
                break;
            }
            sib = sib.nextElementSibling;
        }
    });
}

function unhideAncestors(el, root) {
    let ancestor = el.parentElement;
    while (ancestor && ancestor !== root) {
        ancestor.classList.remove(HIDDEN_CLASS);
        ancestor = ancestor.parentElement;
    }
}

function isVisibleHit(el) {
    return !!el
        && !el.classList.contains(HIDDEN_CLASS)
        && (el.classList.contains(HIT_CLASS) || !!el.querySelector?.(`.${HIT_CLASS}`));
}

/** Keep a control with its preceding label/row when either side matches. */
function revealControlNeighbors(root) {
    root.querySelectorAll('input, select, textarea, .rt-seg-toggle').forEach((el) => {
        const prev = el.previousElementSibling;
        if (!prev) return;
        if (isVisibleHit(el) && prev.classList.contains(HIDDEN_CLASS)) {
            prev.classList.remove(HIDDEN_CLASS);
            unhideAncestors(prev, root);
        }
        if (isVisibleHit(prev) && el.classList.contains(HIDDEN_CLASS)) {
            el.classList.remove(HIDDEN_CLASS);
            unhideAncestors(el, root);
        }
    });
}

function updateTabChrome(overlay, searching) {
    overlay.querySelectorAll('.rt-so-tab-btn').forEach((btn) => {
        const tabId = btn.dataset.tab;
        const pane = overlay.querySelector(`.rt-settings-tab[data-tab="${tabId}"]`);
        const hits = pane ? pane.querySelectorAll(`.${HIT_CLASS}`).length : 0;
        const hasMatch = searching && hits > 0;
        btn.classList.toggle(TAB_MATCH_CLASS, hasMatch);
        pane?.classList.toggle(TAB_MATCH_CLASS, hasMatch);
        const badge = btn.querySelector('.rt-so-tab-count');
        if (badge instanceof HTMLElement) {
            badge.hidden = !hasMatch;
            badge.textContent = hasMatch ? String(hits) : '';
        }
    });
}

function setEmptyState(overlay, query, matchCount) {
    const empty = overlay.querySelector('.rt-so-search-empty');
    const root = overlay.querySelector('.rt-so-settings-root');
    const searching = tokenizeQuery(query).length > 0;
    const noHits = searching && matchCount === 0;
    if (empty instanceof HTMLElement) {
        empty.hidden = !noHits;
        empty.textContent = noHits
            ? `没有与“${query.trim()}”匹配的设置。`
            : '';
    }
    if (root instanceof HTMLElement) {
        root.classList.toggle(HIDDEN_CLASS, noHits);
    }
}

/**
 * Apply or clear the keyword filter.
 * @param {HTMLElement} overlay
 * @param {string} query
 */
export function applySettingsSearch(overlay, query) {
    if (!(overlay instanceof HTMLElement)) return 0;
    const root = overlay.querySelector('.rt-so-settings-root');
    if (!(root instanceof HTMLElement)) return 0;

    const tokens = tokenizeQuery(query);
    clearSearchMarks(overlay);
    overlay.querySelector('#rt-so-search-clear')?.toggleAttribute('hidden', tokens.length === 0);

    if (!tokens.length) {
        restoreDrawerStates(root);
        overlay.classList.remove(SEARCHING_CLASS);
        updateTabChrome(overlay, false);
        setEmptyState(overlay, '', 0);
        return 0;
    }

    if (!overlay.classList.contains(SEARCHING_CLASS)) snapshotDrawerStates(root);
    overlay.classList.add(SEARCHING_CLASS);
    for (const tab of root.querySelectorAll(':scope > .rt-settings-tab')) {
        applyFilter(tab, tokens, false);
    }
    revealGroupHeaders(root);
    revealControlNeighbors(root);

    const matchCount = root.querySelectorAll(`.${HIT_CLASS}`).length;
    updateTabChrome(overlay, true);
    setEmptyState(overlay, query, matchCount);
    return matchCount;
}

/**
 * @param {HTMLElement} overlay
 */
export function clearSettingsSearch(overlay) {
    const input = overlay?.querySelector('#rt-so-search-input');
    if (input instanceof HTMLInputElement && input.value) {
        input.value = '';
    }
    applySettingsSearch(overlay, '');
}

/**
 * Wire the header search field. Call once after the overlay DOM is in the document.
 * @param {HTMLElement} overlay
 * @param {{ onCleared?: () => void }} [opts]
 */
export function installSettingsSearch(overlay, opts = {}) {
    if (!(overlay instanceof HTMLElement)) return;
    const input = overlay.querySelector('#rt-so-search-input');
    const clearBtn = overlay.querySelector('#rt-so-search-clear');
    if (!(input instanceof HTMLInputElement)) return;

    const run = () => {
        const count = applySettingsSearch(overlay, input.value);
        if (!tokenizeQuery(input.value).length) opts.onCleared?.();
        const content = overlay.querySelector('.rt-so-content');
        if (count >= 0 && content instanceof HTMLElement && tokenizeQuery(input.value).length) {
            content.scrollTop = 0;
        }
    };

    input.addEventListener('input', run);
    input.addEventListener('search', run);
    input.closest('.rt-so-search')?.addEventListener('click', () => input.focus());
    clearBtn?.addEventListener('click', () => {
        input.value = '';
        run();
        input.focus();
    });
}

/**
 * @param {KeyboardEvent} e
 * @param {HTMLElement | null} overlay
 * @param {{ close: () => void, restoreTab: () => void }} handlers
 * @returns {boolean} true if the event was handled
 */
export function handleSettingsSearchKeydown(e, overlay, handlers) {
    if (!overlay?.classList.contains('rt-so-open')) return false;
    const input = overlay.querySelector('#rt-so-search-input');

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        if (input instanceof HTMLInputElement) {
            input.focus();
            input.select();
        }
        return true;
    }

    if (e.key === 'Escape') {
        if (input instanceof HTMLInputElement && input.value) {
            e.preventDefault();
            e.stopPropagation();
            input.value = '';
            applySettingsSearch(overlay, '');
            handlers.restoreTab?.();
            input.blur();
            return true;
        }
        handlers.close?.();
        return true;
    }

    return false;
}
