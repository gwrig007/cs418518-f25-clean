import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

/**
 * ----------------------------------------------------
 * GET advising info for a student
 * ----------------------------------------------------
 */
router.get("/get", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    // Get user info
    const [userRows] = await pool.query(
      "SELECT id FROM user_information WHERE email = ?",
      [email]
    );

    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userId = userRows[0].id;

    // Get advising record
    const [advisingRows] = await pool.query(
      "SELECT * FROM advising WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      [userId]
    );

    return res.json({
      success: true,
      advising: advisingRows[0] || null,
    });
  } catch (error) {
    console.error("GET advising error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * ----------------------------------------------------
 * SAVE advising form
 * ----------------------------------------------------
 */
router.post("/save", async (req, res) => {
  try {
    const { email, current_term, last_term, last_gpa } = req.body;

    if (!email || !current_term || !last_term || !last_gpa) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const [userRows] = await pool.query(
      "SELECT id FROM user_information WHERE email = ?",
      [email]
    );
    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userId = userRows[0].id;

    // Insert record
    await pool.query(
      `INSERT INTO advising (user_id, current_term, last_term, last_gpa, status, created_at)
       VALUES (?, ?, ?, ?, 'Pending', NOW())`,
      [userId, current_term, last_term, last_gpa]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("SAVE advising error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.sqlMessage,
    });
  }
});

/**
 * ----------------------------------------------------
 * GET last courses (for checklist page)
 * ----------------------------------------------------
 */
router.get("/last-courses", async (req, res) => {
  try {
    const { email, term } = req.query;

    if (!email || !term) {
      return res.status(400).json({ success: false, message: "Missing email or term" });
    }

    const [userRows] = await pool.query(
      "SELECT id FROM user_information WHERE email = ?",
      [email]
    );

    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userId = userRows[0].id;

    const [rows] = await pool.query(
      `SELECT * FROM last_courses WHERE user_id = ? AND term = ?`,
      [userId, term]
    );

    return res.json({ success: true, courses: rows });
  } catch (error) {
    console.error("LAST COURSES error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * ----------------------------------------------------
 * GET current courses (for checklist page)
 * ----------------------------------------------------
 */
router.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;

    const [userRows] = await pool.query(
      "SELECT id FROM user_information WHERE email = ?",
      [email]
    );

    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userId = userRows[0].id;

    const [rows] = await pool.query(
      "SELECT * FROM current_courses WHERE user_id = ?",
      [userId]
    );

    return res.json({ success: true, courses: rows });
  } catch (error) {
    console.error("CURRENT COURSES error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * ----------------------------------------------------
 * SAVE planned courses
 * ----------------------------------------------------
 */
router.post("/planned-courses", async (req, res) => {
  try {
    const { email, term, planned } = req.body;

    if (!email || !term || !Array.isArray(planned)) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    const [userRows] = await pool.query(
      "SELECT id FROM user_information WHERE email = ?",
      [email]
    );

    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userId = userRows[0].id;

    // Insert each planned course
    for (let course of planned) {
      await pool.query(
        `INSERT INTO last_courses (advising_id, course_level, course_name, user_id, status, term)
         VALUES (?, ?, ?, ?, 'Planned', ?)`,
        [course.advising_id || null, course.course_level, course.course_name, userId, term]
      );
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("PLANNED COURSES error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
