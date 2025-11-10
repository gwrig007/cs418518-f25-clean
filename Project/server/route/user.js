import { Router } from "express";
import { pool } from "../database/connection.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";

const user = Router();

// ✉️ Email Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 🟩 REGISTER (Sign-Up)
user.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const [existing] = await pool.execute(
      "SELECT * FROM user_information WHERE u_email = ?",
      [email]
    );
    if (existing.length > 0)
      return res.status(400).json({ message: "Email already registered." });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      "INSERT INTO user_information (u_first_name, u_last_name, u_email, u_password, is_verified, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
      [firstName, lastName, email, hashedPassword, 1, 0]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome! Your email has been verified 🎉",
      html: `
        <p>Hi ${firstName},</p>
        <p>Your account has been successfully created and verified.</p>
        <p>You can now log in using your credentials and OTP verification.</p>
        <a href="https://oduadvisingportal.netlify.app/signin.html">Go to Sign In</a>
      `,
    });

    res.status(201).json({
      status: 201,
      message: "User registered successfully and email verified.",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟦 LOGIN with OTP
user.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [result] = await pool.execute(
      "SELECT * FROM user_information WHERE u_email = ?",
      [email]
    );

    if (result.length === 0)
      return res.status(401).json({ message: "Invalid email or password." });

    const userInfo = result[0];
    const match = await bcrypt.compare(password, userInfo.u_password);
    if (!match)
      return res.status(401).json({ message: "Invalid password." });

    const otp = Math.floor(100000 + Math.random() * 900000);
    await pool.execute("UPDATE user_information SET otp_code = ? WHERE u_email = ?", [
      otp,
      email,
    ]);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - Course Advising Portal",
      html: `
        <p>Hello ${userInfo.u_first_name},</p>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code expires in 10 minutes.</p>
      `,
    });

    res.json({
      status: 200,
      message: "OTP sent to your email. Please verify.",
      email,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟨 VERIFY OTP
user.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const [result] = await pool.execute(
      "SELECT * FROM user_information WHERE u_email = ? AND otp_code = ?",
      [email, otp]
    );

    if (result.length === 0)
      return res.status(400).json({ message: "Invalid or expired OTP." });

    await pool.execute("UPDATE user_information SET otp_code = NULL WHERE u_email = ?", [
      email,
    ]);

    res.json({
      status: 200,
      message: "OTP verified successfully. You are now logged in.",
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟧 FORGOT PASSWORD
user.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const [result] = await pool.execute(
      "SELECT * FROM user_information WHERE u_email = ?",
      [email]
    );

    if (result.length === 0)
      return res.status(404).json({ message: "Email not found." });

    const resetLink = `https://oduadvisingportal.netlify.app/reset.html?email=${encodeURIComponent(
      email
    )}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset - Course Advising Portal",
      html: `
        <p>Click below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
      `,
    });

    res.json({ message: "Password reset email sent!" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟩 RESET PASSWORD
user.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.execute(
      "UPDATE user_information SET u_password = ? WHERE u_email = ?",
      [hashed, email]
    );

    res.json({ message: "Password updated successfully!" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟦 GET USER PROFILE
user.get("/profile", async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const [results] = await pool.execute(
      "SELECT u_first_name AS firstName, u_last_name AS lastName, u_email AS email FROM user_information WHERE u_email = ?",
      [email]
    );

    if (results.length === 0)
      return res.status(404).json({ message: "User not found." });

    res.json(results[0]);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟩 UPDATE PROFILE
user.put("/update-profile", async (req, res) => {
  try {
    const { email, firstName, lastName, password } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const hashed = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      "UPDATE user_information SET u_first_name = ?, u_last_name = ?, u_password = ? WHERE u_email = ?",
      [firstName, lastName, hashed, email]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "User not found." });

    res.status(200).json({ message: "Profile updated successfully!" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default user;
