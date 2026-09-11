import { afterEach, describe, expect, it } from 'vitest';
import {
    CHAT_COMPLETION_API,
    RECOMMENDED_OUTPUT_LENGTH,
    buildOverlayHtml,
    describeMainApi,
    getApiSetupStatuses,
    getSillyTavernMainApi,
    isChatCompletionApi,
    isFunctionCallingEnabled,
    isMaxContextUnlocked,
    isOutputLengthRecommended,
    shouldShowApiSetupGate,
} from '../src/ui/api-setup-gate.js';

describe('API setup checklist', () => {
    afterEach(() => {
        delete globalThis.SillyTavern;
    });

    it('treats only openai as Chat Completion', () => {
        expect(isChatCompletionApi('openai')).toBe(true);
        expect(isChatCompletionApi('textgenerationwebui')).toBe(false);
        expect(isChatCompletionApi('kobold')).toBe(false);
        expect(isChatCompletionApi('koboldhorde')).toBe(false);
        expect(isChatCompletionApi('novel')).toBe(false);
        expect(CHAT_COMPLETION_API).toBe('openai');
    });

    it('labels Text Completion vs Chat Completion for the overlay', () => {
        expect(describeMainApi('openai')).toBe('Chat Completion');
        expect(describeMainApi('textgenerationwebui')).toBe('Text Completion');
        expect(describeMainApi('')).toBe('未设置');
    });

    it('reads the live API from SillyTavern context', () => {
        globalThis.SillyTavern = { getContext: () => ({ mainApi: 'textgenerationwebui' }) };
        expect(getSillyTavernMainApi()).toBe('textgenerationwebui');
        expect(isChatCompletionApi()).toBe(false);
        globalThis.SillyTavern = { getContext: () => ({ mainApi: 'openai' }) };
        expect(isChatCompletionApi()).toBe(true);
    });

    it('reads function calling, unlocked context, and output length from Chat Completion settings', () => {
        const ready = {
            function_calling: true,
            max_context_unlocked: true,
            openai_max_tokens: RECOMMENDED_OUTPUT_LENGTH,
        };
        expect(isFunctionCallingEnabled(ready)).toBe(true);
        expect(isMaxContextUnlocked(ready)).toBe(true);
        expect(isOutputLengthRecommended(ready)).toBe(true);

        const stale = {
            function_calling: false,
            max_context_unlocked: false,
            openai_max_tokens: 300,
        };
        expect(isFunctionCallingEnabled(stale)).toBe(false);
        expect(isMaxContextUnlocked(stale)).toBe(false);
        expect(isOutputLengthRecommended(stale)).toBe(false);
        expect(isOutputLengthRecommended({ openai_max_tokens: 99999 })).toBe(false);
        expect(isOutputLengthRecommended({ openai_max_tokens: 128000 })).toBe(true);
    });

    it('collects all four live statuses independently', () => {
        globalThis.SillyTavern = {
            getContext: () => ({
                mainApi: 'openai',
                chatCompletionSettings: {
                    function_calling: false,
                    max_context_unlocked: true,
                    openai_max_tokens: 4096,
                },
            }),
        };
        expect(getApiSetupStatuses()).toEqual({
            chatCompletion: true,
            functionCalling: false,
            maxContextUnlocked: true,
            outputLength: false,
        });
    });

    it('is a first-run checklist, not a hard gate on Chat Completion', () => {
        expect(shouldShowApiSetupGate(false)).toBe(true);
        expect(shouldShowApiSetupGate(true)).toBe(false);
        expect(RECOMMENDED_OUTPUT_LENGTH).toBe(100000);
    });

    it('keeps Continue enabled and renders the Anti-Museum Tour copy', () => {
        const html = buildOverlayHtml({
            chatCompletion: false,
            functionCalling: false,
            maxContextUnlocked: false,
            outputLength: false,
        });
        expect(html).toContain('id="rt-api-setup-continue"');
        expect(html).not.toMatch(/id="rt-api-setup-continue"[^>]*disabled/);
        expect(html).toContain('Anti-Museum Tour');
        expect(html).toContain('人们会遇到 JSON 语法错误之类的问题，最终发现都是因为 ST 默认把最大输出长度设得过低。');
        expect(html).toContain('Chat Completion 已启用');
        expect(html).toContain('Text Completion 是 ChatGPT 问世之前的旧式 API。请不要使用它。');
        expect(html).toContain('Function calling 已启用');
        expect(html).toContain('要使用 Multihog D&amp;D 中更高效的工具版本，这项设置至关重要；若实在无法使用工具，也备有一条“MacGyver”路径。');
        expect(html).toContain('最大上下文大小不受限制');
        expect(html).toContain('如今没有任何理由限制它——实际上理由恰恰相反。');
        expect(html).toContain('人为设置上下文上限只会破坏缓存命中率，让你花更多钱。');
        expect(html).toContain('输出长度已设为 100,000');
        expect(html).toContain('JSON 被截断，直接报 schema/语法错误。');
        expect(html).toContain('结果就是扩展抛错、看起来像坏了。不过，这只是又一个糟糕的默认值罢了。');
        expect(html).toContain('href="https://github.com/Lodactio/Extension-Summaryception"');
        expect(html).toContain('>summarizer</a>');
        expect(html).toContain('id="rt-api-setup-gm-name"');
        expect(html).toContain('value="Game Master"');
        expect(html).toContain('id="rt-api-setup-create-gm"');
        expect(html).toContain('Multihog 不使用一对一的聊天格式，而是采用小说式的书写格式，让多个角色可以无缝共存。消息归属于旁白，而不是某个单一角色。');
        expect(html.match(/type="checkbox"/g)?.length).toBe(4);
        expect(html).not.toContain('These live checkmarks reflect your current SillyTavern settings');
    });
});
