const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ Get all advising forms for a user
router.get("/forms", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Missing email parameter" });
    }

    const [rows] = await pool.query(
      "SELECT id, current_term, last_gpa, status, created_at FROM advising_forms WHERE email = ? ORDER BY created_at DESC",
      [email]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching advising forms:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Get a single advising form by ID (for editing)
router.get("/form/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM advising_forms WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Advising form not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching advising form:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Create a new advising form
router.post("/form", async (req, res) => {
  try {
    const { email, current_term, last_gpa, status } = req.body;

    if (!email || !current_term) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [result] = await pool.query(
      "INSERT INTO advising_forms (email, current_term, last_gpa, status, created_at) VALUES (?, ?, ?, ?, NOW())",
      [email, current_term, last_gpa || null, status || "Pending"]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("Error creating advising form:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Update an advising form
router.put("/form/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { current_term, last_gpa, status } = req.body;

    const [result] = await pool.query(
      "UPDATE advising_forms SET current_term = ?, last_gpa = ?, status = ? WHERE id = ?",
      [current_term, last_gpa, status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Form not found or unchanged" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating advising form:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
