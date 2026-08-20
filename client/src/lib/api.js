const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Single fetch wrapper for the whole app.
 * `credentials: 'include'` is what carries the admin session cookie; it is
 * harmless on public routes, which set no cookies at all.
 */
export async function request(path, { method = 'GET', body, signal, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: {
        ...(body instanceof FormData ? {} : body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'We could not reach the farm. Check your connection.');
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') ?? '';

  /**
   * A 200 of HTML from an API path means the request never reached the API.
   *
   * When VITE_API_BASE_URL is unset the base is '', so every call goes to the
   * site's own origin, where the SPA catch-all rewrite answers /api/* with
   * index.html. Without this the failure surfaced as a JSON parse error deep in
   * a component, which says nothing about the actual cause — a build that was
   * never told where the API lives. Vite bakes that variable in at BUILD time,
   * so setting it afterwards changes nothing until the site is rebuilt.
   */
  if (response.ok && contentType.includes('text/html')) {
    throw new ApiError(
      0,
      'API_BASE_NOT_CONFIGURED',
      'This site is not pointed at its API. Set VITE_API_BASE_URL in the hosting ' +
        'dashboard and redeploy — Vite reads it when the site is built, not when it runs.'
    );
  }

  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text();

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(
      response.status,
      error.code ?? 'ERROR',
      error.message ?? 'Something went wrong. Please try again.',
      error.details
    );
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

// --- Public endpoints -------------------------------------------------------

export const getProperties = () => api.get('/api/properties');
export const getProperty = (slug) => api.get(`/api/properties/${slug}`);
export const getAvailability = (id, from, to) =>
  api.get(`/api/properties/${id}/availability?from=${from}&to=${to}`);

export const getQuote = (payload) => api.post('/api/bookings/quote', payload);
export const createBooking = (payload) => api.post('/api/bookings', payload);
export const getBookingBySession = (sessionId) => api.get(`/api/bookings/session/${sessionId}`);
export const getManagedBooking = (token) => api.get(`/api/bookings/manage/${token}`);
export const cancelManagedBooking = (token, reason) =>
  api.post(`/api/bookings/manage/${token}/cancel`, { reason });
export const acceptAgreement = (token, signatureName, agreementVersion) =>
  api.post(`/api/bookings/manage/${token}/agreement`, { signatureName, agreementVersion });
export const payBalance = (token) => api.post(`/api/bookings/manage/${token}/pay`, {});

export const getContentPage = (slug) => api.get(`/api/content/pages/${slug}`);
export const getAnimals = () => api.get('/api/content/animals');
export const getAnimal = (slug) => api.get(`/api/content/animals/${slug}`);
export const getExperiences = () => api.get('/api/content/experiences');
export const getGallery = (collection = 'gallery') =>
  api.get(`/api/content/media?collection=${collection}`);

// --- Admin endpoints --------------------------------------------------------

export const adminLogin = (email, password) => api.post('/api/admin/login', { email, password });
export const adminLogout = () => api.post('/api/admin/logout');
export const adminMe = () => api.get('/api/admin/me');
export const adminChangePassword = (currentPassword, newPassword) =>
  api.post('/api/admin/change-password', { currentPassword, newPassword });

export const adminDashboard = () => api.get('/api/admin/dashboard');
/** Sends a test message to the signed-in admin's own address. */
export const adminSendTestEmail = () => api.post('/api/admin/test-email');

export const adminProperties = () => api.get('/api/admin/properties');

export const adminDiscounts = () => api.get('/api/admin/discounts');
export const adminCreateDiscount = (body) => api.post('/api/admin/discounts', body);
export const adminUpdateDiscount = (id, body) => api.patch(`/api/admin/discounts/${id}`, body);
export const adminDeleteDiscount = (id) => api.del(`/api/admin/discounts/${id}`);
export const adminProperty = (id) => api.get(`/api/admin/properties/${id}`);
export const adminUpdateProperty = (id, updates) =>
  api.patch(`/api/admin/properties/${id}`, updates);
export const adminSyncIcal = (id) => api.post(`/api/admin/properties/${id}/sync-ical`, {});

export const adminBookings = (query = '') => api.get(`/api/admin/bookings${query}`);
export const adminBooking = (id) => api.get(`/api/admin/bookings/${id}`);
export const adminUpdateBooking = (id, updates) => api.patch(`/api/admin/bookings/${id}`, updates);
export const adminCancelBooking = (id, payload) =>
  api.post(`/api/admin/bookings/${id}/cancel`, payload);
export const adminResendConfirmation = (id) =>
  api.post(`/api/admin/bookings/${id}/resend-confirmation`, {});

export const adminBlockedDates = (query = '') => api.get(`/api/admin/blocked-dates${query}`);
export const adminCreateBlock = (payload) => api.post('/api/admin/blocked-dates', payload);
export const adminDeleteBlock = (id) => api.del(`/api/admin/blocked-dates/${id}`);

export const adminAnimals = () => api.get('/api/admin/animals');
export const adminCreateAnimal = (payload) => api.post('/api/admin/animals', payload);
export const adminUpdateAnimal = (id, payload) => api.patch(`/api/admin/animals/${id}`, payload);
export const adminDeleteAnimal = (id) => api.del(`/api/admin/animals/${id}`);

export const adminContentPages = () => api.get('/api/admin/content/pages');
export const adminContentPage = (slug) => api.get(`/api/admin/content/pages/${slug}`);
export const adminSaveContentPage = (slug, payload) =>
  api.put(`/api/admin/content/pages/${slug}`, payload);

export const adminMedia = (query = '') => api.get(`/api/admin/media${query}`);
export const adminUpdateMedia = (id, payload) => api.patch(`/api/admin/media/${id}`, payload);
export const adminDeleteMedia = (id) => api.del(`/api/admin/media/${id}`);
export const adminReorderMedia = (order) => api.post('/api/admin/media/reorder', { order });
export const adminUploadMedia = (formData) =>
  request('/api/admin/media', { method: 'POST', body: formData });
