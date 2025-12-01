import express from "express";
import { pool } from "../database/connection.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fetch from "node-fetch";
import { sendEmail } from "../utils/sendmail.js";

const router = express.Router();


// ============================================================
// ✅ REGISTER
// ============================================================
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const [[existing]] = await pool.query(
      "SELECT u_id FROM user_information WHERE u_email = ?",
      [email]
    );

    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO user_information 
       (u_first_name, u_last_name, u_email, u_password, otp_code, otp_expires_at, is_verified)
       VALUES (?, ?, ?, ?, NULL, NULL, 1)`,
      [firstName, lastName, email, hashed]
    );

    res.json({ message: "Registration successful!" });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Registration failed." });
  }
});


// ============================================================
// ✅ LOGIN + CAPTCHA + OTP
// ============================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password, recaptcha } = req.body;

    if (!recaptcha) {
      return res.status(400).json({ message: "Captcha required." });
    }

    // ✅ CAPTCHA verification
    const captchaRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe&response=${recaptcha}`,
    });

    const captcha = await captchaRes.json();
    if (!captcha.success) {
      return res.status(401).json({ message: "Captcha failed." });
    }

    // ✅ User lookup
    const [[user]] = await pool.query(
      "SELECT u_password FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.u_password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // ✅ Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      "UPDATE user_information SET otp_code = ?, otp_expires_at = ? WHERE u_email = ?",
      [otp, expires, email]
    );

    // ✅ Send OTP email
    await sendEmail(
      email,
      "Your Login Code",
      `<h2>Your OTP Code</h2><h1>${otp}</h1><p>Expires in 10 minutes.</p>`
    );

    res.json({ message: "OTP sent", requireOTP: true });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed." });
  }
});


// ============================================================
// ✅ VERIFY OTP
// ============================================================
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const [[user]] = await pool.query(
      "SELECT otp_code, otp_expires_at FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user || !user.otp_code) {
      return res.status(400).json({ message: "No OTP found." });
    }

    if (user.otp_code !== otp) {
      return res.status(401).json({ message: "Invalid code." });
    }

    if (new Date(user.otp_expires_at) < new Date()) {
      return res.status(401).json({ message: "OTP expired." });
    }

    await pool.query(
      "UPDATE user_information SET otp_code = NULL, otp_expires_at = NULL WHERE u_email = ?",
      [email]
    );

    res.json({ message: "OTP verified!" });

  } catch (err) {
    console.error("OTP VERIFY ERROR:", err);
    res.status(500).json({ message: "OTP failed." });
  }
});


// ============================================================
// ✅ FORGOT PASSWORD
// ============================================================
router.post("/forgot", async (req, res) => {
  const { email } = req.body;

  try {
    const [[user]] = await pool.query(
      "SELECT u_id FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user) {
      return res.json({ message: "If the email exists, a link was sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");

    await pool.query(
      "UPDATE user_information SET verification_token = ? WHERE u_email = ?",
      [token, email]
    );

    const resetLink =
      `https://oduadvisingportal.netlify.app/reset.html?token=${token}`;

    await sendEmail(
      email,
      "Reset Your Password",
      `<p><a href="${resetLink}">${resetLink}</a></p>`
    );

    res.json({ message: "If the email exists, a link was sent." });

  } catch (err) {
    console.error("FORGOT ERROR:", err);
    res.status(500).json({ message: "Server error." });
  }
});


// ============================================================
// ✅ RESET PASSWORD
// ============================================================
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const [[user]] = await pool.query(
      "SELECT u_id FROM user_information WHERE verification_token = ?",
      [token]
    );

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired link." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE user_information SET u_password = ?, verification_token = NULL WHERE u_id = ?",
      [hashed, user.u_id]
    );

    res.json({ message: "Password reset complete." });

  } catch (err) {
    console.error("RESET ERROR:", err);
    res.status(500).json({ message: "Reset failed." });
  }
});


// ============================================================
// ✅ CHANGE PASSWORD
// ============================================================
router.put("/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  try {
    const [[user]] = await pool.query(
      "SELECT u_password FROM user_information WHERE u_email = ?",
      [email]
    );

    const valid = await bcrypt.compare(currentPassword, user.u_password);
    if (!valid) {
      return res.status(401).json({ message: "Wrong password." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE user_information SET u_password = ? WHERE u_email = ?",
      [hashed, email]
    );

    res.json({ message: "Password updated." });

  } catch (err) {
    console.error("CHANGE ERROR:", err);
    res.status(500).json({ message: "Update failed." });
  }
});

// ============================================================
// ✅ get profile
router.get("/profile", async (req, res) => {
  const { email } = req.query;

  if (!email) return res.status(400).json({ message: "Missing email" });

  try {
    const [[user]] = await pool.query(
      "SELECT u_first_name, u_last_name, u_email FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);

  } catch (err) {
    console.error("PROFILE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
