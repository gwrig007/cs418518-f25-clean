import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

/* ---------------------------
   🔹 Utility: Get User ID from Email
--------------------------- */
async function getUserIdByEmail(email) {
  if (!email) return null;

  const [[user]] = await pool.query(
    "SELECT u_id FROM user_information WHERE u_email = ?",
    [email]
  );

  return user ? user.u_id : null;
}

/* ---------------------------
   🔹 CURRENT COURSES
--------------------------- */
router.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      "SELECT course_name FROM current_courses WHERE user_id = ?",
      [userId]
    );

    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("CURRENT COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading current courses" });
  }
});

/* ---------------------------
   🔹 TAKEN (Completed) COURSES
--------------------------- */
router.get("/taken-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserIdByEmail(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      "SELECT course_name FROM advising_courses WHERE user_id = ? AND status = 'Completed'",
      [userId]
    );

    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("TAKEN COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading taken courses" });
  }
});

/* ---------------------------
   🔹 GET ALL FORMS
--------------------------- */
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

/* ---------------------------
   🔹 GET ONE FORM
--------------------------- */
router.get("/form", async (req, res) => {
  try {
    const { formId } = req.query;

    const [[form]] = await pool.query(
      "SELECT id, current_term, last_gpa, status, last_term FROM advising WHERE id = ?",
      [formId]
    );

    if (!form) return res.status(404).json({ message: "Form not found" });

    const [courses] = await pool.query(
      "SELECT course_name, term, status FROM advising_courses WHERE advising_id = ?",
      [formId]
    );

    res.json({
      form,
      selectedCourses: courses.map(c => c.course_name)
    });
  } catch (err) {
    console.error("LOAD FORM ERROR:", err);
    res.status(500).json({ message: "Error loading form" });
  }
});

/* ---------------------------
   🔹 SAVE FORM
--------------------------- */
router.post("/save", async (req, res) => {
  try {
    const { formId, email, currentTerm, lastGPA, selectedCourses } = req.body;

    const userId = await getUserIdByEmail(email);
    if (!userId) return res.status(400).json({ message: "Invalid user" });

    let newId = formId;

    // NEW FORM
    if (!formId) {
      const [result] = await pool.query(
        `INSERT INTO advising (user_id, current_term, last_gpa, status, created_at)
         VALUES (?, ?, ?, 'Pending', NOW())`,
        [userId, currentTerm, lastGPA]
      );

      newId = result.insertId;
    } else {
      // UPDATE EXISTING FORM
      const [[check]] = await pool.query(
        "SELECT status FROM advising WHERE id = ?",
        [formId]
      );

      if (check.status !== "Pending") {
        return res.status(403).json({ error: "Form is locked." });
      }

      await pool.query(
        "UPDATE advising SET current_term=?, last_gpa=? WHERE id=?",
        [currentTerm, lastGPA, formId]
      );
    }

    // delete old courses
    await pool.query(
      "DELETE FROM advising_courses WHERE advising_id = ?",
      [newId]
    );

    // insert new courses
    for (const name of selectedCourses) {
      await pool.query(
        `INSERT INTO advising_courses (advising_id, user_id, course_name, status, term)
         VALUES (?, ?, ?, 'Planned', ?)`,
        [newId, userId, name, currentTerm]
      );
    }

    res.json({ success: true, advisingId: newId });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: "Error saving form" });
  }
});

export default router;
