/** Small date/time helpers for chat, activity and notifications. */

export const timeAgo = (isoString) => {
  if (!isoString) return '';
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const formatTime = (isoString) => {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export const formatDayLabel = (isoString) => {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const isActiveRecently = (lastActiveAt) => {
  if (!lastActiveAt) return false;
  const then = new Date(lastActiveAt).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < 5 * 60 * 1000;
};

export const isActiveToday = (lastActiveAt) => {
  if (!lastActiveAt) return false;
  const then = new Date(lastActiveAt);
  if (Number.isNaN(then.getTime())) return false;
  return new Date().toDateString() === then.toDateString();
};

export const isSameDay = (a, b) =>
  new Date(a).toDateString() === new Date(b).toDateString();
