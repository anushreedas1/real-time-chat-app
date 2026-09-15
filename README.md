# 💬 Chatter — Real-Time Chat Application

A full-stack, real-time chat app built with React, Node.js, Socket.IO, and MongoDB. Sign up, start a direct or group conversation, and share messages and photos that sync live and persist across sessions.

**🔗 Live app:** https://real-time-chat-app-mu-beryl.vercel.app/
**📦 Repo:** https://github.com/anushreedas1/real-time-chat-app

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [What I Learned](#what-i-learned)
- [Future Improvements](#future-improvements)

## Features

- 🔐 **Authentication** — signup/login with hashed passwords (bcrypt) and JWT sessions
- ⚡ **Real-time messaging** — instant delivery via Socket.IO, no page refresh needed
- 👥 **Direct and group chats** — start one-to-one chats or create groups with multiple members
- 💾 **Persistent history** — every message is stored in MongoDB and reloads automatically
- 🖼️ **Photo sharing** — upload an image from a device or capture one with the camera, preview it, then send
- 😊 **Emoji picker** — add common emojis directly from the composer
- ✏️ **Message controls** — edit sent text, delete messages for everyone, or remove any message from only your own view
- 👁️ **Read receipts** — live sent/seen status, including per-member progress in group chats
- 🧑 **Profile photos** — upload, remove, and preview your profile photo; preview a chat participant's photo from the header
- 📬 **Recency-based chat list** — incoming conversations move to the top automatically
- 🛡️ **Verified everywhere** — both REST endpoints and socket connections check a valid JWT before allowing any action; identity is never trusted from client input
- 🎨 **Custom UI** — a designed interface (Fraunces/Inter typography, a raspberry-and-blush palette) rather than default component styling

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB Atlas, Mongoose |
| Auth | JWT, bcryptjs |
| Hosting | Vercel (frontend), Render (backend) |

## Architecture

```
┌─────────────┐        REST + WebSocket         ┌─────────────┐
│   React     │ ──────────────────────────────► │   Express   │
│  (Vercel)   │ ◄────────────────────────────── │  (Render)   │
└─────────────┘                                  └──────┬──────┘
                                                         │
                                                         ▼
                                                  ┌─────────────┐
                                                  │  MongoDB    │
                                                  │  (Atlas)    │
                                                  └─────────────┘
```

**How conversations work:** each direct chat or group is stored as a MongoDB `Conversation` document. Its MongoDB ID is also used as the Socket.IO room name, so messages and read-receipt events are delivered only to the members of that conversation.

**How auth is enforced:** every REST request to a protected route, and every Socket.IO connection attempt, is checked against a JWT before anything else happens. The server never trusts a `sender` field the client sends — it always derives identity from the verified token.

## Project Structure

```
chat-app/
├── backend/
│   ├── models/          # User.js, Message.js, Conversation.js — Mongoose schemas
│   ├── routes/          # Authentication, user, and conversation REST routes
│   ├── middleware/       # verifyToken.js — JWT verification for REST routes
│   └── server.js         # Express + Socket.IO entry point, socket auth middleware
└── frontend/
    └── src/
        ├── components/    # Auth.jsx, UserList.jsx
        ├── App.jsx        # Main chat logic, socket handling, conversation state
        └── App.css        # Design system (colors, type, layout)
```

## Running Locally

### Prerequisites
- Node.js v18+
- A MongoDB Atlas account (free tier) or local MongoDB instance

### 1. Clone the repo
```bash
git clone https://github.com/anushreedas1/real-time-chat-app.git
cd real-time-chat-app
```

### 2. Backend
```bash
cd backend
npm install
```

Create `backend/.env`:
```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret_string
PORT=5000
```

```bash
npm run dev
```

### 3. Frontend
```bash
cd ../frontend
npm install
```

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:5000
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

```bash
npm run dev
```

Visit `http://localhost:5173` — you'll need two accounts (for example, a second browser or incognito window) to test messaging. Camera preview requires a browser camera permission and either `localhost` or HTTPS.

## Environment Variables

| File | Variable | Description |
|---|---|---|
| `backend/.env` | `MONGO_URI` | MongoDB Atlas connection string |
| `backend/.env` | `JWT_SECRET` | Secret used to sign and verify JWTs |
| `backend/.env` | `PORT` | Port for the Express server (defaults to 5000) |
| `frontend/.env` | `VITE_API_URL` | Base URL of the backend API/socket server |
| `frontend/.env` | `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name used for profile and chat image uploads |
| `frontend/.env` | `VITE_CLOUDINARY_UPLOAD_PRESET` | Unsigned Cloudinary upload preset used for image uploads |

## What I Learned

This was my first full-stack project, built end-to-end as a fresh graduate. A few things that stood out:

- **Real-time vs. request/response** — how Socket.IO's persistent connection differs from typical REST calls, and when each is the right tool
- **Never trust the client** — the backend must derive identity from a verified token, not from whatever a client claims about itself
- **Deployment gotchas are real** — a JWT signed locally won't verify against a different `JWT_SECRET` in production; a whitelist that blocks your own database host will silently break everything; `.gitignore` encoding issues can leak `node_modules` into a commit if you're not careful
- **Rooms as a modeling tool** — Socket.IO rooms provide a clean way to scope direct and group conversations while still allowing events such as live read receipts
- **Media needs a delivery service** — Cloudinary keeps image uploads out of the database while MongoDB stores the image URLs alongside message metadata

## Future Improvements

- [ ] Typing indicators
- [ ] Push notifications
- [ ] File sharing beyond images
- [ ] Message reactions

---

Built by [Anushree Das](https://github.com/anushreedas1)
