/**
 * shared.js — Shared app state, utilities, navigation
 * No secrets here. All sensitive data flows through api.js → backend.
 */

/* ── App State ────────────────────────────────────────────────── */
let user = null;       // { no, first, last, role }
let isAdmin = false;
let STUDENTS = [];     // loaded from backend (no passwords)

/* ── Zone config ─────────────────────────────────────────────── */
const ZONE_COLORS = {
  sci:'#4ecdc4', math:'#a78bfa', eng:'#fbbf24',
  soc:'#ec4899', hist:'#f97316', comp:'#10b981'
};
const ZONE_ICONS = {
  sci:'ti-flask', math:'ti-math-function', eng:'ti-world',
  soc:'ti-users',  hist:'ti-history',      comp:'ti-device-laptop'
};
const ZONE_THAI = {
  sci:'วิทยาศาสตร์', math:'คณิตศาสตร์', eng:'ภาษาอังกฤษ',
  soc:'สังคมศึกษา',  hist:'ประวัติศาสตร์', comp:'คอมพิวเตอร์'
};
const ZONE_EN = {
  sci:'Science Lab', math:'Math Realm', eng:'Language World',
  soc:'Society Hub', hist:'Time Archive', comp:'Tech Nexus'
};
const ZONE_ORDER = {
  sci:'ZONE 01', math:'ZONE 02', eng:'ZONE 03',
  soc:'ZONE 04', hist:'ZONE 05', comp:'ZONE 06'
};
const ZONE_KEYS = ['sci','math','eng','soc','hist','comp'];

/* ── Ranks ───────────────────────────────────────────────────── */
const RANKS = [
  [0,'Novice'],[50,'Learner'],[150,'Student'],
  [300,'Scholar'],[600,'Expert'],[1000,'Master']
];

function getRank(xp) {
  let rank = RANKS[0][1], lv = 1, nextXP = RANKS[1][0];
  for (let i = RANKS.length-1; i >= 0; i--) {
    if (xp >= RANKS[i][0]) {
      rank  = RANKS[i][1];
      lv    = i + 1;
      nextXP = (RANKS[i+1] || RANKS[RANKS.length-1])[0];
      break;
    }
  }
  return { rank, lv, nextXP };
}

/* ── Utilities ───────────────────────────────────────────────── */
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
         .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000)   return 'เมื่อกี้';
  if (d < 3600000) return Math.floor(d/60000) + ' นาทีที่แล้ว';
  if (d < 86400000)return Math.floor(d/3600000) + ' ชั่วโมงที่แล้ว';
  return Math.floor(d/86400000) + ' วันที่แล้ว';
}

function getDisplayName(no) {
  return localStorage.getItem('dn_' + no) || '';
}

function getProfilePic(no) {
  return localStorage.getItem('pic_' + no) || null;
}

function avatarContent(no, fallback) {
  const pic = getProfilePic(no);
  const name = getDisplayName(no) || fallback || '?';
  if (pic) return `<img src="${pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  return name.charAt(0).toUpperCase();
}

/* ── Toast ───────────────────────────────────────────────────── */
let _toastTimer;
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.className = '', 3200);
}

/* ── Page Navigation ─────────────────────────────────────────── */
function goPage(name) {
  // Map page names to HTML files
  const pages = {
    lobby:     '/lobby.html',
    library:   '/library.html',
    community: '/community.html',
    settings:  '/settings.html',
    admin:     '/admin.html',
  };
  if (pages[name]) window.location.href = pages[name];
}

/* ── Auth init (call on each protected page) ─────────────────── */
async function initAuth() {
  user = await API.getMe();
  if (!user) {
    window.location.href = '/?reason=auth';
    return false;
  }
  isAdmin = user.role === 'admin';

  // Load students list (no passwords)
  try { STUDENTS = await API.getStudents(); } catch {}

  // Update navbar
  updateNavbar();
  return true;
}

function updateNavbar() {
  const el = document.getElementById('navAva');
  if (!el || !user) return;
  const dn  = getDisplayName(user.no) || user.first;
  const pic = getProfilePic(user.no);
  if (pic) {
    el.innerHTML = `<img src="${pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    el.textContent = dn.charAt(0).toUpperCase();
  }
  const nameEl = document.getElementById('navUserName');
  if (nameEl) nameEl.textContent = 'เลขที่ ' + user.no;
  // Show admin badge
  const admBadge = document.getElementById('navAdminBadge');
  if (admBadge) admBadge.style.display = isAdmin ? 'inline' : 'none';
  // Show admin burger item
  const bmAdmin = document.getElementById('bm-admin');
  if (bmAdmin) bmAdmin.style.display = isAdmin ? 'flex' : 'none';
}

/* ── Burger menu ─────────────────────────────────────────────── */
function toggleBurger() {
  document.getElementById('burgerMenu')?.classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#burgerMenu') && !e.target.closest('#burgerBtn')) {
    document.getElementById('burgerMenu')?.classList.remove('open');
  }
});

/* ── Settings helpers ────────────────────────────────────────── */
function applySettings() {
  const theme = localStorage.getItem('theme') || 'dark';
  const style = localStorage.getItem('btnStyle') || 'solid';
  const lite  = localStorage.getItem('liteMode') === '1';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-style', style);
  document.documentElement.setAttribute('data-lite', lite ? '1' : '0');
}

applySettings(); // apply immediately on load

/* ── Progress tracking ───────────────────────────────────────── */
function getWatched(no, subj) {
  return JSON.parse(localStorage.getItem('pw_' + no + '_' + subj) || '[]');
}
function getDone(no, subj) {
  return JSON.parse(localStorage.getItem('pq_' + no + '_' + subj) || '[]');
}
function markWatched(no, subj, vidId) {
  const w = getWatched(no, subj);
  if (!w.includes(vidId)) { w.push(vidId); localStorage.setItem('pw_' + no + '_' + subj, JSON.stringify(w)); }
}
function markDone(no, subj, quizId) {
  const d = getDone(no, subj);
  if (!d.includes(quizId)) { d.push(quizId); localStorage.setItem('pq_' + no + '_' + subj, JSON.stringify(d)); }
}
