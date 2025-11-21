// api/sheets.js
// Google Sheets API 連携モジュール

const crypto = require('crypto')

// JWT 生成（Google サービスアカウント認証用）
function createJWT(email, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const base64url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

  const unsignedToken = base64url(header) + '.' + base64url(payload)

  // PEM形式の秘密鍵で署名
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(unsignedToken)
  const signature = sign
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return unsignedToken + '.' + signature
}

// Access Token 取得
async function getAccessToken(email, privateKey) {
  const jwt = createJWT(email, privateKey)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Token fetch failed: ${res.status} ${detail}`)
  }

  const data = await res.json()
  return data.access_token
}

// スプレッドシートに行を追加
async function appendRow(sheetId, values, accessToken) {
  const range = 'Sheet1!A:I' // A〜I列（9カラム）
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [values],
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Sheets append failed: ${res.status} ${detail}`)
  }

  return await res.json()
}

// メイン：会話ログを記録
async function logConversation(logData) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const sheetId = process.env.GOOGLE_SHEET_ID

  // 環境変数が未設定の場合はスキップ（エラーにしない）
  if (!email || !privateKey || !sheetId) {
    console.warn('[sheets] Missing env vars, skipping log')
    return null
  }

  try {
    const accessToken = await getAccessToken(email, privateKey)

    // カラム順: timestamp, session_id, turn, user_message, bot_reply, referrer, landing_page, origin, device
    const row = [
      logData.timestamp || new Date().toISOString(),
      logData.session_id || '',
      logData.turn || 1,
      logData.user_message || '',
      logData.bot_reply || '',
      logData.referrer || '',
      logData.landing_page || '',
      logData.origin || '',
      logData.device || '',
    ]

    const result = await appendRow(sheetId, row, accessToken)
    return result
  } catch (e) {
    console.warn('[sheets] Log failed:', e.message)
    return null
  }
}

module.exports = { logConversation }
