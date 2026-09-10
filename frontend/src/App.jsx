import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import UserList from './components/UserList';
import Avatar from './components/Avatar';
import GroupInfoModal from './components/GroupInfoModal';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getSeenInfo(msg, conversation) {
  const seenBy = msg.seenBy || [];
  const othersCount = conversation ? conversation.members.length - 1 : 0;

  if (othersCount <= 0 || seenBy.length === 0) {
    return { label: 'Sent', seen: false };
  }
  if (seenBy.length >= othersCount) {
    return { label: 'Seen', seen: true };
  }
  return { label: `Seen by ${seenBy.length}`, seen: true };
}

function App() {
  const [username, setUsername] = useState(localStorage.getItem('username') || null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [myProfilePicture, setMyProfilePicture] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [conversationsRefreshTrigger, setConversationsRefreshTrigger] = useState(0);
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

    const seenHandler = ({ conversationId, seenBy }) => {
      if (activeConversation && conversationId === activeConversation._id) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.sender === username && !(m.seenBy || []).includes(seenBy)) {
              return { ...m, seenBy: [...(m.seenBy || []), seenBy] };
            }
            return m;
          })
        );
      }
    };

    socket.on('messages seen', seenHandler);
    return () => socket.off('messages seen', seenHandler);
  }, [socket, activeConversation, username]);

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    setMessages([]);
    setShowGroupInfo(false);

    if (socket) {
      socket.emit('join conversation', conv._id);
    }

    fetch(`${API_URL}/messages/${conv._id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error('Error fetching history:', err));
  };

  const sendMessage = () => {
    if (input.trim() === '' || !activeConversation || !socket) return;

    socket.emit('chat message', {
      text: input,
      conversationId: activeConversation._id,
    });
    setInput('');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUsername(null);
    setSocket(null);
    setActiveConversation(null);
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

  const handleGroupUpdated = (updatedConv) => {
    setActiveConversation((prev) => ({
      ...prev,
      name: updatedConv.name,
      profilePicture: updatedConv.groupPicture,
      about: updatedConv.about,
      members: updatedConv.members,
    }));
  };

  const handleConversationRemoved = (conversationId) => {
    if (activeConversation && activeConversation._id === conversationId) {
      setActiveConversation(null);
      setMessages([]);
      setShowGroupInfo(false);
    }
  };

  const handleLeftGroup = (conversationId) => {
    setShowGroupInfo(false);
    handleConversationRemoved(conversationId);
    setConversationsRefreshTrigger((prev) => prev + 1);
  };

  if (!username) {
    return <Auth onLogin={(name) => setUsername(name)} />;
  }

  return (
    <div className="app-layout">
      <UserList
        onSelectConversation={handleSelectConversation}
        activeConversationId={activeConversation?._id}
        onlineUsers={onlineUsers}
        socket={socket}
        username={username}
        onConversationRemoved={handleConversationRemoved}
        refreshTrigger={conversationsRefreshTrigger}
      />

      <div className="app-shell">
        <div className="chat-header">
          <div
            className={`chat-header-left ${activeConversation?.isGroup ? 'clickable' : ''}`}
            onClick={() => activeConversation?.isGroup && setShowGroupInfo(true)}
          >
            {activeConversation && (
              <Avatar name={activeConversation.name} src={activeConversation.profilePicture} />
            )}
            <div>
              <h1>{activeConversation ? activeConversation.name : 'Chatter'}</h1>
              <p className={`status-line ${!isConnected ? 'offline' : ''}`}>
                {activeConversation
                  ? (activeConversation.isGroup
                      ? `${activeConversation.members.length} members`
                      : (onlineUsers.has(activeConversation.name) ? '● Online' : '○ Offline'))
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

        {!activeConversation ? (
          <div className="no-chat-selected">Select a conversation to start chatting</div>
        ) : (
          <>
            <div className="messages-area">
              {messages.map((msg) => {
                const seenInfo = getSeenInfo(msg, activeConversation);
                return (
                  <div key={msg._id} className={`bubble-row ${msg.sender === username ? 'mine' : 'theirs'}`}>
                    {msg.sender !== username && <span className="sender-label">{msg.sender}</span>}
                    <div className="bubble">{msg.text}</div>
                    <span className="msg-time">
                      {formatTime(msg.createdAt)}
                      {msg.sender === username && (
                        <span className={`seen-mark ${seenInfo.seen ? 'seen' : ''}`}>
                          {' '}{seenInfo.seen ? '✓✓' : '✓'} {seenInfo.label}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
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

      {showGroupInfo && activeConversation && (
        <GroupInfoModal
          conversationId={activeConversation._id}
          currentUsername={username}
          onClose={() => setShowGroupInfo(false)}
          onUpdated={handleGroupUpdated}
          onLeftGroup={handleLeftGroup}
        />
      )}
    </div>
  );
}

export default App;