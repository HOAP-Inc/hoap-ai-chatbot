// Vercel Serverless Function (Node.js)
// ファイルパス: /api/ask.ts
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    // JSON以外を弾く（デバッグしやすくする）
    if (!req.headers['content-type']?.includes('application/json')) {
      return res.status(400).json({ error: 'invalid_content_type' })
    }

    const { message } = req.body || {}
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }

    // OpenAI Responses API をRESTで叩く
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: message,
        instructions: '医療・歯科・介護の採用・採用広報のプロとして、丁寧すぎず、敬語は使わず、でも相手に寄り添ったエージェントとして返答する。',
      }),
    })

    // OpenAI側のエラー内容を透過表示（初回デバッグ用）
    if (!r.ok) {
      const detail = await r.text()
      return res.status(502).json({ error: 'openai_error', detail })
    }

    const data = await r.json()

    // 念のため安全に抽出（output_text が無い場合に備えたフォールバック）
    const reply =
      data.output_text
      ?? (Array.isArray(data.output) && data.output[0]?.content?.[0]?.text)
      ?? (data?.content?.[0]?.text ?? '')
      ?? ''

    return res.status(200).json({ reply })
  } catch (e: any) {
    return res.status(500).json({ error: 'server_error', detail: e?.message || String(e) })
  }
}
