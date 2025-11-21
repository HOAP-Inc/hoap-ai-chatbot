// api/ask.js

const { logConversation } = require('./sheets')

// 許可オリジン判定
function isAllowedOrigin(origin) {
  if (!origin) return false
  try {
    const u = new URL(origin)
    const host = u.host

    // 本番
    if (host === 'hoap-inc.jp' || host === 'www.hoap-inc.jp') return true

    // サブドメイン一括許可例: app.hoap-inc.jp 等があるならここで許可
    if (host.endsWith('.hoap-inc.jp')) return true

    // 開発
    if (host.startsWith('localhost:')) return true
    if (host.endsWith('.vercel.app')) return true

    return false
  } catch {
    return false
  }
}

// CORS ヘルパ（srcdoc/同一オリジン考慮）
function setCors(req, res) {
  const origin = String(req.headers.origin || req.headers.Origin || '')
  const hasOrigin = origin.length > 0

  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')

  // iframe.srcdoc / about:srcdoc からのリクエストは Origin ヘッダが null または未送信になる
  // この場合に限り、ワイルドカードで許可（認証Cookieは使っていないので安全）
  if (!hasOrigin || origin === 'null') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return
  }

  // 通常の外部オリジンはホワイトリストで許可
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  // 許可外は何も付けない（ミスマッチ回避のため固定先は返さない）
}

module.exports = async function handler(req, res) {
  setCors(req, res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const ct = String(req.headers['content-type'] || req.headers['Content-Type'] || '')
  if (!ct.includes('application/json')) {
    return res.status(400).json({ error: 'invalid_content_type' })
  }

  const { message, session_id, turn, referrer, landing_page, origin, device } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' })
  }

  // ログ用メタ情報を保持
  const logMeta = { session_id, turn, referrer, landing_page, origin, device }

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
  let KNOWLEDGE = '';
  let RULES = '';
  try {
    KNOWLEDGE = require('../prompt/knowledge');
    RULES = require('../prompt/rules');
  } catch (e) {
    console.warn('Failed to load prompt files', e);
  }

  const SYSTEM_RULES = `${RULES}

【サービス内容別まとめ（参照資料）】
以下の資料に含まれる情報**のみ**を使って回答してね。
資料にない情報は「ごめんね、その情報は持ち合わせていないんだ。お問い合わせフォームから聞いてみて！」と答えてね。
一般的な知識や外部の知識を使って勝手に補完しちゃダメだよ。

${KNOWLEDGE}
`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + (process?.env?.OPENAI_API_KEY || ''),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
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
    const reply = data.choices?.[0]?.message?.content ?? ''

    // スプレッドシートにログ記録（非同期、エラーでも応答は返す）
    logConversation({
      timestamp: new Date().toISOString(),
      session_id: logMeta.session_id,
      turn: logMeta.turn,
      user_message: message,
      bot_reply: reply,
      referrer: logMeta.referrer,
      landing_page: logMeta.landing_page,
      origin: logMeta.origin,
      device: logMeta.device,
    }).catch(e => console.warn('[log] failed:', e.message))

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
    'hoap','効果','フロー','始め方','契約','sns','ブランディング','代行','スカウト'
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

  if (!isAllowed) return { ok:false, reply:'サービスの話題しか話せないんだ。料金・導入・事例・運用のどれにする？' }
  if (politics.some(k => t.includes(k))) return { ok:false, reply:'政治や思想は扱わない設定にしてる。サービス関連なら答えられるよ。' }
  if (asksPII || hasPII) return { ok:false, reply:'個人情報は聞かない運用にしてるんだ。サービス範囲の質問ならどうぞ。' }

  return { ok:true }
}
