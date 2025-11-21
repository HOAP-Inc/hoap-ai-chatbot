// api/log.js
// 定型回答など、OpenAI を使わない会話のログ記録用

const { logConversation } = require('./sheets')

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const { session_id, turn, user_message, bot_reply, referrer, landing_page, origin, device } = req.body || {}

  // ログ記録
  try {
    await logConversation({
      timestamp: new Date().toISOString(),
      session_id,
      turn,
      user_message,
      bot_reply,
      referrer,
      landing_page,
      origin,
      device,
    })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.warn('[log] failed:', e.message)
    return res.status(200).json({ ok: false, error: e.message })
  }
}
