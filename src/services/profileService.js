import { Profile } from "../models/index.js";
import { Op, fn, col, where } from "sequelize";
import { AppError } from "../utils/appError.js";
import {
  fetchAgePrediction,
  fetchGenderPrediction,
  fetchNationalityPrediction,
} from "./upstreamService.js";
import {
  serializeProfile,
  transformProfileData,
  validateNameInput,
} from "./profileTransformService.js";
import {
  buildListProfileCacheKey,
  buildListProfileQuery,
  buildListProfileExportCacheKey,
  buildSearchProfileCacheKey,
  buildListProfileExportQuery,
  buildSearchProfileQuery,
} from "./profileQueryService.js";
import {
  clearCacheNamespace,
  getOrSetCachedValue,
} from "./queryCacheService.js";

const PROFILE_ATTRIBUTES = [
  "id",
  "name",
  "gender",
  "gender_probability",
  "age",
  "age_group",
  "country_id",
  "country_name",
  "country_probability",
  "created_at",
];
const CACHE_NS_PROFILE_BY_ID = "profiles:by-id";
const CACHE_NS_PROFILE_LIST = "profiles:list";
const CACHE_NS_PROFILE_SEARCH = "profiles:search";
const CACHE_NS_PROFILE_EXPORT = "profiles:export";
const PROFILE_CACHE_TTL_MS = Number(process.env.PROFILE_CACHE_TTL_MS || 30_000);

function invalidateProfileReadCaches() {
  clearCacheNamespace(CACHE_NS_PROFILE_BY_ID);
  clearCacheNamespace(CACHE_NS_PROFILE_LIST);
  clearCacheNamespace(CACHE_NS_PROFILE_SEARCH);
  clearCacheNamespace(CACHE_NS_PROFILE_EXPORT);
}

async function findExistingProfile(normalizedName) {
  return Profile.findOne({
    attributes: PROFILE_ATTRIBUTES,
    where: where(fn("LOWER", col("name")), normalizedName),
    raw: true,
  });
}

export async function createProfileRecord(nameInput) {
  const name = validateNameInput(nameInput);
  const existingProfile = await findExistingProfile(name.toLowerCase());

  // Skip upstream network calls when the name already exists.
  if (existingProfile) {
    return {
      alreadyExists: true,
      profile: serializeProfile(existingProfile),
    };
  }

  const [genderData, ageData, nationalityData] = await Promise.all([
    fetchGenderPrediction(name),
    fetchAgePrediction(name),
    fetchNationalityPrediction(name),
  ]);

  const payload = transformProfileData(name, genderData, ageData, nationalityData);
  const existingProfileAfterFetch = await findExistingProfile(payload.name.toLowerCase());

  if (existingProfileAfterFetch) {
    return {
      alreadyExists: true,
      profile: serializeProfile(existingProfileAfterFetch),
    };
  }

  try {
    const createdProfile = await Profile.create(payload);
    invalidateProfileReadCaches();

    return {
      alreadyExists: false,
      profile: serializeProfile(createdProfile),
    };
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      // A concurrent request may insert the same name after our first existence check.
      const concurrentProfile = await findExistingProfile(payload.name.toLowerCase());

      if (concurrentProfile) {
        return {
          alreadyExists: true,
          profile: serializeProfile(concurrentProfile),
        };
      }
    }

    throw err;
  }
}

export async function getProfileRecordById(id) {
  return getOrSetCachedValue(
    CACHE_NS_PROFILE_BY_ID,
    id,
    async () => {
      const profile = await Profile.findByPk(id, {
        attributes: PROFILE_ATTRIBUTES,
        raw: true,
      });

      if (!profile) {
        throw new AppError(404, "Profile not found");
      }

      return serializeProfile(profile);
    },
    PROFILE_CACHE_TTL_MS,
  );
}

async function runProfileQuery(options) {
  const [total, rows] = await Promise.all([
    Profile.count({ where: options.where }),
    Profile.findAll({
      attributes: PROFILE_ATTRIBUTES,
      where: options.where,
      order: options.order,
      limit: options.limit,
      offset: options.offset,
      raw: true,
    }),
  ]);

  return {
    page: options.page,
    limit: options.limit,
    total,
    total_pages: total === 0 ? 0 : Math.ceil(total / options.limit),
    data: rows.map(serializeProfile),
  };
}

export async function listProfileRecords(filters) {
  const options = buildListProfileQuery(filters);
  const cacheKey = buildListProfileCacheKey(filters);

  return getOrSetCachedValue(
    CACHE_NS_PROFILE_LIST,
    cacheKey,
    () => runProfileQuery(options),
    PROFILE_CACHE_TTL_MS,
  );
}

export async function searchProfileRecords(query) {
  const options = buildSearchProfileQuery(query);
  const cacheKey = buildSearchProfileCacheKey(query);

  return getOrSetCachedValue(
    CACHE_NS_PROFILE_SEARCH,
    cacheKey,
    () => runProfileQuery(options),
    PROFILE_CACHE_TTL_MS,
  );
}

export async function exportProfileRecords(filters) {
  const options = buildListProfileExportQuery(filters);
  const cacheKey = buildListProfileExportCacheKey(filters);

  return getOrSetCachedValue(
    CACHE_NS_PROFILE_EXPORT,
    cacheKey,
    async () => {
      const profiles = await Profile.findAll({
        attributes: PROFILE_ATTRIBUTES,
        where: options.where,
        order: options.order,
        raw: true,
      });

      return profiles.map(serializeProfile);
    },
    PROFILE_CACHE_TTL_MS,
  );
}

export async function deleteProfileRecord(id) {
  const deletedCount = await Profile.destroy({
    where: { id },
  });

  if (deletedCount === 0) {
    throw new AppError(404, "Profile not found");
  }

  invalidateProfileReadCaches();
}