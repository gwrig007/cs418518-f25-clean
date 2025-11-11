const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ Get advising summary
router.get("/summary", async (req, res) => {
  const { email } = req.query;
  try {
    const [summary] = await pool.query(
      "SELECT * FROM advising_summary WHERE u_email = ? ORDER BY id DESC LIMIT 1",
      [email]
    );
    res.json(summary[0] || {});
  } catch (err) {
    console.error("Error fetching advising summary:", err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// ✅ Get last courses (from previous term)
router.get("/last-courses", async (req, res) => {
  const { email, term } = req.query;
  try {
    const [rows] = await pool.query(
      "SELECT course_name, grade FROM advising_courses WHERE u_email = ? AND term = ?",
      [email, term]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching last courses:", err);
    res.status(500).json({ error: "Failed to fetch last courses" });
  }
});

// ✅ Get current courses
router.get("/current-courses", async (req, res) => {
  const { email } = req.query;
  try {
    const [rows] = await pool.query(
      "SELECT course_name, course_level FROM advising_courses WHERE u_email = ? AND term = 'Current'",
      [email]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching current courses:", err);
    res.status(500).json({ error: "Failed to fetch current courses" });
  }
});

// ✅ Add a new class (only if not already taken)
router.post("/add-course", async (req, res) => {
  const { email, course_name, course_level, term } = req.body;
  try {
    // check if already exists
    const [exists] = await pool.query(
      "SELECT * FROM advising_courses WHERE u_email = ? AND course_name = ?",
      [email, course_name]
    );

    if (exists.length > 0) {
      return res.status(400).json({ message: "Class already taken or added." });
    }

    await pool.query(
      "INSERT INTO advising_courses (u_email, course_name, course_level, term) VALUES (?, ?, ?, ?)",
      [email, course_name, course_level, term || "Current"]
    );

    res.json({ message: "Class added successfully." });
  } catch (err) {
    console.error("Error adding new class:", err);
    res.status(500).json({ error: "Failed to add class." });
  }
});

// ✅ Get advising history
router.get("/history", async (req, res) => {
  const { email } = req.query;
  try {
    const [rows] = await pool.query(
      "SELECT id, term, date, status, GROUP_CONCAT(course_name SEPARATOR ', ') AS courses FROM advising_courses WHERE u_email = ? GROUP BY term, date, status ORDER BY date DESC",
      [email]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching advising history:", err);
    res.status(500).json({ error: "Failed to fetch advising history" });
  }
});

module.exports = router;
