// database/connection.js
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false, // ✅ Toggle SSL dynamically
});

// Quick test when the server starts
try {
  const conn = await pool.getConnection();
  console.log("✅ Connected to Clever Cloud MySQL!");
  conn.release();
} catch (err) {
  console.error("❌ MySQL connection failed:", err.message);
}
