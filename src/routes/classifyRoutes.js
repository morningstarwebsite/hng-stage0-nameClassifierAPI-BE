// Defines the classify resource routes and wires them to controller actions.

import { Router } from "express";
import { classifyName } from "../controllers/classifyController.js";

const router = Router();

router.get("/classify", classifyName);

export default router;