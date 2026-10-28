

export function getStoredSession() {
  const token = localStorage.getItem('northline-token');
  const storedUser = localStorage.getItem('northline-user');
  if (!token || !storedUser) return null;
  try {
    return { token, user: JSON.parse(storedUser) };
  } catch (error) {
    console.error('Could not restore the saved account session:', error);
    localStorage.removeItem('northline-token');
    localStorage.removeItem('northline-user');
    return null;
  }
}
