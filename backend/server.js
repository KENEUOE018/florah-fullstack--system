require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const ExcelJS = require('exceljs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Confirm .env values
console.log('Connecting to DB:', process.env.DB_NAME);

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connected to MySQL database');
  }
});

// Register
app.post('/api/register', async (req, res) => {
  console.log('📥 Raw request body:', req.body); // ✅ Added debug line
  const { username, password, role } = req.body;
  console.log('📥 Incoming registration:', { username, role });

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashed, role.toLowerCase()],
      (err, result) => {
        if (err) {
          console.error('❌ Registration error:', err.message);
          return res.status(500).json({ message: 'Registration failed' });
        }
        console.log('✅ Registered user ID:', result.insertId);
        res.json({ message: 'Registered successfully' });
      }
    );
  } catch (error) {
    console.error('❌ Hashing error:', error.message);
    res.status(500).json({ message: 'Error hashing password' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log('🔐 Login attempt:', username);

  if (!username || !password) {
    return res.status(400).json({ message: 'Missing credentials' });
  }

  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) {
      console.error('❌ Login DB error:', err.message);
      return res.status(500).json({ message: 'Login failed' });
    }

    if (results.length === 0) {
      console.warn('⚠️ No user found:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, results[0].password);
    if (!match) {
      console.warn('⚠️ Password mismatch for:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('✅ Login successful:', username);
    res.json({ role: results[0].role });
  });
});

// Submit Report
app.post('/api/report', (req, res) => {
  db.query('INSERT INTO report SET ?', req.body, err => {
    if (err) return res.status(500).json({ message: 'Report failed' });
    res.json({ message: 'Report submitted' });
  });
});

// Get Reports
app.get('/api/reports', (req, res) => {
  db.query('SELECT * FROM report', (err, results) => {
    if (err) return res.status(500).json({ message: 'Fetch failed' });
    res.json(results);
  });
});

// Search Reports
app.get('/api/search-report', (req, res) => {
  const { lecturer_name } = req.query;
  db.query('SELECT * FROM report WHERE lecturer_name LIKE ?', [`%${lecturer_name}%`], (err, results) => {
    if (err) return res.status(500).json({ message: 'Search failed' });
    res.json(results);
  });
});

// Download Excel
app.get('/api/download-report', async (req, res) => {
  db.query('SELECT * FROM report', async (err, results) => {
    if (err || results.length === 0) return res.status(500).send('Error generating Excel');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reports');
    sheet.columns = Object.keys(results[0]).map(key => ({ header: key, key }));
    results.forEach(row => sheet.addRow(row));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reports.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  });
});

// Submit Rating
app.post('/api/rating', (req, res) => {
  const data = { ...req.body, date_submitted: new Date() };
  db.query('INSERT INTO rating SET ?', data, err => {
    if (err) return res.status(500).json({ message: 'Rating failed' });
    res.json({ message: 'Rating submitted' });
  });
});

// Assign Course
app.post('/api/assign-course', (req, res) => {
  db.query('INSERT INTO assignments SET ?', req.body, err => {
    if (err) return res.status(500).json({ message: 'Assignment failed' });
    res.json({ message: 'Course assigned' });
  });
});

app.listen(3001, () => console.log('🚀 Backend running on http://localhost:3001'));
