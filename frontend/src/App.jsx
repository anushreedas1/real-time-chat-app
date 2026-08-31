import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import UserList from './components/UserList';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL;

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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [unreadUsers, setUnreadUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set());

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
    if (!socket) return;

    const handler = (msg) => {
      setMessages((prev) => [...prev, msg]);
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

  useEffect(() => {
    if (!socket) return;

    const notifHandler = ({ conversationId, sender }) => {
      const activeId = activeChatUser ? getConversationId(username, activeChatUser) : null;
      if (conversationId !== activeId) {
        setUnreadUsers((prev) => new Set(prev).add(sender));
      }
    };

    socket.on('new message notification', notifHandler);
    return () => socket.off('new message notification', notifHandler);
  }, [socket, activeChatUser, username]);

  const handleSelectUser = (otherUser) => {
    setActiveChatUser(otherUser);
    setMessages([]);

    setUnreadUsers((prev) => {
      const updated = new Set(prev);
      updated.delete(otherUser);
      return updated;
    });

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

  if (!username) {
    return <Auth onLogin={(name) => setUsername(name)} />;
  }

  return (
    <div className="app-layout">
      <UserList
        onSelectUser={handleSelectUser}
        activeChatUser={activeChatUser}
        unreadUsers={unreadUsers}
        onlineUsers={onlineUsers}
      />

      <div className="app-shell">
        <div className="chat-header">
          <div>
            <h1>{activeChatUser || 'Chatter'}</h1>
            <p className={`status-line ${!isConnected ? 'offline' : ''}`}>
              {activeChatUser
                ? (onlineUsers.has(activeChatUser) ? '● Online' : '○ Offline')
                : (isConnected ? '● Connected' : '● Disconnected')}
            </p>
          </div>
          <div className="user-block">
            <span>{username}</span>
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