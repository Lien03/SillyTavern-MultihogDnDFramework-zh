import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');

describe('relationship update pause boundary', () => {
    it('processes chat-regex awards before the tracker pause return', () => {
        const handlerStart = source.indexOf('export async function onGenerationEnded()');
        const handlerEnd = source.indexOf('World Progression deterministic trigger', handlerStart);
        const handler = source.slice(handlerStart, handlerEnd);
        const regexCall = handler.indexOf('if (shouldProcessRegexRelationshipUpdates(settings))');
        const pauseGate = handler.indexOf('if (settings.paused)');

        expect(handlerStart).toBeGreaterThanOrEqual(0);
        expect(regexCall).toBeGreaterThanOrEqual(0);
        expect(pauseGate).toBeGreaterThan(regexCall);
        expect(handler.match(/await handleRelationshipSwipeChange\(\)/g)).toHaveLength(1);
    });
});
