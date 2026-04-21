import { readFile } from "node:fs/promises";
import { v7 as uuidv7 } from "uuid";
import { connectDatabase, sequelize } from "../config/database.js";
import { Profile } from "../models/index.js";
import { Op, fn, col, where } from "sequelize";
import { getCountryName } from "../services/countryLookupService.js";
import { classifyAgeGroup, normalizeName } from "../services/profileTransformService.js";

function assertSeedRecord(record, index) {
  const requiredKeys = [
    "name",
    "gender",
    "gender_probability",
    "age",
    "age_group",
    "country_id",
    "country_name",
    "country_probability",
  ];

  for (const key of requiredKeys) {
    if (record[key] === undefined || record[key] === null || record[key] === "") {
      throw new Error(`Invalid seed record at index ${index}: missing '${key}'`);
    }
  }
}

function extractSeedRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  // The 2026 assessment seed ships as { profiles: [...] }, but a raw array is also accepted.
  if (Array.isArray(payload?.profiles)) {
    return payload.profiles;
  }

  throw new Error("Seed file must contain a JSON array or an object with a 'profiles' array");
}

function mapSeedRecordToProfile(record) {
  const normalizedName = normalizeName(record.name);

  return {
    id: record.id || uuidv7(),
    name: normalizedName,
    gender: String(record.gender).toLowerCase(),
    gender_probability: Number(record.gender_probability),
    age: Number(record.age),
    age_group: String(record.age_group || classifyAgeGroup(Number(record.age))).toLowerCase(),
    country_id: String(record.country_id).toUpperCase(),
    country_name: record.country_name || getCountryName(record.country_id),
    country_probability: Number(record.country_probability),
  };
}

async function seedProfiles(seedFilePath) {
  const fileContents = await readFile(seedFilePath, "utf8");
  const payload = JSON.parse(fileContents);
  const records = extractSeedRecords(payload);

  let createdCount = 0;
  let updatedCount = 0;

  for (const [index, record] of records.entries()) {
    assertSeedRecord(record, index);
    const profilePayload = mapSeedRecordToProfile(record);
    const existingProfile = await Profile.findOne({
      where: where(fn("LOWER", col("name")), profilePayload.name.toLowerCase()),
    });

    // Seeding is idempotent: matching names are updated instead of inserted again.
    if (existingProfile) {
      await existingProfile.update({
        name: profilePayload.name,
        gender: profilePayload.gender,
        gender_probability: profilePayload.gender_probability,
        age: profilePayload.age,
        age_group: profilePayload.age_group,
        country_id: profilePayload.country_id,
        country_name: profilePayload.country_name,
        country_probability: profilePayload.country_probability,
      });
      updatedCount += 1;
      continue;
    }

    await Profile.create(profilePayload);
    createdCount += 1;
  }

  console.log(`[seed] completed: created=${createdCount} updated=${updatedCount}`);
}

const seedFilePath = process.argv[2];

if (!seedFilePath) {
  console.error("[seed] usage: npm run seed:profiles -- ./path/to/seed.json");
  process.exit(1);
}

connectDatabase()
  .then(() => seedProfiles(seedFilePath))
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error("[seed] failed", error);
    await sequelize.close().catch(() => undefined);
    process.exit(1);
  });