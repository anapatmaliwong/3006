/**
 * lobby.js — Lobby page logic
 * Uses api.js (backend) for all data. No Firebase/secrets here.
 */

let bannerSlides = [];
let bannerIdx = 0;
let bannerTimer = null;
let lobbyCardsData = {};
let xpData = {};

/* ── Init ────────────────────────────────────────────────────── */
(async function() {
  if (!await initAuth()) return;

  if (isAdmin) {
    document.getElementById('adminLobbyActions').style.display = 'flex';
    document.getElementById('adminBannerBtn').style.display = 'block';
  }

  await Promise.all([
    loadBanners(),
    loadBriefs(),
    loadXP(),
    loadLobbyCards(),
  ]);

  updateLobbyCard();
  updateProgressGrid();
})();

/* ── Banners ─────────────────────────────────────────────────── */
async function loadBanners() {
  try {
    const data = await API.getBanners();
    bannerSlides = (data && data.urls) || [];
  } catch { bannerSlides = []; }
  renderBanner();
}

function renderBanner() {
  const wrap = document.getElementById('bannerSlides');
  const dots  = document.getElementById('bannerDots');
  clearInterval(bannerTimer);

  if (!bannerSlides.length) {
    wrap.innerHTML = '<div class="slide active slide-default"><div class="slide-default-txt">3006</div></div>';
    dots.innerHTML = '<div class="sdot on"></div>';
    return;
  }

  wrap.innerHTML = bannerSlides.map((url,i) =>
    `<div class="slide${i===0?' active':''}" style="background-image:url('${url}')"></div>`
  ).join('');
  dots.innerHTML = bannerSlides.map((_,i) =>
    `<div class="sdot${i===0?' on':''}" onclick="goSlide(${i})"></div>`
  ).join('');

  if (bannerSlides.length > 1) bannerTimer = setInterval(() => slideMove(1), 5000);
}

function slideMove(d) {
  const slides = document.querySelectorAll('#bannerSlides .slide');
  const sdots  = document.querySelectorAll('#bannerDots .sdot');
  if (!slides.length) return;
  slides[bannerIdx].classList.remove('active');
  if (sdots[bannerIdx]) sdots[bannerIdx].classList.remove('on');
  bannerIdx = (bannerIdx + d + slides.length) % slides.length;
  slides[bannerIdx].classList.add('active');
  if (sdots[bannerIdx]) sdots[bannerIdx].classList.add('on');
}
function bannerPrev() { slideMove(-1); }
function bannerNext() { slideMove(1); }
function goSlide(i) {
  const slides = document.querySelectorAll('#bannerSlides .slide');
  const sdots  = document.querySelectorAll('#bannerDots .sdot');
  slides[bannerIdx].classList.remove('active');
  if (sdots[bannerIdx]) sdots[bannerIdx].classList.remove('on');
  bannerIdx = i;
  slides[bannerIdx].classList.add('active');
  if (sdots[bannerIdx]) sdots[bannerIdx].classList.add('on');
}

/* ── Admin: Banner upload ────────────────────────────────────── */
function openBannerModal() {
  // simple prompt for now — full modal can be added
  const url = prompt('วาง URL รูปภาพ:');
  if (!url) return;
  bannerSlides.push(url);
  API.setBanners({ urls: bannerSlides }).then(() => {
    renderBanner(); toast('✅ เพิ่ม Banner แล้ว');
  }).catch(e => toast('Error: ' + e.message, 'err'));
}
function closeBannerModal() {}

/* ── Briefs (announcements) ──────────────────────────────────── */
async function loadBriefs() {
  try {
    const briefs = await API.getBriefs();
    renderBriefs(briefs);
    document.getElementById('briefCount').textContent = Array.isArray(briefs) ? briefs.length : 0;
  } catch { document.getElementById('briefList').innerHTML = '<div class="brief-empty">โหลดไม่ได้</div>'; }
}

