const BAR_CHANGE_HOLD_MS = 480;
const BAR_FULL_SCALE_TRICKLE_MS = 4000;
const BAR_MIN_TRICKLE_MS = 480;
const BAR_CHANGE_RELEASE_MS = 180;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function valuePosition(snapshot) {
    let position;
    if (snapshot.kind === 'barrel') {
        position = 50 + (clamp(snapshot.current, -snapshot.max, snapshot.max) / snapshot.max) * 50;
    } else {
        position = clamp((snapshot.current / snapshot.max) * 100, 0, 100);
    }
    return Math.round(position * 1_000_000) / 1_000_000;
}

/**
 * Returns the visual geometry for a safe, same-scale bar change.
 * Maximum changes render immediately because comparing two different scales
 * would present a misleading delta segment.
 */
export function getBarChangeTransition(previous, next) {
    if (!previous || !next || !next.animateChanges) return null;
    if (previous.id !== next.id || previous.kind !== next.kind || previous.max !== next.max) return null;
    if (![previous.current, previous.max, next.current, next.max].every(Number.isFinite) || next.max <= 0) return null;

    const delta = next.current - previous.current;
    if (delta === 0) return null;

    const fromPct = valuePosition(previous);
    const toPct = valuePosition(next);
    return {
        delta,
        fromPct,
        toPct,
        segmentLeftPct: Math.min(fromPct, toPct),
        segmentWidthPct: Math.abs(toPct - fromPct),
    };
}

/**
 * Scale transfer time by the fraction of the bar that changed. Equivalent
 * proportional changes therefore move at the same visual rate regardless of
 * whether a bar uses small or large numbers.
 */
export function getBarTrickleDuration(delta, max, reducedMotion = false) {
    if (!Number.isFinite(delta) || !Number.isFinite(max) || max <= 0 || delta === 0) return 0;
    const fractionChanged = clamp(Math.abs(delta) / max, 0, 1);
    const normalDuration = clamp(
        Math.round(fractionChanged * BAR_FULL_SCALE_TRICKLE_MS),
        BAR_MIN_TRICKLE_MS,
        BAR_FULL_SCALE_TRICKLE_MS,
    );
    return reducedMotion ? Math.max(BAR_CHANGE_RELEASE_MS, Math.round(normalDuration * 0.4)) : normalDuration;
}

/** Return the visible value and remaining floating delta for one frame. */
export function getBarTrickleFrame(previousCurrent, delta, max, kind, progress) {
    const safeProgress = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
    const current = previousCurrent + (delta * safeProgress);
    return {
        current,
        remaining: Math.abs(delta) * (1 - safeProgress),
        positionPct: valuePosition({ current, max, kind }),
    };
}

function readBarSnapshot(element) {
    const id = element?.dataset?.rtBarId || '';
    const current = Number(element?.dataset?.rtBarVisibleCurrent ?? element?.dataset?.rtBarCurrent);
    const max = Number(element?.dataset?.rtBarMax);
    if (!id || !Number.isFinite(current) || !Number.isFinite(max)) return null;
    return {
        id,
        current,
        max,
        kind: element.dataset.rtBarKind || 'linear',
        animateChanges: element.dataset.rtBarAnimate === 'true',
    };
}

/** Capture all visible enabled/disabled bars before their container is rebuilt. */
export function captureBarChangeAnimationState(container, contextKey) {
    const bars = {};
    container?.querySelectorAll?.('[data-rt-bar-id][data-rt-bar-current][data-rt-bar-max]')?.forEach(element => {
        const snapshot = readBarSnapshot(element);
        if (snapshot && bars[snapshot.id] === undefined) bars[snapshot.id] = snapshot;
    });
    return {
        contextMatches: !!container && container.dataset.rtBarAnimationContext === contextKey,
        bars,
    };
}

function findLinearFill(bar) {
    return bar.querySelector?.('.rt-hp-bar, .rt-progress-bar, .rt-weight-bar, .rt-battery-fill') || null;
}

function findFloaterHost(bar) {
    return bar.closest?.('.rt-entity-sub-line, .rt-entity-row, .rt-progress-row, .rt-weight-row, .rt-charge-row, .rt-barrel-row')
        || bar.parentElement;
}

function formatDelta(delta) {
    const rounded = Math.round(delta * 100) / 100;
    return `${rounded > 0 ? '+' : '\u2212'}${Math.abs(rounded).toLocaleString('en-US')}`;
}

function formatRemainingDelta(delta, remaining) {
    const rounded = Number.isInteger(delta)
        ? Math.ceil(Math.max(0, remaining - Number.EPSILON))
        : Math.round(Math.max(0, remaining) * 100) / 100;
    if (rounded === 0) return '0';
    return `${delta > 0 ? '+' : '\u2212'}${rounded.toLocaleString('en-US')}`;
}

function getBarrelBackground(bar, direction) {
    return bar.querySelector?.(`.rt-barrel-${direction}-control`)?.dataset?.recolorCurrent || '';
}

