import React from 'react';

const icons = {
  sparkle: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.5 4.3L18 7.2l-3.6 2.8L15 16l-3-2-3 2 .6-5.9L6 7.2l4.5-.9L12 2z" />
    </svg>
  ),
  flame: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c-1.8 2.7-3 4.8-3 7.2 0 3.2 2.4 5.1 3 5.6.6-.5 3-2.4 3-5.6 0-2.4-1.2-4.6-3-7.2zM12 21c-3.3 0-6-2.7-6-6 0-2.5 1.5-4.8 3-6.2-.1 2.5 1.6 4.4 3 5.8 1.4-1.4 3.1-3.3 3-5.8 1.6 1.4 3 3.7 3 6.2 0 3.3-2.7 6-6 6z" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 17.3l6.2 3.7-1.6-6.8 5.4-4.6-6.9-.6L12 2 9 9 2 9.6l5.4 4.6-1.6 6.8z" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm2 0v14h12V5H6zm2 3l3 4 2-2.5 3 3.5v1H8V8z" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
    </svg>
  ),
  save: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm12 1.5L18.5 9H16V5.5zM12 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c-.8 0-1.5.5-1.8 1.2L13.8 6H10L7 9l5 5-2 5 3-1 5-5 3-3.5V4.5c0-.8-.7-1.5-1.5-1.5z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 7h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-4h6v2H9V3zm2 4h2v9h-2V7z" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 17.3V21h3.7l10.2-10.2-3.7-3.7L3 17.3zm17.7-10.8c.4-.4.4-1 0-1.4l-2.8-2.8a1 1 0 0 0-1.4 0l-2.1 2.1 4.2 4.2 2.1-2.1z" />
    </svg>
  ),
  plane: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2.5 19.5l19-7.5-19-7.5v5l12 2-12 2v6.5z" />
    </svg>
  ),
  flagGb: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 5h16v14H4V5zm2 2v10l5-5 5 5V7H6z" />
    </svg>
  ),
  pizza: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C7 2 2.7 4.8 1 9.4l10.5 13.7L22.9 9.4C21.3 4.8 17 2 12 2zm1.8 11.7c-.5.5-1.2.5-1.7 0-.5-.5-.5-1.2 0-1.7.5-.5 1.2-.5 1.7 0 .5.5.5 1.2 0 1.7zm-4.5-2.4c-.5.5-1.2.5-1.7 0-.5-.5-.5-1.2 0-1.7.5-.5 1.2-.5 1.7 0 .5.5.5 1.2 0 1.7zm5.5 3.9c-.5.5-1.2.5-1.7 0-.5-.5-.5-1.2 0-1.7.5-.5 1.2-.5 1.7 0 .5.5.5 1.2 0 1.7z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 6L9 17l-5-5 1.5-1.5L9 14l9.5-9.5L20 6z" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L12 13.4 5.7 19.7 4.3 18.3 10.6 12 4.3 5.7 5.7 4.3 12 10.6l6.3-6.3 1.4 1.4z" />
    </svg>
  )
};

export function Icon({ name, className = '' }) {
  const icon = icons[name];
  if (!icon) return null;
  return (
    <span className={[`icon icon-${name}`, className].filter(Boolean).join(' ')} aria-hidden="true">
      {icon}
    </span>
  );
}
