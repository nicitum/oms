const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Migration to hash existing plain-text passwords
const hashExistingPasswords = async (db) => {
  try {
    const [users] = await db.promise().query('SELECT * FROM supermasters');
    for (const user of users) {
      if (!user.password.startsWith('$2b$')) {
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
        await db.promise().query(
          'UPDATE supermasters SET password = ? WHERE username = ?',
          [hashedPassword, user.username]
        );
        console.log(`Hashed password for user: ${user.username}`);
      }
    }
    console.log('Password hashing migration completed.');
  } catch (error) {
    console.error('Error during password hashing migration:', error);
  }
};

// Run migration on server start
router.initMigration = (db) => {
  hashExistingPasswords(db);
};

// Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const [users] = await req.db.promise().query(
      'SELECT * FROM supermasters WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await req.db.promise().query(
      'UPDATE supermasters SET logged_in_at = CURRENT_TIME WHERE username = ?',
      [username]
    );

    const token = jwt.sign(
      { username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      username: user.username,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout Route
router.post('/logout', async (req, res) => {
  const { username } = req.body;

  try {
    await req.db.promise().query(
      'UPDATE supermasters SET logged_out_at = CURRENT_TIME WHERE username = ?',
      [username]
    );

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change Password Route
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const username = req.user.username;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  try {
    const [users] = await req.db.promise().query(
      'SELECT * FROM supermasters WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidCurrentPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await req.db.promise().query(
      'UPDATE supermasters SET password = ? WHERE username = ?',
      [hashedNewPassword, username]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clients CRUD Routes
// Create a client
router.post('/clients', authenticateToken, async (req, res) => {
  const { license_no, expiry_date, duration, duration_unit, status } = req.body;
  const created_by = req.user.username;
  const issue_date = new Date().toISOString().split('T')[0]; // Always use today's date

  if (!license_no || !expiry_date || !duration || !status || !duration_unit) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    await req.db.promise().query(
      'INSERT INTO clients (license_no, issue_date, expiry_date, duration, duration_unit, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [license_no, issue_date, expiry_date, duration, duration_unit, status, created_by]
    );
    res.status(201).json({ message: 'Client created successfully' });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Read all clients
router.get('/clients', authenticateToken, async (req, res) => {
  try {
    const [clients] = await req.db.promise().query('SELECT * FROM clients');
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a client
router.put('/clients/:client_id', authenticateToken, async (req, res) => {
  const { client_id } = req.params;
  const { license_no, expiry_date, duration, duration_unit, status } = req.body;

  if (!license_no || !expiry_date || !duration || !status || !duration_unit) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const [result] = await req.db.promise().query(
      'UPDATE clients SET license_no = ?, expiry_date = ?, duration = ?, duration_unit = ?, status = ? WHERE client_id = ?',
      [license_no, expiry_date, duration, duration_unit, status, client_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a client
router.delete('/clients/:client_id', authenticateToken, async (req, res) => {
  const { client_id } = req.params;

  try {
    const [result] = await req.db.promise().query(
      'DELETE FROM clients WHERE client_id = ?',
      [client_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected route example
router.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

// Health check route
router.get('/health', async (req, res) => {
  try {
    const [result] = await req.db.promise().query('SELECT 1');
    res.json({
      status: 'API is running',
      database: 'Connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'API is running',
      database: 'Disconnected',
      error: error.message,
    });
  }
});

module.exports = router;