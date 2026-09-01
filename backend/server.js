const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Message = require('./models/Message');
const User = require('./models/User');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const verifyToken = require('./middleware/verifyToken');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.get('/messages/:conversationId', verifyToken, async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId })
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
    socket.join(conversationId);

    try {
      const result = await Message.updateMany(
        { conversationId, sender: { $ne: username }, seen: false },
        { $set: { seen: true } }
      );
      console.log(`Marked ${result.modifiedCount} messages as seen in ${conversationId} by ${username}`);
      io.to(conversationId).emit('messages seen', { conversationId, seenBy: username });
    } catch (err) {
      console.error('Error marking messages seen:', err);
    }
  });

  socket.on('chat message', async (data) => {
    try {
      const newMessage = new Message({
        text: data.text,
        sender: username,
        conversationId: data.conversationId,
      });
      await newMessage.save();

      io.to(data.conversationId).emit('chat message', newMessage);

      if (data.recipient) {
        // Auto-add the sender to the recipient's contacts, so this chat
        // shows up in their sidebar even if they never manually added the sender
        await User.updateOne(
          { username: data.recipient, contacts: { $ne: username } },
          { $addToSet: { contacts: username } }
        );

        io.to(data.recipient).emit('new message notification', {
          conversationId: data.conversationId,
          sender: username,
        });
      }
    } catch (err) {
      console.error('Error saving message:', err);
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