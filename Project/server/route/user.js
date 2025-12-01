import express from "express";
import { pool } from "../database/connection.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fetch from "node-fetch";
import { sendEmail } from "../utils/sendmail.js"; // ✅ uses your SendGrid helper

const router = express.Router();



/* ============================================================
   ✅ LOGIN + reCAPTCHA + SEND OTP VIA SENDGRID
============================================================ */
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // ✅ Validate input (prevents NULL errors)
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // ✅ Prevent duplicate email crash
    const [[existing]] = await pool.query(
      "SELECT u_id FROM user_information WHERE u_email = ?",
      [email]
    );

    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    // ✅ Hash password
    const hashed = await bcrypt.hash(password, 10);

    // ✅ Insert user
    await pool.query(
      `INSERT INTO user_information 
       (u_first_name, u_last_name, u_email, u_password, is_verified)
       VALUES (?, ?, ?, ?, 1)`,
      [firstName, lastName, email, hashed]
    );

    res.json({ message: "Registration successful!" });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message || err);
    res.status(500).json({ message: "Registration failed." });
  }
});


/* ============================================================
   ✅ VERIFY OTP
============================================================ */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: "Missing email or code." });

    const [[user]] = await pool.query(
      "SELECT otp_code, otp_expires_at FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user || !user.otp_code)
      return res.status(400).json({ message: "No OTP found. Login again." });

    if (user.otp_code !== otp)
      return res.status(401).json({ message: "Invalid OTP." });

    if (new Date(user.otp_expires_at) < new Date())
      return res.status(401).json({ message: "OTP expired." });

    // ✅ Clear OTP
    await pool.query(
      "UPDATE user_information SET otp_code = NULL, otp_expires_at = NULL WHERE u_email = ?",
      [email]
    );

    res.json({ message: "OTP verified successfully!" });

  } catch (err) {
    console.error("OTP ERROR:", err);
    res.status(500).json({ message: "OTP verification failed." });
  }
});

/* ============================================================
   ✅ FORGOT PASSWORD
============================================================ */
router.post("/forgot", async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ message: "Email required." });

  try {
    const [[user]] = await pool.query(
      "SELECT u_id FROM user_information WHERE u_email = ?",
      [email]
    );

    // ✅ Prevent enumeration
    if (!user)
      return res.json({ message: "If the email exists, a reset link was sent." });

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
      `
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
      `
    );

    res.json({ message: "If the email exists, a reset link was sent." });

  } catch (err) {
    console.error("FORGOT ERROR:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/* ============================================================
   ✅ RESET PASSWORD
============================================================ */
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword)
    return res.status(400).json({ message: "Missing token or password." });

  try {
    const [[user]] = await pool.query(
      "SELECT u_id FROM user_information WHERE verification_token = ?",
      [token]
    );

    if (!user)
      return res.status(400).json({ message: "Invalid or expired link." });

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE user_information SET u_password = ?, verification_token = NULL WHERE u_id = ?",
      [hashed, user.u_id]
    );

    res.json({ message: "Password updated successfully." });

  } catch (err) {
    console.error("RESET ERROR:", err);
    res.status(500).json({ message: "Reset failed." });
  }
});

/* ============================================================
   ✅ CHANGE PASSWORD
============================================================ */
router.put("/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  try {
    const [[user]] = await pool.query(
      "SELECT u_password FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user)
      return res.status(404).json({ message: "User not found." });

    const match = await bcrypt.compare(currentPassword, user.u_password);
    if (!match)
      return res.status(401).json({ message: "Incorrect current password." });

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE user_information SET u_password = ? WHERE u_email = ?",
      [hashed, email]
    );

    res.json({ message: "Password updated." });

  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ message: "Password update failed." });
  }
});

export default router;
