import { normalizeLocationPath } from './portraits.js';

/**
 * Tokenize freeform location text for loose matching against lore paths.
 * @param {string} raw
 * @returns {string[]}
 */
export function tokenizeLocationText(raw) {
    if (!raw) return [];
    let text = String(raw).trim();
    if (!text) return [];

    text = text
        .replace(/\s*::\s*/g, ' ')
        .replace(/[,/]/g, ' ')
        .replace(/\s*[—–]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return text
        .split(' ')
        .map(t => t.toLowerCase())
        .filter(Boolean);
}

/**
 * @param {string} part
 * @returns {string[]}
 */
function partToTokens(part) {
    return String(part || '')
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

/**
 * @param {string[]} parts
 * @returns {string[]}
 */
function pathPartsToTokens(parts) {
    const seq = [];
    for (const part of parts) {
        seq.push(...partToTokens(part));
    }
    return seq;
}

/**
 * @param {string[]} inputTokens
 * @param {string[]} pathTokens
 * @returns {boolean}
 */
function tokensSuffixMatch(inputTokens, pathTokens) {
    if (!pathTokens.length || pathTokens.length > inputTokens.length) return false;
    const start = inputTokens.length - pathTokens.length;
    for (let i = 0; i < pathTokens.length; i++) {
        if (inputTokens[start + i] !== pathTokens[i]) return false;
    }
    return true;
}

/**
 * Loosely resolve freeform location text to a canonical lore path.
 * Deepest suffix match wins (e.g. "Monastery Courtyard" → "Monastery :: Courtyard").
 * @param {string} rawText
 * @param {string[]} allPaths Canonical paths using ` :: ` separators
 * @param {{ activeLocPaths?: string[] }} [opts]
 * @returns {string|null}
 */
export function resolveCurrentLocationPath(rawText, allPaths, opts = {}) {
    if (!rawText || !Array.isArray(allPaths) || allPaths.length === 0) return null;

    const inputTokens = tokenizeLocationText(rawText);
    if (!inputTokens.length) return null;

    const normalizedPaths = [...new Set(allPaths
        .map(p => normalizeLocationPath(p))
        .filter(Boolean))];

    const activeSet = new Set((opts.activeLocPaths || []).map(p => normalizeLocationPath(p)));

    let bestPath = null;
    let bestScore = -1;

    for (const path of normalizedPaths) {
        const parts = path.split(' :: ');
        const pathTokens = pathPartsToTokens(parts);
        if (!pathTokens.length) continue;

        if (!tokensSuffixMatch(inputTokens, pathTokens)) continue;

        let score = parts.length * 1000 + pathTokens.length;
        if (activeSet.has(path)) score += 50;
        if (normalizeLocationPath(rawText) === path) score += 500;

        if (score > bestScore) {
            bestScore = score;
            bestPath = path;
        }
    }

    if (bestPath) return bestPath;

    // Allow extra descriptive tiers, but require the known parents in order.
    const leafCandidates = normalizedPaths.filter((path) => {
        const parts = path.split(' :: ');
        const leafTokens = partToTokens(parts.pop());
        if (!tokensSuffixMatch(inputTokens, leafTokens)) return false;
        const parentEnd = inputTokens.length - leafTokens.length;
        if (parentEnd === 0) return true;

        let cursor = 0;
        for (const part of parts) {
            const parentTokens = partToTokens(part);
            while (cursor + parentTokens.length <= parentEnd
                && !parentTokens.every((token, i) => inputTokens[cursor + i] === token)) {
                cursor++;
            }
            if (cursor + parentTokens.length > parentEnd) return false;
            cursor += parentTokens.length;
        }
        return true;
    });

    return leafCandidates.length === 1 ? leafCandidates[0] : null;
}

/**
 * @param {string} path
 * @returns {string}
 */
export function formatLocationBreadcrumb(path) {
    if (!path) return '';
    return normalizeLocationPath(path)
        .split(' :: ')
        .map(seg => seg.trim())
        .filter(Boolean)
        .join(' › ');
}
