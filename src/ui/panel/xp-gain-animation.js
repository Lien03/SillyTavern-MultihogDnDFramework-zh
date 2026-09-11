const XP_GAIN_HOLD_MS = 840;
const XP_GAIN_TRICKLE_MS = 2640;

/**
 * @typedef {{
 *   current: number,
 *   max: number,
 *   level: string,
 *   showAsPercentage: boolean,
 * }} XpSnapshot
 */

/**
 * Return the safe, animation-worthy portion of an XP change.
 * Level-ups and threshold changes deliberately render immediately.
 *
 * @param {XpSnapshot|null} previous
 * @param {XpSnapshot|null} next
 * @returns {{ gained: number, fromPct: number, toPct: number }|null}
 */
export function getXpGainTransition(previous, next) {
    if (!previous || !next) return null;
    if (previous.level !== next.level || previous.max !== next.max) return null;
    if (!Number.isFinite(previous.current) || !Number.isFinite(next.current) || !Number.isFinite(next.max) || next.max <= 0) return null;

    const gained = Math.round(next.current - previous.current);
    if (gained <= 0) return null;

    return {
        gained,
        fromPct: Math.max(0, Math.min(100, (previous.current / next.max) * 100)),
        toPct: Math.max(0, Math.min(100, (next.current / next.max) * 100)),
    };
}

/**
 * @param {number} current
 * @param {number} max
 * @param {boolean} showAsPercentage
 */
export function formatAnimatedXpValue(current, max, showAsPercentage) {
    const value = showAsPercentage
        ? Math.round((current / max) * 100)
        : Math.round(current);
    return value.toLocaleString('en-US');
}

/** @param {Element|null} container */
function readXpSnapshot(container) {
    const row = container?.querySelector?.('.rt-xp-row[data-xp-current][data-xp-max]');
    if (!(row instanceof HTMLElement)) return null;

    // During an active animation the memo-backed value is already final, while
    // xpVisibleCurrent tracks what the player can actually see. Prefer it so an
    // immediate second render resumes the trickle instead of erasing it.
    const current = Number(row.dataset.xpVisibleCurrent ?? row.dataset.xpCurrent);
    const max = Number(row.dataset.xpMax);
    if (!Number.isFinite(current) || !Number.isFinite(max)) return null;

    return {
        current,
        max,
        level: row.dataset.xpLevel || '',
        showAsPercentage: row.dataset.xpShowPercentage === 'true',
    };
}

/**
 * Capture the visible XP state before a rendered container is replaced.
 *
 * @param {HTMLElement|null} container
 * @param {string} contextKey
 */
export function captureXpGainAnimationState(container, contextKey) {
    if (!container) return { contextMatches: false, previous: null };
    return {
        contextMatches: container.dataset.rtXpAnimationContext === contextKey,
        previous: readXpSnapshot(container),
    };
}

/**
 * Restore the prior bar visually, then count the award down while filling it.
 * The underlying memo and the row's data attributes already contain the final XP.
 *
 * @param {HTMLElement|null} container
 * @param {{ contextMatches: boolean, previous: XpSnapshot|null }} captured
 * @param {string} contextKey
 */
export function playXpGainAnimation(container, captured, contextKey) {
    if (!container) return;
    container.dataset.rtXpAnimationContext = contextKey;

    const next = readXpSnapshot(container);
    const transition = captured?.contextMatches
        ? getXpGainTransition(captured.previous, next)
        : null;
    if (!transition || !next || !captured.previous) return;

    const row = container.querySelector('.rt-xp-row[data-xp-current][data-xp-max]');
    const bar = row?.querySelector('.rt-xp-bar');
    const currentLabel = row?.querySelector('.rt-xp-current');
    if (!(row instanceof HTMLElement) || !(bar instanceof HTMLElement) || !(currentLabel instanceof HTMLElement)) return;

    const oldCurrent = captured.previous.current;
    const gained = transition.gained;
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    const trickleMs = reducedMotion ? 1080 : XP_GAIN_TRICKLE_MS;

    bar.style.transition = 'none';
    bar.style.width = `${transition.fromPct.toFixed(1)}%`;
    currentLabel.textContent = formatAnimatedXpValue(oldCurrent, next.max, next.showAsPercentage);
    row.dataset.xpVisibleCurrent = String(oldCurrent);

    const floater = document.createElement('span');
    floater.className = 'rt-xp-gain-floater';
    floater.setAttribute('role', 'status');
    floater.setAttribute('aria-label', `获得 ${gained} 点经验值`);
    floater.style.setProperty('--rt-xp-trickle-duration', `${trickleMs}ms`);
    floater.textContent = `+${gained.toLocaleString('en-US')} 经验值`;
    row.classList.add('rt-xp-gain-active');
    row.appendChild(floater);

    const finish = () => {
        bar.style.width = `${transition.toPct.toFixed(1)}%`;
        bar.style.transition = '';
        currentLabel.textContent = formatAnimatedXpValue(next.current, next.max, next.showAsPercentage);
        row.dataset.xpVisibleCurrent = String(next.current);
        floater.textContent = '+0 经验值';
        floater.classList.add('rt-xp-gain-complete');
        globalThis.setTimeout(() => {
            floater.remove();
            row.classList.remove('rt-xp-gain-active');
        }, 180);
    };

    globalThis.setTimeout(() => {
        floater.classList.add('rt-xp-gain-trickling');
        const startedAt = globalThis.performance?.now?.() ?? Date.now();

        const tick = (now) => {
            if (!row.isConnected) return;
            const progress = Math.max(0, Math.min(1, (now - startedAt) / trickleMs));
            const transferred = Math.min(gained, Math.floor(gained * progress));
            const remaining = gained - transferred;
            const visibleCurrent = oldCurrent + transferred;
            const visiblePct = transition.fromPct + ((transition.toPct - transition.fromPct) * progress);

            floater.textContent = `+${remaining.toLocaleString('en-US')} 经验值`;
            bar.style.width = `${visiblePct.toFixed(2)}%`;
            currentLabel.textContent = formatAnimatedXpValue(visibleCurrent, next.max, next.showAsPercentage);
            row.dataset.xpVisibleCurrent = String(visibleCurrent);

            if (progress < 1) {
                globalThis.requestAnimationFrame(tick);
            } else {
                finish();
            }
        };

        globalThis.requestAnimationFrame(tick);
    }, XP_GAIN_HOLD_MS);
}
