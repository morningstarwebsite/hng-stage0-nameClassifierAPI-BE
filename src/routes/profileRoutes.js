import { Router } from "express";
import {
  createProfile,
  deleteProfile,
  getProfileById,
  listProfiles,
} from "../controllers/profileController.js";

const router = Router();

router.post("/profiles", createProfile);
router.get("/profiles/:id", getProfileById);
router.get("/profiles", listProfiles);
router.delete("/profiles/:id", deleteProfile);

export default router;