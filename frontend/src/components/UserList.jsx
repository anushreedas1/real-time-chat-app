import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

function UserList({ onSelectUser, activeChatUser, unreadUsers, onlineUsers }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/users`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error('Error fetching users:', err);
        setUsers([]);
      });
  }, []);

  return (
    <div className="user-list">
      <h3>Chats</h3>
      {users.length === 0 && <p className="empty-state">No other users yet — sign up a second account to test.</p>}
      {users.map((u) => (
        <div
          key={u._id}
          className={`user-list-item ${activeChatUser === u.username ? 'active' : ''}`}
          onClick={() => onSelectUser(u.username)}
        >
          <div className="user-info">
            <span className="user-name">{u.username}</span>
            <span className={`online-label ${onlineUsers.has(u.username) ? 'online' : ''}`}>
              {onlineUsers.has(u.username) ? 'Online' : 'Offline'}
            </span>
          </div>
          {unreadUsers.has(u.username) && <span className="unread-dot"></span>}
        </div>
      ))}
    </div>
  );
}

export default UserList;