// public/hoap-chat-embed.js
(() => {
  const ORIGIN = 'https://hoap-ai-chatbot.vercel.app';
  const API    = ORIGIN + '/api/ask';
  const IMG    = ORIGIN + '/hoap-basic.png';

  // Shadow DOM
  const mount  = document.createElement('div');
  document.body.appendChild(mount);
  const shadow = mount.attachShadow({ mode: 'open' });

  // UI
  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <style>
      :host{ all:initial; --z:2147483000; --r:16px; --sh:0 8px 24px rgba(0,0,0,.18);
             --bg:#fff; --g1:#f9a8d4; --g2:#d8b4fe; --g3:#c4b5fd; }
      *{ box-sizing:border-box; font:inherit; }
      /* 画像ランチャー（右下／サイズはお好みで） */
.launcher{
  position: fixed;
  right: 20px;
  bottom: 80px;          /* ← 位置はここで調整 */
  z-index: var(--z);
  width: 128px;          /* ← 画像の見せたい大きさ */
  height: auto;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  box-shadow: none;
  display: block;
}
.launcher img{
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;          /* クリックはbuttonに集約 */
  animation: floaty 4.8s ease-in-out infinite;
  will-change: transform;
}

/* ふわふわ上下 */
@keyframes floaty{
  0%   { transform: translateY(0); }
  50%  { transform: translateY(-10px); }
  100% { transform: translateY(0); }
}

/* アニメ苦手設定の尊重 */
@media (prefers-reduced-motion: reduce){
  .launcher img{ animation: none; }
}

/* スマホはちょい小さめ＋位置も詰める */
@media (max-width: 480px){
  .launcher{ right: 12px; bottom: 72px; width: 100px; }
}


      .chat{ position:fixed; right:15px; bottom:20px; z-index:var(--z);
        width:360px; max-width:calc(100vw - 30px); background:var(--bg);
        border-radius:var(--r); box-shadow:var(--sh); border:1px solid #e5e7eb;
        display:none; flex-direction:column; overflow:hidden; height:72vh; max-height:80vh; isolation:isolate; }
      .open{ display:flex; }

      .hd{ padding:12px 14px; background:linear-gradient(135deg,var(--g1),var(--g2),var(--g3));
           color:#fff; display:flex; align-items:center; gap:10px; }
      .ttl{ font-weight:700; font-size:14px; } .sub{ font-size:12px; opacity:.9; }
      .close{ margin-left:auto; background:transparent; color:#fff; border:none; font-size:18px; cursor:pointer; }

      /* 本文ラッパー：スクロールは子の .scroll に持たせる */
  .body{
    position: relative;
    flex: 1;
    min-height: 0;
  }
  
  /* 実際にスクロールする領域（背景色もこちらへ） */
  .scroll{
    padding:12px;
    overflow-y:auto;
    background:#fafafa;
    position:relative;
    height:100%;
  }
      /* メッセージは z=2（＝マスコットの前） */
      .msg{ display:flex; gap:8px; margin-bottom:10px; position:relative; z-index:2; }
      .bubble{ padding:10px 12px; border-radius:14px; max-width:80%; line-height:1.4; font-size:14px; }
      .bot .bubble{ background:#fff; border:1px solid #e5e7eb; max-width:65%; } /* ほーぷちゃんが見えるよう幅を狭める */
      .user{ justify-content:flex-end; } .user .bubble{ background:linear-gradient(135deg,var(--g1),var(--g2),var(--g3)); color:#fff; }
      .bubble a{ color:#6366f1; text-decoration:underline; }
      .bubble a:hover{ color:#4f46e5; }

      /* 選択肢ボタン */
      .choice-btn{
        display:block; width:90%; max-width:280px; margin:6px auto;
        padding:8px 12px; background:#fff; color:#333;
        border:2px solid #8b5cf6; border-radius:999px;
        font-size:13px; text-align:center; cursor:pointer; transition:background .2s;
      }
      .choice-btn:hover{ background:#f5f3ff; }

      .quick{
        display:grid; grid-template-columns:repeat(3, 1fr); /* 3列 */
        gap:8px; padding:10px 12px;
        border-top:1px solid #e5e7eb; background:#fff;
      }
      .quick button{
        border:1px solid #e5e7eb; background:#fff; border-radius:999px;
        padding:8px 4px; font-size:11px; cursor:pointer;
        width:100%; display:flex; justify-content:center; align-items:center;
      }
      .inp{ display:flex; gap:8px; padding:10px; border-top:1px solid #e5e7eb; background:#fff; }
      .inp textarea{ flex:1; border:1px solid #e5e7eb; border-radius:10px; padding:10px; font-size:14px; resize:none; }
      .inp button{ background:linear-gradient(135deg,var(--g1),var(--g2),var(--g3)); color:#fff; border:none; padding:0 14px; border-radius:10px; cursor:pointer; }

      /* ほーぷちゃん：本文の“中”で右下固定。z=1（メッセージの後ろ） */
      .mascot{
  position:absolute;
  inset:auto;
  right:-30px;                           /* もっと右へ */
  bottom:calc(0px + var(--uiH, 110px));  /* 余白なし */
  width:200px;
  pointer-events:none;
  z-index:1;
  filter:drop-shadow(0 10px 24px rgba(0,0,0,.22));
  opacity:.98;
  left:auto;
  transform:none;
  margin:0;
}
      .mascot img{ display:block; width:100%; height:auto; animation:floaty 4.8s ease-in-out infinite; }
      @keyframes floaty{0%{transform:translateY(0) rotate(.4deg);}50%{transform:translateY(-8px) rotate(-.4deg);}100%{transform:translateY(0) rotate(.4deg);}}
      @media (prefers-reduced-motion:reduce){ .mascot img{ animation:none; } }

      @media (max-width:480px){
  /* チャット本体：7割サイズ・右下固定・角を丸く */
  .chat{
    right:8px;
    bottom:8px;
    width:85vw;          /* 幅を85%に広げる（ボタン3列確保のため） */
    height:70vh;
    max-width:none;
    max-height:none;
    border-radius:24px;
  }

  /* ほーぷちゃん：少し大きく、クイック＋入力の“上”に配置 */
  .mascot{
    right:-20px;
    bottom:calc(0px + var(--uiH, 110px)); /* スマホも同様 */
    width:min(66%, 220px);
  }

  /* 念のため前面に（重なり見え対策のみ） */
  .quick, .inp{ position:relative; z-index:3; }
  
  .quick{
    padding:6px 8px;
    gap:6px;
    /* grid継承 */
  }
  .quick button{
    padding:4px 2px;
    font-size:10px;    /* さらに小さく */
    border-radius:999px;
    line-height:1.1;
    width:100%;
  }
}

/* 入力中「…」の見た目（薄く） */
.msg.bot.typing .bubble{ opacity:.75; }
    </style>

    <button class='launcher' aria-label='チャットを開く'>
  <img src='${ORIGIN}/hoap-question.png' alt='HOAP-chan'>
</button>


    <div class='chat' role='dialog' aria-label='HOAP サイトチャット'>
      <div class='hd'>
        <div><div class='ttl'>HOAP-chan</div><div class='sub'>医療・歯科・介護業界特化 採用支援</div></div>
        <button class='close' aria-label='閉じる'>×</button>
      </div>

     <div class='body'>
  <div class='scroll' id='body'></div>
</div>
 <div class='mascot' aria-hidden='true'><img src='${IMG}' alt='HOAP-chan'></div>
<div class='quick' id='quick'></div>
<div class='inp'>
  <textarea id='ta' rows='2' placeholder='質問を入力して送信'></textarea>
  <button id='send'>送信</button>
</div>
    </div>
  `;
  shadow.appendChild(tpl.content.cloneNode(true));

  // 要素
  const $        = s => shadow.querySelector(s);
  const dialog   = $('.chat');
  const launcher = $('.launcher');
  const closeBtn = $('.close');
  const bodyEl   = $('#body');
  const quickEl  = $('#quick');
  const ta       = $('#ta');
  const send     = $('#send');
  const inpEl    = shadow.querySelector('.inp'); // ← 追加

  function syncUIHeights(){
  const uiH = (quickEl?.offsetHeight || 0) + (inpEl?.offsetHeight || 0);
  dialog.style.setProperty('--uiH', uiH + 'px');
}

  // プリセット
  const presets = [
    ['about','サービス紹介'], ['cases','事例紹介'], ['price','料金'],
    ['flow','導入フロー'], ['other','その他質問'], ['contact','問い合わせ']
  ];
  quickEl.innerHTML = presets.map(([k,v]) => `<button data-k="${k}">${v}</button>`).join('');

  // 定型回答
  const KB = {
    about: 'HOAPは医療・歯科・介護業界に特化した採用支援サービスを提供しているよ。求人媒体＋SNS運用を代行し、手間なく欲しい人材から応募を集めるのが得意なんだ！',
    cases: '事例1 兵庫の訪問看護で応募増。事例2 千葉の介護で応募2.5倍。事例3 東京の訪問看護で インスタ見て応募 の声。',
    price: '採用支援は月額10万円〜。Instagram運用は月額15万円。初期費用は各10万円。',
    price_recruit: '採用支援サービスは月額110,000円（税込）から導入可能だよ！<br>現在の課題感や採用計画に合わせて柔軟に対応できるから、よかったらまずは相談してみてね。<br><button class="choice-btn" data-next="contact_direct">問い合わせ</button>',
    price_insta: '採用支援サービスは月額165,000円（税込）で導入可能だよ！<br>現在の課題感や採用計画に合わせて柔軟に対応できるから、よかったらまずは相談してみてね。<br><button class="choice-btn" data-next="contact_direct">問い合わせ</button>',
    flow: '導入フローは 1 無料相談 2 契約 3 キックオフMTG 4 支援開始。最短3営業日で着手可能！',
    other: 'その他のご質問については、お気軽に問い合わせフォームからご連絡ください。詳しくお答えしますね！'
  };

  // 吹き出し
  function addMsg(side, text, isHtml = false){
    const row = document.createElement('div');
    row.className = 'msg ' + side;
    const bub = document.createElement('div');
    bub.className = 'bubble';
    if (isHtml) {
      bub.innerHTML = text;
    } else {
      bub.textContent = text;
    }
    row.appendChild(bub);
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }
  const userSay = t => addMsg('user', t);
  const botSay  = (t, isHtml = false) => addMsg('bot', t, isHtml);

  // 「…」のタイピング表示を出し、あとで消す関数を返す
function showTyping(){
  const row = document.createElement('div');
  row.className = 'msg bot typing';
  const bub = document.createElement('div');
  bub.className = 'bubble';
  bub.textContent = '…';  // 考え中の三点リーダ
  row.appendChild(bub);
  bodyEl.appendChild(row);
  bodyEl.scrollTop = bodyEl.scrollHeight;
  // 後で消すための関数を返す
  return () => { row.remove(); };
}

  // API
  async function ask(q){
    const res = await fetch(API, {
      method:'POST', mode:'cors',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ message:q })
    });
    let data=null; try{ data=await res.json(); }catch{}
    if(!res.ok) throw new Error((data&&(data.detail||data.error))||(res.status+' '+res.statusText));
    if(data&&data.error) throw new Error(data.detail||data.error);
    return (data&&data.reply)||'';
  }

  // 送信
  async function handle(){
  const t = ta.value.trim(); if (!t) return;
  userSay(t); ta.value = '';

  // 考え中「…」を表示
  const hideTyping = showTyping();

  try{
    const reply = await ask(t) || '（空の返答）';
    hideTyping();         // 「…」を消す
    await splitAndShow(reply);
    afterBotReply(t);
  }catch(e){
    hideTyping();         // エラー時も必ず消す
    botSay('エラー: ' + (e && e.message || e));
  }
}

async function splitAndShow(text) {
  const MAX_LEN = 225;
  const lines = text.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    if ((current + line).length > MAX_LEN) {
      if (current) chunks.push(current);
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }
  if (current) chunks.push(current);

  let lastMsg = null;
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await new Promise(r => setTimeout(r, 3000));
      if (lastMsg) lastMsg.remove();
    }
    botSay(chunks[i].trim());
    lastMsg = bodyEl.lastElementChild; 
  }
}

  // CTA
  function afterBotReply(userText){
    const k = userText.toLowerCase();
    const key = k.includes('料金')||k.includes('price') ? 'price'
             : k.includes('導入')||k.includes('flow')||k.includes('始め') ? 'flow'
             : k.includes('事例')||k.includes('case') ? 'cases'
             : k.includes('インスタ')||k.includes('instagram') ? 'insta'
             : k.includes('求人')||k.includes('採用')||k.includes('広報') ? 'feature'
             : 'about';
    dialog.__last = dialog.__last || '';
    dialog.__cnt  = dialog.__cnt  || 0;
    if (dialog.__last === key) dialog.__cnt++; else { dialog.__last = key; dialog.__cnt = 1; }
    if (dialog.__cnt >= 2){ botSay('よかったらHOAPに相談してみない？問い合わせフォームを押してね！'); dialog.__cnt = 0; }
  }

  // 入力系
  let composing = false;
  send.addEventListener('click', handle);
  ta.addEventListener('compositionstart', () => { composing = true; });
  ta.addEventListener('compositionend',   () => { composing = false; });
  ta.addEventListener('keydown', e => {
    if (composing) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handle(); }
  });

  // 開閉
  function openChat(){
  dialog.classList.add('open');
  if (!bodyEl.dataset.welcomed){
    botSay('こんにちは！ほーぷちゃんだよ。気になるところをタップしてね！');
    bodyEl.dataset.welcomed = '1';
  }
  syncUIHeights();   // ★ 追加
  ta.focus();
}
  function closeChat(){ dialog.classList.remove('open'); }

  // ボタン
  launcher.addEventListener('click', openChat);
  launcher.addEventListener('touchend', openChat);
  closeBtn.addEventListener('click', closeChat);

  // プリセット
  const quick = $('#quick');
  quick.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'contact'){ window.location.href = 'https://hoap-inc.jp/contact'; return; }
    userSay(b.textContent);
    if (k === 'cases') {
      botSay('こちらから確認してね！<br><a href="https://hoap-inc.jp/case" target="_blank" rel="noopener noreferrer">導入事例紹介</a>', true);
    } else if (k === 'price') {
      botSay('どちらの料金について知りたい？<br>' +
        '<button class="choice-btn" data-next="price_recruit">採用支援</button>' +
        '<button class="choice-btn" data-next="price_insta">採用広報支援（Instagram）</button>', true);
    } else if (k === 'about') {
      botSay('どちらのサービスについて知りたい？<br>' +
        '<button class="choice-btn" data-ask="採用支援について詳しく教えて">採用支援</button>' +
        '<button class="choice-btn" data-ask="採用広報支援について詳しく教えて">採用広報支援</button>', true);
    } else {
      botSay(KB[k] || 'その話題は用意してないやつ。サービスについてなら案内できるよ。');
    }
    afterBotReply(b.textContent);
  });

  // メッセージ内ボタン
  bodyEl.addEventListener('click', async e => {
    const btn = e.target.closest('.choice-btn');
    if (!btn) return;
    const next = btn.dataset.next;
    const askText = btn.dataset.ask;
    
    if (next === 'contact_direct') {
      window.location.href = 'https://hoap-inc.jp/contact';
      return;
    }

    if (askText) {
      userSay(btn.textContent);
      const hide = showTyping();
      try {
        const reply = await ask(askText);
        hide();
        await splitAndShow(reply);
        afterBotReply(btn.textContent);
      } catch(err) {
        hide();
        botSay('エラー: ' + (err.message || err));
      }
      return;
    }

    if (next && KB[next]) {
      userSay(btn.textContent);
      botSay(KB[next], true);
      afterBotReply(btn.textContent);
    }
  });
  // 下部UIの高さを監視して反映
const ro = new ResizeObserver(syncUIHeights);
ro.observe(quickEl);
ro.observe(inpEl);
window.addEventListener('resize', syncUIHeights);

// 初期1回反映
syncUIHeights();
})();
