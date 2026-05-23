import User from "../../models/User.js";
import { parseIdentifier, findUserByIdentifier, ensureUserExists } from "../utils/identifier.js";
import { generateEmailOtp, MOBILE_STATIC_OTP } from "../utils/otp.js";
import { saveOtp, verifyStoredOtp, OTP_EXPIRY_MS } from "../utils/otpStore.js";
import { sendOtpEmail } from "../utils/emailService.js";
import {
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
  formatAuthUser,
} from "../utils/token.js";

// ─── SEND OTP ───────────────────────────────────────────────────────────────
export const sendOTP = async (req, res) => {
  try {
    const identifier = parseIdentifier(req.body?.identifier ?? req.body?.email ?? req.body?.phonenum);
    if (identifier?.error) {
      return res.status(400).json({ success: false, message: identifier.error });
    }

    if (identifier.type === "mobile") {
      saveOtp(identifier.key, { otp: MOBILE_STATIC_OTP, type: "mobile" });
      return res.status(200).json({
        success: true,
        channel: "mobile",
        expiresIn: OTP_EXPIRY_MS,
        message: "OTP sent to your mobile number.",
      });
    }

    const otp = generateEmailOtp();
    saveOtp(identifier.key, { otp, type: "email" });

    let delivered = false;
    try {
      await sendOtpEmail(identifier.key, otp);
      delivered = true;
    } catch (mailErr) {
      console.error("[AUTH] Email OTP failed:", mailErr.message);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[AUTH] Dev email OTP for ${identifier.key}: ${otp}`);
      }
      return res.status(503).json({
        success: false,
        message: mailErr.message || "Failed to send OTP email. Check EMAIL_USER and EMAIL_PASS.",
      });
    }

    res.status(200).json({
      success: true,
      channel: "email",
      delivered,
      expiresIn: OTP_EXPIRY_MS,
      message: "OTP sent to your email address.",
    });
  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── VERIFY OTP (login / auto signup) ─────────────────────────────────────
export const verifyOTP = async (req, res) => {
  try {
    const identifier = parseIdentifier(
      req.body?.identifier ?? req.body?.email ?? req.body?.phonenum
    );
    if (identifier?.error) {
      return res.status(400).json({ success: false, message: identifier.error });
    }

    const sanitizedOtp = String(req.body?.otp || "").trim().replace(/\s/g, "");
    if (!sanitizedOtp) {
      return res.status(400).json({ success: false, message: "OTP is required." });
    }

    if (identifier.type === "mobile") {
      if (sanitizedOtp !== MOBILE_STATIC_OTP) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP code. Please try again.",
        });
      }
    } else {
      const check = verifyStoredOtp(identifier.key, sanitizedOtp);
      if (!check.ok) {
        return res.status(400).json({ success: false, message: check.message });
      }
    }

    const user = await ensureUserExists(User, identifier, req.body?.name);
    const token = signAuthToken(user);
    setAuthCookie(res, token);

    const userPayload = formatAuthUser(user, token);

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: userPayload,
    });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

// ─── GET CURRENT USER ───────────────────────────────────────────────────────
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({
      success: true,
      user: formatAuthUser(user),
    });
  } catch (err) {
    console.error("Get current user error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── LOGOUT ─────────────────────────────────────────────────────────────────
export const logoutUser = (_req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// Legacy register (optional — hybrid flow auto-creates users)
export const registerUser = async (req, res) => {
  try {
    const { name, phonenum, email } = req.body || {};
    const mobileId = parseIdentifier(phonenum);
    const emailId = parseIdentifier(email);

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }
    if (mobileId?.error) {
      return res.status(400).json({ success: false, message: mobileId.error });
    }
    if (emailId?.error) {
      return res.status(400).json({ success: false, message: emailId.error });
    }

    const existingMobile = mobileId?.key
      ? await User.findOne({ phonenum: mobileId.key })
      : null;
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this mobile number. Please login.",
      });
    }

    const existingEmail = emailId?.key
      ? await User.findOne({ email: emailId.key })
      : null;
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email. Please login.",
      });
    }

    const user = await User.create({
      name: name.trim(),
      phonenum: mobileId.key,
      email: emailId.key,
      role: "user",
    });

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      user: formatAuthUser(user),
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};
