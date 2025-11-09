import { Router } from "express";
import { connection } from "../database/connection.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";

const user = Router();


// Email Transporter (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your Gmail
    pass: process.env.EMAIL_PASS, // app password
  },
});

// REGISTER (Sign-Up)
user.post("/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  connection.execute(
    "SELECT * FROM user_information WHERE u_email = ?",
    [email],
    async (err, results) => {
      if (err) return res.status(500).json({ message: err.message });
      if (results.length > 0) {
        return res.status(400).json({ message: "Email already registered." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Mark as verified immediately
      connection.execute(
        "INSERT INTO user_information (u_first_name, u_last_name, u_email, u_password, is_verified, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
        [firstName, lastName, email, hashedPassword, 1, 0],
        async (error) => {
          if (error) return res.status(500).json({ message: error.message });

          // Send welcome email
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Welcome! Your email has been verified 🎉",
            html: `
              <p>Hi ${firstName},</p>
              <p>Your account has been successfully created and verified.</p>
              <p>You can now log in using your credentials and OTP verification.</p>
              <a href="http://127.0.0.1:5500/cs418518-f25/Project/client/signin.html">Go to Sign In</a>
            `,
          });

          res.status(201).json({
            status: 201,
            message: "User registered successfully and email verified.",
          });
        }
      );
    }
  );
});

//  LOGIN with OTP
user.post("/login", async (req, res) => {
  const { email, password } = req.body;

  connection.execute(
    "SELECT * FROM user_information WHERE u_email = ?",
    [email],
    async (error, result) => {
      if (error) return res.status(500).json({ message: error.message });
      if (result.length === 0)
        return res.status(401).json({ message: "Invalid email or password." });

      const userInfo = result[0];
      const match = await bcrypt.compare(password, userInfo.u_password);

      if (!match)
        return res.status(401).json({ message: "Invalid password." });

      const otp = Math.floor(100000 + Math.random() * 900000);

      connection.execute(
        "UPDATE user_information SET otp_code = ? WHERE u_email = ?",
        [otp, email]
      );

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
        email: email,
      });
    }
  );
});

// VERIFY OTP
user.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  connection.execute(
    "SELECT * FROM user_information WHERE u_email = ? AND otp_code = ?",
    [email, otp],
    (error, result) => {
      if (error) return res.status(500).json({ message: error.message });

      if (result.length === 0)
        return res.status(400).json({ message: "Invalid or expired OTP." });

      connection.execute("UPDATE user_information SET otp_code = NULL WHERE u_email = ?", [email]);

      res.json({
        status: 200,
        message: "OTP verified successfully. You are now logged in.",
      });
    }
  );
});

// FORGOT PASSWORD (sends reset email)
user.post("/forgot-password", (req, res) => {
  const { email } = req.body;

  connection.execute(
    "SELECT * FROM user_information WHERE u_email = ?",
    [email],
    async (error, result) => {
      if (error) return res.status(500).json({ message: error.message });
      if (result.length === 0)
        return res.status(404).json({ message: "Email not found." });

      const resetLink = `http://127.0.0.1:5500/cs418518-f25/Project/client/reset.html?email=${encodeURIComponent(
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
    }
  );
});

// RESET PASSWORD
user.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  const hashed = await bcrypt.hash(newPassword, 10);

  connection.execute(
    "UPDATE user_information SET u_password = ? WHERE u_email = ?",
    [hashed, email],
    (error) => {
      if (error) return res.status(500).json({ message: error.message });
      res.json({ message: "Password updated successfully!" });
    }
  );
});

// 🟦 GET USER PROFILE
user.get("/profile", (req, res) => {
  const email = req.query.email;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const sql = `
    SELECT u_first_name AS firstName,
           u_last_name AS lastName,
           u_email AS email,
           u_password AS password
    FROM user_information
    WHERE u_email = ?
  `;

  connection.execute(sql, [email], (err, results) => {
    if (err) {
      console.error("Error fetching profile:", err);
      return res.status(500).json({ message: "Error fetching profile." });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json(results[0]);
  });
});

// 🟩 UPDATE PROFILE
user.put("/update-profile", (req, res) => {
  const { email, firstName, lastName, password } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const sql = `
    UPDATE user_information
    SET u_first_name = ?, u_last_name = ?, u_password = ?
    WHERE u_email = ?
  `;

  connection.execute(sql, [firstName, lastName, password, email], (err, result) => {
    if (err) {
      console.error("Error updating profile:", err);
      return res.status(500).json({ message: "Error updating profile." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "Profile updated successfully!" });
  });
});


export default user;
