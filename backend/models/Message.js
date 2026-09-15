const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    default: '',
    trim: true,
  },
  imageUrl: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    enum: ['text', 'image'],
    default: 'text',
  },
  sender: {
    type: String,
    required: true,
  },
  conversationId: {
    type: String,
    required: true,
  },
  seenBy: {
    type: [String], // usernames who have seen this message
    default: [],
  },
  deletedFor: {
    type: [String], // usernames who removed this message from their own chat
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Message', messageSchema);
