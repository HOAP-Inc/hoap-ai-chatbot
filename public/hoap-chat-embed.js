(() => {
  const ORIGIN = 'https://hoap-ai-chatbot.vercel.app'; // ←あなたの本番URLに固定
  const API    = ORIGIN + '/api/ask';

  // ランチャー
  const btn = document.createElement('button');
  btn.textContent = '💬';
  Object.assign(btn.style, {
    position:'fixed', right:'20px', bottom:'20px', zIndex:'2147483000',
    width:'64px', height:'64px', borderRadius:'999px', border:'none', cursor:'pointer',
    background:'linear-gradient(135deg,#f9a8d4,#d8b4fe,#c4b5fd)', color:'#fff', fontSize:'24px',
    boxShadow:'0 8px 24px rgba(0,0,0,.18)'
  });

  // パネル
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position:'fixed', right:'20px', bottom:'100px', zIndex:'2147483000',
    width:'360px', maxWidth:'calc(100vw - 40px)', background:'#fff', borderRadius:'16px',
    boxShadow:'0 8px 24px rgba(0,0,0,.18)', border:'1px solid #e5e7eb',
    display:'none', flexDirection:'column', overflow:'hidden', isolation:'isolate'
  });

  const header = document.createElement('div');
  header.textContent = 'HOAP-chan';
  Object.assign(header.style, {
    padding:'12px 14px', background:'linear-gradient(135deg,#f9a8d4,#d8b4fe,#c4b5fd)', color:'#fff', fontWeight:'700'
  });

  const body = document.createElement('div');
  Object.assign(body.style, { padding:'12px', height:'420px', overflowY:'auto', background:'#fafafa' });

  const inputBar = document.createElement('div');
  Object.assign(inputBar.style, { display:'flex', gap:'8px', padding:'10px', borderTop:'1px solid #e5e7eb', background:'#fff' });

  const ta = document.createElement('textarea');
  ta.rows = 2;
  ta.placeholder = '質問を入力して送信';
  Object.assign(ta.style, { flex:'1', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'10px', fontSize:'14px', resize:'none' });

  const send = document.createElement('button');
  send.textContent = '送信';
  Object.assign(send.style, { background:'linear-gradient(135deg,#f9a8d4,#d8b4fe,#c4b5fd)', color:'#fff', border:'none', padding:'0 14px', borderRadius:'10px', cursor:'pointer' });

  // 吹き出し
  function addMsg(side, text){
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginBottom = '10px';
    const bub = document.createElement('div');
    bub.textContent = text;
    bub.style.padding = '10px 12px';
    bub.style.borderRadius = '14px';
    bub.style.maxWidth = '80%';
    bub.style.lineHeight = '1.4';
    bub.style.fontSize = '14px';
    if (side === 'bot') {
      bub.style.background = '#fff';
      bub.style.border = '1px solid #e5e7eb';
    } else {
      bub.style.marginLeft = 'auto';
      bub.style.background = 'linear-gradient(135deg,#f9a8d4,#d8b4fe,#c4b5fd)';
      bub.style.color = '#fff';
    }
    row.appendChild(bub);
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  // API
  async function ask(q){
    const res = await fetch(API, {
      method:'POST',
      mode:'cors',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ message:q })
    });
    let data=null; try{ data=await res.json(); }catch{}
    if(!res.ok) throw new Error((data&&(data.detail||data.error))||res.status+' '+res.statusText);
    if(data&&data.error) throw new Error(data.detail||data.error);
    return (data&&data.reply)||'';
  }

  // 送信
  async function handle(){
    const raw = ta.value; const text = raw.trim();
    if(!text) return;
    addMsg('user', text);
    ta.value = '';
    try{
      const a = await ask(text);
      addMsg('bot', a || '（空の返答）');
    }catch(e){
      addMsg('bot', 'エラー: ' + (e && e.message || e));
    }
  }

  // イベント
  send.addEventListener('click', handle);
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handle(); }
  });
  btn.addEventListener('click', () => {
    const open = wrap.style.display !== 'none';
    wrap.style.display = open ? 'none' : 'flex';
    if(!open && body.dataset.welcomed!=='1'){
      addMsg('bot','こんにちは！ほーぷちゃんだよ。気になるところをタップしてね！');
      body.dataset.welcomed='1';
    }
  });

  // 組み立て
  inputBar.appendChild(ta); inputBar.appendChild(send);
  wrap.appendChild(header); wrap.appendChild(body); wrap.appendChild(inputBar);
  document.body.appendChild(btn); document.body.appendChild(wrap);
})();
