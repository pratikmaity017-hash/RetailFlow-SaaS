import { Router } from "express";

import { listBusinessCategories } from "../controllers/business-category.controller.js";

const router = Router();

router.get("/", listBusinessCategories);

export default router;
