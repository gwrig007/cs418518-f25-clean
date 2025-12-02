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
   ✅ ADMIN AUTH MIDDLEWARE
========================= */
function adminOnly(req, res, next) {
  if (req.headers["x-admin"] !== "true") {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
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
   ✅ LOAD A SINGLE FORM (STUDENT)
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
    console.error("Load form error:", err);
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

    // Check completed courses
    const [completed] = await pool.query(
      `SELECT LOWER(REPLACE(course_name,'–','-')) AS c
       FROM advising_courses
       WHERE user_id=? AND status='Completed'`,
      [userId]
    );

    const completedSet = completed.map(x => x.c);

    for (const c of selectedCourses) {
      const norm = c.replace(/–/g, "-").toLowerCase();
      if (completedSet.includes(norm))
        return res.status(400).json({ message: `Already completed: ${c}` });
    }

    let advisingId = formId;

    // New form
    if (!formId) {
      const [r] = await pool.query(
        `INSERT INTO advising 
         (user_id,current_term,last_gpa,last_term,status,created_at)
         VALUES (?,?,?,?,?,NOW())`,
        [userId, currentTerm, lastGPA || null, currentTerm, status || 'Pending']
      );
      advisingId = r.insertId;
    } 
    // Update form
    else {
      const [[check]] = await pool.query(
        "SELECT status FROM advising WHERE id=?",
        [formId]
      );

      if (!check || check.status !== "Pending")
        return res.status(403).json({ message: "Form locked" });

      await pool.query(
        "UPDATE advising SET current_term=?, last_gpa=?, status=? WHERE id=?",
        [currentTerm, lastGPA || null, status || "Pending", formId]
      );
    }

    // Clear planned courses
    await pool.query(
      "DELETE FROM advising_courses WHERE advising_id=? AND status='Planned'",
      [advisingId]
    );

    // Insert new planned courses
    for (const c of selectedCourses) {
      await pool.query(
        `INSERT INTO advising_courses
         (advising_id,user_id,course_name,status,term)
         VALUES (?,?,?,'Planned',?)`,
        [advisingId, userId, c, currentTerm]
      );
    }

    res.json({ success: true, advisingId });

  } catch (err) {
    console.error("Save form error:", err);
    res.status(500).json({ error: "Save failed" });
  }
});

/* =========================
   ✅ LOAD COURSE PLAN
========================= */
router.get("/forms/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [forms] = await pool.query(
      "SELECT id, current_term, last_gpa, status, created_at FROM advising WHERE id=?",
      [id]
    );

    if (!forms.length)
      return res.status(404).json({ error: "Not found" });

    const [courses] = await pool.query(
      "SELECT course_level, course_name FROM advising_courses WHERE advising_id=?",
      [id]
    );

    res.json({ ...forms[0], courses });

  } catch (err) {
    console.error("Load plan error:", err);
    res.status(500).json({ error: "Failed loading course plan" });
  }
});

/* =========================
   ✅ ADMIN LIST
========================= */
router.get("/admin/forms", adminOnly, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT a.id, a.current_term, a.status, u.u_name AS name
    FROM advising a
    JOIN user_information u ON a.user_id = u.u_id
    ORDER BY FIELD(a.status,'Pending','Approved','Rejected'), a.created_at DESC
  `);
  res.json(rows);
});

/* =========================
   ✅ ADMIN VIEW
========================= */
router.get("/admin/forms/:id", adminOnly, async (req, res) => {
  const { id } = req.params;

  const [[form]] = await pool.query(`
    SELECT a.*, u.u_name AS name, u.u_email
    FROM advising a
    JOIN user_information u ON a.user_id = u.u_id
    WHERE a.id = ?
  `, [id]);

  const [courses] = await pool.query(`
    SELECT course_name FROM advising_courses WHERE advising_id=?
  `, [id]);

  res.json({ ...form, courses });
});

/* =========================
   ✅ ADMIN DECISION
========================= */
router.post("/admin/decision", adminOnly, async (req, res) => {
  const { id, status, message } = req.body;

  await pool.query(
    "UPDATE advising SET status=?, admin_message=? WHERE id=?",
    [status, message, id]
  );

  res.json({ success: true });
});

export default router;
