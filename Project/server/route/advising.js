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
       FROM advising_records 
       WHERE u_email = ? 
       ORDER BY created_at DESC`,
      [email]
    );

    res.json(rows);
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ message: "Server error fetching advising history" });
  }
});

/* ===========================
   GET /advising/current?email=
   Returns courses the student is currently registered for
=========================== */
advising.get("/current", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.execute(
      `SELECT course_name AS course, term, grade
       FROM taken_courses
       WHERE u_email = ? AND term = (
         SELECT MAX(term) FROM taken_courses WHERE u_email = ?
       )
       ORDER BY course_name`,
      [email, email]
    );

    res.json(rows);
  } catch (err) {
    console.error("Current courses error:", err);
    res.status(500).json({ message: "Server error fetching current courses" });
  }
});


/* ===========================
   GET /advising/:id
   Fetch a single advising record + its courses
=========================== */
advising.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [records] = await pool.execute(
      "SELECT * FROM advising_records WHERE id = ?",
      [id]
    );
    if (records.length === 0)
      return res.status(404).json({ message: "Record not found" });

    const [courses] = await pool.execute(
      "SELECT * FROM advising_courses WHERE record_id = ?",
      [id]
    );

    res.json({ record: records[0], courses });
  } catch (err) {
    console.error("Get record error:", err);
    res.status(500).json({ message: "Server error fetching record" });
  }
});

/* ===========================
   POST /advising/create
   Create new advising record
=========================== */
advising.post("/create", async (req, res) => {
  const { email, last_term, last_gpa, current_term, courses } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO advising_records (u_email, last_term, last_gpa, current_term, status, created_at)
       VALUES (?, ?, ?, ?, 'Pending', NOW())`,
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
          "INSERT INTO advising_courses (record_id, course_level, course_name) VALUES (?, ?, ?)",
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
   Update existing advising record
=========================== */
advising.put("/update/:id", async (req, res) => {
  const { email, last_term, last_gpa, current_term, courses } = req.body;
  const { id } = req.params;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [check] = await conn.execute(
      "SELECT status FROM advising_records WHERE id = ? AND u_email = ?",
      [id, email]
    );
    if (check.length === 0)
      return res.status(404).json({ message: "Record not found" });
    if (check[0].status !== "Pending")
      return res.status(403).json({ message: "Cannot modify approved/rejected record" });

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
