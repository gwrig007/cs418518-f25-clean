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

  // ✅ Works for Clever Cloud (self-signed or non-SSL)
  ssl: {
    rejectUnauthorized: false,
  },
});

// quick connection test when the server starts
try {
  const conn = await pool.getConnection();
  console.log("✅ Connected to Clever Cloud MySQL!");
  conn.release();
} catch (err) {
  console.error("❌ MySQL connection failed:", err.message);
}
