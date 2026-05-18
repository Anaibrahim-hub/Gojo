/**
 * End-to-end upload test — runs outside the browser.
 * Uses Firebase anonymous auth REST API to get a real JWT, then POSTs a
 * minimal PNG to the worker and checks the R2 response.
 */

const FIREBASE_API_KEY = 'AIzaSyChXpnttLkOMX84phCYqzFINGaHULijLro'
const WORKER_URL       = 'https://gojo-upload.ana-ibrahim433.workers.dev'
const R2_PUBLIC_URL    = 'https://pub-b2ec9ffdcf0f4c288d36da6bf1acfa39.r2.dev'

// ── Step 1: sign in with test account ────────────────────────────────────────
console.log('1. Signing in with Firebase test account…')
const authRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'upload-test@gojo-test.dev',
      password: 'GojoTest2026!',
      returnSecureToken: true,
    }),
  }
)

if (!authRes.ok) {
  const err = await authRes.text()
  console.error('Firebase auth failed:', err)
  process.exit(1)
}

const { idToken, localId } = await authRes.json()
console.log(`   ✓ UID: ${localId}`)

// ── Step 2: build a minimal 1×1 red PNG (67 bytes) ──────────────────────────
const PNG_1x1_RED = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080200000090' +
  '77533800000000c4944415478016360f8cfc00000000200016c65672a0000' +
  '0000049454e44ae426082',
  'hex'
)
const testFile = new File([PNG_1x1_RED], 'test.png', { type: 'image/png' })

// ── Step 3: upload ────────────────────────────────────────────────────────────
console.log('2. Uploading 1×1 test PNG to worker…')
const form = new FormData()
form.append('file', testFile)

const uploadRes = await fetch(`${WORKER_URL}/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${idToken}` },
  body: form,
})

const uploadBody = await uploadRes.json()
console.log(`   HTTP ${uploadRes.status}:`, uploadBody)

if (!uploadRes.ok) {
  console.error('Upload failed.')
  process.exit(1)
}

const { key, url } = uploadBody

// ── Step 4: verify the file is publicly accessible in R2 ────────────────────
console.log('3. Fetching uploaded file from R2…')
const r2Res = await fetch(url)
console.log(`   HTTP ${r2Res.status} — Content-Type: ${r2Res.headers.get('content-type')}`)

if (!r2Res.ok) {
  console.error('Could not fetch from R2. Check public access is enabled.')
  process.exit(1)
}

// ── Step 5: delete (cleanup) ─────────────────────────────────────────────────
console.log('4. Deleting test file from R2…')
const delRes = await fetch(`${WORKER_URL}/image/${encodeURIComponent(key)}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${idToken}` },
})
const delBody = await delRes.json()
console.log(`   HTTP ${delRes.status}:`, delBody)

console.log('\n✅ All tests passed — Worker + R2 are wired up correctly.')
console.log(`   Worker: ${WORKER_URL}`)
console.log(`   R2:     ${R2_PUBLIC_URL}`)
