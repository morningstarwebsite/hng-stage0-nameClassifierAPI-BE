import { AppError } from "../utils/appError.js";
import { lookupCountryCode } from "./countryLookupService.js";

// These patterns keep the parser deterministic by only accepting explicit age phrases.
const ageRangePatterns = [
  /\bbetween(?:\s+ages?)?\s+(\d{1,3})\s+(?:and|to)\s+(\d{1,3})\b/i,
  /\baged?\s+(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\b/i,
  /\bages?\s+(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\b/i,
];
const minimumAgePatterns = [
  /\b(?:above|over|older than|at least)\s+(\d{1,3})\b/i,
];
const maximumAgePatterns = [
  /\b(?:below|under|younger than|at most)\s+(\d{1,3})\b/i,
];

function normalizeSearchQuery(query) {
  return query
    .toLowerCase()
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAgeRange(query) {
  for (const pattern of ageRangePatterns) {
    const match = query.match(pattern);

    if (match) {
      return {
        minAge: Math.min(Number(match[1]), Number(match[2])),
        maxAge: Math.max(Number(match[1]), Number(match[2])),
      };
    }
  }

  return null;
}

function getMatchNumber(query, patterns) {
  for (const pattern of patterns) {
    const match = query.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return undefined;
}

function getGenderFilter(query) {
  const hasMale = /\b(male|males|man|men|boy|boys)\b/.test(query);
  const hasFemale = /\b(female|females|woman|women|girl|girls)\b/.test(query);

  // When both sides appear, the request is treated as mixed-gender rather than guessed.
  if (hasMale && !hasFemale) {
    return "male";
  }

  if (hasFemale && !hasMale) {
    return "female";
  }

  return undefined;
}

function getAgeGroupFilter(query) {
  if (/\b(child|children)\b/.test(query)) {
    return "child";
  }

  if (/\b(teen|teens|teenager|teenagers)\b/.test(query)) {
    return "teenager";
  }

  if (/\b(adult|adults)\b/.test(query)) {
    return "adult";
  }

  if (/\b(senior|seniors)\b/.test(query)) {
    return "senior";
  }

  return undefined;
}

function getCountryFilter(query) {
  const match = query.match(/\b(?:from|in|living in)\s+([a-z][a-z\s'-]*)/i);

  if (!match) {
    const adjectiveTokens = query.match(/\b[a-z]+(?:an|ian|ese|ish)\b/g) || [];

    for (const token of adjectiveTokens) {
      const code = lookupCountryCode(token);

      if (code) {
        return code;
      }
    }

    return undefined;
  }

  // Strip trailing age/gender words so "from kenya above 30" still resolves to KE.
  const countryTerm = match[1]
    .replace(/\b(?:above|over|older than|at least|below|under|younger than|at most)\b.*$/i, "")
    .replace(/\b(?:male|males|female|females|man|men|woman|women|boy|boys|girl|girls|child|children|teen|teens|teenager|teenagers|adult|adults|senior|seniors|young)\b.*$/i, "")
    .trim();

  return lookupCountryCode(countryTerm) || undefined;
}

export function parseNaturalLanguageProfileQuery(query) {
  if (typeof query !== "string") {
    throw new AppError(422, "Invalid query parameters");
  }

  const normalizedQuery = normalizeSearchQuery(query);

  if (normalizedQuery.length === 0) {
    throw new AppError(400, "The 'q' parameter is required");
  }

  const filters = {};
  const gender = getGenderFilter(normalizedQuery);
  const ageGroup = getAgeGroupFilter(normalizedQuery);
  const countryId = getCountryFilter(normalizedQuery);
  const ageRange = getAgeRange(normalizedQuery);
  const minAge = getMatchNumber(normalizedQuery, minimumAgePatterns);
  const maxAge = getMatchNumber(normalizedQuery, maximumAgePatterns);
  const isYoung = /\byoung\b/.test(normalizedQuery);

  if (gender) {
    filters.gender = gender;
  }

  if (ageGroup) {
    filters.age_group = ageGroup;
  }

  if (countryId) {
    filters.country_id = countryId;
  }

  if (isYoung) {
    // "young" is a parsing shortcut only; it is never stored as an age_group value.
    filters.min_age = 16;
    filters.max_age = 24;
  }

  if (ageRange) {
    filters.min_age = ageRange.minAge;
    filters.max_age = ageRange.maxAge;
  }

  if (minAge !== undefined) {
    filters.min_age = filters.min_age === undefined ? minAge : Math.max(filters.min_age, minAge);
  }

  if (maxAge !== undefined) {
    filters.max_age = filters.max_age === undefined ? maxAge : Math.min(filters.max_age, maxAge);
  }

  if (filters.min_age !== undefined && filters.max_age !== undefined && filters.min_age > filters.max_age) {
    throw new AppError(400, "Unable to interpret query");
  }

  if (Object.keys(filters).length === 0) {
    throw new AppError(400, "Unable to interpret query");
  }

  return filters;
}