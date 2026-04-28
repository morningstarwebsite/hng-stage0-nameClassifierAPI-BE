import { Router } from "express";
import {
  beginGithubAuth,
  githubAuthCallback,
  logoutSession,
  refreshSession,
} from "../controllers/authController.js";

const router = Router();

router.get("/github", beginGithubAuth);
router.get("/github/callback", githubAuthCallback);
router.post("/refresh", refreshSession);
router.post("/logout", logoutSession);

export default router;
