export function getCsrfToken() {
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]+)'));
  return match ? match[2] : '';
}

export function getAuthHeaders() {
  return {
    'X-CSRF-Token': getCsrfToken()
  };
}
