import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  registerUser,
  sendOTP,
  verifyOTP,
  logoutUser,
  getCurrentUser,
  sendRegisterEmailOtp,
  verifyRegisterEmailOtp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/register/send-email-otp", sendRegisterEmailOtp);
router.post("/register/verify-email-otp", verifyRegisterEmailOtp);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/logout", logoutUser);
router.get("/me", protect, getCurrentUser);

export default router;
