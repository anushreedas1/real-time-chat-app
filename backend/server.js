const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const verifyToken = require('./middleware/verifyToken');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);

app.get('/messages/:conversationId', verifyToken, async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId,
      deletedFor: { $ne: req.user.username },
    })
      .sort({ createdAt: 1 })
      .limit(50);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication error: no token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error: invalid token'));
  }
});

const onlineUsers = new Map();

function broadcastOnlineUsers() {
  io.emit('online users', Array.from(onlineUsers.keys()));
}

io.on('connection', (socket) => {
  const { username } = socket.user;
  console.log('A user connected:', username);

  socket.join(username);

  onlineUsers.set(username, (onlineUsers.get(username) || 0) + 1);
  broadcastOnlineUsers();

  socket.on('join conversation', async (conversationId) => {
    try {
      const conversation = await Conversation.findById(conversationId).select('members');
      if (!conversation?.members.includes(username)) return;
      socket.join(conversationId);

      const result = await Message.updateMany(
        { conversationId, sender: { $ne: username }, seenBy: { $ne: username } },
        { $addToSet: { seenBy: username } }
      );
      console.log(`Marked ${result.modifiedCount} messages as seen in ${conversationId} by ${username}`);
      // Every socket joins its username room at connection time, so this reaches
      // the sender immediately even if their browser is no longer in this chat room.
      conversation.members.forEach((member) => {
        io.to(member).emit('messages seen', { conversationId, seenBy: username });
      });
    } catch (err) {
      console.error('Error marking messages seen:', err);
    }
  });

  socket.on('chat message', async (data) => {
    try {
      if (!data?.conversationId || (!data.text?.trim() && !data.imageUrl)) {
        return;
      }

      const newMessage = new Message({
        text: data.text || '',
        imageUrl: data.imageUrl || '',
        type: data.imageUrl ? 'image' : 'text',
        sender: username,
        conversationId: data.conversationId,
      });
      await newMessage.save();

      io.to(data.conversationId).emit('chat message', newMessage);

      const conversation = await Conversation.findById(data.conversationId);
      if (conversation) {
        conversation.lastMessageAt = new Date();
        if (conversation.hiddenFor.length > 0) {
          conversation.hiddenFor = [];
        }
        await conversation.save();

        conversation.members
          .filter((m) => m !== username)
          .forEach((member) => {
            io.to(member).emit('new message notification', {
              conversationId: data.conversationId,
              sender: username,
            });
          });
      }
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('edit message', async ({ messageId, text }) => {
    try {
      if (!messageId || typeof text !== 'string' || !text.trim()) return;
      const message = await Message.findOneAndUpdate(
        { _id: messageId, sender: username },
        { text: text.trim() },
        { new: true, runValidators: true }
      );
      if (message) io.to(message.conversationId).emit('message updated', message);
    } catch (err) {
      console.error('Error editing message:', err);
    }
  });

  socket.on('delete message', async ({ messageId }) => {
    try {
      const message = await Message.findOne({ _id: messageId, sender: username });
      if (!message) return;
      await message.deleteOne();
      io.to(message.conversationId).emit('message deleted', { messageId: message._id.toString() });
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  });

  socket.on('delete message for me', async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;
      const conversation = await Conversation.findById(message.conversationId);
      if (!conversation?.members.includes(username)) return;
      await Message.updateOne({ _id: messageId }, { $addToSet: { deletedFor: username } });
      socket.emit('message deleted for me', { messageId: message._id.toString() });
    } catch (err) {
      console.error('Error deleting message for one user:', err);
    }
  });

  socket.on('remove message image', async ({ messageId }) => {
    try {
      const message = await Message.findOne({ _id: messageId, sender: username });
      if (!message?.imageUrl) return;
      if (!message.text) {
        await message.deleteOne();
        io.to(message.conversationId).emit('message deleted', { messageId: message._id.toString() });
        return;
      }
      message.imageUrl = '';
      message.type = 'text';
      await message.save();
      io.to(message.conversationId).emit('message updated', message);
    } catch (err) {
      console.error('Error removing message image:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', username);

    const count = onlineUsers.get(username) || 0;
    if (count <= 1) {
      onlineUsers.delete(username);
    } else {
      onlineUsers.set(username, count - 1);
    }
    broadcastOnlineUsers();
  });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
