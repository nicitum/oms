require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const apiRouter = require('./api');

const app = express();
const PORT = process.env.PORT || 3001; // Changed port to 3001

// Configure CORS with specific options
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://147.93.110.150', 'http://localhost:8081', 'exp://'], // Added React Native dev server
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Successfully connected to MySQL database');
  connection.release();
});

// Add database to request object
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Use API routes
app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});