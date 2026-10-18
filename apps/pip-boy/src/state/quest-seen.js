// Device-local record of which quest stages this device has shown, per
// character: `{ [questId]: stageId[] }` under `pb.quests.seen.<cid>.<charId>`.
// Stage ids (not counts or dates) so editing a past stage never raises the
// AGGIORNATA badge, while publishing a new one does. Storage can be missing or
// throw (private mode, quota); every access degrades to "no badges".

const FAILED = Symbol('storage-failed');

const keyFor = (campaignId, characterId) => `pb.quests.seen.${campaignId}.${characterId}`;

/** The stored record, `null` when none exists yet, or FAILED when storage throws. */
function read(campaignId, characterId) {
    try {
        const raw = localStorage.getItem(keyFor(campaignId, characterId));
        if (raw == null) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return FAILED;
    }
}

function write(campaignId, characterId, record) {
    try {
        localStorage.setItem(keyFor(campaignId, characterId), JSON.stringify(record));
    } catch (_) { /* degrade silently */ }
}

const stageIds = (quest) => (quest.stages ?? []).map((s) => s.id);

/**
 * Ids of the quests holding a stage this device has not shown. On the very
 * first load for a character (no record at all) everything visible is seeded
 * as seen, so a fresh device is not flooded with badges. A quest missing from
 * an existing record counts as unseen — it was just revealed.
 */
export function unseenQuestIds(campaignId, characterId, quests) {
    const record = read(campaignId, characterId);
    if (record === FAILED) return new Set();
    if (record === null) {
        write(campaignId, characterId, Object.fromEntries(quests.map((q) => [q.id, stageIds(q)])));
        return new Set();
    }
    return new Set(quests
        .filter((q) => {
            const seen = new Set(record[q.id] ?? []);
            return stageIds(q).some((id) => !seen.has(id));
        })
        .map((q) => q.id));
}

/** Record every current stage of `quest` as seen on this device. */
export function markQuestSeen(campaignId, characterId, quest) {
    const record = read(campaignId, characterId);
    if (record === FAILED) return;
    write(campaignId, characterId, { ...(record ?? {}), [quest.id]: stageIds(quest) });
}
