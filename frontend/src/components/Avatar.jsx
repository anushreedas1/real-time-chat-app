function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

function Avatar({ name, src, size = 'normal', self = false, editable = false, onEditClick }) {
  let sizeClass = '';
  if (size === 'large') sizeClass = 'avatar-circle-large';
  else if (size === 'small') sizeClass = 'avatar-circle-small';
  else if (self) sizeClass = 'avatar-circle-self';

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
          aria-label="Edit picture"
        >
          {src ? '✎' : '+'}
        </button>
      )}
    </div>
  );
}

export default Avatar;