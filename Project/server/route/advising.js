import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

/* ---------------------------
   Utility: Get User ID
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
   1. Get CURRENT courses
--------------------------- */
router.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) return res.json([]);  // prevent null crash
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
    res.status(500).json({ message: "Error loading current courses" });
  }
});

/* ---------------------------
   2. Get TAKEN courses
--------------------------- */
router.get("/taken-courses", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) return res.json([]);
    const userId = await getUserIdByEmail(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `
      SELECT course_name 
      FROM advising_courses
      WHERE user_id = ? AND status = 'Completed'
      `,
      [userId]
    );

    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("TAKEN COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading taken courses" });
  }
});

/* ---------------------------
   3. Save advising form
--------------------------- */
router.post("/save", async (req, res) => {
  try {
    const { email, currentTerm, lastGPA, status, selectedCourses, formId } = req.body;

    const userId = await getUserIdByEmail(email);
    if (!userId) return res.status(400).json({ message: "Invalid user" });

    /* CREATE NEW FORM */
    if (!formId) {
      const [result] = await pool.query(
        `
        INSERT INTO advising (user_id, current_term, last_gpa, status, created_at)
        VALUES (?, ?, ?, ?, NOW())
        `,
        [userId, currentTerm, lastGPA, status]
      );

      const newId = result.insertId;

      for (const c of selectedCourses) {
        await pool.query(
          `
          INSERT INTO advising_courses (advising_id, user_id, course_name, status, term)
          VALUES (?, ?, ?, ?, ?)
          `,
          [newId, userId, c.course_name, c.status, c.term]
        );
      }

      return res.json({ message: "Form created", advisingId: newId });
    }

    /* UPDATE EXISTING FORM */
    await pool.query(
      `
      UPDATE advising
      SET current_term = ?, last_gpa = ?, status = ?
      WHERE advising_id = ? AND user_id = ?
      `,
      [currentTerm, lastGPA, status, formId, userId]
    );

    await pool.query("DELETE FROM advising_courses WHERE advising_id = ?", [formId]);

    for (const c of selectedCourses) {
      await pool.query(
        `
        INSERT INTO advising_courses (advising_id, user_id, course_name, status, term)
        VALUES (?, ?, ?, ?, ?)
        `,
        [formId, userId, c.course_name, c.status, c.term]
      );
    }

    res.json({ message: "Form updated", advisingId: formId });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: "Error saving form" });
  }
});

/* ---------------------------
   4. Get ONE form
   FRONTEND EXPECTS: /advising/form?formId=123
--------------------------- */
router.get("/form", async (req, res) => {
  try {
    const formId = req.query.formId;

    const [[form]] = await pool.query(
      "SELECT * FROM advising WHERE advising_id = ?",
      [formId]
    );

    if (!form) return res.status(404).json({ message: "Form not found" });

    const [courses] = await pool.query(
      `
      SELECT course_name, status, term
      FROM advising_courses
      WHERE advising_id = ?
      `,
      [formId]
    );

    res.json({ ...form, selectedCourses: courses });
  } catch (err) {
    console.error("FORM LOAD ERROR:", err);
    res.status(500).json({ message: "Error loading form" });
  }
});

/* ---------------------------
   5. Get ALL forms
--------------------------- */
router.get("/forms", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);

    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `
      SELECT advising_id, current_term, status, created_at
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

export default router;
