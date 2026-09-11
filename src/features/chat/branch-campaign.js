import { createBranch } from '../../../../../../bookmarks.js';
import { saveItemizedPrompts } from '../../../../../../itemized-prompts.js';
import { getSettings, sanitizeCampaignPrefixString, saveChatState } from '../../../state-manager.js';
import { snapshotPortraitMapsForChat } from '../../../portrait-storage.js';
import { runtimeState } from '../../app/runtime-state.js';
import {
    cloneCampaignStackToPrefix,
    deleteWorldInfoBooks,
} from './clone-campaign-stack.js';
import {
    COMPANION_BY_CHAT_KEY,
    MEMO_RECOVERY_KEY,
    copyLocalChatMapEntry,
} from './local-chat-map.js';
import {
    copyChatStatePartition,
    remapBookKeyedKey,
    remapBookKeyedList,
    remapBookKeyedMap,
} from './branch-campaign-utils.js';

export {
    copyChatStatePartition,
    remapBookKeyedKey,
    remapBookKeyedList,
    remapBookKeyedMap,
};

/** @type {Set<string>} */
const _pendingBranchSeeds = new Set();

/**
 * True while a 分支战役 seed for this chat id is in flight / just completed.
 * Prevents onChatChanged from treating the branch as an unseen empty chat.
 * @param {string|null|undefined} chatId
 */
export function isBranchSeedInProgress(chatId) {
    return !!(chatId && _pendingBranchSeeds.has(String(chatId)));
}

/**
 * @param {string} chatId
 */
export function clearBranchSeedGuard(chatId) {
    if (chatId) _pendingBranchSeeds.delete(String(chatId));
}

/**
 * One-button 分支战役: ST transcript branch + Multihog partition copy + lore stack clone.
 * Preserves chat A intact (copy, not move).
 * @param {{ saveSettings: (force?: boolean) => Promise<void>|void }} deps
 */
