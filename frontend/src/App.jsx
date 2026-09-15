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
  const members = conversation?.members || [];
  const seenBy = [...new Set(msg.seenBy || [])].filter((name) => name !== msg.sender && members.includes(name));
  const othersCount = Math.max(0, members.length - 1);

  if (othersCount <= 0 || seenBy.length === 0) {
    return { label: 'Sent', seen: false };
  }
  if (seenBy.length >= othersCount) {
    return { label: 'Seen', seen: true };
  }
  return { label: `Seen by ${seenBy.length} of ${othersCount}`, seen: false, partial: true };
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState('');
  const [previewProfile, setPreviewProfile] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [conversationsRefreshTrigger, setConversationsRefreshTrigger] = useState(0);
  const fileInputRef = useRef(null);
  const chatPhotoInputRef = useRef(null);
  const cameraPhotoInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const messagesEndRef = useRef(null);

  const emojis = ['😀', '😂', '🥰', '😍', '😎', '😭', '😡', '👍', '👎', '👏', '🙏', '🎉', '❤️', '🔥', '✨', '🤔', '✅', '💯'];

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

    const updateHandler = (updatedMessage) => {
      setMessages((prev) => prev.map((message) => (
        message._id === updatedMessage._id ? updatedMessage : message
      )));
    };
    const deleteHandler = ({ messageId }) => {
      setMessages((prev) => prev.filter((message) => message._id !== messageId));
      setEditingMessageId((current) => (current === messageId ? null : current));
    };
    const deleteForMeHandler = ({ messageId }) => {
      setMessages((prev) => prev.filter((message) => message._id !== messageId));
    };

    socket.on('message updated', updateHandler);
    socket.on('message deleted', deleteHandler);
    socket.on('message deleted for me', deleteForMeHandler);
    return () => {
      socket.off('message updated', updateHandler);
      socket.off('message deleted', deleteHandler);
      socket.off('message deleted for me', deleteForMeHandler);
    };
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

  useEffect(() => {
    if (activeConversation && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [activeConversation, messages]);

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

  const sendImage = (imageUrl) => {
    if (!imageUrl || !activeConversation || !socket) return;
    socket.emit('chat message', {
      text: '',
      imageUrl,
      conversationId: activeConversation._id,
    });
  };

  const uploadChatImage = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      alert('Photo sending is not configured yet. Add the Cloudinary environment variables to the frontend.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );
      const data = await response.json();
      if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
      sendImage(data.secure_url);
    } catch (err) {
      console.error('Error uploading chat image:', err);
      alert('Could not send the photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleChatPhotoSelected = async (event) => {
    await uploadChatImage(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleCameraPhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) showCapturedPhoto(file);
  };

  const clearCapturedPhoto = () => {
    if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
    setCapturedPhoto(null);
    setCapturedPhotoUrl('');
  };

  const showCapturedPhoto = (file) => {
    if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl);
    setCapturedPhoto(file);
    setCapturedPhotoUrl(URL.createObjectURL(file));
    setCameraError('');
    setShowCamera(true);
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    clearCapturedPhoto();
    setShowCamera(false);
  };

  const openCamera = async () => {
    setShowEmojiPicker(false);
    setCameraError('');
    clearCapturedPhoto();
    setShowCamera(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera preview is not supported by this browser');
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      cameraStreamRef.current = stream;
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 0);
    } catch (err) {
      console.error('Camera unavailable:', err);
      setCameraError('Live camera preview is unavailable. Use the device camera button below, or allow camera access and open this site over HTTPS.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (blob) {
        showCapturedPhoto(new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' }));
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    }, 'image/jpeg', 0.9);
  };

  const sendCapturedPhoto = async () => {
    if (!capturedPhoto) return;
    await uploadChatImage(capturedPhoto);
    stopCamera();
  };

  const startEditing = (message) => {
    setEditingMessageId(message._id);
    setEditingText(message.text);
  };

  const saveEdit = (messageId) => {
    const text = editingText.trim();
    if (!text || !socket) return;
    socket.emit('edit message', { messageId, text });
    setEditingMessageId(null);
  };

  const deleteMessage = (messageId) => socket?.emit('delete message', { messageId });

  const deleteMessageForMe = (messageId) => socket?.emit('delete message for me', { messageId });

  const removeImage = (message) => {
    if (!socket) return;
    if (!message.text) {
      deleteMessage(message._id);
      return;
    }
    socket.emit('remove message image', { messageId: message._id });
  };

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
              <Avatar
                name={activeConversation.name}
                src={activeConversation.profilePicture}
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewProfile({ name: activeConversation.name, src: activeConversation.profilePicture });
                }}
              />
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
                onClick={() => myProfilePicture && setPreviewProfile({ name: username, src: myProfilePicture })}
              />

              {showProfileMenu && (
                <div className="profile-menu">
                  {myProfilePicture ? (
                    <>
                      <button onClick={() => { setShowProfileMenu(false); setPreviewProfile({ name: username, src: myProfilePicture }); }}>Preview photo</button>
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
                const isEditing = editingMessageId === msg._id;
                const isMine = msg.sender === username;
                return (
                  <div key={msg._id} className={`bubble-row ${msg.sender === username ? 'mine' : 'theirs'}`}>
                    {msg.sender !== username && <span className="sender-label">{msg.sender}</span>}
                    {isEditing ? (
                      <div className="message-edit-form">
                        <input value={editingText} onChange={(event) => setEditingText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveEdit(msg._id)} autoFocus />
                        <button type="button" onClick={() => saveEdit(msg._id)}>Save</button>
                        <button type="button" onClick={() => setEditingMessageId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className={`bubble ${msg.imageUrl ? 'image-bubble' : ''}`}>
                        {msg.imageUrl && <img src={msg.imageUrl} alt="Shared in chat" className="chat-image" />}
                        {msg.text && <span>{msg.text}</span>}
                      </div>
                    )}
                    <span className="msg-time">
                      {formatTime(msg.createdAt)}
                      {msg.sender === username && (
                        <span className={`seen-mark ${seenInfo.seen ? 'seen' : ''}`}>
                          {' '}{seenInfo.seen ? '✓✓' : '✓'} {seenInfo.label}
                        </span>
                      )}
                    </span>
                    {!isEditing && (
                      <div className="message-menu-wrap">
                        <button className="message-menu-toggle" type="button" aria-label="Message actions" aria-expanded={openMessageMenuId === msg._id} onClick={() => setOpenMessageMenuId((current) => current === msg._id ? null : msg._id)}>⌄</button>
                        {openMessageMenuId === msg._id && (
                          <div className="message-actions">
                            {isMine && msg.text && <button type="button" onClick={() => { startEditing(msg); setOpenMessageMenuId(null); }}>Edit</button>}
                            {isMine && msg.imageUrl && <button type="button" onClick={() => { removeImage(msg); setOpenMessageMenuId(null); }}>{msg.text ? 'Remove photo' : 'Delete photo'}</button>}
                            {isMine && <button type="button" onClick={() => { deleteMessageForMe(msg._id); setOpenMessageMenuId(null); }}>Delete for me</button>}
                            {isMine && <button type="button" onClick={() => { deleteMessage(msg._id); setOpenMessageMenuId(null); }}>Delete for everyone</button>}
                            {!isMine && <button type="button" onClick={() => { deleteMessageForMe(msg._id); setOpenMessageMenuId(null); }}>Delete for me</button>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-row">
              <div className="composer-tools">
                <button className="composer-icon-btn" type="button" aria-label="Add emoji" onClick={() => setShowEmojiPicker((prev) => !prev)}>😊</button>
                {showEmojiPicker && (
                  <div className="emoji-picker" role="dialog" aria-label="Choose an emoji">
                    {emojis.map((emoji) => (
                      <button key={emoji} type="button" onClick={() => { setInput((prev) => `${prev}${emoji}`); setShowEmojiPicker(false); }}>{emoji}</button>
                    ))}
                  </div>
                )}
                <input ref={chatPhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChatPhotoSelected} />
                <input ref={cameraPhotoInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCameraPhotoSelected} />
                <button className="composer-icon-btn" type="button" aria-label="Choose photo from device" onClick={() => chatPhotoInputRef.current?.click()}>🖼️</button>
                <button className="composer-icon-btn" type="button" aria-label="Take a photo" onClick={openCamera}>📷</button>
              </div>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
              />
              <button className="send-btn" onClick={sendMessage} disabled={uploading}>{uploading ? 'Sending...' : 'Send'}</button>
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

      {showCamera && (
        <div className="modal-overlay" onClick={stopCamera}>
          <div className="camera-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={stopCamera} aria-label="Close camera">✕</button>
            <h2>Take a photo</h2>
            {capturedPhotoUrl ? (
              <img src={capturedPhotoUrl} className="camera-preview" alt="Photo ready to send" />
            ) : (cameraError ? <p className="camera-error">{cameraError}</p> : <video ref={videoRef} className="camera-preview" playsInline muted />)}
            <div className="camera-actions">
              {capturedPhoto ? (
                <>
                  <button className="camera-cancel-btn" onClick={openCamera} disabled={uploading}>Retake</button>
                  <button className="send-btn" onClick={sendCapturedPhoto} disabled={uploading}>{uploading ? 'Sending...' : 'Send photo'}</button>
                </>
              ) : cameraError ? (
                <button className="send-btn" onClick={() => cameraPhotoInputRef.current?.click()} disabled={uploading}>Use device camera</button>
              ) : (
                <button className="send-btn" onClick={capturePhoto} disabled={uploading}>Capture & send</button>
              )}
              <button className="camera-cancel-btn" onClick={stopCamera}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {previewProfile && (
        <div className="modal-overlay" onClick={() => setPreviewProfile(null)}>
          <div className="profile-preview-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setPreviewProfile(null)} aria-label="Close profile preview">✕</button>
            <h2>{previewProfile.name}</h2>
            {previewProfile.src ? (
              <img src={previewProfile.src} alt={`${previewProfile.name}'s profile`} className="profile-preview-image" />
            ) : (
              <div className="profile-preview-placeholder">{previewProfile.name.charAt(0).toUpperCase()}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
