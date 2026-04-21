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
  buildListProfileQuery,
  buildSearchProfileQuery,
} from "./profileQueryService.js";

async function findExistingProfile(normalizedName) {
  return Profile.findOne({
    where: where(fn("LOWER", col("name")), normalizedName),
  });
}

export async function createProfileRecord(nameInput) {
  const name = validateNameInput(nameInput);

  const [genderData, ageData, nationalityData] = await Promise.all([
    fetchGenderPrediction(name),
    fetchAgePrediction(name),
    fetchNationalityPrediction(name),
  ]);

  const payload = transformProfileData(name, genderData, ageData, nationalityData);
  const existingProfile = await findExistingProfile(payload.name.toLowerCase());

  if (existingProfile) {
    return {
      alreadyExists: true,
      profile: serializeProfile(existingProfile),
    };
  }

  try {
    const createdProfile = await Profile.create(payload);

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
  const profile = await Profile.findByPk(id);

  if (!profile) {
    throw new AppError(404, "Profile not found");
  }

  return serializeProfile(profile);
}

async function runProfileQuery(options) {
  const result = await Profile.findAndCountAll({
    where: options.where,
    order: options.order,
    limit: options.limit,
    offset: options.offset,
  });

  return {
    page: options.page,
    limit: options.limit,
    total: result.count,
    data: result.rows.map(serializeProfile),
  };
}

export async function listProfileRecords(filters) {
  return runProfileQuery(buildListProfileQuery(filters));
}

export async function searchProfileRecords(query) {
  return runProfileQuery(buildSearchProfileQuery(query));
}

export async function deleteProfileRecord(id) {
  const deletedCount = await Profile.destroy({
    where: { id },
  });

  if (deletedCount === 0) {
    throw new AppError(404, "Profile not found");
  }
}