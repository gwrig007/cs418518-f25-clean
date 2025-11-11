import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

/* ===========================
   GET /advising/history?email=
   Returns all advising records for that student
=========================== */
router.get("/history", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.execute(
      `SELECT id, DATE_FORMAT(created_at, '%m/%d/%Y') AS date, current_term AS term, status
       FROM advising_records WHERE u_email = ? ORDER BY created_at DESC`,
      [email]
    );

    res.json(rows);
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   GET /advising/summary?email=
   Returns summary info for student
=========================== */
router.get("/summary", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [[record]] = await pool.execute(
      `SELECT u_email, last_term, last_gpa, current_term, status
       FROM advising_records WHERE u_email = ?
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    res.json(record || {});
  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ message: "Error loading summary" });
  }
});

/* ===========================
   GET /advising/current-courses?email=
   Returns all currently registered courses
=========================== */
router.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.execute(
      `SELECT course_name, course_level 
       FROM advising_courses ac
       JOIN advising_records ar ON ac.record_id = ar.id
       WHERE ar.u_email = ?
       ORDER BY course_name ASC`,
      [email]
    );

    res.json(rows);
  } catch (err) {
    console.error("Current courses error:", err);
    res.status(500).json({ message: "Server error fetching current courses" });
  }
});

/* ===========================
   GET /advising/last-courses?email=&term=
   Fetch courses from a given or most recent term
=========================== */
router.get("/last-courses", async (req, res) => {
  try {
    const { email, term } = req.query;
    if (!email) return res.status(400).json({ message: "Email required" });

    let finalTerm = term;

    if (!finalTerm) {
      const [latest] = await pool.execute(
        "SELECT term FROM taken_courses WHERE u_email = ? ORDER BY id DESC LIMIT 1",
        [email]
      );
      if (latest.length > 0) finalTerm = latest[0].term;
    }

    if (!finalTerm) return res.json([]);

    const [rows] = await pool.execute(
      "SELECT course_name, grade FROM taken_courses WHERE u_email = ? AND term = ?",
      [email, finalTerm]
    );

    res.json(rows);
  } catch (err) {
    console.error("Last courses error:", err);
    res.status(500).json({ message: "Error loading last courses" });
  }
});

/* ===========================
   POST /advising/add-course
   Adds a new course (if not already taken)
=========================== */
router.post("/add-course", async (req, res) => {
  try {
    const { email, course_name, course_level } = req.body;
    if (!email || !course_name)
      return res.status(400).json({ message: "Email and course name required" });

    // Prevent duplicates
    const [exists] = await pool.execute(
      "SELECT id FROM taken_courses WHERE u_email = ? AND course_name = ?",
      [email, course_name]
    );
    if (exists.length > 0)
      return res.status(400).json({ message: "Course already taken" });

    // Insert new course
    await pool.execute(
      "INSERT INTO taken_courses (u_email, course_name, course_level, term) VALUES (?, ?, ?, 'Current')",
      [email, course_name, course_level]
    );

    res.json({ message: "Course added successfully!" });
  } catch (err) {
    console.error("Add course error:", err);
    res.status(500).json({ message: "Server error adding course" });
  }
});

/* ===========================
   GET /advising/list?email=
   Alias route for current courses (for backward compatibility)
=========================== */
router.get("/list", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.execute(
      `SELECT course_name, course_level 
       FROM advising_courses ac
       JOIN advising_records ar ON ac.record_id = ar.id
       WHERE ar.u_email = ?
       ORDER BY course_name ASC`,
      [email]
    );

    res.json(rows);
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ message: "Server error fetching advising list" });
  }
});


export default router;
