const express = require('express');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// Get the logged-in user's contact list
router.get('/contacts', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const contacts = await User.find({ username: { $in: user.contacts } }).select('username');
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Add a contact by username
router.post('/contacts', verifyToken, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.trim() === '') {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (username === req.user.username) {
      return res.status(400).json({ error: "You can't add yourself" });
    }

    const targetUser = await User.findOne({ username });
    if (!targetUser) {
      return res.status(404).json({ error: 'No user found with that username' });
    }

    const currentUser = await User.findOne({ username: req.user.username });

    if (currentUser.contacts.includes(username)) {
      return res.status(400).json({ error: 'Already in your contacts' });
    }

    currentUser.contacts.push(username);
    await currentUser.save();

    res.status(201).json({ username: targetUser.username });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

module.exports = router;