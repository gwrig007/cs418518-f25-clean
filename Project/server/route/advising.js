import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

// Utility: Get user ID by email
async function getUserId(email) {
  if (!email) return null;
  const [[user]] = await pool.query("SELECT user_id FROM users WHERE email = ?", [email]);
  return user ? user.user_id : null;
}

// 1️⃣ GET current courses
router.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserId(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT course_name FROM current_courses WHERE user_id = ?`,
      [userId]
    );
    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("CURRENT COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading current courses" });
  }
});

// 2️⃣ GET taken/completed courses (last term)
router.get("/taken-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserId(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT course_name FROM taken_courses WHERE user_id = ?`,
      [userId]
    );
    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("TAKEN COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading taken courses" });
  }
});

// 3️⃣ GET all advising forms
router.get("/forms", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserId(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT id AS id, current_term, status, created_at FROM advising WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("FORMS ERROR:", err);
    res.json([]);
  }
});

// 4️⃣ GET single form by id
router.get("/form", async (req, res) => {
  try {
    const { formId } = req.query;
    if (!formId) return res.status(400).json({ message: "Missing formId" });

    const [[form]] = await pool.query(
      `SELECT id, current_term, last_gpa, status, last_term FROM advising WHERE id = ?`,
      [formId]
    );
    if (!form) return res.status(404).json({ message: "Form not found" });

    const [courses] = await pool.query(
      `SELECT course_name, status, term FROM advising_courses WHERE advising_id = ?`,
      [formId]
    );

    res.json({ form, courses });
  } catch (err) {
    console.error("LOAD FORM ERROR:", err);
    res.status(500).json({ message: "Error loading form" });
  }
});

// 5️⃣ SAVE or UPDATE form
router.post("/save", async (req, res) => {
  try {
    const { formId, email, currentTerm, lastGPA, status, selectedCourses } = req.body;
    const userId = await getUserId(email);
    if (!userId) return res.status(400).json({ message: "Invalid user" });

    let newId = formId;

    if (!formId) {
      // CREATE new form
      const [result] = await pool.query(
        `INSERT INTO advising (user_id, current_term, last_gpa, status, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [userId, currentTerm, lastGPA || null, "Pending"]
      );
      newId = result.insertId;
    } else {
      // UPDATE existing
      const [[check]] = await pool.query(`SELECT status FROM advising WHERE id = ?`, [formId]);
      if (check.status === "Accepted" || check.status === "Rejected") {
        return res.status(403).json({ message: "Form is locked." });
      }

      await pool.query(
        `UPDATE advising SET current_term=?, last_gpa=?, status=? WHERE id=?`,
        [currentTerm, lastGPA || null, status, formId]
      );
    }

    // DELETE old courses
    await pool.query(`DELETE FROM advising_courses WHERE advising_id=?`, [newId]);

    // INSERT new courses
    for (const c of selectedCourses) {
      await pool.query(
        `INSERT INTO advising_courses (advising_id, user_id, course_name, status, term)
         VALUES (?, ?, ?, 'Planned', ?)`,
        [newId, userId, c, currentTerm]
      );
    }

    res.json({ success: true, message: "Form saved", id: newId });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: "Error saving form" });
  }
});

export default router;
