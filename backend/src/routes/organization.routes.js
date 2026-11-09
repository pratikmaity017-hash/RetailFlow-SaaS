import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";

const router = Router();

router.get(
  "/:organizationId/context",
  authenticate,
  requireOrganization,
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Organization access verified",
      data: {
        organization: req.organization,
        membership: req.membership,
      },
    });
  },
);

router.get(
  "/:organizationId/owner-only",
  authenticate,
  requireOrganization,
  authorize("owner"),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Owner permission verified",
      data: {
        userId: req.auth.userId,
        organizationId: req.organization.id,
        role: req.membership.role,
      },
    });
  },
);

export default router;
