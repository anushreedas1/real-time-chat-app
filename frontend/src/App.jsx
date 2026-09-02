import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import UserList from './components/UserList';
import Avatar from './components/Avatar';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

function getConversationId(userA, userB) {
  return [userA, userB].sort().join('_');
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function App() {
  const [username, setUsername] = useState(localStorage.getItem('username') || null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [activeChatUserPic, setActiveChatUserPic] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [myProfilePicture, setMyProfilePicture] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    if (!username) return;

    const newSocket = io(API_URL, {
      auth: { token: localStorage.getItem('token') },
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, [username]);

  useEffect(() => {
    if (!username) return;

    fetch(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => setMyProfilePicture(data.profilePicture || ''))
      .catch((err) => console.error('Error fetching own profile:', err));
  }, [username]);

  useEffect(() => {
    if (!socket) return;

    const handler = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    socket.on('chat message', handler);
    return () => socket.off('chat message', handler);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const onlineHandler = (usersList) => {
      setOnlineUsers(new Set(usersList));
    };

    socket.on('online users', onlineHandler);
    return () => socket.off('online users', onlineHandler);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const seenHandler = ({ conversationId }) => {
      const activeId = activeChatUser ? getConversationId(username, activeChatUser) : null;
      if (conversationId === activeId) {
        setMessages((prev) => prev.map((m) => (m.sender === username ? { ...m, seen: true } : m)));
      }
    };

    socket.on('messages seen', seenHandler);
    return () => socket.off('messages seen', seenHandler);
  }, [socket, activeChatUser, username]);

  const handleSelectUser = (otherUser, otherUserPic) => {
    setActiveChatUser(otherUser);
    setActiveChatUserPic(otherUserPic || '');
    setMessages([]);

    const conversationId = getConversationId(username, otherUser);

    if (socket) {
      socket.emit('join conversation', conversationId);
    }

    fetch(`${API_URL}/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error('Error fetching history:', err));
  };

  const sendMessage = () => {
    if (input.trim() === '' || !activeChatUser || !socket) return;

    const conversationId = getConversationId(username, activeChatUser);
    socket.emit('chat message', {
      text: input,
      conversationId,
      recipient: activeChatUser,
    });
    setInput('');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUsername(null);
    setSocket(null);
    setActiveChatUser(null);
  };

  const handleUploadClick = () => {
    setShowProfileMenu(false);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );
      const uploadData = await uploadRes.json();

      if (!uploadData.secure_url) {
        throw new Error('Upload failed');
      }

      await fetch(`${API_URL}/api/users/me/profile-picture`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ profilePicture: uploadData.secure_url }),
      });

      setMyProfilePicture(uploadData.secure_url);
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      alert('Could not upload image. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePicture = async () => {
    setShowProfileMenu(false);

    try {
      await fetch(`${API_URL}/api/users/me/profile-picture`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setMyProfilePicture('');
    } catch (err) {
      console.error('Error removing profile picture:', err);
    }
  };

  if (!username) {
    return <Auth onLogin={(name) => setUsername(name)} />;
  }

  return (
    <div className="app-layout">
      <UserList
        onSelectUser={handleSelectUser}
        activeChatUser={activeChatUser}
        onlineUsers={onlineUsers}
        socket={socket}
      />

      <div className="app-shell">
        <div className="chat-header">
          <div className="chat-header-left">
            {activeChatUser && (
              <Avatar name={activeChatUser} src={activeChatUserPic} />
            )}
            <div>
              <h1>{activeChatUser || 'Chatter'}</h1>
              <p className={`status-line ${!isConnected ? 'offline' : ''}`}>
                {activeChatUser
                  ? (onlineUsers.has(activeChatUser) ? '● Online' : '○ Offline')
                  : (isConnected ? '● Connected' : '● Disconnected')}
              </p>
            </div>
          </div>
          <div className="user-block">
            <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle dark mode">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />

            <div className="profile-menu-anchor">
              <Avatar
                name={username}
                src={myProfilePicture}
                self
                editable
                onEditClick={() => setShowProfileMenu((prev) => !prev)}
              />

              {showProfileMenu && (
                <div className="profile-menu">
                  {myProfilePicture ? (
                    <>
                      <button onClick={handleUploadClick}>Change photo</button>
                      <button className="danger" onClick={handleRemovePicture}>Remove photo</button>
                    </>
                  ) : (
                    <button onClick={handleUploadClick}>Upload photo</button>
                  )}
                </div>
              )}
            </div>

            <span className="current-username">{uploading ? 'Uploading...' : username}</span>
            <button className="logout-btn" onClick={handleLogout}>Log out</button>
          </div>
        </div>

        {!activeChatUser ? (
          <div className="no-chat-selected">Select a conversation to start chatting</div>
        ) : (
          <>
            <div className="messages-area">
              {messages.map((msg) => (
                <div key={msg._id} className={`bubble-row ${msg.sender === username ? 'mine' : 'theirs'}`}>
                  {msg.sender !== username && <span className="sender-label">{msg.sender}</span>}
                  <div className="bubble">{msg.text}</div>
                  <span className="msg-time">
                    {formatTime(msg.createdAt)}
                    {msg.sender === username && (
                      <span className={`seen-mark ${msg.seen ? 'seen' : ''}`}>
                        {msg.seen ? ' ✓✓ Seen' : ' ✓ Sent'}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="input-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
              />
              <button className="send-btn" onClick={sendMessage}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;