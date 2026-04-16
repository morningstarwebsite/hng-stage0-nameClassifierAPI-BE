import { Op, col, fn, where } from "sequelize";
import { Profile } from "../models/index.js";
import { AppError } from "../utils/appError.js";
import {
  fetchAgePrediction,
  fetchGenderPrediction,
  fetchNationalityPrediction,
} from "./upstreamService.js";
import {
  normalizeFilterValue,
  serializeProfile,
  transformProfileData,
  validateNameInput,
} from "./profileTransformService.js";

async function findExistingProfile(normalizedName) {
  return Profile.findOne({
    where: { normalized_name: normalizedName },
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
  const existingProfile = await findExistingProfile(payload.normalized_name);

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
      const concurrentProfile = await findExistingProfile(payload.normalized_name);

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

export async function listProfileRecords(filters) {
  const gender = normalizeFilterValue(filters.gender, "gender");
  const countryId = normalizeFilterValue(filters.country_id, "country_id");
  const ageGroup = normalizeFilterValue(filters.age_group, "age_group");
  const andConditions = [];

  if (gender) {
    andConditions.push(where(fn("LOWER", col("gender")), gender));
  }

  if (countryId) {
    andConditions.push(where(fn("LOWER", col("country_id")), countryId));
  }

  if (ageGroup) {
    andConditions.push(where(fn("LOWER", col("age_group")), ageGroup));
  }

  const profiles = await Profile.findAll({
    where: andConditions.length > 0 ? { [Op.and]: andConditions } : undefined,
    order: [["created_at", "DESC"]],
  });

  return profiles.map(serializeProfile);
}

export async function deleteProfileRecord(id) {
  const deletedCount = await Profile.destroy({
    where: { id },
  });

  if (deletedCount === 0) {
    throw new AppError(404, "Profile not found");
  }
}