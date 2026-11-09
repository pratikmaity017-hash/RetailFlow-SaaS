import { Router } from "express";

import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
} from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from "../validators/auth.validator.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshTokenSchema), refresh);
router.get("/me", authenticate, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authentication successful",
    data: {
      userId: req.auth.userId,
      sessionId: req.auth.sessionId,
    },
  });
});

router.post("/logout", authenticate, logout);
router.post("/logout-all", authenticate, logoutAll);

export default router;
