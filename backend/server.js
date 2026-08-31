const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Message = require('./models/Message');
const authRoutes = require('./routes/authRoutes');
const jwt = require('jsonwebtoken');
const verifyToken = require('./middleware/verifyToken');
const userRoutes = require('./routes/userRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/users', userRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Fetch chat history
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

app.use('/api/auth', authRoutes);

// Create HTTP server and wrap Express in it
const server = http.createServer(app);

// Attach Socket.IO to that server
const io = new Server(server, {
  cors: {
    origin: '*', // we'll lock this down later
  },
});

// Middleware: runs before every socket connection is accepted
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication error: no token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // attach user info to this socket for later use
    next();
  } catch (err) {
    next(new Error('Authentication error: invalid token'));
  }
});

// Listen for new client connections
io.on('connection', (socket) => {
  console.log('A user connected:', socket.user.username);

  // Client asks to join a specific conversation
  socket.on('join conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`${socket.user.username} joined conversation ${conversationId}`);
  });

  socket.on('chat message', async (data) => {
    try {
      const newMessage = new Message({
        text: data.text,
        sender: socket.user.username,
        conversationId: data.conversationId,
      });
      await newMessage.save();

      // Only send to people in this specific conversation room
      io.to(data.conversationId).emit('chat message', newMessage);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.user.username);
  });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('MongoDB connection error:', err));