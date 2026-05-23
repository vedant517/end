/**
 * User-scoped browser storage helpers.
 * Prevents cart/wishlist/notification data leaking between accounts on the same device.
 */

const GLOBAL_KEYS = ['userId', 'customerLoggedIn'];
const SCOPED_PREFIXES = ['cart_', 'wishlist_', 'notification_'];

export const getStoredUserId = () => {
  const id = localStorage.getItem('userId');
  return id ? String(id) : null;
};



export const userScopedKey = (base, userId = getStoredUserId()) =>
  userId ? `${base}_${userId}` : base;

export const setStoredUserSession = ({ userId }) => {
  if (userId) {
    localStorage.setItem('userId', String(userId));
    localStorage.setItem('customerLoggedIn', 'true');
  }
};

/** Remove all customer session keys (including prior users' scoped cart/wishlist keys). */
export const clearUserSessionStorage = () => {
  GLOBAL_KEYS.forEach((key) => localStorage.removeItem(key));

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  sessionStorage.removeItem('cart');
  sessionStorage.removeItem('wishlist');
  sessionStorage.removeItem('notifications');
};

export const readScopedJson = (base, fallback = null) => {
  const userId = getStoredUserId();
  if (!userId) return fallback;
  try {
    const raw = localStorage.getItem(userScopedKey(base, userId));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const writeScopedJson = (base, value) => {
  const userId = getStoredUserId();
  if (!userId) return;
  localStorage.setItem(userScopedKey(base, userId), JSON.stringify(value));
};
