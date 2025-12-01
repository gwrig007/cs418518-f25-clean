import express from "express";
import { pool } from "../database/connection.js";

const router = express.Router();

async function getUserIdByEmail(email) {
  const [[user]] = await pool.query("SELECT u_id FROM user_information WHERE u_email = ?",[email]);
  return user?.u_id;
}

/* COMPLETED COURSES FOR BLUR */
router.get("/taken-courses", async (req,res)=>{
  const userId = await getUserIdByEmail(req.query.email);
  const [rows] = await pool.query(
    `SELECT course_name FROM advising_courses WHERE user_id=? AND status='Completed'`,
    [userId]
  );
  res.json(rows);
});

/* LOAD FORM */
router.get("/form", async (req,res)=>{
  const [[form]] = await pool.query("SELECT * FROM advising WHERE id=?", [req.query.formId]);
  const [courses] = await pool.query("SELECT course_name,status,term FROM advising_courses WHERE advising_id=?", [req.query.formId]);

  res.json({
    form,
    selectedCourses: courses.map(c=>({name:c.course_name,status:c.status,term:c.term}))
  });
});

/* SAVE FORM */
router.post("/save", async (req,res)=>{
  const {formId,email,currentTerm,lastGPA,status,selectedCourses} = req.body;
  const userId = await getUserIdByEmail(email);

  const [completed] = await pool.query(
    `SELECT LOWER(REPLACE(course_name,'–','-')) AS c FROM advising_courses WHERE user_id=? AND status='Completed'`,
    [userId]
  );
  const completedSet = completed.map(x=>x.c);

  for(const c of selectedCourses){
    const norm = c.replace(/–/g,"-").toLowerCase();
    if(completedSet.includes(norm))
      return res.status(400).json({message:`Already completed: ${c}`});
  }

  let advisingId=formId;

  if(!formId){
    const [r] = await pool.query(
      `INSERT INTO advising (user_id,current_term,last_gpa,last_term,status,created_at)
       VALUES (?,?,?,?,?,NOW())`,
      [userId,currentTerm,lastGPA||null,currentTerm,status||"Pending"]
    );
    advisingId=r.insertId;
  } else {
    const [[check]] = await pool.query("SELECT status FROM advising WHERE id=?", [formId]);
    if(check.status!=="Pending") return res.status(403).json({message:"Locked"});
    await pool.query("UPDATE advising SET current_term=?,last_gpa=?,status=? WHERE id=?",
      [currentTerm,lastGPA||null,status||"Pending",formId]);
  }

  await pool.query("DELETE FROM advising_courses WHERE advising_id=? AND status='Planned'",[advisingId]);

  for(const c of selectedCourses){
    await pool.query(
      `INSERT INTO advising_courses (advising_id,user_id,course_name,status,term)
       VALUES (?,?,?,'Planned',?)`,
      [advisingId,userId,c,currentTerm]
    );
  }

  res.json({success:true,advisingId});
});

export default router;
