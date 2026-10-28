import { Check } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function reportError(error) {
  const message = error instanceof TypeError
    ? 'Could not connect to the dealership server. Check your internet connection and make sure the API service is running.'
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
    const endpoint = response.url
      ? new URL(response.url).pathname
      : 'the API endpoint';
    const requestError = new Error(
      `The request to ${endpoint} returned HTTP ${response.status} with a non-JSON response. The request may be reaching a static frontend instead of the dealership API. Ensure /api and /healthz are routed to the Express server, or serve the frontend and API from the same app.`,
    );
    requestError.status = response.status;
    reportError(requestError);
    throw requestError;
  }

  if (!response.ok) {
    const details = body && Array.isArray(body.details)
      ? body.details.map((detail) => detail.message).filter(Boolean).join('. ')
      : '';
    const requestError = new Error(
      [body?.error || fallbackMessage, details && body?.error === 'Invalid request' ? details : '']
        .filter(Boolean)
        .join(': '),
    );
    requestError.status = response.status;
    reportError(requestError);
    throw requestError;
  }
  return body;
}
