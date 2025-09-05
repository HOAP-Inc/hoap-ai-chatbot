// @ts-nocheck

// process を直参照しない（型定義不要）
const ENV =
  (typeof globalThis !== 'undefined' &&
    (globalThis as any) &&
    (globalThis as any).process &&
    (globalThis as any).process.env) ||
  {};

// /api/ask.ts
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', 'https://hoap-inc.jp/'); // 埋め込み元
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(400).json({ error: 'invalid_content_type' })
  }

  const { message } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' })
  }

  // 1) ローカル判定（高速・確実）
  const verdict = localGuard(message)
  if (!verdict.ok) {
    return res.status(200).json({ reply: verdict.reply })
  }

  // 2) OpenAIのモデレーションで危険内容を弾く
  const mod = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + (ENV.OPENAI_API_KEY || ''),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input: message,
    }),
  })
  if (!mod.ok) {
    const detail = await mod.text()
    return res.status(502).json({ error: 'moderation_error', detail })
  }
  /* @ts-ignore */
  const modJson = await mod.json()
  if (Array.isArray(modJson.results) && modJson.results[0]?.flagged) {
    return res.status(200).json({
      reply: 'その内容は扱えない設定にしてる。サービスに関する質問なら答えられるよ',
    })
  }

  // 3) モデル呼び出し（強いルールを毎回付与）
  const SYSTEM_RULES = [
    '回答はHOAPのサービスに関する話題に限定',
    '政治・思想・宗教の話題は扱わない',
    '相手の個人情報を質問しない・保存しない・求めない',
    '行動の強制はしない。提案は任意で、断れる余地を必ず残す',
    'センシティブやサービス外は「扱えない」と明確に伝えてから、許可された話題に誘導',
    '文面は短く端的',
    '敬語厳禁。丁寧だけど相手に寄り添うエージェントとして親しみのある口調で回答',
  ].join('。')

  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + (ENV.OPENAI_API_KEY || ''),
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
    return res.status(502).json({ error: 'openai_error', detail })
  }
  /* @ts-ignore */
  const data = await r.json()
  /* @ts-ignore */
  const reply =
    data.output_text ??
    (Array.isArray(data.output) && data.output[0]?.content?.[0]?.text) ??
    ''

  return res.status(200).json({ reply })
}

function localGuard(text: string): { ok: boolean; reply?: string } {
  const t = text.replace(/\s+/g,'').toLowerCase()

  // サービス関連ワード（ホワイトリスト寄り）
  const allowHints = [
    'サービス','料金','プラン','導入','相談','事例','支援',
    'instagram','インスタ','採用','求人','広報','問い合わせ',
    'hoap','効果','フロー','始め方','契約'
  ]
  const isAllowed = allowHints.some(k => t.includes(k))

  // 政治・思想
  const politics = ['選挙','政党','政治','与党','野党','憲法','思想','イデオロギー','デモ','国会']

  // 個人情報（要求/提示どちらもNG）
  const asksPII = /連絡先|電話|メール|住所|生年月日|個人情報|snsアカウント|line|フルネーム/.test(t)
  const piiPatterns = [
    /\b\d{2,4}-\d{2,4}-\d{3,4}\b/, // 電話
    /@/,                            // メール
    /(〒?\d{3}-\d{4})|都|道|府|県|市|区|町|村/, // 住所ざっくり
    /\b[0-9]{16}\b/,                // カード番号風
  ]
  const hasPII = piiPatterns.some(r => r.test(t))

  if (!isAllowed) return { ok:false, reply:'サービスの話題に限定してる。料金・導入・事例・運用のどれにする？' }
  if (politics.some(k => t.includes(k))) return { ok:false, reply:'政治や思想は扱わない設定にしてる。サービス関連なら答えられるよ。' }
  if (asksPII || hasPII) return { ok:false, reply:'個人情報は聞かない運用にしてる。サービス範囲の質問ならどうぞ。' }

  return { ok:true }
}
