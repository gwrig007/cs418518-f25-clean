import { Router } from "express";
import { pool } from "../database/connection.js";

const advising = Router();

/* ===========================
   GET /advising/history?email=
   Returns all advising records for that student
=========================== */
advising.get("/history", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.execute(
      `SELECT id, DATE_FORMAT(created_at, '%m/%d/%Y') AS date, current_term AS term, status
       FROM advising_records WHERE u_email = ? ORDER BY created_at DESC`,
      [email]
    );

    res.json(rows);
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   ✅ GET /advising/summary?email=
   Academic summary (GPA, last term, total courses)
=========================== */
advising.get("/summary", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email required" });

    const [[stats]] = await pool.execute(
      `SELECT 
          MAX(term) AS last_term,
          ROUND(AVG(last_gpa), 2) AS avg_gpa,
          COUNT(*) AS advising_count
       FROM advising_records
       WHERE u_email = ?`,
      [email]
    );

    const [[totalCourses]] = await pool.execute(
      "SELECT COUNT(*) AS total_courses FROM taken_courses WHERE u_email = ?",
      [email]
    );

    res.json({
      last_term: stats?.last_term || "N/A",
      avg_gpa: stats?.avg_gpa || 0,
      advising_count: stats?.advising_count || 0,
      total_courses: totalCourses?.total_courses || 0,
    });
  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ message: "Error loading academic summary" });
  }
});

/* ===========================
   GET /advising/current-courses?email=
   Returns most recent term’s courses for this student
=========================== */
advising.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email required" });

    // Find latest term first
    const [[latest]] = await pool.execute(
      "SELECT term FROM taken_courses WHERE u_email = ? ORDER BY id DESC LIMIT 1",
      [email]
    );

    if (!latest) return res.json([]);

    const [rows] = await pool.execute(
      "SELECT course_name FROM taken_courses WHERE u_email = ? AND term = ?",
      [email, latest.term]
    );

    res.json(rows.map((r) => r.course_name));
  } catch (err) {
    console.error("Current courses error:", err);
    res.status(500).json({ message: "Error loading current courses" });
  }
});

/* ===========================
   GET /advising/:id
=========================== */
advising.get("/:id", async (req, res) => {
  try {
    const [records] = await pool.execute(
      "SELECT * FROM advising_records WHERE id = ?",
      [req.params.id]
    );
    if (records.length === 0)
      return res.status(404).json({ message: "Record not found" });

    const [courses] = await pool.execute(
      "SELECT * FROM advising_courses WHERE record_id = ?",
      [req.params.id]
    );

    res.json({ record: records[0], courses });
  } catch (err) {
    console.error("Get record error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   POST /advising/create
=========================== */
advising.post("/create", async (req, res) => {
  const { email, last_term, last_gpa, current_term, courses } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO advising_records (u_email, last_term, last_gpa, current_term, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [email, last_term, last_gpa, current_term]
    );
    const recordId = result.insertId;

    for (const c of courses || []) {
      const [taken] = await conn.execute(
        "SELECT id FROM taken_courses WHERE u_email = ? AND term = ? AND course_name = ?",
        [email, last_term, c.name]
      );
      if (taken.length === 0) {
        await conn.execute(
          `INSERT INTO advising_courses (record_id, course_level, course_name)
           VALUES (?, ?, ?)`,
          [recordId, c.level, c.name]
        );
      }
    }

    await conn.commit();
    res.json({ message: "Advising record created successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("Create advising error:", err);
    res.status(500).json({ message: "Server error creating advising record" });
  } finally {
    conn.release();
  }
});

export default advising;
