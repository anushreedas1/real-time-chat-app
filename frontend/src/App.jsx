import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import UserList from './components/UserList';
import './App.css';

function getConversationId(userA, userB) {
  return [userA, userB].sort().join('_');
}

function App() {
  const [username, setUsername] = useState(localStorage.getItem('username') || null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // Create the socket connection once we know we're logged in
  useEffect(() => {
    if (!username) return;

    const newSocket = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, [username]);

  // Listen for incoming messages
  useEffect(() => {
    if (!socket) return;

    const handler = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat message', handler);
    return () => socket.off('chat message', handler);
  }, [socket]);

  // When a chat partner is selected, join that conversation room and load history
  const handleSelectUser = (otherUser) => {
    setActiveChatUser(otherUser);
    setMessages([]);

    const conversationId = getConversationId(username, otherUser);

    if (socket) {
      socket.emit('join conversation', conversationId);
    }

    fetch(`http://localhost:5000/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error('Error fetching history:', err));
  };

  const sendMessage = () => {
    if (input.trim() === '' || !activeChatUser || !socket) return;

    const conversationId = getConversationId(username, activeChatUser);
    socket.emit('chat message', { text: input, conversationId });
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
      <UserList onSelectUser={handleSelectUser} />

      <div className="app-shell">
        <div className="chat-header">
          <div>
            <h1>{activeChatUser || 'Chatter'}</h1>
            <p className={`status-line ${!isConnected ? 'offline' : ''}`}>
              {isConnected ? '● Connected' : '● Disconnected'}
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