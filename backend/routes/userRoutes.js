const express = require('express');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// Get all users except the currently logged-in one
router.get('/', verifyToken, async (req, res) => {
  try {
    const users = await User.find({ username: { $ne: req.user.username } }).select('username');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;