export async function branchCampaignChat(deps) {
    const { saveSettings } = deps;
    const s = getSettings();
    const ctx = SillyTavern.getContext();
    const title = '分支战役';

    if (!s.chatLinkEnabled) {
        toastr['warning'](
            '请先开启「聊天联动模式」，以便将战役状态复制到分支。',
            title,
        );
        return null;
    }

    const oldId = runtimeState.currentChatId
        || ctx.getCurrentChatId?.()
        || ctx.chatId
        || null;
    if (!oldId) {
        toastr['warning']('没有可进行分支的当前聊天。', title);
        return null;
    }

    const chat = ctx.chat;
    if (!Array.isArray(chat) || chat.length === 0) {
        toastr['warning']('聊天为空，没有可分支的内容。', title);
        return null;
    }

    const hasCharacterOrGroup = ctx.characterId !== undefined || !!ctx.groupId;
    if (!hasCharacterOrGroup) {
        toastr['info']('未选择角色。', title);
        return null;
    }

    const currentPrefix = (s.routerCampaignPrefix || getSettings().routerCampaignPrefix || '').trim()
        || sanitizeCampaignPrefixString(oldId);
    const confirmHtml = `
        <div style="text-align:left;font-size:0.9em;line-height:1.5;">
            <p>这将从当前记录创建 SillyTavern <b>分支聊天</b>，并把全部 Multihog D&amp;D 数据复制到其上。</p>
            <ul style="margin:8px 0 0 1.2em;padding:0;">
                <li>追踪器备忘、关系数据、任务、头像画像映射、设置锁定、同伴历史</li>
                <li>战役设定集将以新 prefix 克隆（存在堆栈时）</li>
                <li>原聊天 <code>${escapeHtml(oldId)}</code> 保持原样</li>
            </ul>
            <p style="margin-top:8px;opacity:0.8;">完成后将自动切换到新分支。</p>
        </div>
    `;
    let confirmed = false;
    try {
        confirmed = await ctx.Popup.show.confirm(title, confirmHtml, {
            okButton: '分支战役',
            cancelButton: '取消',
        });
    } catch (_) {
        return null;
    }
    if (!confirmed) return null;

    // ── Freeze chat A ──────────────────────────────────────────────────────────
    if (typeof globalThis._rpgFlushRawMemoChanges === 'function') {
        globalThis._rpgFlushRawMemoChanges();
    }
    if (typeof globalThis._rpgFlushAdventureCompanionForChat === 'function') {
        globalThis._rpgFlushAdventureCompanionForChat(oldId);
    }
    snapshotPortraitMapsForChat(s, oldId);
    saveChatState(oldId, { skipDiskWrite: true });
    await Promise.resolve(saveSettings(true));

    // Re-read after flush/save
    if (!s.chatStates?.[oldId]) {
        toastr['error']('无法为当前聊天创建 Multihog 状态快照。', title);
        return null;
    }

    // ── Create ST transcript branch (do not open yet) ──────────────────────────
    const mesId = chat.length - 1;
    let newChatId = null;
    try {
        newChatId = await createBranch(mesId);
    } catch (e) {
        console.error('[RPG Tracker] createBranch failed:', e);
        toastr['error'](`创建分支失败：${e?.message || e}`, title);
        return null;
    }
    if (!newChatId) {
        toastr['error']('SillyTavern 无法创建分支聊天。', title);
        return null;
    }

    _pendingBranchSeeds.add(String(newChatId));
    const newPrefix = sanitizeCampaignPrefixString(newChatId);
    let bookRenameMap = {};
    let createdBookNames = [];

    try {
        // ── Clone lore stack (optional if no books) ────────────────────────────
        const sourcePrefix = (s.chatStates[oldId]?.routerCampaignPrefix || currentPrefix || '').trim()
            || sanitizeCampaignPrefixString(oldId);

        if (sourcePrefix && newPrefix && sourcePrefix !== newPrefix) {
            const sourceBooks = Array.isArray(s.chatStates[oldId]?.campaignBooks)
                ? s.chatStates[oldId].campaignBooks
                : [];
            toastr['info'](`正在克隆设定集 ${sourcePrefix} → ${newPrefix}…`, title);
            const cloneResult = await cloneCampaignStackToPrefix(sourcePrefix, newPrefix);
            // Fail closed: a campaign with linked books must not branch while still
            // pointing at the source stack (shared mutations / silent data coupling).
            if (sourceBooks.length > 0 && cloneResult.matchingCount === 0) {
                throw new Error(
                    `找不到前缀为 "${sourcePrefix}" 的设定集可克隆 `
                    + `（聊天中列有 ${sourceBooks.length} 个关联设定）。中止操作，以免 `
                    + '分支与原设定堆栈共享数据。',
                );
            }
            if (cloneResult.matchingCount > 0 && !cloneResult.ok) {
                // createdBookNames are only books this attempt wrote; preflight collisions
                // abort with an empty list so cleanup cannot delete pre-existing destinations.
                await deleteWorldInfoBooks(ctx, cloneResult.createdBookNames);
                throw new Error(
                    `设定集克隆不完整（${cloneResult.cloned}/${cloneResult.matchingCount}）。`
                    + (cloneResult.errors.slice(0, 3).join('; ') || '未知错误'),
                );
            }
            bookRenameMap = cloneResult.bookRenameMap || {};
            createdBookNames = cloneResult.createdBookNames || [];
        }

        // ── Deep-copy Multihog partition ───────────────────────────────────────
        copyChatStatePartition(s, oldId, newChatId, newPrefix, bookRenameMap);
        copyLocalChatMapEntry(COMPANION_BY_CHAT_KEY, oldId, newChatId);
        copyLocalChatMapEntry(MEMO_RECOVERY_KEY, oldId, newChatId);

        // Keep Campaign Prefix Override on the SOURCE chat. Otherwise the branch
        // inherits a global/legacy override and keeps writing into the original
        // lorebook stack while cloned books under newPrefix sit unused.
        const ov = (s.routerCampaignPrefixOverride || '').trim();
        if (ov) {
            const anchor = (s.routerCampaignPrefixOverrideAnchorChatId || '').trim();
            if (!anchor || anchor === newChatId) {
                s.routerCampaignPrefixOverrideAnchorChatId = oldId;
            }
        }

        let saved = false;
        try {
            await Promise.resolve(saveSettings(true));
            saved = true;
        } catch (e1) {
            console.warn('[RPG Tracker] Branch settings save retry:', e1);
            try {
                await Promise.resolve(saveSettings(true));
                saved = true;
            } catch (e2) {
                throw new Error(`无法持久化 Multihog 分支数据：${e2?.message || e2}`);
            }
        }
        if (!saved || !s.chatStates?.[newChatId]) {
            throw new Error('保存后缺少 Multihog 分支数据分区。');
        }

        // ── Open branch ────────────────────────────────────────────────────────
        try {
            await saveItemizedPrompts(newChatId);
        } catch (_) { /* non-fatal */ }

        if (ctx.groupId) {
            await ctx.openGroupChat(ctx.groupId, newChatId);
        } else {
            await ctx.openCharacterChat(newChatId);
        }

        const loreNote = createdBookNames.length
            ? ` 已在前缀 "${newPrefix}" 下克隆设定集。`
            : (newPrefix ? ` 前缀为 "${newPrefix}"。` : '');
        toastr['success'](
            `已分支到 "${newChatId}"。Multihog 数据已复制，原聊天保留。${loreNote}`,
            title,
            { timeOut: 9000 },
        );
        return newChatId;
    } catch (err) {
        console.error('[RPG Tracker] 分支战役 failed:', err);
        if (createdBookNames.length) {
            await deleteWorldInfoBooks(ctx, createdBookNames);
        }
        if (s.chatStates?.[newChatId]) {
            // Only remove the seed we just wrote; never touch chat A.
            delete s.chatStates[newChatId];
            try { await Promise.resolve(saveSettings(true)); } catch (_) { /* non-fatal */ }
        }
        toastr['error'](
            `${err?.message || err}\nST 分支文件 "${newChatId}" 可能已存在——修复后可手动打开，或将其删除。`,
            title,
            { timeOut: 12000 },
        );
        return null;
    } finally {
        // Keep guard briefly so CHAT_CHANGED during open still sees the seed intent;
        // clear on next tick after open settles.
        setTimeout(() => clearBranchSeedGuard(newChatId), 3000);
    }
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export {
    COMPANION_BY_CHAT_KEY,
    MEMO_RECOVERY_KEY,
    copyLocalChatMapEntry,
    moveLocalChatMapEntry,
} from './local-chat-map.js';
