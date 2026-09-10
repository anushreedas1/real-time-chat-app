import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import Toast from './Toast';

const API_URL = import.meta.env.VITE_API_URL;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

function GroupInfoModal({ conversationId, currentUsername, onClose, onUpdated, onLeftGroup }) {
  const [info, setInfo] = useState(null);
  const [aboutDraft, setAboutDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/api/conversations/${conversationId}/info`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        setInfo(data);
        setAboutDraft(data.about || '');
      })
      .catch((err) => console.error('Error fetching group info:', err));
  }, [conversationId]);

  const patchConversation = async (body) => {
    const res = await fetch(`${API_URL}/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setInfo(data);
    onUpdated(data);
    return data;
  };

  const handleSaveAbout = async () => {
    await patchConversation({ about: aboutDraft });
    setToastMessage('About updated');
  };

  const handleUploadClick = () => {
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

      if (!uploadData.secure_url) throw new Error('Upload failed');

      await patchConversation({ groupPicture: uploadData.secure_url });
      setToastMessage('Group photo updated');
    } catch (err) {
      console.error('Error uploading group picture:', err);
      alert('Could not upload image. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePicture = async () => {
    await patchConversation({ groupPicture: '' });
    setToastMessage('Group photo removed');
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm(`Leave "${info.name}"?`)) return;

    try {
      await fetch(`${API_URL}/api/conversations/${conversationId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      onLeftGroup(conversationId);
    } catch (err) {
      console.error('Error leaving group:', err);
    }
  };

  if (!info) return null;

  const aboutButtonLabel = info.about ? 'Update' : 'Save';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="group-info-header">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />
          <Avatar
            name={info.name}
            src={info.groupPicture}
            size="large"
            editable
            onEditClick={handleUploadClick}
          />
          {info.groupPicture && (
            <button className="remove-group-pic-btn" onClick={handleRemovePicture}>
              Remove photo
            </button>
          )}
          <h2>{info.name}</h2>
          {uploading && <p className="uploading-text">Uploading...</p>}
        </div>

        <div className="group-info-section">
          <label>About</label>
          <textarea
            value={aboutDraft}
            onChange={(e) => setAboutDraft(e.target.value)}
            placeholder="Add a group description..."
            rows={3}
          />
          <button className="save-about-btn" onClick={handleSaveAbout}>
            {aboutButtonLabel}
          </button>
        </div>

        <div className="group-info-section">
          <label>Members ({info.members.length})</label>
          <div className="group-members-list">
            {info.members.map((m) => (
              <div key={m} className="group-member-row">
                <Avatar name={m} size="small" />
                <span>{m}{m === currentUsername ? ' (You)' : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="leave-group-btn" onClick={handleLeaveGroup}>Leave group</button>
      </div>

      <Toast message={toastMessage} onDismiss={() => setToastMessage('')} />
    </div>
  );
}

export default GroupInfoModal;