import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

/* =========================
   ✅ USER ID HELPER
========================= */
async function getUserIdByEmail(email) {
  const [[user]] = await pool.query(
    "SELECT u_id FROM user_information WHERE u_email = ?",
    [email]
  );
  return user?.u_id || null;
}

/* =========================
   ✅ CURRENT COURSES
========================= */
router.get("/current-courses", async (req, res) => {
  try {
    const userId = await getUserIdByEmail(req.query.email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT course_name FROM advising_courses
       WHERE user_id=? AND status='Planned'`,
      [userId]
    );

    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("Current courses error:", err);
    res.status(500).json({ error: "Failed loading current courses" });
  }
});

/* =========================
   ✅ TAKEN COURSES
========================= */
router.get("/taken-courses", async (req, res) => {
  try {
    const userId = await getUserIdByEmail(req.query.email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT course_name FROM advising_courses
       WHERE user_id=? AND status='Completed'`,
      [userId]
    );

    res.json(rows.map(r => r.course_name));
  } catch (err) {
    console.error("Taken courses error:", err);
    res.status(500).json({ error: "Failed loading taken courses" });
  }
});

/* =========================
   ✅ ADVISING FORMS HISTORY
========================= */
router.get("/forms", async (req, res) => {
  try {
    const userId = await getUserIdByEmail(req.query.email);
    if (!userId) return res.json([]);

    const [rows] = await pool.query(
      `SELECT id, current_term, last_gpa, status, created_at
       FROM advising
       WHERE user_id=?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Form history error:", err);
    res.status(500).json({ error: "Failed loading forms" });
  }
});

/* =========================
   ✅ LOAD A SINGLE FORM (legacy)
========================= */
router.get("/form", async (req, res) => {
  try {
    const { formId } = req.query;

    const [[form]] = await pool.query(
      "SELECT * FROM advising WHERE id=?",
      [formId]
    );

    if (!form) return res.status(404).json({ error: "Form not found" });

    const [courses] = await pool.query(
      `SELECT course_name, status, term
       FROM advising_courses
       WHERE advising_id=?`,
      [formId]
    );

    res.json({
      form,
      selectedCourses: courses.map(c => ({
        name: c.course_name,
        status: c.status,
        term: c.term
      }))
    });
  } catch (err) {
    console.error("Load legacy form error:", err);
    res.status(500).json({ error: "Failed loading form" });
  }
});

/* =========================
   ✅ SAVE / UPDATE FORM
========================= */
router.post("/save", async (req, res) => {
  try {
    const { formId, email, currentTerm, lastGPA, status, selectedCourses } = req.body;
    const userId = await getUserIdByEmail(email);
    if (!userId) return res.status(400).json({ error: "Invalid user" });

    // Get completed courses
    const [completed] = await pool.query(
      `SELECT LOWER(REPLACE(course_name,'–','-')) AS c
       FROM advising_courses
       WHERE user_id=? AND status='Completed'`,
      [userId]
    );

    const completedSet = completed.map(x => x.c);

    // Enforce rule: cannot re-add completed courses
    for (const c of selectedCourses) {
      const norm = c.replace(/–/g, "-").toLowerCase();
      if (completedSet.includes(norm)) {
        return res.status(400).json({ message: `Already completed: ${c}` });
      }
    }

    let advisingId = formId;

    if (!formId) {
      // Create new form
      const [r] = await pool.query(
        `INSERT INTO advising (user_id,current_term,last_gpa,last_term,status,created_at)
         VALUES (?,?,?,?,?,NOW())`,
        [userId, currentTerm, lastGPA || null, currentTerm, status || 'Pending']
      );
      advisingId = r.insertId;
    } else {
      // Update existing if not locked
      const [[check]] = await pool.query(
        "SELECT status FROM advising WHERE id=?",
        [formId]
      );

      if (!check || check.status !== "Pending")
        return res.status(403).json({ message: "Form is locked" });

      await pool.query(
        "UPDATE advising SET current_term=?, last_gpa=?, status=? WHERE id=?",
        [currentTerm, lastGPA || null, status || 'Pending', formId]
      );
    }

    // Remove old planned courses
    await pool.query(
      "DELETE FROM advising_courses WHERE advising_id=? AND status='Planned'",
      [advisingId]
    );

    // Insert new planned courses
    for (const c of selectedCourses) {
      await pool.query(
        `INSERT INTO advising_courses (advising_id,user_id,course_name,status,term)
         VALUES (?,?,?,'Planned',?)`,
        [advisingId, userId, c, currentTerm]
      );
    }

    res.json({ success: true, advisingId });

  } catch (err) {
    console.error("Save form error:", err);
    res.status(500).json({ error: "Failed saving form" });
  }
});

/* =========================
   ✅ VIEW COURSE PLAN (MAIN ROUTE)
========================= */
router.get("/forms/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Load form
    const [forms] = await pool.query(
      "SELECT id, current_term, last_gpa, status, created_at FROM advising WHERE id = ?",
      [id]
    );

    if (forms.length === 0)
      return res.status(404).json({ error: "Form not found" });

    // Load courses (✅ CORRECT FK NAME)
    const [courses] = await pool.query(
      "SELECT course_level, course_name FROM advising_courses WHERE advising_id = ?",
      [id]
    );

    res.json({
      ...forms[0],
      courses
    });

  } catch (err) {
    console.error("Load plan error:", err);
    res.status(500).json({ error: "Server error loading course plan" });
  }
});

export default router;
