function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

function Avatar({ name, src, size = 'normal', self = false, editable = false, onEditClick }) {
  const sizeClass = size === 'large' ? 'avatar-circle-large' : (self ? 'avatar-circle-self' : '');

  return (
    <div className="avatar-wrapper">
      <div className={`avatar-circle ${sizeClass}`}>
        {src ? (
          <img
            src={src}
            alt={name}
            className="avatar-img"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
          />
        ) : (
          getInitial(name)
        )}
      </div>
      {editable && (
        <button
          type="button"
          className={`avatar-edit-badge ${src ? 'has-pic' : 'no-pic'}`}
          onClick={onEditClick}
          aria-label="Edit profile picture"
        >
          {src ? '✎' : '+'}
        </button>
      )}
    </div>
  );
}

export default Avatar;