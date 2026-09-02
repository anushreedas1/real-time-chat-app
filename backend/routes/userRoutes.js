const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

function getConversationId(userA, userB) {
  return [userA, userB].sort().join('_');
}

// Get the logged-in user's own profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const user = await User.findOne({ username: req.user.username }).select('username profilePicture');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update the logged-in user's profile picture URL
router.patch('/me/profile-picture', verifyToken, async (req, res) => {
  try {
    const { profilePicture } = req.body;

    if (!profilePicture) {
      return res.status(400).json({ error: 'profilePicture URL is required' });
    }

    const user = await User.findOneAndUpdate(
      { username: req.user.username },
      { profilePicture },
      { new: true }
    ).select('username profilePicture');

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

// Remove the logged-in user's profile picture
router.delete('/me/profile-picture', verifyToken, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { username: req.user.username },
      { profilePicture: '' },
      { new: true }
    ).select('username profilePicture');

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove profile picture' });
  }
});

// Get the logged-in user's contact list, each with an unread flag and profile picture
router.get('/contacts', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    const user = await User.findOne({ username: req.user.username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const contacts = await User.find({ username: { $in: user.contacts } }).select('username profilePicture');

    const contactsWithUnread = await Promise.all(
      contacts.map(async (contact) => {
        const conversationId = getConversationId(req.user.username, contact.username);
        const unreadCount = await Message.countDocuments({
          conversationId,
          sender: contact.username,
          seen: false,
        });
        return {
          _id: contact._id,
          username: contact.username,
          profilePicture: contact.profilePicture,
          hasUnread: unreadCount > 0,
        };
      })
    );

    res.json(contactsWithUnread);
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