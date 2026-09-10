import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import Toast from './Toast';

const API_URL = import.meta.env.VITE_API_URL;

function UserList({ onSelectConversation, activeConversationId, onlineUsers, socket, username, onConversationRemoved, refreshTrigger }) {
  const [conversations, setConversations] = useState([]);
  const [newContactName, setNewContactName] = useState('');
  const [addError, setAddError] = useState('');
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [memberTags, setMemberTags] = useState([]);
  const [groupError, setGroupError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const fetchConversations = () => {
    fetch(`${API_URL}/api/conversations`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      cache: 'no-store',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch conversations');
        return res.json();
      })
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error('Error fetching conversations:', err);
        setConversations([]);
      });
  };

  useEffect(() => {
    fetchConversations();
  }, [refreshTrigger]);

  useEffect(() => {
    if (!socket) return;

    const handler = ({ conversationId }) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conversationId);
        if (!exists) {
          fetchConversations();
          return prev;
        }
        return prev.map((c) => (c._id === conversationId ? { ...c, hasUnread: true } : c));
      });
    };

    socket.on('new message notification', handler);
    return () => socket.off('new message notification', handler);
  }, [socket]);

  const handleSelect = (conv) => {
    setConversations((prev) =>
      prev.map((c) => (c._id === conv._id ? { ...c, hasUnread: false } : c))
    );
    onSelectConversation(conv);
  };

  const handleAddDm = async (e) => {
    e.preventDefault();
    setAddError('');

    if (newContactName.trim() === '') return;

    try {
      const res = await fetch(`${API_URL}/api/conversations/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ username: newContactName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAddError(data.error || 'Could not start chat');
        return;
      }

      setNewContactName('');
      fetchConversations();
    } catch (err) {
      setAddError('Something went wrong');
    }
  };

  const handleAddMemberTag = (e) => {
    e.preventDefault();
    const name = memberInput.trim();
    if (name === '') return;

    if (name === username) {
      setGroupError("You're added automatically — no need to add yourself");
      setMemberInput('');
      return;
    }

    if (memberTags.includes(name)) {
      setMemberInput('');
      return;
    }

    setGroupError('');
    setMemberTags((prev) => [...prev, name]);
    setMemberInput('');
  };

  const handleRemoveMemberTag = (name) => {
    setMemberTags((prev) => prev.filter((m) => m !== name));
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setGroupError('');

    if (groupName.trim() === '') {
      setGroupError('Group name is required');
      return;
    }

    if (memberTags.length < 2) {
      setGroupError('Add at least 2 other members');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/conversations/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name: groupName.trim(), members: memberTags }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGroupError(data.error || 'Could not create group');
        return;
      }

      setGroupName('');
      setMemberTags([]);
      setMemberInput('');
      setShowGroupForm(false);
      fetchConversations();
    } catch (err) {
      setGroupError('Something went wrong');
    }
  };

  const handleDeleteConversation = async (e, conv) => {
    e.stopPropagation();

    const confirmMsg = conv.isGroup ? `Leave "${conv.name}"?` : `Delete chat with ${conv.name}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (conv.isGroup) {
        await fetch(`${API_URL}/api/conversations/${conv._id}/leave`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setToastMessage('Left group');
      } else {
        await fetch(`${API_URL}/api/conversations/${conv._id}/hide`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setToastMessage('Chat deleted');
      }

      setConversations((prev) => prev.filter((c) => c._id !== conv._id));
      onConversationRemoved(conv._id);
    } catch (err) {
      console.error('Error removing conversation:', err);
    }
  };

  return (
    <div className="user-list">
      <div className="user-list-header">
        <h3>Chats</h3>
        <button className="new-group-btn" onClick={() => setShowGroupForm((prev) => !prev)}>
          {showGroupForm ? 'Cancel' : '+ Group'}
        </button>
      </div>

      <form className="add-contact-form" onSubmit={handleAddDm}>
        <input
          type="text"
          placeholder="Add by username..."
          value={newContactName}
          onChange={(e) => setNewContactName(e.target.value)}
        />
        <button type="submit">+</button>
      </form>
      {addError && <p className="add-contact-error">{addError}</p>}

      {showGroupForm && (
        <form className="group-form" onSubmit={handleCreateGroup}>
          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />

          <p className="group-form-hint">You're added automatically — add the other members below.</p>

          <div className="member-tag-input-row">
            <input
              type="text"
              placeholder="Type a username, press Enter"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddMemberTag(e);
                }
              }}
            />
            <button type="button" onClick={handleAddMemberTag}>Add</button>
          </div>

          {memberTags.length > 0 && (
            <div className="member-tags">
              {memberTags.map((m) => (
                <span key={m} className="member-tag">
                  {m}
                  <button type="button" onClick={() => handleRemoveMemberTag(m)}>✕</button>
                </span>
              ))}
            </div>
          )}

          {groupError && <p className="add-contact-error">{groupError}</p>}
          <button type="submit" className="group-create-btn">
            Create group ({memberTags.length + 1} members)
          </button>
        </form>
      )}

      {conversations.length === 0 && (
        <p className="empty-state">No chats yet — add someone by their username above, or start a group.</p>
      )}

      {conversations.map((conv) => (
        <div
          key={conv._id}
          className={`user-list-item ${activeConversationId === conv._id ? 'active' : ''}`}
          onClick={() => handleSelect(conv)}
        >
          <div className="user-info-row">
            <Avatar name={conv.name} src={conv.profilePicture} />
            <div className="user-info">
              <span className="user-name">{conv.name}</span>
              <span className={`online-label ${!conv.isGroup && onlineUsers.has(conv.name) ? 'online' : ''}`}>
                {conv.isGroup
                  ? `${conv.members.length} members`
                  : (onlineUsers.has(conv.name) ? 'Online' : 'Offline')}
              </span>
            </div>
          </div>
          <div className="user-list-item-actions">
            {conv.hasUnread && <span className="unread-dot"></span>}
            <button
              className="delete-conv-btn"
              onClick={(e) => handleDeleteConversation(e, conv)}
              aria-label={conv.isGroup ? 'Leave group' : 'Delete chat'}
              title={conv.isGroup ? 'Leave group' : 'Delete chat'}
            >
              🗑
            </button>
          </div>
        </div>
      ))}

      <Toast message={toastMessage} onDismiss={() => setToastMessage('')} />
    </div>
  );
}

export default UserList;