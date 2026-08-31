import { useEffect, useState } from 'react';

function UserList({ onSelectUser }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/users', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .catch((err) => console.error('Error fetching users:', err));
  }, []);

  return (
    <div className="user-list">
      <h3>Chats</h3>
      {users.length === 0 && <p className="empty-state">No other users yet — sign up a second account to test.</p>}
      {users.map((u) => (
        <div key={u._id} className="user-list-item" onClick={() => onSelectUser(u.username)}>
          {u.username}
        </div>
      ))}
    </div>
  );
}

export default UserList;