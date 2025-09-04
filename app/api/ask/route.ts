import OpenAI from 'openai'

export const runtime = 'edge'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    const { message } = await req.json()
    if (!message) {
      return new Response(JSON.stringify({ error: 'message is required' }), { status: 400 })
    }

    const r = await client.responses.create({
      model: 'gpt-4o-mini',
      input: message,
      instructions: '医療介護歯科の採用支援や採用広報支援に特化して、相手に寄り添い過度に丁寧にならずフランクに返答すること。敬語は使用しなくてOK',
    })

    // SDKの高レベルプロパティを採用
    const reply = (r as any).output_text ?? 'no output'
    const requestId = (r as any)._request_id ?? null

    return new Response(JSON.stringify({ reply, requestId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500 })
  }
}
