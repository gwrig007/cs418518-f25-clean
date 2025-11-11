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
   GET /advising/summary?email=
   Returns total number of advising records and total courses taken
=========================== */
advising.get("/summary", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [[records]] = await pool.execute(
      "SELECT COUNT(*) AS total_records FROM advising_records WHERE u_email = ?",
      [email]
    );

    const [[courses]] = await pool.execute(
      "SELECT COUNT(*) AS total_courses FROM taken_courses WHERE u_email = ?",
      [email]
    );

    res.json({
      total_records: records.total_records || 0,
      total_courses: courses.total_courses || 0,
    });
  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ message: "Error loading summary" });
  }
});

/* ===========================
   GET /advising/current-courses?email=
   Returns all currently registered courses
=========================== */
advising.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.execute(
      `SELECT course_name, term 
       FROM taken_courses 
       WHERE u_email = ? 
       ORDER BY term DESC, course_name ASC`,
      [email]
    );

    res.json(rows);
  } catch (err) {
    console.error("Current courses error:", err);
    res.status(500).json({ message: "Server error fetching current courses" });
  }
});

/* ===========================
   GET /advising/last-courses?email=&term=
   Fetch courses from a given or most recent term
=========================== */
advising.get("/last-courses", async (req, res) => {
  try {
    const { email, term } = req.query;
    if (!email) return res.status(400).json({ message: "Email required" });

    let finalTerm = term;

    // If term not provided, get most recent (current) term automatically
    if (!finalTerm) {
      const [latest] = await pool.execute(
        "SELECT term FROM taken_courses WHERE u_email = ? ORDER BY id DESC LIMIT 1",
        [email]
      );
      if (latest.length > 0) finalTerm = latest[0].term;
    }

    if (!finalTerm) return res.json([]);

    const [rows] = await pool.execute(
      "SELECT course_name FROM taken_courses WHERE u_email = ? AND term = ?",
      [email, finalTerm]
    );

    res.json(rows.map((r) => r.course_name));
  } catch (err) {
    console.error("Last courses error:", err);
    res.status(500).json({ message: "Error loading last courses" });
  }
});

/* ===========================
   GET /advising/:id
   Fetch a single advising record + its courses
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
   Prevents re-registering for already taken courses
=========================== */
advising.post("/create", async (req, res) => {
  const { email, last_term, last_gpa, current_term, courses } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1️⃣ insert advising record
    const [result] = await conn.execute(
      `INSERT INTO advising_records (u_email, last_term, last_gpa, current_term, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [email, last_term, last_gpa, current_term]
    );
    const recordId = result.insertId;

    // 2️⃣ insert course plan — prevent duplicates from any term
    for (const c of courses || []) {
      const [taken] = await conn.execute(
        "SELECT id FROM taken_courses WHERE u_email = ? AND course_name = ?",
        [email, c.name]
      );
      if (taken.length > 0) {
        await conn.rollback();
        return res.status(400).json({ message: `You have already taken ${c.name}` });
      }

      await conn.execute(
        `INSERT INTO advising_courses (record_id, course_level, course_name)
         VALUES (?, ?, ?)`,
        [recordId, c.level, c.name]
      );
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

/* ===========================
   PUT /advising/update/:id
   Also prevents duplicate course re-enrollment
=========================== */
advising.put("/update/:id", async (req, res) => {
  const { email, last_term, last_gpa, current_term, courses } = req.body;
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE advising_records 
       SET last_term=?, last_gpa=?, current_term=?, status='Pending'
       WHERE id=? AND u_email=?`,
      [last_term, last_gpa, current_term, id, email]
    );

    await conn.execute("DELETE FROM advising_courses WHERE record_id=?", [id]);

    for (const c of courses || []) {
      const [taken] = await conn.execute(
        "SELECT id FROM taken_courses WHERE u_email = ? AND course_name = ?",
        [email, c.name]
      );
      if (taken.length > 0) {
        await conn.rollback();
        return res.status(400).json({ message: `You have already taken ${c.name}` });
      }

      await conn.execute(
        "INSERT INTO advising_courses (record_id, course_level, course_name) VALUES (?, ?, ?)",
        [id, c.level, c.name]
      );
    }

    await conn.commit();
    res.json({ message: "Advising record updated successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("Update advising error:", err);
    res.status(500).json({ message: "Server error updating record" });
  } finally {
    conn.release();
  }
});

export default advising;
