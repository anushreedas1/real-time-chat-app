const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  conversationId: {
    type: String,
    required: true,
  },
  seen: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Message', messageSchema);