function renderBriefs(briefs) {
  const el = document.getElementById('briefList');
  if (!Array.isArray(briefs) || !briefs.length) {
    el.innerHTML = '<div class="brief-empty">ยังไม่มีประกาศ</div>'; return;
  }
  const sorted = briefs.sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0) || b.ts - a.ts);
  el.innerHTML = sorted.map(n => {
    const expEl = n.expiresAt
      ? `<span style="font-size:.68rem;color:var(--warn)">⏰ ${new Date(n.expiresAt).toLocaleDateString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>`
      : '';
    return `<div class="brief-card${n.pinned?' pinned':''}">
      <div class="brief-card-top">
        <div>
          <div class="brief-title">${n.pinned?'📌 ':''}${esc(n.title)}</div>
          <div class="brief-body">${esc(n.body)}</div>
          <div class="brief-meta">${esc(n.author)} · ${timeAgo(n.ts)} ${expEl}</div>
        </div>
        <span class="brief-tag ${n.tag||'info'}">${{info:'📘 ข้อมูล',warn:'⚠️ สำคัญ',em:'✅ ดีงาม'}[n.tag]||'📘'}</span>
      </div>
      ${isAdmin?`<button class="brief-del-btn" data-id="${n.id}" onclick="deleteBriefItem(this.dataset.id)">🗑</button>`:''}
    </div>`;
  }).join('');
}

function deleteBriefItem(id) {
  API.deleteBrief(id).then(() => { toast('ลบประกาศแล้ว'); loadBriefs(); })
     .catch(e => toast('Error: ' + e.message, 'err'));
}

function openBriefModal() {
  const title = prompt('หัวข้อประกาศ:'); if (!title) return;
  const body  = prompt('เนื้อหา:');       if (!body) return;
  const tag   = prompt('ประเภท (info/warn/em):', 'info') || 'info';
  const expRaw = prompt('วันหมดอายุ (เว้นว่าง = ไม่หมดอายุ)\nFormat: 2025-06-30T10:00', '');
  const expiresAt = expRaw ? new Date(expRaw).getTime() : null;
  API.postBrief(title, body, tag, expiresAt)
     .then(() => { toast('✅ โพสต์ประกาศแล้ว'); loadBriefs(); })
     .catch(e => toast('Error: ' + e.message, 'err'));
}

/* ── XP ──────────────────────────────────────────────────────── */
async function loadXP() {
  try { xpData = await API.getXP(); }
  catch { xpData = {}; }
  updateLobbyCard();
}

