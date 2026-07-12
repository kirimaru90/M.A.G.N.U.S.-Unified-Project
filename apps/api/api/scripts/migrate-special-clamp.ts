import 'reflect-metadata';
import 'dotenv/config';
import * as mongoose from 'mongoose';

/**
 * One-time migration for `special-skill-scale`.
 *
 * The SPECIAL range tightened from `0..8` to `1..5`. Documents persisted under
 * the former range may hold an attribute outside `1..5`; those would be invalid
 * under the new bounds and could be re-written by a later partial patch. Clamp
 * every non-deleted character's seven attributes into range up front
 * (`< 1 → 1`, `> 5 → 5`). Idempotent: an in-range value is left untouched.
 */
const SPECIAL_KEYS = [
  'strength',
  'perception',
  'endurance',
  'charisma',
  'intelligence',
  'agility',
  'luck',
] as const;

const SPECIAL_MIN = 1;
const SPECIAL_MAX = 5;

async function run() {
  const mongoUrl =
    process.env.MONGO_URL ??
    process.env.MONGODB_URI ??
    'mongodb://localhost:27017/robco';

  try {
    await mongoose.connect(mongoUrl);
  } catch (e) {
    const err = e as { message?: string };
    console.error(`[connect] failed to connect to Mongo: ${err.message}`);
    throw e;
  }
  const db = mongoose.connection.db;
  if (!db) throw new Error('Mongo connection has no db handle');

  const characters = db.collection('characters');

  // Only non-deleted characters that actually hold an out-of-range attribute.
  const outOfRange = {
    isDeleted: { $ne: true },
    $or: SPECIAL_KEYS.flatMap((key) => [
      { [`special.${key}`]: { $lt: SPECIAL_MIN } },
      { [`special.${key}`]: { $gt: SPECIAL_MAX } },
    ]),
  };

  const totalBefore = await characters.countDocuments({});
  const affectedBefore = await characters.countDocuments(outOfRange);
  console.log(
    `[before] total=${totalBefore} withOutOfRangeSpecial=${affectedBefore}`,
  );

  // Aggregation-pipeline update clamps each attribute in place.
  const clampStage = {
    $set: Object.fromEntries(
      SPECIAL_KEYS.map((key) => [
        `special.${key}`,
        {
          $max: [SPECIAL_MIN, { $min: [SPECIAL_MAX, `$special.${key}`] }],
        },
      ]),
    ),
  };

  const res = await characters.updateMany(outOfRange, [clampStage]);
  console.log(
    `[clamp] matched=${res.matchedCount} modified=${res.modifiedCount}`,
  );

  const affectedAfter = await characters.countDocuments(outOfRange);
  console.log(`[after] withOutOfRangeSpecial=${affectedAfter}`);
  if (affectedAfter !== 0) {
    throw new Error(
      `[verify] ${affectedAfter} character(s) still hold an out-of-range SPECIAL attribute`,
    );
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
