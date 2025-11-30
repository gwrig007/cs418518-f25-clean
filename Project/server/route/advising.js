import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

// 🔹 Utility: Get User ID from Email
async function getUserId(email) {
  if (!email) return null;
  const [[user]] = await pool.query("SELECT user_id FROM users WHERE email=?", [email]);
  return user ? user.user_id : null;
}

// ------------------------
// GET current courses
// FRONTEND: /advising/current-courses?email=...
// ------------------------
router.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserId(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      "SELECT course_name FROM current_courses WHERE user_id = ?",
      [userId]
    );

    // return array of course names
    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("CURRENT COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading current courses" });
  }
});

// ------------------------
// GET taken/completed courses
// FRONTEND: /advising/taken-courses?email=...
// ------------------------
router.get("/taken-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserId(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      "SELECT course_name FROM advising_courses WHERE user_id = ? AND status='Completed'",
      [userId]
    );

    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("TAKEN COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading taken courses" });
  }
});

// ------------------------
// GET all advising forms
// FRONTEND: /advising/forms?email=...
// ------------------------
router.get("/forms", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserId(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT id, current_term, status, created_at
       FROM advising WHERE user_id=? ORDER BY created_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("FORMS ERROR:", err);
    res.status(500).json([]);
  }
});

// ------------------------
// GET single advising form
// FRONTEND: /advising/form?formId=...
// ------------------------
router.get("/form", async (req, res) => {
  try {
    const { formId } = req.query;

    const [[form]] = await pool.query(
      "SELECT id, current_term, last_gpa, status, last_term FROM advising WHERE id=?",
      [formId]
    );

    if (!form) return res.status(404).json({ message: "Form not found" });

    const [courses] = await pool.query(
      "SELECT course_name FROM advising_courses WHERE advising_id=?",
      [formId]
    );

    res.json({ form, selectedCourses: courses.map(c => c.course_name) });
  } catch (err) {
    console.error("LOAD FORM ERROR:", err);
    res.status(500).json({ message: "Error loading form" });
  }
});

// ------------------------
// SAVE / UPDATE advising form
// FRONTEND: POST /advising/save
// ------------------------
router.post("/save", async (req, res) => {
  try {
    const { formId, email, currentTerm, lastGPA, selectedCourses } = req.body;
    const userId = await getUserId(email);
    if (!userId) return res.status(400).json({ message: "Invalid user" });

    let newId = formId;

    if (!formId) {
      // Create new form
      const [result] = await pool.query(
        `INSERT INTO advising (user_id, current_term, last_gpa, status, created_at)
         VALUES (?, ?, ?, 'Pending', NOW())`,
        [userId, currentTerm, lastGPA]
      );
      newId = result.insertId;
    } else {
      // Update existing form (only if Pending)
      const [[check]] = await pool.query(`SELECT status FROM advising WHERE id=?`, [formId]);
      if (check.status !== "Pending") {
        return res.status(403).json({ error: "Form is locked and cannot be edited." });
      }

      await pool.query(
        "UPDATE advising SET current_term=?, last_gpa=? WHERE id=?",
        [currentTerm, lastGPA, formId]
      );
    }

    // Remove old courses
    await pool.query("DELETE FROM advising_courses WHERE advising_id=?", [newId]);

    // Insert new courses
    for (const c of selectedCourses) {
      await pool.query(
        `INSERT INTO advising_courses (advising_id, user_id, course_name, status, term)
         VALUES (?, ?, ?, 'Planned', ?)`,
        [newId, userId, c, currentTerm]
      );
    }

    res.json({ success: true, advisingId: newId });
  } catch (err) {
    console.error("SAVE FORM ERROR:", err);
    res.status(500).json({ message: "Error saving form" });
  }
});

export default router;
