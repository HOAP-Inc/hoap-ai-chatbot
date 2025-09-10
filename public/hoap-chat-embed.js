// public/hoap-chat-embed.js
(() => {
  const ORIGIN = 'https://hoap-ai-chatbot.vercel.app';
  const API    = ORIGIN + '/api/ask';
  const IMG    = ORIGIN + '/hoap-basic.png';

  const mount  = document.createElement('div');
  document.body.appendChild(mount);
  const shadow = mount.attachShadow({ mode: 'open' });

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <style>
      :host{ all:initial; --z:2147483000; --r:16px; --sh:0 8px 24px rgba(0,0,0,.18);
             --bg:#fff; --g1:#f9a8d4; --g2:#d8b4fe; --g3:#c4b5fd; }
      *{ box-sizing:border-box; font:inherit; }
      .launcher{ position:fixed; right:20px; bottom:20px; z-index:var(--z);
        width:64px; height:64px; border-radius:999px; border:none; cursor:pointer;
        background:linear-gradient(135deg,var(--g1),var(--g2),var(--g3));
        color:#fff; font-size:24px; display:grid; place-items:center; box-shadow:var(--sh); }
      .chat{ position:fixed; right:20px; bottom:20px; z-index:var(--z);
        width:320px; max-width:calc(100vw - 40px); background:var(--bg);
        border-radius:var(--r); box-shadow:var(--sh); border:1px solid #e5e7eb;
        display:none; flex-direction:column; overflow:hidden; height:72vh; max-height:80vh; isolation:isolate; }
      .open{ display:flex; }
      .hd{ padding:12px 14px; background:linear-gradient(135deg,var(--g1),var(--g2),var(--g3));
           color:#fff; display:flex; align-items:center; gap:10px; }
      .ttl{ font-weight:700; font-size:14px; } .sub{ font-size:12px; opacity:.9; }
      .close{ margin-left:auto; background:transparent; color:#fff; border:none; font-size:18px; cursor:pointer; }
      .body{ padding:12px; overflow-y:auto; background:#fafafa; position:relative; z-index:0; flex:1; min-height:0; }
      .msg{ display:flex; gap:8px; margin-bottom:10px; position:relative; z-index:2; }
      .bubble{ padding:10px 12px; border-radius:14px; max-width:80%; line-height:1.4; font-size:14px; }
      .bot .bubble{ background:#fff; border:1px solid #e5e7eb; }
      .user{ justify-content:flex-end; } .user .bubble{ background:linear-gradient(135deg,var(--g1),var(--g2),var(--g3)); color:#fff; }
      .quick{ display:flex; flex-wrap:wrap; gap:8px; padding:10px 12px; border-top:1px solid #e5e7eb; background:#fff; }
      .quick button{ border:1px solid #e5e7eb; background:#fff; border-radius:999px; padding:6px 10px; font-size:12px; cursor:pointer; }
      .inp{ display:flex; gap:8px; padding:10px; border-top:1px solid #e5e7eb; background:#fff; }
      .inp textarea{ flex:1; border:1px solid #e5e7eb; border-radius:10px; padding:10px; font-size:14px; resize:none; }
      .inp button{ background:linear-gradient(135deg,var(--g1),var(--g2),var(--g3)); color:#fff; border:none; padding:0 14px; border-radius:10px; cursor:pointer; }
      .mascot{ position:absolute; right:12px; bottom:12px; width:min(62%,220px); pointer-events:none; z-index:1;
               filter:drop-shadow(0 10px 24px rgba(0,0,0,.22)); opacity:.98; transform:translateY(var(--sy,0px)); }
      .mascot img{ display:block; width:100%; height:auto; animation:floaty 4.8s ease-in-out infinite; }
      @keyframes floaty{0%{transform:translateY(0) rotate(.4deg);}50%{transform:translateY(-8px) rotate(-.4deg);}100%{transform:translateY(0) rotate(.4deg);}}
      @media (prefers-reduced-motion:reduce){ .mascot img{ animation:none; } }
      @media (max-width:480px){
        .chat{ right:0; bottom:0; width:100%; height:100vh; max-height:100vh; border-radius:0; }
        .mascot{ right:8px; bottom:8px; width:min(45%,140px); }
      }
    </style>
    <button class='launcher' aria-label='チャットを開く'>💬</button>
    <div class='chat' role='dialog' aria-label='HOAP サイトチャット'>
      <div class='hd'>
        <div><div class='ttl'>HOAP-chan</div><div class='sub'>医療・歯科・介護業界特化 採用支援</div></div>
        <button class='close' aria-label='閉じる'>×</button>
      </div>
      <div class='body' id='body'>
        <div class='mascot'><img src='${IMG}' alt='HOAP-chan'></div>
      </div>
      <div class='quick' id='quick'></div>
      <div class='inp'>
        <textarea id='ta' rows='2' placeholder='質問を入力して送信'></textarea>
        <button id='send'>送信</button>
      </div>
    </div>
  `;
  shadow.appendChild(tpl.content.cloneNode(true));

  const $ = s => shadow.querySelector(s);
  const dialog = $('.chat'), launcher = $('.launcher'), closeBtn = $('.close');
  const bodyEl = $('#body'), quickEl = $('#quick'), ta = $('#ta'), send = $('#send');

  const presets = [
    ['about','サービス概要'], ['trend','採用トレンド'], ['challenge','採用課題'],
    ['solution','HOAPの解決法'], ['feature','支援の特徴'], ['insta','Instagram運用'],
    ['cases','事例紹介'], ['price','料金'], ['flow','導入フロー'], ['contact','問い合わせ']
  ];
  quickEl.innerHTML = presets.map(([k,v]) => '<button data-k=' + k + '>' + v + '</button>').join('');

  const KB = {
    about: 'HOAPは医療・歯科・介護業界に特化した採用支援サービスを提供しているよ。求人媒体＋SNS運用を代行し、手間なく欲しい人材から応募を集めるのが得意なんだ！',
    trend: '求職者は応募前にSNSで情報収集する時代。求職者の8割がSNSで気になる会社を検索し、職場の雰囲気や人間関係を確認してから応募するんだ。',
    challenge: 'よく相談される課題は 応募が来ない 時間がない 離職が多い。診療や訪問に追われ、採用に手が回らない経営者も多いんだ。',
    solution: 'HOAPは業界特化のノウハウで応募を集め、媒体運用 スカウト 面接日調整 採用広報のSNS運用など実務まで代行しているよ。経営者や事務スタッフはコア業務に専念できるんだ！',
    feature: '特徴は3つ。1 欲しい人材像を明確化 2 媒体運用やスカウト送付を代行 3 毎月データ分析と改善提案',
    insta: 'Instagram運用支援では、差別化と共感される投稿を設計し、ファン化を狙うよ。写真提供とアンケート回答、投稿前チェックだけでOK！',
    cases: '事例1 兵庫の訪問看護で応募増。事例2 千葉の介護で応募2.5倍。事例3 東京の訪問看護で インスタ見て応募 の声。',
    price: '採用支援は月額10万円〜。Instagram運用は月額15万円。初期費用は各10万円。',
    flow: '導入フローは 1 無料相談 2 契約 3 キックオフMTG 4 支援開始。最短3営業日で着手可能！'
  };

  function addMsg(side, text){
    const row = document.createElement('div');
    row.className = 'msg ' + side;
    const bub = document.createElement('div');
    bub.className = 'bubble';
    bub.textContent = text;
    row.appendChild(bub);
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    const m = shadow.querySelector('.mascot');
    if (m) m.style.setProperty('--sy', bodyEl.scrollTop + 'px');
  }
  const userSay = t => addMsg('user', t);
  const botSay  = t => addMsg('bot',  t);

  async function ask(q){
    const res = await fetch(API, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q })
    });
    let data = null; try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error((data && (data.detail || data.error)) || (res.status + ' ' + res.statusText));
    if (data && data.error) throw new Error(data.detail || data.error);
    return (data && data.reply) || '';
  }

  async function handle(){
    const t = ta.value.trim(); if (!t) return;
    userSay(t); ta.value = '';
    try { botSay(await ask(t) || '（空の返答）'); afterBotReply(t); }
    catch(e){ botSay('エラー: ' + (e && e.message || e)); }
  }

  function afterBotReply(userText){
    const k = userText.toLowerCase();
    const key = k.includes('料金') || k.includes('price') ? 'price'
             : k.includes('導入') || k.includes('flow')  || k.includes('始め') ? 'flow'
             : k.includes('事例') || k.includes('case')  ? 'cases'
             : k.includes('インスタ') || k.includes('instagram') ? 'insta'
             : k.includes('求人') || k.includes('採用') || k.includes('広報') ? 'feature'
             : 'about';
    dialog.__last = dialog.__last || '';
    dialog.__cnt  = dialog.__cnt  || 0;
    if (dialog.__last === key) dialog.__cnt++; else { dialog.__last = key; dialog.__cnt = 1; }
    if (dialog.__cnt >= 2){ botSay('よかったらHOAPに相談してみない？問い合わせフォームを押してね！'); dialog.__cnt = 0; }
  }

  let composing = false;
  send.addEventListener('click', handle);
  ta.addEventListener('compositionstart', () => { composing = true; });
  ta.addEventListener('compositionend',   () => { composing = false; });
  ta.addEventListener('keydown', e => {
    if (composing) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handle(); }
  });

  function openChat(){
    dialog.classList.add('open');
    if (!bodyEl.dataset.welcomed){
      botSay('こんにちは！ほーぷちゃんだよ。気になるところをタップしてね！');
      bodyEl.dataset.welcomed = '1';
    }
    ta.focus();
  }
  function closeChat(){ dialog.classList.remove('open'); }

  const launcher = shadow.querySelector('.launcher');
  const closeBtn = shadow.querySelector('.close');
  const quickEl  = shadow.querySelector('#quick');
  launcher.addEventListener('click', openChat);
  launcher.addEventListener('touchend', openChat);
  closeBtn.addEventListener('click', closeChat);
  quickEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'contact'){ window.location.href = 'https://hoap-inc.jp/contact'; return; }
    userSay(b.textContent);
    botSay(KB[k] || 'その話題は用意してないやつ。サービスについてなら案内できるよ。');
    afterBotReply(b.textContent);
  });
})();
