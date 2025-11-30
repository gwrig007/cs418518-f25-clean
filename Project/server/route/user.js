import express from "express";
import { pool } from "../database/connection.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";

const router = express.Router();

/* ============================================================
   📌 HELPER — SEND EMAIL
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
    const { email, password } = req.body;

    const [[user]] = await pool.query(
      "SELECT * FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user) {
      return res.status(404).json({ message: "Email not found." });
    }

    const match = await bcrypt.compare(password, user.u_password);
    if (!match) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    res.json({ message: "Login successful!", userId: user.u_id });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

/* ============================================================
   📌 FORGOT PASSWORD — SEND RESET EMAIL
============================================================ */
router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body;

    const [[user]] = await pool.query(
      "SELECT u_id FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user) {
      return res.status(404).json({ message: "Email not found." });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");

    // Save reset token
    await pool.query(
      "UPDATE user_information SET verification_token = ? WHERE u_email = ?",
      [token, email]
    );

    // ⭐ Link for Netlify Frontend
    const resetLink = `https://oduadvisingportal.netlify.app/reset.html?token=${token}`;

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to set a new password:</p>
        <a href="${resetLink}">${resetLink}</a>
      `,
    });

    res.json({ message: "Password reset link sent!" });
  } catch (err) {
    console.error("FORGOT ERROR:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/* ============================================================
   📌 RESET PASSWORD (from reset.html)
============================================================ */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token) return res.status(400).json({ message: "Invalid token." });

    const hashed = await bcrypt.hash(newPassword, 10);

    const [result] = await pool.query(
      "UPDATE user_information SET u_password = ?, verification_token = NULL WHERE verification_token = ?",
      [hashed, token]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error("RESET ERROR:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/* ============================================================
   📌 CHANGE PASSWORD (From profile page)
============================================================ */
router.put("/change-password", async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    const [[user]] = await pool.query(
      "SELECT * FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!user) return res.status(404).json({ message: "User not found." });

    const match = await bcrypt.compare(currentPassword, user.u_password);
    if (!match) {
      return res.status(401).json({ message: "Incorrect current password." });
    }

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
