import { AppError } from "../utils/appError.js";

function toFiniteNumber(value, message) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new AppError(502, message);
  }

  return numericValue;
}

export function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ");
}

export function validateNameInput(name) {
  if (name === undefined) {
    throw new AppError(400, "The 'name' field is required");
  }

  if (typeof name !== "string") {
    throw new AppError(422, "The 'name' field must be a string");
  }

  const normalized = normalizeName(name);

  if (normalized.length === 0) {
    throw new AppError(400, "The 'name' field cannot be empty");
  }

  return normalized;
}

export function normalizeFilterValue(value, key) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError(422, `The '${key}' filter must be a string`);
  }

  const normalized = value.trim();

  return normalized === "" ? undefined : normalized.toLowerCase();
}

export function classifyAgeGroup(age) {
  if (age <= 12) {
    return "child";
  }

  if (age <= 19) {
    return "teenager";
  }

  if (age <= 59) {
    return "adult";
  }

  return "senior";
}

export function transformProfileData(name, genderData, ageData, nationalityData) {
  if (!genderData?.gender || Number(genderData.count) === 0) {
    throw new AppError(404, "No valid gender data available for the provided name");
  }

  if (ageData?.age === null || ageData?.age === undefined) {
    throw new AppError(404, "No valid age data available for the provided name");
  }

  if (!Array.isArray(nationalityData?.country) || nationalityData.country.length === 0) {
    throw new AppError(404, "No valid nationality data available for the provided name");
  }

  const topCountry = nationalityData.country.reduce((highest, current) => {
    if (!highest || Number(current.probability) > Number(highest.probability)) {
      return current;
    }

    return highest;
  }, null);

  if (!topCountry?.country_id) {
    throw new AppError(502, "Nationalize returned invalid country data");
  }

  const sanitizedName = normalizeName(name);
  const normalized_name = sanitizedName.toLowerCase();
  const probability = toFiniteNumber(
    genderData.probability,
    "Genderize returned invalid probability data",
  );
  const sample_size = toFiniteNumber(
    genderData.count,
    "Genderize returned invalid sample size data",
  );
  const age = toFiniteNumber(ageData.age, "Agify returned invalid age data");
  const country_probability = toFiniteNumber(
    topCountry.probability,
    "Nationalize returned invalid country probability data",
  );

  return {
    name: sanitizedName,
    normalized_name,
    gender: genderData.gender,
    probability,
    sample_size,
    age,
    age_group: classifyAgeGroup(age),
    country_id: topCountry.country_id.toUpperCase(),
    country_probability,
  };
}

export function serializeProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    gender: profile.gender,
    probability: profile.probability,
    sample_size: profile.sample_size,
    age: profile.age,
    age_group: profile.age_group,
    country_id: profile.country_id,
    country_probability: profile.country_probability,
    created_at: profile.created_at instanceof Date ? profile.created_at.toISOString() : profile.created_at,
    updated_at: profile.updated_at instanceof Date ? profile.updated_at.toISOString() : profile.updated_at,
  };
}