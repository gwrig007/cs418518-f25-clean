import 'dotenv/config';
import mysql from 'mysql2';

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,
  ssl: {
    // Clever Cloud’s MySQL uses a self-signed certificate
    rejectUnauthorized: false
  }
});

connection.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to Clever Cloud MySQL!");
  }
});

export { connection };