function setVisibleFill(bar, fill, current, max, kind) {
    if (!fill) return;
    if (kind !== 'barrel') {
        fill.style.width = `${valuePosition({ current, max, kind }).toFixed(2)}%`;
        return;
    }

    const clampedCurrent = clamp(current, -max, max);
    const isPositive = clampedCurrent >= 0;
    const direction = isPositive ? 'positive' : 'negative';
    fill.classList.toggle('rt-barrel-positive', isPositive);
    fill.classList.toggle('rt-barrel-negative', !isPositive);
    fill.dataset.barrelDirection = direction;
    fill.style.left = isPositive ? '50%' : 'auto';
    fill.style.right = isPositive ? 'auto' : '50%';
    fill.style.width = `${(Math.abs(clampedCurrent) / max * 50).toFixed(2)}%`;
    const background = getBarrelBackground(bar, direction);
    if (background) fill.style.background = background;
}

function updateSegment(segment, currentPosition, targetPosition) {
    segment.style.left = `${Math.min(currentPosition, targetPosition).toFixed(2)}%`;
    segment.style.width = `${Math.abs(targetPosition - currentPosition).toFixed(2)}%`;
}

function requestFrame(callback) {
    if (typeof globalThis.requestAnimationFrame === 'function') {
        return globalThis.requestAnimationFrame(callback);
    }
    return globalThis.setTimeout(() => callback(globalThis.performance?.now?.() ?? Date.now()), 16);
}

function animateBar(bar, transition, next) {
    const isGain = transition.delta > 0;
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    const holdMs = reducedMotion ? 180 : BAR_CHANGE_HOLD_MS;
    const trickleMs = getBarTrickleDuration(transition.delta, next.max, reducedMotion);
    const fill = next.kind === 'barrel' ? bar.querySelector?.('.rt-barrel-fill') : findLinearFill(bar);
    const host = findFloaterHost(bar);
    if (!host) return;

    host.classList?.add('rt-bar-change-host');
    bar.querySelectorAll?.('.rt-bar-delta-segment')?.forEach(node => node.remove());
    Array.from(host.children || [])
        .filter(node => node.classList?.contains('rt-bar-change-floater'))
        .forEach(node => node.remove());

    if (fill) {
        fill.style.transition = 'none';
        setVisibleFill(bar, fill, next.current - transition.delta, next.max, next.kind);
    }
    bar.dataset.rtBarVisibleCurrent = String(next.current - transition.delta);

    const segment = document.createElement('span');
    segment.className = `rt-bar-delta-segment ${isGain ? 'rt-bar-delta-gain' : 'rt-bar-delta-loss'}`;
    updateSegment(segment, transition.fromPct, transition.toPct);
    bar.appendChild(segment);

    const floater = document.createElement('span');
    floater.className = `rt-bar-change-floater ${isGain ? 'rt-bar-change-positive' : 'rt-bar-change-negative'}`;
    floater.setAttribute('role', 'status');
    floater.setAttribute('aria-label', `${isGain ? '增加' : '减少'} ${Math.abs(transition.delta)}`);
    floater.textContent = formatDelta(transition.delta);
    host.appendChild(floater);

    const finish = () => {
        setVisibleFill(bar, fill, next.current, next.max, next.kind);
        bar.dataset.rtBarVisibleCurrent = String(next.current);
        segment.style.width = '0%';
        segment.style.opacity = '0';
        floater.textContent = '0';
        floater.classList.add('rt-bar-change-releasing');
        globalThis.setTimeout(() => {
            segment.remove();
            floater.remove();
            host.classList?.remove('rt-bar-change-host');
            if (fill) fill.style.transition = '';
        }, BAR_CHANGE_RELEASE_MS);
    };

    globalThis.setTimeout(() => {
        if (!bar.isConnected) return;
        floater.classList.add('rt-bar-change-trickling');
        const previousCurrent = next.current - transition.delta;
        const startedAt = globalThis.performance?.now?.() ?? Date.now();

        const tick = (now) => {
            if (!bar.isConnected) return;
            const progress = clamp((now - startedAt) / trickleMs, 0, 1);
            const frame = getBarTrickleFrame(previousCurrent, transition.delta, next.max, next.kind, progress);

            setVisibleFill(bar, fill, frame.current, next.max, next.kind);
            updateSegment(segment, frame.positionPct, transition.toPct);
            segment.style.opacity = String(0.82 * (1 - progress));
            floater.textContent = formatRemainingDelta(transition.delta, frame.remaining);
            bar.dataset.rtBarVisibleCurrent = String(frame.current);

            if (progress < 1) requestFrame(tick);
            else finish();
        };

        requestFrame(tick);
    }, holdMs);
}

/** Compare the rebuilt DOM to its captured predecessor and play opted-in changes. */
export function playBarChangeAnimations(container, captured, contextKey) {
    if (!container) return;
    container.dataset.rtBarAnimationContext = contextKey;
    if (!captured?.contextMatches) return;

    container.querySelectorAll?.('[data-rt-bar-id][data-rt-bar-current][data-rt-bar-max]')?.forEach(bar => {
        const next = readBarSnapshot(bar);
        const previous = next ? captured.bars?.[next.id] : null;
        const transition = getBarChangeTransition(previous, next);
        if (transition && next) animateBar(bar, transition, next);
    });
}
