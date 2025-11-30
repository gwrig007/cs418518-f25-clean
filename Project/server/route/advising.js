import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

/* ---------------------------
   🔹 Utility: Get User ID From Email
--------------------------- */
async function getUserIdByEmail(email) {
  if (!email) return null;
  const [[user]] = await pool.query(
    "SELECT user_id FROM users WHERE email = ?",
    [email]
  );
  return user ? user.user_id : null;
}

/* ---------------------------
   🔹 1. Get CURRENT courses 
   frontend: /current-courses?email=...
--------------------------- */
router.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);

    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `
      SELECT 
        course_name AS courseName,
        course_code AS courseCode,
        term
      FROM current_courses
      WHERE user_id = ?
      `,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("CURRENT COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading courses" });
  }
});

/* ---------------------------
   🔹 2. Save advising form
--------------------------- */
router.post("/save", async (req, res) => {
  try {
    const {
      email,
      currentTerm,
      lastTerm,
      lastGpa,
      selectedCourses // [{ course_name, course_code, status, term }]
    } = req.body;

    const userId = await getUserIdByEmail(email);
    if (!userId) return res.status(400).json({ message: "Invalid user" });

    if (!currentTerm || !selectedCourses) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const finalGpa = lastGpa === "" ? null : lastGpa;

    const [result] = await pool.query(
      `
      INSERT INTO advising (user_id, current_term, last_gpa, last_term, status, created_at)
      VALUES (?, ?, ?, ?, 'Pending', NOW())
      `,
      [userId, currentTerm, finalGpa, lastTerm]
    );

    const advisingId = result.insertId;

    for (const c of selectedCourses) {
      if (!c.course_name || !c.status || !c.term) continue;

      await pool.query(
        `
        INSERT INTO advising_courses (
          advising_id, 
          user_id,
          course_name,
          course_code,
          status,
          term
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          advisingId,
          userId,
          c.course_name,
          c.course_code || null,
          c.status,
          c.term
        ]
      );
    }

    res.json({ message: "Advising form saved", advisingId });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: "Error saving form" });
  }
});

/* ---------------------------
   🔹 3. Get ONE advising form by ID
--------------------------- */
router.get("/form/:id", async (req, res) => {
  try {
    const advisingId = req.params.id;

    const [[form]] = await pool.query(
      "SELECT * FROM advising WHERE advising_id = ?",
      [advisingId]
    );

    if (!form) return res.status(404).json({ message: "Form not found" });

    const [courses] = await pool.query(
      `
      SELECT course_name, course_code, status, term
      FROM advising_courses
      WHERE advising_id = ?
      `,
      [advisingId]
    );

    res.json({ form, courses });
  } catch (err) {
    console.error("LOAD FORM ERROR:", err);
    res.status(500).json({ message: "Error loading form" });
  }
});

/* ---------------------------
   🔹 4. Get ALL advising forms for a user
   (FRONTEND REQUIRES id — NOT advising_id)
--------------------------- */
router.get("/forms", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);

    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `
      SELECT 
        advising_id AS id,   -- REQUIRED FIX
        current_term,
        status,
        created_at
      FROM advising
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("FORMS ERROR:", err);
    res.json([]); 
  }
});

/* ---------------------------
   🔹 5. Get ALL courses ever selected by user
--------------------------- */
router.get("/all-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);

    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `
      SELECT course_name, course_code, status, term
      FROM advising_courses
      WHERE user_id = ?
      `,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("ALL COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading courses" });
  }
});

export default router;
