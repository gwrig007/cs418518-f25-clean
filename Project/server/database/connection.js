import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT) || 3306,

  waitForConnections: true,
  connectionLimit: 3,   // ✅ Reduce from 5 to 3
  queueLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

// Optional logs (KEEP ONLY FOR DEBUG — remove later)
pool.on("connection", () => {
  console.log("✅ DB connection opened");
});
