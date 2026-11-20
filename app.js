/* JP Vocabs — UI logic. Vocabulary lives in js/data.js (window.VOCAB_DATA), Telegram bridge in js/telegram.js. */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var has = function (s) { return s != null && String(s).trim() !== ''; };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };
  var shuffle = function (a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };

  var D = window.VOCAB_DATA;
  var TG = window.TG || { init: function () {}, setBack: function () {}, lockSwipes: function () {}, haptic: function () {}, inTelegram: false };
  var LV = ['N5', 'N4'];
  var app = $('#app'), navEl = $('#nav');

  /* Entry layout (unchanged from the source): [reading/word, bangla pronunciation, kanji, english, bangla] */
  var F = { word: 0, pron: 1, kanji: 2, en: 3, bn: 4 };

  /* ---------- storage (localStorage, separate N5 / N4 progress) ---------- */
  var KEY = 'jpvocabs.v1';
  var S = loadState();
  function blank() { return { v: 1, learned: { N5: {}, N4: {} }, fav: { N5: {}, N4: {} }, pos: {}, last: null }; }
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1 && s.learned && s.fav) return s;
    } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- data accessors ---------- */
  var off = function (l) { return l === 'N4' ? D.N5.length : 0; };     // N4 lessons continue the source numbering (26–50)
  var num = function (l, li) { return li + 1 + off(l); };
  var wid = function (li, wi) { return li + '.' + wi; };
  var isLearned = function (l, li, wi) { return !!S.learned[l][wid(li, wi)]; };
  var isFav = function (l, li, wi) { return !!S.fav[l][wid(li, wi)]; };

  function lessonStat(l, li) {
    var n = D[l][li].length, k = 0;
    for (var i = 0; i < n; i++) if (S.learned[l][wid(li, i)]) k++;
    var seen = (l + '.' + li) in S.pos;
    return { n: n, k: k, status: n > 0 && k === n ? 'done' : (k > 0 || seen ? 'prog' : 'new') };
  }
  function levelStat(l) {
    var words = 0, k = 0, done = 0;
    D[l].forEach(function (_, li) { var s = lessonStat(l, li); words += s.n; k += s.k; if (s.status === 'done') done++; });
    return { words: words, k: k, done: done, lessons: D[l].length };
  }
  function totals() {
    var t = { words: 0, k: 0, done: 0, lessons: 0 };
    LV.forEach(function (l) { var s = levelStat(l); t.words += s.words; t.k += s.k; t.done += s.done; t.lessons += s.lessons; });
    return t;
  }
  var pct = function (a, b) { return b ? Math.round(a / b * 100) : 0; };

  /* ---------- small UI helpers ---------- */
  var toastT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  function openSheet(html) { $('#sheetBody').innerHTML = html; var s = $('#sheet'); s.classList.add('on'); s.setAttribute('aria-hidden', 'false'); }
  function closeSheet() { var s = $('#sheet'); s.classList.remove('on'); s.setAttribute('aria-hidden', 'true'); }
  function sizeClass(t) { var n = String(t).length; return n <= 3 ? 'xl' : n <= 6 ? 'l' : n <= 12 ? 'm' : 's'; }
  function speakText(t) { return String(t).replace(/\[[^\]]*\]/g, '').replace(/[ⅠⅡⅢⅣⅤ～~]/g, '').replace(/\s+/g, ' ').trim(); }
  function speak(t) {
    try {
      var u = new SpeechSynthesisUtterance(speakText(t)); u.lang = 'ja-JP'; u.rate = .85;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { toast('Audio is not available here'); }
  }

  /* ---------- routing ---------- */
  var deck = null, view = '';
  var SQ = { q: '', level: 'all', lesson: 'all', status: 'all', fav: false, limit: 50 };

  function parse() {
    var p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (p[0] === 'lv' && LV.indexOf(p[1]) > -1) {
      if (p[2]) { var li = parseInt(p[2], 10) - 1; if (li >= 0 && li < D[p[1]].length) return { v: 'deck', l: p[1], li: li }; }
      return { v: 'lessons', l: p[1] };
    }
    if (p[0] === 'search') return { v: 'search', fav: false };
    if (p[0] === 'fav') return { v: 'search', fav: true };
    return { v: 'home' };
  }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }

  function route() {
    var r = parse();
    closeSheet();
    view = r.v;
    document.body.dataset.lv = r.l || '';
    document.body.classList.toggle('nonav', r.v === 'deck');
    if (r.v !== 'deck') deck = null;
    TG.lockSwipes(r.v === 'deck');
    try {
      if (r.v === 'home') renderHome();
      else if (r.v === 'lessons') renderLessons(r.l);
      else if (r.v === 'deck') renderDeck(r.l, r.li);
      else renderSearch(r.fav);
    } catch (e) { fail(e); }
    renderNav(r);
    TG.setBack(r.v !== 'home', function () { go(r.v === 'deck' ? '#/lv/' + r.l : '#/'); });
    window.scrollTo(0, 0);
  }

  function renderNav(r) {
    var items = [['#/', '⌂', 'Home', r.v === 'home' || r.v === 'lessons'], ['#/search', '⌕', 'Search', r.v === 'search' && !r.fav], ['#/fav', '★', 'Favorites', r.v === 'search' && r.fav]];
    navEl.innerHTML = items.map(function (i) {
      return '<a href="' + i[0] + '" class="' + (i[3] ? 'on' : '') + '"' + (i[3] ? ' aria-current="page"' : '') + '><i aria-hidden="true">' + i[1] + '</i>' + i[2] + '</a>';
    }).join('');
  }

  /* ---------- Home ---------- */
  function continueInfo() {
    var L = S.last;
    if (L && D[L.l] && D[L.l][L.li]) {
      var n = D[L.l][L.li].length;
      return { l: L.l, li: L.li, label: L.l + ' · Lesson ' + pad(num(L.l, L.li)), sub: 'Card ' + (Math.min(L.wi, n - 1) + 1) + ' of ' + n, resume: true };
    }
    return { l: 'N5', li: 0, label: 'N5 · Lesson ' + pad(num('N5', 0)), sub: 'Start from the beginning', resume: false };
  }

  function renderHome() {
    var t = totals(), c = continueInfo(), pc = pct(t.k, t.words);
    app.innerHTML =
      '<div class="brand"><div class="mark" aria-hidden="true">語</div><div><h1>JP Vocabs</h1><p>JLPT N5 &amp; N4 flashcards</p></div></div>' +
      '<section class="hero"><div class="ring" style="--p:' + pc + '" role="img" aria-label="' + pc + ' percent learned"><div><b>' + pc + '%</b><span>learned</span></div></div>' +
      '<div class="hs"><div class="hn">' + fmt(t.words) + '</div><div class="hl">total words</div>' +
      '<div class="hrow"><span><b>' + fmt(t.k) + '</b>words learned</span><span><b>' + t.done + ' / ' + t.lessons + '</b>lessons done</span></div></div></section>' +
      '<button class="cta lv-' + c.l.toLowerCase() + '" data-go="#/lv/' + c.l + '/' + (c.li + 1) + '"><span><b>' + (c.resume ? 'Continue Learning' : 'Start Learning') + '</b><span>' + c.label + ' · ' + c.sub + '</span></span><span class="play" aria-hidden="true">▶</span></button>' +
      LV.map(function (l) {
        var s = levelStat(l);
        return '<a class="lvpanel lv-' + l.toLowerCase() + '" href="#/lv/' + l + '"><span class="wm" aria-hidden="true">' + (l === 'N5' ? '五' : '四') + '</span>' +
          '<div class="t"><span class="seal">' + l + '</span><h2>JLPT ' + l + ' Vocabulary</h2></div><p>' + fmt(s.words) + ' words · ' + s.lessons + ' lessons</p>' +
          '<div class="meter"><i style="width:' + pct(s.k, s.words) + '%"></i></div>' +
          '<div class="meta"><span>' + fmt(s.k) + ' learned · ' + pct(s.k, s.words) + '%</span><span>' + s.done + ' / ' + s.lessons + ' lessons done</span></div></a>';
      }).join('');
  }

  /* ---------- Lesson list ---------- */
  function renderLessons(l) {
    var s = levelStat(l);
    app.innerHTML =
      '<div class="bar-top"><a class="back" href="#/" aria-label="Back to home">‹</a><h1>JLPT ' + l + ' Vocabulary<small>' + fmt(s.words) + ' words · ' + s.done + ' / ' + s.lessons + ' lessons done</small></h1><span class="seal">' + l + '</span></div>' +
      '<div class="tiles">' + D[l].map(function (_, li) {
        var st = lessonStat(l, li);
        var label = st.status === 'done' ? 'Done' : st.status === 'prog' ? pct(st.k, st.n) + '%' : st.n + ' words';
        var aria = 'Lesson ' + pad(num(l, li)) + ', ' + st.n + ' words, ' + (st.status === 'done' ? 'completed' : st.status === 'prog' ? 'in progress' : 'not started');
        return '<a class="tile ' + st.status + '" style="--p:' + pct(st.k, st.n) + '" href="#/lv/' + l + '/' + (li + 1) + '" aria-label="' + aria + '"><span class="tring"><b>' + pad(num(l, li)) + '</b></span><small>' + (st.status === 'new' ? st.n + ' words' : label) + (st.status === 'prog' ? '<br>' + st.n + ' words' : '') + '</small></a>';
      }).join('') + '</div>';
  }

  /* ---------- Flashcards ---------- */
  function renderDeck(l, li) {
    var n = D[l][li].length, key = l + '.' + li;
    if (!deck || deck.l !== l || deck.li !== li) {
      var wi = S.pos[key]; if (!(wi >= 0 && wi < n)) wi = 0;
      deck = { l: l, li: li, order: Array.from({ length: n }, function (_, i) { return i; }), i: wi, only: false, flipped: false };
    }
    drawDeck('');
  }
  function dList() {
    var d = deck; if (!d.only) return d.order;
    return d.order.filter(function (wi) { return !isLearned(d.l, d.li, wi); });
  }
  function dCur() { var L = dList(); return L.length ? L[Math.max(0, Math.min(deck.i, L.length - 1))] : -1; }

  function frontHTML(v) {
    var big = has(v[F.kanji]) ? v[F.kanji] : v[F.word];
    return '<div class="jp ' + sizeClass(big) + '">' + esc(big) + '</div>' + (has(v[F.kanji]) ? '<div class="read">' + esc(v[F.word]) + '</div>' : '');
  }
  function backHTML(v) {
    return '<div class="small-jp">' + esc(has(v[F.kanji]) ? v[F.kanji] + ' · ' + v[F.word] : v[F.word]) + '</div>' +
      (has(v[F.en]) ? '<div class="en">' + esc(v[F.en]) + '</div>' : '') +
      (has(v[F.bn]) ? '<div class="bn">' + esc(v[F.bn]) + '</div>' : '') +
      (has(v[F.pron]) ? '<div class="pron">' + esc(v[F.pron]) + '</div>' : '');
  }

  function drawDeck(dir) {
    var d = deck, l = d.l, li = d.li, key = l + '.' + li, n = D[l][li].length, L = dList(), st = lessonStat(l, li);
    var head = '<div class="bar-top"><a class="back" href="#/lv/' + l + '" aria-label="Back to lessons">‹</a><h1>Lesson ' + pad(num(l, li)) + '<small>JLPT ' + l + ' · ' + n + ' words' + (d.only ? ' · unlearned only' : '') + '</small></h1><button class="back" data-a="menu" aria-label="More options">⋯</button></div>';
    if (!L.length) {
      app.innerHTML = head + '<div class="empty deck"><h2>🎉 All words learned</h2><p>You have marked every word in this lesson as learned.</p>' +
        '<button class="btn main" data-a="showall">Review all cards</button><button class="btn" data-a="restart">Restart lesson</button></div>';
      return;
    }
    d.i = Math.max(0, Math.min(d.i, L.length - 1));
    var wi = L[d.i], v = D[l][li][wi];
    S.pos[key] = wi; S.last = { l: l, li: li, wi: wi }; save();
    var tools = '<span class="tools"><button class="ic icf" data-a="fav" aria-label="Favorite">☆</button><button class="ic" data-a="say" aria-label="Listen">🔊</button></span>';
    app.innerHTML = head + '<div class="deck lv-' + l.toLowerCase() + '">' +
      '<div class="deckbar"><span>Card <b>' + (d.i + 1) + '</b> / ' + L.length + '</span><span id="lc">' + st.k + ' / ' + n + ' learned</span></div>' +
      '<div class="meter" role="progressbar" aria-label="Position in lesson" aria-valuenow="' + (d.i + 1) + '" aria-valuemin="1" aria-valuemax="' + L.length + '"><i style="width:' + ((d.i + 1) / L.length * 100) + '%"></i></div>' +
      '<div class="stage ' + (d.flipped ? 'flipped ' : '') + (dir ? 'in-' + dir : '') + '" id="stage" role="button" tabindex="0" aria-label="Flashcard. Tap to flip, swipe to change card."><div class="drag"><div class="flip3">' +
      '<div class="face front"><span class="corner seal">' + l + '</span>' + tools + frontHTML(v) + '<span class="hint">Tap to flip · swipe for next</span></div>' +
      '<div class="face rear"><span class="corner seal">' + l + '</span>' + tools + backHTML(v) + '</div></div></div></div>' +
      '<div class="controls"><button class="btn" data-a="prev" aria-label="Previous card"><span class="ar">‹</span></button><button class="btn learned" id="bl" data-a="learn"></button><button class="btn main" data-a="next" aria-label="Next card"><span class="ar">›</span></button></div></div>';
    syncMarks();
  }

  function syncMarks() {
    var d = deck, wi = dCur(); if (wi < 0) return;
    var ln = isLearned(d.l, d.li, wi), fv = isFav(d.l, d.li, wi), st = lessonStat(d.l, d.li);
    var bl = $('#bl'); if (!bl) return;
    bl.classList.toggle('on', ln); bl.textContent = ln ? '✓ Learned' : 'Mark learned';
    bl.setAttribute('aria-pressed', ln);
    document.querySelectorAll('.icf').forEach(function (b) { b.classList.toggle('on', fv); b.textContent = fv ? '★' : '☆'; b.setAttribute('aria-pressed', fv); });
    $('#lc').textContent = st.k + ' / ' + st.n + ' learned';
  }

  function step(dx) {
    var L = dList(); if (!L.length) return;
    deck.i = (deck.i + dx + L.length) % L.length; deck.flipped = false;
    TG.haptic('light'); drawDeck(dx > 0 ? 'next' : 'prev');
  }
  function flip() {
    var s = $('#stage'); if (!s) return;
    deck.flipped = !deck.flipped; s.classList.remove('in-next', 'in-prev'); s.classList.toggle('flipped', deck.flipped);
    TG.haptic('light');
  }
  function deckAction(a) {
    var d = deck; if (!d) return;
    var wi = dCur(), l = d.l, li = d.li;
    if (a === 'next') step(1);
    else if (a === 'prev') step(-1);
    else if (a === 'flip') flip();
    else if (a === 'learn' && wi >= 0) {
      var k = wid(li, wi), was = !!S.learned[l][k];
      if (was) delete S.learned[l][k]; else S.learned[l][k] = 1;
      save();
      if (!was) {
        TG.haptic('success');
        if (lessonStat(l, li).status === 'done') { toast('🎉 Lesson ' + pad(num(l, li)) + ' completed'); drawDeck('next'); return; }
        if (d.only) { d.flipped = false; drawDeck('next'); return; }   // card leaves the unlearned list
        step(1); return;
      }
      syncMarks();
    }
    else if (a === 'fav' && wi >= 0) {
      var k2 = wid(li, wi);
      if (S.fav[l][k2]) delete S.fav[l][k2]; else S.fav[l][k2] = 1;
      save(); TG.haptic('light'); syncMarks(); toast(S.fav[l][k2] ? 'Added to favorites' : 'Removed from favorites');
    }
    else if (a === 'shuf') { d.order = shuffle(d.order); d.i = 0; d.flipped = false; toast('Cards shuffled'); TG.haptic('medium'); drawDeck('next'); }
    else if (a === 'only') { d.only = !d.only; d.i = 0; d.flipped = false; drawDeck(''); }
    else if (a === 'showall') { d.only = false; d.i = 0; drawDeck(''); }
    else if (a === 'say' && wi >= 0) speak(D[l][li][wi][F.word]);
    else if (a === 'menu') {
      openSheet('<h3>Lesson ' + pad(num(l, li)) + '</h3>' +
        '<button class="btn" data-s="shuf">🔀 Shuffle cards</button>' +
        '<button class="btn" data-s="only">' + (d.only ? '📚 Show all cards' : '🎯 Unlearned only') + '</button>' +
        '<button class="btn" data-s="ask">↺ Restart lesson</button>' +
        '<button class="btn" data-s="cancel">Close</button>');
    }
    else if (a === 'restart') askRestart();
  }
  function askRestart() {
    var d = deck;
    openSheet('<h3>Restart Lesson ' + pad(num(d.l, d.li)) + '?</h3><p>Go back to the first card in the original order.</p>' +
      '<button class="btn main" data-s="restart-keep">Restart, keep learned marks</button>' +
      '<button class="btn danger" data-s="restart-clear">Restart and clear learned marks</button>' +
      '<button class="btn" data-s="cancel">Cancel</button>');
  }
  function sheetAction(a) {
    var d = deck;
    if (a === 'cancel' || !d) { closeSheet(); return; }
    if (a === 'shuf' || a === 'only') { closeSheet(); deckAction(a); return; }
    if (a === 'ask') { askRestart(); return; }
    if (a === 'restart-clear') { for (var i = 0; i < D[d.l][d.li].length; i++) delete S.learned[d.l][wid(d.li, i)]; save(); }
    d.order = Array.from({ length: D[d.l][d.li].length }, function (_, i) { return i; });
    d.i = 0; d.only = false; d.flipped = false;
    closeSheet(); drawDeck(''); toast('Lesson restarted');
  }

  /* touch: the card follows the finger, flies off past the threshold, springs back otherwise */
  var tx = 0, ty = 0, dx = 0, dragging = false, swiped = false;
  app.addEventListener('touchstart', function (e) {
    if (view !== 'deck' || !e.target.closest('#stage') || e.target.closest('.tools')) return;
    var t = e.touches[0]; tx = t.clientX; ty = t.clientY; dx = 0; dragging = false; swiped = false;
    var dr = $('.drag'); if (dr) dr.classList.remove('snap', 'fly');
  }, { passive: true });
  app.addEventListener('touchmove', function (e) {
    if (view !== 'deck' || !$('#stage') || !tx) return;
    var t = e.touches[0], mx = t.clientX - tx, my = t.clientY - ty;
    if (!dragging && Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.2) dragging = true;
    if (dragging) { dx = mx; var dr = $('.drag'); if (dr) dr.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 20 + 'deg)'; }
  }, { passive: true });
  function endTouch() {
    var dr = $('.drag'), was = dragging, d = dx; tx = 0; dragging = false;
    if (!dr || !was) return;
    swiped = true; setTimeout(function () { swiped = false; }, 400);
    if (Math.abs(d) > 90) {
      dr.classList.add('fly'); dr.style.transform = 'translateX(' + (d < 0 ? -130 : 130) + '%) rotate(' + (d < 0 ? -18 : 18) + 'deg)'; dr.style.opacity = '0';
      setTimeout(function () { step(d < 0 ? 1 : -1); }, 190);
    } else { dr.classList.add('snap'); dr.style.transform = ''; }
  }
  app.addEventListener('touchend', endTouch);
  app.addEventListener('touchcancel', endTouch);

  /* ripple on every press */
  var RIP = '.btn,.chip,.tile,.lvpanel,.cta,.res,.back,.ic,.nav a';
  function ripple(el, x, y, cls) {
    var r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, sp = document.createElement('span');
    sp.className = 'rp ' + (cls || ''); sp.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (x - s / 2) + 'px;top:' + (y - s / 2) + 'px';
    el.appendChild(sp); setTimeout(function () { sp.remove(); }, 650);
  }
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest(RIP);
    if (el) { var r = el.getBoundingClientRect(); ripple(el, e.clientX - r.left, e.clientY - r.top); TG.haptic('light'); return; }
    var st = e.target.closest('#stage');
    if (st) {
      var face = st.querySelector(deck && deck.flipped ? '.face.rear' : '.face.front'), fr = st.getBoundingClientRect(), x = e.clientX - fr.left;
      if (face) ripple(face, deck && deck.flipped ? fr.width - x : x, e.clientY - fr.top, 'acc');
    }
  }, { passive: true });

  /* ---------- Search / Favorites ---------- */
  var norm = function (s) { return String(s == null ? '' : s).normalize('NFKC').toLowerCase(); };

  function renderSearch(fav) {
    if (SQ.fav !== fav) { SQ.fav = fav; SQ.limit = 50; }
    var title = fav ? 'Favorites' : 'Search';
    var lessonOpts = '<option value="all">All lessons</option>';
    if (SQ.level !== 'all') D[SQ.level].forEach(function (_, li) { lessonOpts += '<option value="' + li + '"' + (String(SQ.lesson) === String(li) ? ' selected' : '') + '>Lesson ' + pad(num(SQ.level, li)) + '</option>'; });
    app.innerHTML =
      '<div class="bar-top"><a class="back" href="#/" aria-label="Back to home">‹</a><h1>' + title + '<small>' + (fav ? 'Words you starred' : 'Japanese, reading, Bangla or English') + '</small></h1></div>' +
      '<input class="search" id="q" type="search" placeholder="Search words…" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(SQ.q) + '" aria-label="Search words">' +
      '<div class="filters">' +
      '<select class="sel" id="fl" aria-label="Level"><option value="all">N5 + N4</option>' + LV.map(function (l) { return '<option value="' + l + '"' + (SQ.level === l ? ' selected' : '') + '>JLPT ' + l + '</option>'; }).join('') + '</select>' +
      '<select class="sel" id="fs" aria-label="Lesson"' + (SQ.level === 'all' ? ' disabled' : '') + '>' + lessonOpts + '</select>' +
      '<select class="sel" id="ft" aria-label="Status"><option value="all">Learned + unlearned</option><option value="learned"' + (SQ.status === 'learned' ? ' selected' : '') + '>Learned only</option><option value="unlearned"' + (SQ.status === 'unlearned' ? ' selected' : '') + '>Unlearned only</option></select>' +
      '<button class="chip ' + (SQ.fav ? 'on' : '') + '" id="ff" aria-pressed="' + SQ.fav + '" style="justify-content:center">★ Favorites only</button></div>' +
      '<div class="count" id="cnt"></div><div class="results" id="res"></div>';
    var qi = $('#q');
    var t; qi.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { SQ.q = qi.value; SQ.limit = 50; drawResults(); }, 120); });
    $('#fl').onchange = function (e) { SQ.level = e.target.value; SQ.lesson = 'all'; SQ.limit = 50; var q = SQ.q; renderSearch(SQ.fav); SQ.q = q; };
    $('#fs').onchange = function (e) { SQ.lesson = e.target.value; SQ.limit = 50; drawResults(); };
    $('#ft').onchange = function (e) { SQ.status = e.target.value; SQ.limit = 50; drawResults(); };
    $('#ff').onclick = function () { SQ.fav = !SQ.fav; SQ.limit = 50; $('#ff').classList.toggle('on', SQ.fav); $('#ff').setAttribute('aria-pressed', SQ.fav); drawResults(); };
    drawResults();
  }

  function drawResults() {
    var q = norm(SQ.q.trim()), out = [];
    LV.forEach(function (l) {
      if (SQ.level !== 'all' && SQ.level !== l) return;
      D[l].forEach(function (les, li) {
        if (SQ.lesson !== 'all' && String(SQ.lesson) !== String(li)) return;
        les.forEach(function (v, wi) {
          var ln = isLearned(l, li, wi), fv = isFav(l, li, wi);
          if (SQ.fav && !fv) return;
          if (SQ.status === 'learned' && !ln) return;
          if (SQ.status === 'unlearned' && ln) return;
          if (q && !v.some(function (x) { return norm(x).indexOf(q) > -1; })) return;
          out.push({ l: l, li: li, wi: wi, v: v, ln: ln, fv: fv });
        });
      });
    });
    $('#cnt').textContent = out.length + (out.length === 1 ? ' word' : ' words');
    var shown = out.slice(0, SQ.limit);
    $('#res').innerHTML = shown.length ? shown.map(function (r) {
      var v = r.v, big = has(v[F.kanji]) ? v[F.kanji] : v[F.word];
      return '<button class="res lv-' + r.l.toLowerCase() + '" data-open="' + r.l + '.' + r.li + '.' + r.wi + '"><div class="w">' + esc(big) + (has(v[F.kanji]) ? '<small>' + esc(v[F.word]) + '</small>' : '') + '</div>' +
        '<div class="m"><p>' + esc(v[F.en]) + '</p><p>' + esc(v[F.bn]) + '</p></div>' +
        '<div class="side"><span>' + r.l + ' · L' + pad(num(r.l, r.li)) + '</span><span>' + (r.fv ? '<span class="st">★</span>' : '') + (r.ln ? '<span class="ok">✓</span>' : '') + '</span></div></button>';
    }).join('') + (out.length > shown.length ? '<button class="btn more" data-more="1">Show more</button>' : '')
      : '<div class="empty"><h2>' + (SQ.fav && !q ? 'No favorites yet' : 'No match found') + '</h2><p>' + (SQ.fav && !q ? 'Tap ☆ Favorite on a flashcard to save words here.' : 'Try a different word or clear the filters.') + '</p></div>';
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var g = t.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
    var s = t.closest('[data-s]'); if (s) { sheetAction(s.dataset.s); return; }
    if (t.id === 'sheet') { closeSheet(); return; }
    var o = t.closest('[data-open]');
    if (o) {
      var p = o.dataset.open.split('.'), l = p[0], li = +p[1], wi = +p[2];
      S.pos[l + '.' + li] = wi; save(); deck = null; go('#/lv/' + l + '/' + (li + 1)); return;
    }
    if (t.closest('[data-more]')) { SQ.limit += 50; drawResults(); return; }
    if (view !== 'deck') return;
    var b = t.closest('[data-a]'); if (b) { deckAction(b.dataset.a); return; }
    if (t.closest('#stage')) { if (swiped) { swiped = false; return; } flip(); }
  });
  document.addEventListener('keydown', function (e) {
    if (view !== 'deck' || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') deckAction('next');
    else if (e.key === 'ArrowLeft') deckAction('prev');
    else if (e.key === ' ' || e.key === 'Enter') { if (!e.target.closest('button,a')) { e.preventDefault(); flip(); } }
    else if (e.key === 'Escape') closeSheet();
  });
  window.addEventListener('hashchange', route);

  /* ---------- error handling ---------- */
  var failed = false;
  function fail(err) {
    try { console.error(err); } catch (e) {}
    if (failed) return; failed = true;
    app.innerHTML = '<div class="errbox"><p><b>Something went wrong.</b></p><p>Your progress is safe. Please try again.</p><button class="btn main" id="reload" style="margin:auto">Reload</button></div>';
    var r = $('#reload'); if (r) r.onclick = function () { failed = false; location.hash = '#/'; location.reload(); };
  }
  window.addEventListener('error', function (e) { fail(e.error || e.message); });
  window.addEventListener('unhandledrejection', function (e) { fail(e.reason); });

  /* ---------- boot ---------- */
  try {
    TG.init();
    if (!D || !D.N5 || !D.N4) throw new Error('Vocabulary data failed to load');
    route();
  } catch (e) { fail(e); }
})();
