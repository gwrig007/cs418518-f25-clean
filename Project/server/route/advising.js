import express from "express";
import { pool } from "../database/connection.js";
const router = express.Router();

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

// Convert email → user_id
async function getUserIdFromEmail(email) {
  const [rows] = await pool.query(
    "SELECT u_id FROM user_information WHERE u_email = ?",
    [email]
  );
  return rows.length > 0 ? rows[0].u_id : null;
}

/* -------------------------------------------------------
   1️⃣ GET ADVISING HISTORY (like your screenshot)
------------------------------------------------------- */
router.get("/history", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Missing email parameter" });

    const userId = await getUserIdFromEmail(email);
    if (!userId) return res.status(404).json({ error: "User not found" });

    const [rows] = await pool.query(
      `SELECT 
         id,
         created_at,
         last_term,
         last_gpa,
         'Pending' AS status
       FROM advising
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching advising history:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/* -------------------------------------------------------
   2️⃣ CREATE NEW ADVISING RECORD
------------------------------------------------------- */
router.post("/create", async (req, res) => {
  try {
    const { email, last_term, last_gpa } = req.body;

    if (!email || !last_term)
      return res.status(400).json({ error: "Missing fields" });

    const userId = await getUserIdFromEmail(email);
    if (!userId) return res.status(404).json({ error: "User not found" });

    const [result] = await pool.query(
      `INSERT INTO advising (user_id, last_term, last_gpa, created_at)
       VALUES (?, ?, ?, NOW())`,
      [userId, last_term, last_gpa]
    );

    res.json({ success: true, advising_id: result.insertId });
  } catch (err) {
    console.error("Error creating advising record:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------------------------------------------
   3️⃣ GET COURSES FOR AN ADVISING RECORD
------------------------------------------------------- */
router.get("/courses", async (req, res) => {
  try {
    const { advising_id } = req.query;
    if (!advising_id)
      return res.status(400).json({ error: "Missing advising_id" });

    const [rows] = await pool.query(
      `SELECT 
          id,
          course_level,
          course_name,
          current_term,
          status
       FROM advising_courses
       WHERE advising_id = ?
       ORDER BY course_level ASC`,
      [advising_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching advising courses:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------------------------------------------
   4️⃣ ADD A COURSE TO AN ADVISING SESSION
------------------------------------------------------- */
router.post("/add-course", async (req, res) => {
  try {
    const { advising_id, course_level, course_name, current_term } = req.body;

    if (!advising_id || !course_level || !course_name || !current_term)
      return res.status(400).json({ error: "Missing required fields" });

    const [result] = await pool.query(
      `INSERT INTO advising_courses 
          (advising_id, course_level, course_name, current_term, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [advising_id, course_level, course_name, current_term]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("Error adding course:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
