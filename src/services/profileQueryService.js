import { Op } from "sequelize";
import { AppError } from "../utils/appError.js";
import { parseNaturalLanguageProfileQuery } from "./profileSearchService.js";

const allowedListQueryKeys = new Set([
  "gender",
  "age_group",
  "country_id",
  "min_age",
  "max_age",
  "min_gender_probability",
  "min_country_probability",
  "sort_by",
  "order",
  "page",
  "limit",
]);

const allowedSearchQueryKeys = new Set(["q", "sort_by", "order", "page", "limit"]);
const allowedAgeGroups = new Set(["child", "teenager", "adult", "senior"]);
const sortFieldMap = {
  age: "age",
  created_at: "created_at",
  gender_probability: "gender_probability",
};

function invalidQueryParametersError() {
  return new AppError(422, "Invalid query parameters");
}

function readSingleQueryValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== "string") {
    throw invalidQueryParametersError();
  }

  return value.trim();
}

function validateAllowedKeys(query, allowedKeys) {
  // Reject unknown keys early so the API contract stays explicit and assessment-friendly.
  for (const key of Object.keys(query)) {
    if (!allowedKeys.has(key)) {
      throw invalidQueryParametersError();
    }
  }
}

function parsePositiveInteger(value, defaultValue, maxValue) {
  const normalizedValue = readSingleQueryValue(value);

  if (normalizedValue === undefined) {
    return defaultValue;
  }

  if (!/^\d+$/.test(normalizedValue)) {
    throw invalidQueryParametersError();
  }

  const parsedValue = Number(normalizedValue);

  if (parsedValue < 1) {
    throw invalidQueryParametersError();
  }

  if (maxValue !== undefined && parsedValue > maxValue) {
    throw invalidQueryParametersError();
  }

  return parsedValue;
}

function parseIntegerFilter(value) {
  const normalizedValue = readSingleQueryValue(value);

  if (normalizedValue === undefined || normalizedValue === "") {
    return undefined;
  }

  if (!/^\d+$/.test(normalizedValue)) {
    throw invalidQueryParametersError();
  }

  return Number(normalizedValue);
}

function parseProbabilityFilter(value) {
  const normalizedValue = readSingleQueryValue(value);

  if (normalizedValue === undefined || normalizedValue === "") {
    return undefined;
  }

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    throw invalidQueryParametersError();
  }

  const parsedValue = Number(normalizedValue);

  if (parsedValue < 0 || parsedValue > 1) {
    throw invalidQueryParametersError();
  }

  return parsedValue;
}

function parseGender(value) {
  const normalizedValue = readSingleQueryValue(value);

  if (normalizedValue === undefined) {
    return undefined;
  }

  const lowered = normalizedValue.toLowerCase();

  if (lowered !== "male" && lowered !== "female") {
    throw invalidQueryParametersError();
  }

  return lowered;
}

function parseAgeGroup(value) {
  const normalizedValue = readSingleQueryValue(value);

  if (normalizedValue === undefined) {
    return undefined;
  }

  const lowered = normalizedValue.toLowerCase();

  if (!allowedAgeGroups.has(lowered)) {
    throw invalidQueryParametersError();
  }

  return lowered;
}

function parseCountryId(value) {
  const normalizedValue = readSingleQueryValue(value);

  if (normalizedValue === undefined) {
    return undefined;
  }

  if (!/^[a-z]{2}$/i.test(normalizedValue)) {
    throw invalidQueryParametersError();
  }

  return normalizedValue.toUpperCase();
}

function parseSortOrder(value) {
  const normalizedValue = readSingleQueryValue(value);

  if (normalizedValue === undefined) {
    return "DESC";
  }

  const lowered = normalizedValue.toLowerCase();

  if (lowered !== "asc" && lowered !== "desc") {
    throw invalidQueryParametersError();
  }

  return lowered.toUpperCase();
}

function parseSortField(value) {
  const normalizedValue = readSingleQueryValue(value);

  if (normalizedValue === undefined) {
    return "created_at";
  }

  const lowered = normalizedValue.toLowerCase();

  if (!sortFieldMap[lowered]) {
    throw invalidQueryParametersError();
  }

  return lowered;
}

function buildWhereClause(filters) {
  const where = {};

  if (filters.gender) {
    where.gender = filters.gender;
  }

  if (filters.age_group) {
    where.age_group = filters.age_group;
  }

  if (filters.country_id) {
    where.country_id = filters.country_id;
  }

  if (filters.min_age !== undefined || filters.max_age !== undefined) {
    where.age = {};

    if (filters.min_age !== undefined) {
      where.age[Op.gte] = filters.min_age;
    }

    if (filters.max_age !== undefined) {
      where.age[Op.lte] = filters.max_age;
    }
  }

  if (filters.min_gender_probability !== undefined) {
    where.gender_probability = { [Op.gte]: filters.min_gender_probability };
  }

  if (filters.min_country_probability !== undefined) {
    where.country_probability = { [Op.gte]: filters.min_country_probability };
  }

  return where;
}

function buildQueryOptions(filters, query, options = {}) {
  const page = parsePositiveInteger(query.page, 1);
  const limit = parsePositiveInteger(query.limit, 10, 50);
  const sortBy = parseSortField(query.sort_by);
  const order = parseSortOrder(query.order);

  if (filters.min_age !== undefined && filters.max_age !== undefined && filters.min_age > filters.max_age) {
    throw invalidQueryParametersError();
  }

  const queryOptions = {
    where: buildWhereClause(filters),
    // A stable secondary sort keeps pagination deterministic when primary values tie.
    order: [[sortFieldMap[sortBy], order], ["id", "ASC"]],
  };

  if (!options.paginate) {
    return queryOptions;
  }

  return {
    ...queryOptions,
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function extractDirectFilters(query) {
  return {
    gender: parseGender(query.gender),
    age_group: parseAgeGroup(query.age_group),
    country_id: parseCountryId(query.country_id),
    min_age: parseIntegerFilter(query.min_age),
    max_age: parseIntegerFilter(query.max_age),
    min_gender_probability: parseProbabilityFilter(query.min_gender_probability),
    min_country_probability: parseProbabilityFilter(query.min_country_probability),
  };
}

export function buildListProfileQuery(query) {
  validateAllowedKeys(query, allowedListQueryKeys);
  return buildQueryOptions(extractDirectFilters(query), query, { paginate: true });
}

export function buildListProfileExportQuery(query) {
  validateAllowedKeys(query, allowedListQueryKeys);
  return buildQueryOptions(extractDirectFilters(query), query, { paginate: false });
}

export function buildSearchProfileQuery(query) {
  validateAllowedKeys(query, allowedSearchQueryKeys);

  const searchTerm = readSingleQueryValue(query.q);

  if (searchTerm === undefined || searchTerm === "") {
    throw new AppError(400, "The 'q' parameter is required");
  }

  // Search reuses the same query builder as direct filters after the text is parsed.
  const filters = parseNaturalLanguageProfileQuery(searchTerm);

  return buildQueryOptions(filters, query, { paginate: true });
}