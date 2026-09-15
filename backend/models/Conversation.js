const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  isGroup: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    default: '',
  },
  about: {
    type: String,
    default: '',
  },
  groupPicture: {
    type: String,
    default: '',
  },
  members: {
    type: [String],
    required: true,
  },
  hiddenFor: {
    type: [String], // usernames who "deleted" this chat from their own view
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Conversation', conversationSchema);
