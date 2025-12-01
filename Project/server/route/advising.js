import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

/* ============================================================
   🔹 GET USER ID FROM EMAIL
============================================================ */
async function getUserIdByEmail(email) {
  if (!email) return null;

  const [[user]] = await pool.query(
    "SELECT u_id FROM user_information WHERE u_email = ?",
    [email]
  );

  return user ? user.u_id : null;
}

/* ============================================================
   ✅ CURRENT COURSES
============================================================ */
router.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      "SELECT course_name, term FROM current_courses WHERE user_id = ?",
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("CURRENT COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading current courses" });
  }
});

/* ============================================================
   ✅ TAKEN COURSES
============================================================ */
router.get("/taken-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      "SELECT course_name, term FROM taken_courses WHERE user_id = ?",
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("TAKEN COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading taken courses" });
  }
});

/* ============================================================
   ✅ LAST COURSES
============================================================ */
router.get("/last-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      "SELECT course_name, term FROM last_courses WHERE user_id = ?",
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("LAST COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading last courses" });
  }
});

/* ============================================================
   ✅ FORM HISTORY
============================================================ */
router.get("/forms", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT id, current_term, status, created_at
         FROM advising
        WHERE user_id = ?
     ORDER BY created_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("FORMS ERROR:", err);
    res.status(500).json([]);
  }
});

/* ============================================================
   ✅ LOAD SINGLE FORM (PLANNED + COMPLETED)
============================================================ */
router.get("/form", async (req, res) => {
  try {
    const { formId } = req.query;

    const [[form]] = await pool.query(
      "SELECT id, current_term, last_gpa, last_term, status FROM advising WHERE id = ?",
      [formId]
    );

    if (!form) return res.status(404).json({ message: "Form not found" });

    const [courses] = await pool.query(
      `SELECT 
          id,
          course_level,
          course_name,
          status,
          term
        FROM advising_courses
        WHERE advising_id = ?`,
      [formId]
    );

    res.json({
      form,
      selectedCourses: courses.map(c => ({
        id: c.id,
        name: c.course_name,
        level: c.course_level || "",
        status: c.status,
        term: c.term
      }))
    });
  } catch (err) {
    console.error("LOAD FORM ERROR:", err);
    res.status(500).json({ message: "Error loading form" });
  }
});

/* ============================================================
   ✅ SAVE ADVISING FORM
============================================================ */
router.post("/save", async (req, res) => {
  try {
    const { formId, email, currentTerm, lastGPA, selectedCourses } = req.body;

    if (!email || !currentTerm || !selectedCourses) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const userId = await getUserIdByEmail(email);
    if (!userId) return res.status(400).json({ message: "Invalid user" });

    let advisingId = formId;

    /* ---------- CREATE FORM ---------- */
    if (!formId) {
      const [result] = await pool.query(
        `INSERT INTO advising
          (user_id, current_term, last_gpa, last_term, status, created_at)
         VALUES (?, ?, ?, ?, 'Pending', NOW())`,
        [userId, currentTerm, lastGPA || null, currentTerm]
      );

      advisingId = result.insertId;
    }

    /* ---------- UPDATE FORM ---------- */
    else {
      const [[check]] = await pool.query(
        "SELECT status FROM advising WHERE id = ?",
        [formId]
      );

      if (!check || check.status !== "Pending") {
        return res.status(403).json({ message: "Form is locked." });
      }

      await pool.query(
        "UPDATE advising SET current_term = ?, last_gpa = ? WHERE id = ?",
        [currentTerm, lastGPA || null, formId]
      );
    }

    /* ---------- CLEAR OLD PLANNED COURSES ---------- */
    await pool.query(
      "DELETE FROM advising_courses WHERE advising_id = ? AND status = 'Planned'",
      [advisingId]
    );

    /* ---------- INSERT NEW PLANNED COURSES ---------- */
    for (const courseName of selectedCourses) {
      await pool.query(
        `INSERT INTO advising_courses
          (advising_id, user_id, course_name, status, term)
         VALUES (?, ?, ?, 'Planned', ?)`,
        [advisingId, userId, courseName, currentTerm]
      );
    }

    res.json({ success: true, advisingId });
  } catch (err) {
    console.error("SAVE ERROR FULL:", err);
    res.status(500).json({
      message: "Database error",
      error: err.sqlMessage || err.message
    });
  }
});

export default router;
