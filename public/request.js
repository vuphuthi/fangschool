export function sameOriginFetch(resource, options) {
  const method = options?.method?.toUpperCase() ?? 'GET';
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return fetch(resource, options);

  const headers = new Headers(options?.headers);
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  if (token) headers.set('X-CSRF-TOKEN', token);
  return fetch(resource, { ...options, headers });
}
