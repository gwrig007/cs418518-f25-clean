import express from "express";
import { pool } from "../database/connection.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import fetch from "node-fetch";


const router = express.Router();

/* ============================================================
   📌 EMAIL TRANSPORTER (SAFE MODE)
============================================================ */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ============================================================
   📌 REGISTER USER
============================================================ */
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO user_information (u_first_name, u_last_name, u_email, u_password, is_verified)
       VALUES (?, ?, ?, ?, 1)`,
      [firstName, lastName, email, hashed]
    );

    res.json({ message: "Registration successful!" });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Error registering user." });
  }
});

/* ============================================================
   📌 LOGIN
============================================================ */
router.post("/login", async (req, res) => {
  try {
    const { email, password, recaptcha } = req.body;

    // ✅ Make sure captcha exists
    if (!recaptcha) {
      return res.status(400).json({ message: "Captcha is required." });
    }

    // ✅ Verify reCAPTCHA with Google (TEST SECRET KEY — works on any domain)
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe&response=${recaptcha}`
    });

    const captchaResult = await response.json();

    if (!captchaResult.success) {
      return res.status(401).json({ message: "reCAPTCHA validation failed." });
    }

    // ✅ Normal login logic (unchanged)
    const [[user]] = await pool.query(
      "SELECT * FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user) {
      return res.status(404).json({ message: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.u_password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // ✅ Login success
    res.json({ message: "Login successful!", userId: user.u_id });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/* ============================================================
   📌 FORGOT PASSWORD (SAFE IMPLEMENTATION)
============================================================ */
router.post("/forgot", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required." });

  try {
    const [[user]] = await pool.query(
      "SELECT u_id FROM user_information WHERE u_email = ?",
      [email]
    );

    // ✅ Always respond safely (no enumeration)
    if (!user)
      return res.json({ message: "If the email exists, a reset link has been sent." });

    const token = crypto.randomBytes(32).toString("hex");

    await pool.query(
      "UPDATE user_information SET verification_token = ? WHERE u_email = ?",
      [token, email]
    );

    const resetLink =
      `https://oduadvisingportal.netlify.app/reset.html?token=${token}`;

    // ✅ Try to send email (but never block app if email fails)
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset Request",
        html: `
          <p>You requested a password reset.</p>
          <p>Click the link below:</p>
          <a href="${resetLink}">${resetLink}</a>
        `,
      });
    } catch (emailErr) {
      console.error("EMAIL ERROR:", emailErr.message);
    }

    res.json({ message: "If the email exists, a reset link has been sent." });

  } catch (err) {
    console.error("FORGOT ERROR:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/* ============================================================
   📌 RESET PASSWORD (TOKEN)
============================================================ */
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword)
    return res.status(400).json({ message: "Missing token or password." });

  try {
    const [rows] = await pool.query(
      "SELECT u_id FROM user_information WHERE verification_token = ?",
      [token]
    );

    if (rows.length === 0)
      return res.status(400).json({ message: "Invalid or expired reset link." });

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE user_information SET u_password = ?, verification_token = NULL WHERE u_id = ?",
      [hashed, rows[0].u_id]
    );

    res.json({ message: "Password successfully reset." });

  } catch (err) {
    console.error("RESET ERROR:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/* ============================================================
   📌 CHANGE PASSWORD (LOGGED-IN USERS)
============================================================ */
router.put("/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  if (!email || !currentPassword || !newPassword)
    return res.status(400).json({ message: "Missing required fields." });

  try {
    const [[user]] = await pool.query(
      "SELECT u_password FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user) return res.status(404).json({ message: "User not found." });

    const valid = await bcrypt.compare(currentPassword, user.u_password);
    if (!valid)
      return res.status(401).json({ message: "Incorrect current password." });

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE user_information SET u_password = ? WHERE u_email = ?",
      [hashed, email]
    );

    res.json({ message: "Password updated successfully!" });

  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error updating password." });
  }
});

export default router;
