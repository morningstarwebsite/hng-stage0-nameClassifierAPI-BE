import { Router } from "express";
import {
  createProfile,
  deleteProfile,
  exportProfilesAsCsv,
  getProfileById,
  listProfiles,
  searchProfiles,
} from "../controllers/profileController.js";
import { requireRole } from "../middleware/authorization.js";

const router = Router();

router.get("/profiles/export", exportProfilesAsCsv);
router.get("/profiles/search", searchProfiles);
router.get("/profiles/:id", getProfileById);
router.get("/profiles", listProfiles);
router.post("/profiles", requireRole("admin"), createProfile);
router.delete("/profiles/:id", requireRole("admin"), deleteProfile);

export default router;