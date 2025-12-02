import express from "express";
import { pool } from "../database/connection.js";
import { sendStatusEmail } from "../utils/sendmail.js";

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
      `SELECT course_name
       FROM advising_courses
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
      `SELECT course_name
       FROM advising_courses
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
   SAVE / UPDATE FORM
========================= */
/* =========================
   SAVE / UPDATE FORM (LOCK COURSES EVEN IF PENDING)
========================= */
router.post("/save", async (req, res) => {
  try {
    const { formId, email, currentTerm, lastGPA, status, selectedCourses } = req.body;
    const userId = await getUserIdByEmail(email);
    if (!userId) return res.status(400).json({ error: "Invalid user" });

    // BLOCK COURSES THAT ARE IN ANY FORM (Pending OR Approved OR Rejected)
    const [planned] = await pool.query(`
      SELECT LOWER(REPLACE(course_name,'–','-')) AS c
      FROM advising_courses
      WHERE user_id=?
    `, [userId]);

    const plannedSet = planned.map(x => x.c);

    // 🚫 Prevent duplicates (even if Pending)
    for (const course of selectedCourses) {
      const norm = course.replace(/–/g,"-").toLowerCase();
      if (plannedSet.includes(norm)) {
        return res.status(400).json({
          message: `You already submitted: ${course}`
        });
      }
    }

    let advisingId = formId;

    // CREATE NEW FORM
    if (!formId) {
      const [r] = await pool.query(`
        INSERT INTO advising 
        (user_id,current_term,last_gpa,last_term,status,created_at)
        VALUES (?,?,?,?,?,NOW())
      `, [
        userId,
        currentTerm,
        lastGPA || null,
        currentTerm,
        status || "Pending"
      ]);

      advisingId = r.insertId;

    } else {
      // LOCK EDITING IF NOT PENDING
      const [[check]] = await pool.query(
        "SELECT status FROM advising WHERE id=?",
        [formId]
      );

      if (!check || check.status !== "Pending") {
        return res.status(403).json({
          message: "This form is locked and cannot be edited"
        });
      }

      await pool.query(`
        UPDATE advising 
        SET current_term=?, last_gpa=?, status=?
        WHERE id=?
      `, [
        currentTerm,
        lastGPA || null,
        status || "Pending",
        formId
      ]);
    }

    // Insert new planned classes
    for (const c of selectedCourses) {
      await pool.query(`
        INSERT INTO advising_courses
        (advising_id,user_id,course_name,status,term)
        VALUES (?,?,?,'Planned',?)
      `, [
        advisingId,
        userId,
        c,
        currentTerm
      ]);
    }

    res.json({ success: true, advisingId });

  } catch (err) {
    console.error("Save form error:", err);
    res.status(500).json({ error: "Save failed" });
  }
});


/* =========================
  ADMIN — VIEW
========================= */
router.get("/admin/forms/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [[form]] = await pool.query(`
      SELECT 
        a.*,
        CONCAT(u.u_first_name, ' ', u.u_last_name) AS name,
        u.u_email
      FROM advising a
      JOIN user_information u ON a.user_id = u.u_id
      WHERE a.id = ?
    `, [id]);

    if (!form) return res.status(404).json({ error: "Not found" });

    const [courses] = await pool.query(
      "SELECT course_name FROM advising_courses WHERE advising_id=?",
      [id]
    );

    res.json({ ...form, courses });

  } catch (err) {
    console.error("Admin view error:", err);
    res.status(500).json({ error: "Failed loading form details" });
  }
});

/* =========================
   ADMIN — DECISION 
========================= */
router.post("/admin/decision", async (req, res) => {
  const { id, status, message } = req.body;

  try {
    await pool.query(
      "UPDATE advising SET status=?, admin_message=? WHERE id=?",
      [status, message, id]
    );

    const [[row]] = await pool.query(`
      SELECT u.u_email, a.current_term
      FROM advising a
      JOIN user_information u ON a.user_id = u.u_id
      WHERE a.id = ?
    `, [id]);

    // CRITICAL FIX (this stops Jest crashing)
    if (!row) {
      return res.status(404).json({ error: "Advising record not found" });
    }

    await sendStatusEmail(
      row.u_email,
      status,
      row.current_term,
      message
    );

    res.json({ success: true });

  } catch (err) {
    console.error("Decision error:", err);
    res.status(500).json({ error: "Decision failed" });
  }
});

/* =========================
   ✅ ADMIN CHECK
========================= */
router.post("/check-admin", async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT is_admin FROM user_information WHERE u_email = ?",
      [email]
    );

    if (!rows.length) return res.json({ isAdmin: false });

    res.json({ isAdmin: rows[0].is_admin === 1 });

  } catch (err) {
    console.error("Admin check error:", err);
    res.status(500).json({ isAdmin: false });
  }
});

export default router;
