export async function onRequest({ request }) {
  const url = new URL(request.url)
  const target = new URL(url.pathname + url.search, 'https://gojo-9e529.firebaseapp.com')
  return fetch(target.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  })
}
