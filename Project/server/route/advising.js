import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

/* -------------------------------------------------------
   Helper: Convert email → user_id
------------------------------------------------------- */
async function getUserId(email) {
  const [rows] = await pool.query(
    "SELECT u_id FROM user_information WHERE u_email = ?",
    [email]
  );
  return rows.length ? rows[0].u_id : null;
}

/* -------------------------------------------------------
   1️⃣ GET CURRENT COURSES
------------------------------------------------------- */
router.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserId(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT course_name 
       FROM advising_courses
       WHERE user_id = ? AND status = 'Current'`,
      [userId]
    );

    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("Error fetching current courses:", err);
    res.status(500).json({ error: "Error fetching current courses" });
  }
});

/* -------------------------------------------------------
   2️⃣ GET LAST-TERM (COMPLETED) COURSES
------------------------------------------------------- */
router.get("/taken-courses", async (req, res) => {
  try {
    const { email } = req.query;

    const userId = await getUserId(email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT course_name 
       FROM advising_courses
       WHERE user_id = ? AND status = 'Completed'
       ORDER BY term DESC`,
      [userId]
    );

    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("Error fetching taken courses:", err);
    res.status(500).json({ error: "Error fetching taken courses" });
  }
});

/* -------------------------------------------------------
   3️⃣ GET ALL ADVISING FORMS
------------------------------------------------------- */
router.get("/forms", async (req, res) => {
  try {
    const { email } = req.query;
    const userId = await getUserId(email);
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
    console.error("Error fetching forms:", err);
    res.status(500).json({ error: "Error fetching forms" });
  }
});

/* -------------------------------------------------------
   4️⃣ GET SINGLE FORM BY ID
------------------------------------------------------- */
router.get("/form", async (req, res) => {
  try {
    const { formId } = req.query;

    const [[form]] = await pool.query(
      `SELECT id, current_term, last_gpa, status, last_term
       FROM advising 
       WHERE id = ?`,
      [formId]
    );

    if (!form) return res.status(404).json({ error: "Form not found" });

    const [courses] = await pool.query(
      `SELECT course_name 
       FROM advising_courses 
       WHERE advising_id = ?`,
      [formId]
    );

    form.selectedCourses = courses.map(c => c.course_name);

    res.json(form);
  } catch (err) {
    console.error("Error fetching form:", err);
    res.status(500).json({ error: "Error fetching form" });
  }
});

/* -------------------------------------------------------
   5️⃣ CREATE OR UPDATE ADVISING FORM
------------------------------------------------------- */
router.post("/save", async (req, res) => {
  try {
    const { formId, email, currentTerm, lastGPA, status, selectedCourses } =
      req.body;

    const userId = await getUserId(email);
    if (!userId) return res.status(404).json({ error: "User not found" });

    let newId = formId;

    /* -----------------------------------------
       If no formId → CREATE new advising form
    ----------------------------------------- */
    if (!formId) {
      const [result] = await pool.query(
        `INSERT INTO advising 
         (user_id, current_term, last_gpa, status, last_term, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, currentTerm, lastGPA, "Pending", "Fall 2024"]
      );

      newId = result.insertId;
    } else {
      /* -----------------------------------------
         UPDATE existing form
      ----------------------------------------- */

      // IMPORTANT: If Accepted/Rejected → lock editing
      const [[check]] = await pool.query(
        `SELECT status FROM advising WHERE id = ?`,
        [formId]
      );

      if (check.status === "Accepted" || check.status === "Rejected") {
        return res.status(403).json({
          error: "This advising form is locked and cannot be edited.",
        });
      }

      await pool.query(
        `UPDATE advising 
         SET current_term=?, last_gpa=?, status=?
         WHERE id=?`,
        [currentTerm, lastGPA, status, formId]
      );
    }

    /* -----------------------------------------
       REMOVE all old courses for this advising form
    ----------------------------------------- */
    await pool.query(
      `DELETE FROM advising_courses WHERE advising_id = ?`,
      [newId]
    );

    /* -----------------------------------------
       INSERT new selected courses
    ----------------------------------------- */
    for (const c of selectedCourses) {
      await pool.query(
        `INSERT INTO advising_courses 
         (advising_id, user_id, course_name, status, term)
         VALUES (?, ?, ?, 'Planned', ?)`,
        [newId, userId, c, currentTerm]
      );
    }

    res.json({ success: true, id: newId });
  } catch (err) {
    console.error("Error saving form:", err);
    res.status(500).json({ error: "Error saving form" });
  }
});

export default router;
