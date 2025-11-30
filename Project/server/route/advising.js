import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * Save advising form
 */
router.post("/save", async (req, res) => {
  try {
    const {
      userId,
      currentTerm,
      lastTerm,
      lastGpa,
      selectedCourses, // [{ course_name, status, term }]
    } = req.body;

    if (!userId || !currentTerm || !selectedCourses) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Convert empty GPA to null so MySQL doesn't throw decimal errors
    const finalLastGpa = lastGpa === "" ? null : lastGpa;

    // Insert into advising parent table
    const [advisingResult] = await pool.query(
      `
      INSERT INTO advising (user_id, current_term, last_gpa, status, last_term, created_at)
      VALUES (?, ?, ?, 'Pending', ?, NOW())
      `,
      [userId, currentTerm, finalLastGpa, lastTerm]
    );

    const advisingId = advisingResult.insertId;

    // Insert selected courses with provided status + term
    for (const c of selectedCourses) {
      if (!c.course_name || !c.status || !c.term) {
        console.log("Skipping invalid course entry:", c);
        continue;
      }

      await pool.query(
        `
        INSERT INTO advising_courses (advising_id, user_id, course_name, status, term)
        VALUES (?, ?, ?, ?, ?)
        `,
        [advisingId, userId, c.course_name, c.status, c.term]
      );
    }

    res.json({ message: "Advising form saved", advisingId });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: "Error saving form", error: err });
  }
});

/**
 * GET a full advising form by ID
 */
router.get("/form/:id", async (req, res) => {
  try {
    const advisingId = req.params.id;

    const [[form]] = await pool.query(
      "SELECT * FROM advising WHERE advising_id = ?",
      [advisingId]
    );

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    const [courses] = await pool.query(
      "SELECT * FROM advising_courses WHERE advising_id = ?",
      [advisingId]
    );

    res.json({ form, courses });
  } catch (err) {
    console.error("LOAD FORM ERROR:", err);
    res.status(500).json({ message: "Error loading form" });
  }
});

/**
 * Get all advising forms for a user
 */
router.get("/list/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const [forms] = await pool.query(
      `
      SELECT advising_id, current_term, last_term, last_gpa, status, created_at
      FROM advising
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json(forms);
  } catch (err) {
    console.error("LIST ERROR:", err);
    res.status(500).json({ message: "Error loading forms" });
  }
});

/**
 * Get all courses for a user (used for checking duplicates)
 */
router.get("/courses/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const [rows] = await pool.query(
      `
      SELECT course_name, status, term
      FROM advising_courses
      WHERE user_id = ?
      `,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("COURSES ERROR:", err);
    res.status(500).json({ message: "Error loading courses" });
  }
});

export default router;
