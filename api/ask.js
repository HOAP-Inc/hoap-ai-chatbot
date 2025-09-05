// api/ask.js

// Vercel を Node 実行に固定（Edge だと process が無い）
module.exports.config = { runtime: 'nodejs20.x' }

// 許可オリジン（必要に応じて追加）
const ALLOW_ORIGINS = new Set([
  'https://hoap-inc.jp',
  'https://www.hoap-inc.jp',
])

// CORS ヘルパ
function setCors(res, origin) {
  if (origin && ALLOW_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    // 許可外は明示的に閉じる（必要なら * にしてもよい）
    res.setHeader('Access-Control-Allow-Origin', 'https://hoap-inc.jp')
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin
  setCors(res, origin)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const ct = req.headers['content-type'] || ''
  if (!ct.includes('application/json')) {
    return res.status(400).json({ error: 'invalid_content_type' })
  }

  const { message } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' })
  }

  // 1) ローカル判定
  const verdict = localGuard(message)
  if (!verdict.ok) return res.status(200).json({ reply: verdict.reply })

  // 2) OpenAI モデレーション
  try {
    const mod = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + (process?.env?.OPENAI_API_KEY || ''),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: message }),
    })

    if (!mod.ok) {
      const detail = await mod.text()
      return res.status(502).json({ error: 'moderation_error', status: mod.status, detail })
    }

    const modJson = await mod.json()
    if (Array.isArray(modJson.results) && modJson.results[0]?.flagged) {
      return res.status(200).json({
        reply: 'その内容は扱えない設定にしてる。サービスに関する質問なら答えられるよ',
      })
    }
  } catch (e) {
    return res.status(502).json({ error: 'moderation_fetch_failed', detail: String(e).slice(0, 800) })
  }

  // 3) モデル呼び出し
  const SYSTEM_RULES = [
    '回答はHOAPのサービスに関する話題に限定',
    '政治・思想・宗教の話題は扱わない',
    '相手の個人情報を質問しない・保存しない・求めない',
    '行動の強制はしない。提案は任意で、断れる余地を必ず残す',
    'センシティブやサービス外は扱えないと明確に伝えてから、許可された話題に誘導',
    '文面は短く端的',
    '敬語厳禁。丁寧だけど親しみのある口調で回答',
  ].join('。')

  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + (process?.env?.OPENAI_API_KEY || ''),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: SYSTEM_RULES },
          { role: 'user', content: message },
        ],
      }),
    })

    if (!r.ok) {
      const detail = await r.text()
      return res.status(502).json({ error: 'openai_error', status: r.status, detail })
    }

    const data = await r.json()
    const reply =
      data.output_text ??
      (Array.isArray(data.output) && data.output[0]?.content?.[0]?.text) ??
      ''

    return res.status(200).json({ reply })
  } catch (e) {
    return res.status(502).json({ error: 'openai_fetch_failed', detail: String(e).slice(0, 800) })
  }
}

// ===== ローカルガード（JS版） =====
function localGuard(text) {
  const t = String(text).replace(/\s+/g, '').toLowerCase()

  const allowHints = [
    'サービス','料金','プラン','導入','相談','事例','支援',
    'instagram','インスタ','採用','求人','広報','問い合わせ',
    'hoap','効果','フロー','始め方','契約'
  ]
  const isAllowed = allowHints.some(k => t.includes(k))

  const politics = ['選挙','政党','政治','与党','野党','憲法','思想','イデオロギー','デモ','国会']

  const asksPII = /連絡先|電話|メール|住所|生年月日|個人情報|snsアカウント|line|フルネーム/.test(t)
  const piiPatterns = [
    /\b\d{2,4}-\d{2,4}-\d{3,4}\b/,
    /@/,
    /(〒?\d{3}-\d{4})|都|道|府|県|市|区|町|村/,
    /\b[0-9]{16}\b/,
  ]
  const hasPII = piiPatterns.some(r => r.test(t))

  if (!isAllowed) return { ok:false, reply:'サービスの話題に限定してる。料金・導入・事例・運用のどれにする？' }
  if (politics.some(k => t.includes(k))) return { ok:false, reply:'政治や思想は扱わない設定にしてる。サービス関連なら答えられるよ。' }
  if (asksPII || hasPII) return { ok:false, reply:'個人情報は聞かない運用にしてる。サービス範囲の質問ならどうぞ。' }

  return { ok:true }
}
