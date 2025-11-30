// database/connection.js
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,

  waitForConnections: true,
  connectionLimit: 5,     // 🔥 Match Clever Cloud's max_user_connections = 5
  queueLimit: 0,
});

// Logs for debugging (optional)
pool.on("connection", () => {
  console.log("🔥 New MySQL connection established");
});

pool.on("release", () => {
  console.log("♻ MySQL connection released");
});
