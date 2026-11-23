(function () {
  'use strict';
  var people = window.LETTER_PEOPLE;
  var state = {}, active = 'zhao';
  var $ = function (s, scope) { return (scope || document).querySelector(s); };
  var $$ = function (s, scope) { return Array.from((scope || document).querySelectorAll(s)); };
  function addText(parent, tag, value, cls) {
    var e = document.createElement(tag); e.textContent = value;
    if (cls) e.className = cls; parent.appendChild(e); return e;
  }
  function download(text, filename) {
    var u = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'}));
    var a = document.createElement('a'); a.href = u; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 1500);
  }
  function message(d, text, user, index, cite) {
    var box = $('#view-' + d.id + '-dialogue .msgs');
    var m = document.createElement('div'); m.className = 'msg ' + (user ? 'user' : 'bot');
    addText(m, 'span', user ? '你 · ' + d.role : d.name + ' · 角色演绎', 'family-speaker');
    addText(m, 'div', text);
    if (!user && cite) {
      var details = document.createElement('details'); details.className = 'family-evidence';
      addText(details, 'summary', '原文依据与出处 · 回答为角色演绎');
      if (Number.isInteger(index) && d.letter[index]) addText(details, 'p', '原文依据：' + d.letter[index]);
      else addText(details, 'p', '资料边界：本条不新增人物经历或后续事件；原文未明确的信息不作推断。');
      var a = addText(details, 'a', d.sourceTitle + ' ↗'); a.href = d.source; a.target = '_blank'; a.rel = 'noopener';
      m.appendChild(details);
    }
    box.appendChild(m); box.scrollTop = box.scrollHeight;
  }
  function send(d, text, preset) {
    text = text.trim(); if (!text) return;
    if(!preset && window.LetterAI && window.LetterAI.isAvailable()){window.LetterAI.send(d,text);return;}
    var st = state[d.id]; message(d, text, true);
    $('#view-' + d.id + '-dialogue input').value = '';
    if (/续写|编造|编.{0,8}故事|代写/.test(text)) {
      message(d, d.address + '，现有家书没有记下的事，我不能凭空补说。你可以以自己的身份写下回应。', false, null, true); return;
    }
    if (/后来|结局|202[0-9]|如今|现在的中国|新中国.{0,4}(成立|怎么样)|你知道未来|你怎么牺牲|你死后/.test(text)) {
      message(d, d.address + '，写信以后的事，我无法预知。我们可以谈谈这封信里留下的话。', false, null, true); return;
    }
    var q = preset || d.questions.find(function (x) { return x.q === text; });
    if (!q && st.selected >= 0 && /这段|这句|选中|解释/.test(text)) {
      q = d.questions.find(function (x) { return x.index === st.selected; });
      if (!q) {
        message(d, d.address + '，这段话我写在信中，想同你谈的，正是这些。请再看看下面的原文；没有明确记下的心事，我不能替当年的自己补说。', false, st.selected, true); return;
      }
    }
    if (!q) q = d.questions.find(function (x) { return new RegExp(x.keys).test(text); });
    if (q) message(d, q.a, false, q.index, true);
    else message(d, d.address + '，这个问题，现有家书没有足够的记载，我不能凭空作答。你可以从下方的问题里，选一句我们接着谈。', false, null, true);
  }
  function pauseAll(except) {
    $$('.family-audio audio').forEach(function (a) { if (a !== except) a.pause(); });
  }
  people.forEach(function (d) {
    state[d.id] = { selected:-1, audioUrl:null, started:false };
    var read = $('#view-' + d.id), chat = $('#view-' + d.id + '-dialogue');
    d.questions.forEach(function (q) {
      var b = addText($('.presets',chat),'button',q.q,'chip'); b.type = 'button'; b.onclick = function () { send(d,q.q,q); };
    });
    $('form',chat).onsubmit = function (e) { e.preventDefault(); send(d,$('input',chat).value); };
    $$('.family-text p',read).forEach(function (p, index) {
      function pick() {
        $$('.family-text p',read).forEach(function (x) { x.classList.remove('selected'); x.setAttribute('aria-pressed','false'); });
        p.classList.add('selected'); p.setAttribute('aria-pressed','true'); state[d.id].selected = index;
        $('.family-ask',read).disabled = false; $('.family-selection',read).textContent = '已选中第 ' + (index + 1) + ' 段';
      }
      p.onclick = pick;
      p.onkeydown = function (e) { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
    });
    $('.family-ask',read).onclick = function () {
      var context = $('.family-context',chat); context.hidden = false;
      context.textContent = '正在阅读的原文：\n' + d.letter[state[d.id].selected];
      $('input',chat).value = '请说说选中的这段话'; location.hash = '/' + d.id + '-dialogue';
    };
    var audio = $('audio',read), btn = $('.family-play',read), status = $('.audio-state',read);
    btn.onclick = async function () {
      if(!audio.paused) { audio.pause(); return; }
      pauseAll(audio);
      try { await audio.play(); } catch(e) { status.textContent = '无法播放，请重新选择录音'; }
    };
    audio.onplay = function () { btn.textContent = '暂停朗读'; status.textContent = '播放中…'; };
    audio.onpause = function () { btn.textContent = '播放朗读'; status.textContent = '已暂停'; };
    audio.onended = function () { btn.textContent = '播放朗读'; status.textContent = '已结束'; };
    audio.onerror = function () { status.textContent = '音频格式不支持或文件不可用'; };
    $('.family-file',read).onchange = function () {
      var file = this.files[0]; if(!file) return;
      audio.pause(); if(state[d.id].audioUrl) URL.revokeObjectURL(state[d.id].audioUrl);
      state[d.id].audioUrl = URL.createObjectURL(file); audio.src = state[d.id].audioUrl;
      btn.disabled = false; btn.textContent = '播放朗读'; status.textContent = '未播放 · 本机试听';
    };
    $('.family-save',chat).onclick = function () {
      var value = $('textarea',chat).value.trim(), result = $('.family-reply-state',chat);
      if(!value) { result.textContent = '请先写下你的回信。'; return; }
      var content = '给' + d.name + '家书的回音\n' + d.role + '\n当代体验者创作，非历史原文或收信人真实书信\n\n';
      if(state[d.id].selected >= 0) content += '选中的原文：\n' + d.letter[state[d.id].selected] + '\n\n';
      download(content + '我的回信：\n' + value + '\n\n原文来源：' + d.source, '给' + d.name + '家书的回音.txt');
      result.textContent = '已发起下载。';
    };
  });
  var cards = $('#letter-cards');
  people.forEach(function (d) {
    var c = document.createElement('div'); c.className = 'lcard';
    addText(c,'div',d.name,'nm'); addText(c,'div',d.tag + ' · ' + d.cardDate,'yr'); addText(c,'div',d.one,'one');
    var act = document.createElement('div'); act.className = 'act'; var a = addText(act,'a','进入家书 →'); a.href = '#/' + d.id;
    c.appendChild(act); cards.appendChild(c);
  });
  function route() {
    var key = location.hash.replace(/^#\/?/,'') || 'home';
    key = ({letter:'zhao',dialogue:'zhao-dialogue'})[key] || key;
    if(!$('#view-' + key)) key = 'home';
    $$('.view').forEach(function (v) { v.classList.toggle('on',v.id === 'view-' + key); });
    pauseAll();
    var isChat = key.endsWith('-dialogue'), id = isChat ? key.slice(0,-9) : key;
    if(state[id]) active = id;
    $$('nav .links a').forEach(function (a) {
      a.classList.toggle('on',a.dataset.view === (key === 'home' ? 'home' : isChat ? 'dialogue' : 'letter'));
      if(a.dataset.view !== 'home') a.href = '#/' + active + (a.dataset.view === 'dialogue' ? '-dialogue' : '');
    });
    if(isChat && state[id] && !state[id].started) {
      state[id].started = true; var d = people.find(function (x) { return x.id === id; }); message(d,d.opening,false);
    }
    window.scrollTo({top:0,left:0,behavior:'instant'});
  }
  $$('[data-scroll]').forEach(function(a) { a.onclick = function(e) { e.preventDefault(); document.getElementById(a.dataset.scroll).scrollIntoView({behavior:'smooth'}); }; });
  window.addEventListener('hashchange',route); route();
})();
