import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

function UserList({ onSelectUser, activeChatUser, unreadUsers, onlineUsers, socket }) {
  const [contacts, setContacts] = useState([]);
  const [newContactName, setNewContactName] = useState('');
  const [addError, setAddError] = useState('');

  const fetchContacts = () => {
    fetch(`${API_URL}/api/users/contacts`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch contacts');
        return res.json();
      })
      .then((data) => setContacts(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error('Error fetching contacts:', err);
        setContacts([]);
      });
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Refresh the contact list whenever a new message notification comes in —
  // this makes a brand-new sender appear in the sidebar without a page refresh
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      fetchContacts();
    };

    socket.on('new message notification', handler);
    return () => socket.off('new message notification', handler);
  }, [socket]);

  const handleAddContact = async (e) => {
    e.preventDefault();
    setAddError('');

    if (newContactName.trim() === '') return;

    try {
      const res = await fetch(`${API_URL}/api/users/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ username: newContactName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAddError(data.error || 'Could not add contact');
        return;
      }

      setNewContactName('');
      fetchContacts();
    } catch (err) {
      setAddError('Something went wrong');
    }
  };

  return (
    <div className="user-list">
      <h3>Chats</h3>

      <form className="add-contact-form" onSubmit={handleAddContact}>
        <input
          type="text"
          placeholder="Add by username..."
          value={newContactName}
          onChange={(e) => setNewContactName(e.target.value)}
        />
        <button type="submit">+</button>
      </form>
      {addError && <p className="add-contact-error">{addError}</p>}

      {contacts.length === 0 && (
        <p className="empty-state">No contacts yet — add someone by their username above.</p>
      )}

      {contacts.map((u) => (
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