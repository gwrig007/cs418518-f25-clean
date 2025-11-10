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
   GET /advising/last-courses?email=&term=
   Fetch courses student took in previous or current term
=========================== */
advising.get("/last-courses", async (req, res) => {
  try {
    const { email, term } = req.query;
    if (!email) return res.status(400).json({ message: "Email required" });

    let finalTerm = term;

    // 🟦 If term not provided, get most recent (current) term automatically
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
   POST /advising/create
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

    // 2️⃣ insert course plan
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

/* ===========================
   PUT /advising/update/:id
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
        "SELECT id FROM taken_courses WHERE u_email = ? AND term = ? AND course_name = ?",
        [email, last_term, c.name]
      );
      if (taken.length === 0) {
        await conn.execute(
          "INSERT INTO advising_courses (record_id, course_level, course_name) VALUES (?, ?, ?)",
          [id, c.level, c.name]
        );
      }
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
