const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function reportError(error) {
  const message = error instanceof TypeError
    ? 'We can’t connect right now. Please check your internet connection and try again.'
    : error.message || 'Something went wrong. Please try again.';
  window.dispatchEvent(new CustomEvent('app-error', { detail: message }));
}

export async function parseApiResponse(response, fallbackMessage) {
  if (response.status === 204) return null;

  const responseText = await response.text();
  let body;
  try {
    body = JSON.parse(responseText);
  } catch {
    // Keep the technical detail in the console for developers, show a friendly message to users.
    console.error(`Unexpected non-JSON response (HTTP ${response.status}) from ${response.url || 'API'}`);
    const requestError = new Error('Our service is temporarily unavailable. Please try again in a moment.');
    requestError.status = response.status;
    reportError(requestError);
    throw requestError;
  }

  if (!response.ok) {
    const details = body && Array.isArray(body.details)
      ? body.details.map((detail) => detail.message).filter(Boolean).join('. ')
      : '';
    const requestError = new Error(
      body?.error === 'Invalid request' && details
        ? details
        : body?.error || fallbackMessage,
    );
    requestError.status = response.status;
    // Client errors (4xx) are shown inline next to the form that caused them; only surface server failures globally.
    if (response.status >= 500) reportError(requestError);
    throw requestError;
  }
  return body;
}
