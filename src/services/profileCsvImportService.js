import fs from "node:fs";
import readline from "node:readline";
import { QueryTypes } from "sequelize";
import { v7 as uuidv7 } from "uuid";
import { sequelize } from "../config/database.js";
import { Profile } from "../models/index.js";
import { getCountryName } from "./countryLookupService.js";
import { classifyAgeGroup, normalizeName } from "./profileTransformService.js";

const REQUIRED_HEADERS = [
  "name",
  "gender",
  "gender_probability",
  "age",
  "age_group",
  "country_id",
  "country_name",
  "country_probability",
];
const DEFAULT_BATCH_SIZE = Number(process.env.CSV_IMPORT_BATCH_SIZE || 1_000);

function buildSummary() {
  return {
    status: "success",
    total_rows: 0,
    inserted: 0,
    skipped: 0,
    reasons: {
      duplicate_name: 0,
      invalid_age: 0,
      missing_fields: 0,
      malformed: 0,
    },
  };
}

function recordSkip(summary, reason) {
  summary.skipped += 1;
  summary.reasons[reason] += 1;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      if (!inQuotes && current.length > 0) {
        return null;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  if (inQuotes) {
    return null;
  }

  values.push(current);
  return values;
}

function buildHeaderMap(headerLine) {
  const headers = parseCsvLine(headerLine);

  if (!headers) {
    throw new Error("CSV header row is malformed");
  }

  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());

  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!normalizedHeaders.includes(requiredHeader)) {
      throw new Error(`CSV file is missing required header '${requiredHeader}'`);
    }
  }

  return normalizedHeaders;
}

function mapCsvRow(headers, line) {
  const values = parseCsvLine(line);

  if (!values || values.length !== headers.length) {
    return null;
  }

  const row = {};

  headers.forEach((header, index) => {
    row[header] = values[index]?.trim() ?? "";
  });

  return row;
}

function validateRequiredFields(row) {
  return REQUIRED_HEADERS.every((header) => row[header] !== undefined && row[header] !== "");
}

function normalizeCsvProfile(row) {
  const name = normalizeName(row.name);
  const age = Number(row.age);
  const genderProbability = Number(row.gender_probability);
  const countryProbability = Number(row.country_probability);
  const gender = String(row.gender).toLowerCase();
  const ageGroup = String(row.age_group || classifyAgeGroup(age)).toLowerCase();
  const countryId = String(row.country_id).toUpperCase();

  if (!name) {
    return { reason: "missing_fields" };
  }

  if (!Number.isFinite(age) || age < 0) {
    return { reason: "invalid_age" };
  }

  if (!Number.isFinite(genderProbability) || genderProbability < 0 || genderProbability > 1) {
    return { reason: "malformed" };
  }

  if (!Number.isFinite(countryProbability) || countryProbability < 0 || countryProbability > 1) {
    return { reason: "malformed" };
  }

  if (gender !== "male" && gender !== "female") {
    return { reason: "malformed" };
  }

  if (!["child", "teenager", "adult", "senior"].includes(ageGroup)) {
    return { reason: "malformed" };
  }

  if (!/^[A-Z]{2}$/.test(countryId)) {
    return { reason: "malformed" };
  }

  return {
    profile: {
      id: row.id || uuidv7(),
      name,
      gender,
      gender_probability: genderProbability,
      age,
      age_group: ageGroup,
      country_id: countryId,
      country_name: row.country_name || getCountryName(countryId) || countryId,
      country_probability: countryProbability,
    },
    normalizedName: name.toLowerCase(),
  };
}

async function loadExistingNormalizedNames(normalizedNames) {
  if (normalizedNames.length === 0) {
    return new Set();
  }

  const rows = await sequelize.query(
    "SELECT LOWER(name) AS normalized_name FROM profiles WHERE LOWER(name) = ANY($1)",
    {
      bind: [normalizedNames],
      type: QueryTypes.SELECT,
    },
  );

  return new Set(rows.map((row) => row.normalized_name));
}

async function flushBatch(batch, summary) {
  if (batch.length === 0) {
    return;
  }

  const existingNameSet = await loadExistingNormalizedNames(batch.map((entry) => entry.normalizedName));
  const insertableProfiles = [];

  for (const entry of batch) {
    if (existingNameSet.has(entry.normalizedName)) {
      recordSkip(summary, "duplicate_name");
      continue;
    }

    insertableProfiles.push(entry.profile);
  }

  if (insertableProfiles.length === 0) {
    return;
  }

  try {
    await Profile.bulkCreate(insertableProfiles, {
      ignoreDuplicates: true,
    });
    summary.inserted += insertableProfiles.length;
  } catch {
    summary.skipped += insertableProfiles.length;
    summary.reasons.malformed += insertableProfiles.length;
  }

  await new Promise((resolve) => setImmediate(resolve));
}

export async function importProfilesFromCsv(filePath, options = {}) {
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const summary = buildSummary();
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let headers = null;
  let batch = [];
  const fileNameSet = new Set();

  try {
    for await (const line of reader) {
      if (headers === null) {
        headers = buildHeaderMap(line);
        continue;
      }

      if (line.trim() === "") {
        continue;
      }

      summary.total_rows += 1;
      const rawRow = mapCsvRow(headers, line);

      if (!rawRow) {
        recordSkip(summary, "malformed");
        continue;
      }

      if (!validateRequiredFields(rawRow)) {
        recordSkip(summary, "missing_fields");
        continue;
      }

      const normalized = normalizeCsvProfile(rawRow);

      if (!normalized.profile) {
        recordSkip(summary, normalized.reason);
        continue;
      }

      if (fileNameSet.has(normalized.normalizedName)) {
        recordSkip(summary, "duplicate_name");
        continue;
      }

      fileNameSet.add(normalized.normalizedName);
      batch.push(normalized);

      if (batch.length >= batchSize) {
        await flushBatch(batch, summary);
        batch = [];
      }
    }

    await flushBatch(batch, summary);
    return summary;
  } finally {
    reader.close();
    stream.close();
  }
}