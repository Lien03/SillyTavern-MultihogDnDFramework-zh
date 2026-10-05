# Chat ownership across asynchronous work

`getSettings()` exposes one mutable live projection. Loading another chat replaces
its story fields while keeping the same object. Holding a reference to that object
does not hold a reference to the originating chat's state.

Use the helpers in `src/state/pass-affinity.js` for asynchronous work that changes
the live memo, histories, relationships, lorebook activation, schedules, or UI
actions bound to an entity. The switch epoch is invalidated before projecting the
arriving chat. Comparing chat IDs alone misses an A → B → A round trip.

## Capture once, check at each continuation

```js
const ownsChat = createChatCommitGuard(getActiveChatId(), getActiveChatId, {
    signal: controller.signal, // optional cancellation
    canCommit: parentGuard,    // optional enclosing operation
});
const bookName = `${getLivePrefix()}_Locations`;
const book = chatCommitResult(ownsChat, await loadWorldInfoFresh(bookName, ctx));
// It is now safe to inspect live settings and prepare the next write.
await writeBook(bookName, book, { canCommit: ownsChat });
assertChatCommit(ownsChat);
updateLiveHistory();
```

- Pass the original guard to nested writers. Those writers must check at entry,
  after their own awaits, and before fallback/recovery writes. Checking only after
  a nested writer returns is too late.
- `chatCommitResult(guard, await promise)` checks synchronously in the caller's
  continuation. An asynchronous wrapper that checks internally leaves another
  microtask gap before its caller can write.
- A rejected promise bypasses the result checkpoint. Check the guard in `catch`
  before creating a fallback book, restoring snapshots, or modifying live state.
- Check again at timer/callback entry and between queued jobs. A stale scheduler
  must not start a fresh operation with the arriving chat's identity.
- Cancellation cannot undo an already-started backend write. Pin its destination
  before starting it, and cancel live activation/history/UI follow-ups afterward.

## UI and cancellation lifetimes

Persistent controls capture a new guard when clicked, not when the panel is wired.
Entity-specific popups and rendered rows keep their originating view's guard, so
an old popup cannot edit a same-named entity in a new chat. Check both lifetimes
when a persistent action opens a chat-specific dialog.

At event boundaries, `ignoreChatCancellation(async (...) => { ... })` suppresses
the expected `CHAT_OWNERSHIP_LOST` rejection. It preserves other errors and `this`.
Data writers should propagate cancellation so callers cannot mistake it for a
successful write. Callers still checkpoint after awaiting UI helpers.

Keep a local controller/request token. `finally` may release a shared controller,
running flag, or notification only if it still belongs to that request. A cancelled
operation may settle after its replacement starts.

## Explicit destination writes

Portrait/location uploads that capture a chat ID and update that partition directly
can finish after switching. Preserve this behavior: do not replace the pinned ID
with the current one after an upload. Their live UI follow-ups still need guards.
Likewise, branch creation can finish seeding its explicit destination, but must not
read the arriving chat's prompts or navigate away from it on late completion.

## Regression coverage

Run `npm test`. `tests/chat-operation-races.test.js` executes production functions
with deferred host I/O. Suspend operations at loads, generation, saves, and failed
I/O; switch chats (including away and back); then release the work. Assert that the
arriving settings stay intact and no subsequent writer or queued job runs. Also
test ordinary success and replacement requests, so guards do not silently disable
valid actions. Chat Link schema and LIVE-pointer regressions are covered in
`tests/chat-link-conflict.test.js`.
