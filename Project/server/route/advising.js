// server/route/advising.js
import express from "express";
import pool from "../config/db.js";

const advising = express.Router();

/* ===========================
   GET /advising/summary?email=
=========================== */
advising.get("/summary", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [[result]] = await pool.execute(
      `SELECT 
         u_email,
         last_term,
         last_gpa,
         current_term,
         status
       FROM advising_records
       WHERE u_email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (!result) return res.json({});
    res.json(result);
  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ message: "Server error loading summary" });
  }
});

/* ===========================
   GET /advising/current-courses?email=
=========================== */
advising.get("/current-courses", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [courses] = await pool.execute(
      `SELECT course_name, course_level
       FROM advising_courses ac
       JOIN advising_records ar ON ac.record_id = ar.id
       WHERE ar.u_email = ?
       ORDER BY ac.course_name`,
      [email]
    );

    res.json(courses);
  } catch (err) {
    console.error("Current courses error:", err);
    res.status(500).json({ message: "Server error loading current courses" });
  }
});

/* ===========================
   GET /advising/last-courses?email=&term=
=========================== */
advising.get("/last-courses", async (req, res) => {
  try {
    const { email, term } = req.query;
    if (!email || !term)
      return res.status(400).json({ message: "Email and term are required" });

    const [courses] = await pool.execute(
      `SELECT course_name, grade
       FROM taken_courses
       WHERE u_email = ? AND term = ?`,
      [email, term]
    );

    res.json(courses);
  } catch (err) {
    console.error("Last courses error:", err);
    res.status(500).json({ message: "Server error loading last courses" });
  }
});

/* ===========================
   GET /advising/history?email=
=========================== */
advising.get("/history", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.execute(
      `SELECT 
         ar.id,
         DATE_FORMAT(ar.created_at, '%m/%d/%Y') AS date,
         ar.current_term AS term,
         ar.status,
         GROUP_CONCAT(ac.course_name ORDER BY ac.course_name SEPARATOR ', ') AS courses
       FROM advising_records ar
       LEFT JOIN advising_courses ac ON ar.id = ac.record_id
       WHERE ar.u_email = ?
       GROUP BY ar.id
       ORDER BY ar.created_at DESC`,
      [email]
    );

    res.json(rows);
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ message: "Server error loading history" });
  }
});

/* ===========================
   POST /advising/submit
=========================== */
advising.post("/submit", async (req, res) => {
  const { email, lastTerm, lastGpa, currentTerm, courses } = req.body;
  if (!email || !currentTerm)
    return res.status(400).json({ message: "Missing required fields" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO advising_records (u_email, last_term, last_gpa, current_term, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [email, lastTerm, lastGpa, currentTerm]
    );
    const recordId = result.insertId;

    for (const c of courses) {
      await conn.execute(
        `INSERT INTO advising_courses (record_id, course_name, course_level)
         VALUES (?, ?, ?)`,
        [recordId, c.name, c.level]
      );
    }

    await conn.commit();
    res.json({ message: "Advising record submitted successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("Submit error:", err);
    res.status(500).json({ message: "Server error submitting record" });
  } finally {
    conn.release();
  }
});

/* ===========================
   POST /advising/sync-approved
   Auto-sync approved advising → taken_courses
=========================== */
advising.post("/sync-approved", async (req, res) => {
  try {
    const [result] = await pool.execute(`
      INSERT INTO taken_courses (u_email, term, course_name)
      SELECT ar.u_email, ar.current_term, ac.course_name
      FROM advising_records ar
      JOIN advising_courses ac ON ar.id = ac.record_id
      WHERE ar.status = 'Approved'
      AND (ar.u_email, ar.current_term, ac.course_name) 
          NOT IN (SELECT u_email, term, course_name FROM taken_courses)
    `);

    res.json({ message: `Synced ${result.affectedRows} approved courses.` });
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ message: "Error syncing approved records" });
  }
});

export default advising;
