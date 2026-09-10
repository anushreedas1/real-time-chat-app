const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// List all conversations (DMs + groups) for the logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const username = req.user.username;

    const conversations = await Conversation.find({
      members: username,
      hiddenFor: { $ne: username },
    }).sort({ createdAt: 1 });

    const result = await Promise.all(
      conversations.map(async (conv) => {
        let displayName = conv.name;
        let displayPicture = conv.groupPicture;

        if (!conv.isGroup) {
          const otherUsername = conv.members.find((m) => m !== username);
          displayName = otherUsername;
          const otherUser = await User.findOne({ username: otherUsername }).select('profilePicture');
          displayPicture = otherUser ? otherUser.profilePicture : '';
        }

        const unreadCount = await Message.countDocuments({
          conversationId: conv._id.toString(),
          sender: { $ne: username },
          seenBy: { $ne: username },
        });

        return {
          _id: conv._id,
          isGroup: conv.isGroup,
          name: displayName,
          members: conv.members,
          profilePicture: displayPicture,
          about: conv.about,
          hasUnread: unreadCount > 0,
        };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Start or fetch an existing 1-on-1 conversation with another user
router.post('/dm', verifyToken, async (req, res) => {
  try {
    const { username: otherUsername } = req.body;
    const myUsername = req.user.username;

    if (!otherUsername || otherUsername.trim() === '') {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (otherUsername === myUsername) {
      return res.status(400).json({ error: "You can't start a chat with yourself" });
    }

    const otherUser = await User.findOne({ username: otherUsername });
    if (!otherUser) {
      return res.status(404).json({ error: 'No user found with that username' });
    }

    let conversation = await Conversation.findOne({
      isGroup: false,
      members: { $all: [myUsername, otherUsername], $size: 2 },
    });

    if (!conversation) {
      conversation = new Conversation({
        isGroup: false,
        members: [myUsername, otherUsername],
      });
      await conversation.save();
    } else if (conversation.hiddenFor.includes(myUsername)) {
      // Re-surface a previously deleted chat if the user tries to start it again
      conversation.hiddenFor = conversation.hiddenFor.filter((u) => u !== myUsername);
      await conversation.save();
    }

    res.status(201).json({ _id: conversation._id, name: otherUsername });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// Create a new group conversation
router.post('/group', verifyToken, async (req, res) => {
  try {
    const { name, members } = req.body;
    const myUsername = req.user.username;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Group name is required' });
    }

    if (!Array.isArray(members) || members.length < 2) {
      return res.status(400).json({ error: 'Add at least 2 other members' });
    }

    const foundUsers = await User.find({ username: { $in: members } }).select('username');
    if (foundUsers.length !== members.length) {
      return res.status(400).json({ error: 'One or more usernames were not found' });
    }

    const allMembers = Array.from(new Set([myUsername, ...members]));

    const conversation = new Conversation({
      isGroup: true,
      name: name.trim(),
      members: allMembers,
    });
    await conversation.save();

    res.status(201).json({ _id: conversation._id, name: conversation.name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get full info for a conversation (used for the group info panel)
router.get('/:id/info', verifyToken, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!conv.members.includes(req.user.username)) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversation info' });
  }
});

// Update a group's name, about text, or picture
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!conv.members.includes(req.user.username)) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }
    if (!conv.isGroup) {
      return res.status(400).json({ error: 'Only groups can be edited' });
    }

    const { name, about, groupPicture } = req.body;
    if (name !== undefined) conv.name = name;
    if (about !== undefined) conv.about = about;
    if (groupPicture !== undefined) conv.groupPicture = groupPicture;

    await conv.save();
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete a DM chat from your own view only
router.delete('/:id/hide', verifyToken, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!conv.members.includes(req.user.username)) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    await Conversation.updateOne(
      { _id: conv._id },
      { $addToSet: { hiddenFor: req.user.username } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Leave a group
router.post('/:id/leave', verifyToken, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!conv.isGroup) return res.status(400).json({ error: 'Can only leave groups' });
    if (!conv.members.includes(req.user.username)) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    conv.members = conv.members.filter((m) => m !== req.user.username);
    await conv.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

module.exports = router;