function updateLobbyCard() {
  if (!user) return;
  const myXP = (xpData['u'+user.no] || {}).xp || 0;
  const { rank, lv, nextXP } = getRank(myXP);
  const dn = getDisplayName(user.no) || user.first;
  const pct = Math.min(100, Math.round(myXP/nextXP*100));

  document.getElementById('lpcName').textContent = dn;
  document.getElementById('lpcRank').textContent = rank + ' · Lv.' + lv;
  document.getElementById('lpcXP').textContent   = myXP;
  document.getElementById('lpcXPMax').textContent= nextXP;
  document.getElementById('lpcXPFill').style.width = pct + '%';
  document.getElementById('lpcTotal').textContent = myXP;

  // Profile pic
  const ava = document.getElementById('lpcAva');
  const pic = getProfilePic(user.no);
  if (ava) ava.innerHTML = pic ? `<img src="${pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : dn.charAt(0);

  // Stats (from localStorage)
  let vW = 0, qD = 0;
  ZONE_KEYS.forEach(k => {
    vW += getWatched(user.no, k).length;
    qD += getDone(user.no, k).length;
  });
  document.getElementById('lpcVid').textContent  = vW;
  document.getElementById('lpcQuiz').textContent = qD;
}

/* ── Progress Grid ───────────────────────────────────────────── */
async function updateProgressGrid() {
  const el = document.getElementById('progressGrid'); if (!el) return;

  // Load counts from backend
  const counts = {};
  await Promise.all(ZONE_KEYS.map(async k => {
    try { counts[k] = await API.getSubject(k); }
    catch { counts[k] = { videos:[], quizzes:[] }; }
  }));

  el.innerHTML = ZONE_KEYS.map(k => {
    const d = counts[k] || {};
    const vids = (d.videos||[]).length;
    const quiz = (d.quizzes||[]).length;
    let vPct = 0, qPct = 0;
    if (user) {
      vPct = vids ? Math.min(100, Math.round(getWatched(user.no, k).length / vids * 100)) : 0;
      qPct = quiz ? Math.min(100, Math.round(getDone(user.no, k).length   / quiz * 100)) : 0;
    }
    const color = ZONE_COLORS[k];
    const icon  = ZONE_ICONS[k];
    const name  = ZONE_THAI[k];
    return `<div class="lv3-prog-card s-${k}" onclick="goToZone('${k}')" title="${name}">
      <i class="ti ${icon}" style="color:${color};font-size:1.6rem;display:block;margin-bottom:8px"></i>
      <div class="lpc-subj-name">${name}</div>
      <div class="lpc-prog-bars">
        <div class="lpc-prog-row">
          <div class="lpc-prog-label" style="color:${color}">VID</div>
          <div class="lpc-prog-track"><div class="lpc-prog-fill-v" style="width:${vPct}%;background:${color}"></div></div>
          <div class="lpc-prog-pct">${vPct}%</div>
        </div>
        <div class="lpc-prog-row">
          <div class="lpc-prog-label" style="color:#8b5cf6">QZ</div>
          <div class="lpc-prog-track"><div class="lpc-prog-fill-q" style="width:${qPct}%"></div></div>
          <div class="lpc-prog-pct">${qPct}%</div>
        </div>
      </div>
      <div style="text-align:right;font-size:.58rem;color:var(--tx3);margin-top:6px">TAP →</div>
    </div>`;
  }).join('');
}

function goToZone(s) {
  sessionStorage.setItem('openZone', s);
  window.location.href = '/library.html';
}

/* ── Lobby Custom Cards ──────────────────────────────────────── */
async function loadLobbyCards() {
  try { lobbyCardsData = await API.getLobbyCards(); }
  catch { lobbyCardsData = {}; }
  renderLobbyCustomCards();
}

function renderLobbyCustomCards() {
  const el = document.getElementById('lobbyCustomSection'); if (!el) return;
  const cards = Object.values(lobbyCardsData).sort((a,b)=>(a.order||0)-(b.order||0));
  if (!cards.length) { el.innerHTML=''; return; }
  const cardsHtml = cards.map(c => {
    const bg = c.color ? ('background:'+c.color+';') : '';
    const btnHtml = c.button && c.button.label
      ? `<button class="lcc-btn" data-cardid="${c.id}" onclick="handleCardBtn(this.dataset.cardid)">${esc(c.button.label)} →</button>`
      : '';
    return `<div class="lobby-custom-card width-${c.width||'full'}" style="${bg}">
      <div class="lcc-title">${esc(c.title||'')}</div>
      <div class="lcc-body">${c.body||''}</div>
      ${btnHtml}
    </div>`;
  }).join('');
  el.innerHTML = `<div class="lv5-sect"><div class="lv5-sect-hd"><i class="ti ti-layout lv5-sect-ic" style="color:#a78bfa"></i><span class="lv5-sect-title">ข้อมูลและลิงก์</span></div><div class="lobby-custom-grid">${cardsHtml}</div></div>`;
}

function handleCardBtn(id) {
  const c = lobbyCardsData[id]; if (!c||!c.button) return;
  const action = c.button.action || '';
  if (action.startsWith('page:')) goPage(action.replace('page:',''));
  else if (action.startsWith('zone:')) { sessionStorage.setItem('openZone', action.replace('zone:','')); window.location.href='/library.html'; }
  else if (action==='url' && c.button.url) window.open(c.button.url,'_blank');
}

function openLobbyEditor() {
  toast('Lobby editor — coming soon. ใช้ Admin Panel ได้เลย', 'info');
}

/* ── Profile pic upload ──────────────────────────────────────── */
function uploadProfilePic(input) {
  if (!input.files||!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    localStorage.setItem('pic_'+user.no, e.target.result);
    updateLobbyCard();
    updateNavbar();
    toast('✅ เปลี่ยนรูปโปรไฟล์แล้ว');
  };
  reader.readAsDataURL(input.files[0]);
}
