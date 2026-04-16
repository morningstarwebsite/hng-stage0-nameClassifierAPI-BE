import {
  createProfileRecord,
  deleteProfileRecord,
  getProfileRecordById,
  listProfileRecords,
} from "../services/profileService.js";

export async function createProfile(req, res, next) {
  try {
    const result = await createProfileRecord(req.body?.name);

    res.status(result.alreadyExists ? 200 : 201).json({
      status: "success",
      ...(result.alreadyExists ? { message: "Profile already exists" } : {}),
      data: result.profile,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProfileById(req, res, next) {
  try {
    const profile = await getProfileRecordById(req.params.id);

    res.status(200).json({
      status: "success",
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

export async function listProfiles(req, res, next) {
  try {
    const profiles = await listProfileRecords(req.query);

    res.status(200).json({
      status: "success",
      data: profiles,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteProfile(req, res, next) {
  try {
    await deleteProfileRecord(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}