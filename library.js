/**
 * library.js — Library page: zones, episodes, quests, XP
 */

let subj = null;
let currentSubjectData = null;
let curQuiz = null;
let qIdx = 0, qOk = 0, qfsXP = 0, qfsCombo = 0;
let qfsTimerInt = null, qfsTimerLeft = 30;
let qMode = { diff:'easy', speed:'chill' };
let pendingQuizId = null;
let aqParsed = [];
let xpDataLib = {};

/* ── Init ────────────────────────────────────────────────────── */
(async function() {
  if (!await initAuth()) return;

  // Load XP
  try { xpDataLib = await API.getXP(); } catch {}
  updateHUD();
  renderDramaLB();
  renderZoneGrid();

  // Auto-open zone if navigated from lobby
  const pendingZone = sessionStorage.getItem('openZone');
  if (pendingZone) {
    sessionStorage.removeItem('openZone');
    setTimeout(() => openSubject(pendingZone), 300);
  }
})();

/* ── HUD ─────────────────────────────────────────────────────── */
function updateHUD() {
  if (!user) return;
  const myXP = (xpDataLib['u'+user.no]||{}).xp||0;
  const { rank, lv, nextXP } = getRank(myXP);
  const pct = Math.min(100, Math.round(myXP/nextXP*100));
  const dn  = getDisplayName(user.no)||user.first;

  ['hudAva','hudName','hudRank','hudXP','hudXPMax','hudXPFill'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    if (id==='hudAva')    { const pic=getProfilePic(user.no); el.innerHTML=pic?`<img src="${pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`  :dn.charAt(0); }
    else if (id==='hudName')  el.textContent = dn;
    else if (id==='hudRank')  el.textContent = rank+' · Lv.'+lv;
    else if (id==='hudXP')    el.textContent = myXP;
    else if (id==='hudXPMax') el.textContent = nextXP;
    else if (id==='hudXPFill')el.style.width = pct+'%';
  });

  let vW=0,qD=0,zDone=0;
  ZONE_KEYS.forEach(k => {
    vW += getWatched(user.no,k).length;
    qD += getDone(user.no,k).length;
  });
  document.getElementById('hudTotalVid')&&(document.getElementById('hudTotalVid').textContent=vW);
  document.getElementById('hudTotalQuiz')&&(document.getElementById('hudTotalQuiz').textContent=qD);
  document.getElementById('hudStreak')&&(document.getElementById('hudStreak').textContent=zDone);
}

/* ── Zone Grid ───────────────────────────────────────────────── */
function renderZoneGrid() {
  const el = document.getElementById('zoneGrid'); if (!el) return;
  el.innerHTML = ZONE_KEYS.map((k,i) => {
    const color = ZONE_COLORS[k];
    const icon  = ZONE_ICONS[k];
    const name  = ZONE_THAI[k];
    const en    = ZONE_EN[k];
    return `<div class="gzone-card ${k}-zone" onclick="openSubject('${k}')">
      <div class="gz-glow"></div>
      <div class="gz-corner-badge">ZONE 0${i+1}</div>
      <div class="gz-icon-wrap"><i class="ti ${icon} gz-icon" style="color:${color}"></i></div>
      <div class="gz-subject">${name}</div>
      <div class="gz-subtitle">${en}</div>
      <div class="gz-xp-wrap">
        <div class="gz-xp-bar"><div class="gz-xp-fill" id="gxp-${k}"></div></div>
        <div class="gz-xp-pct" id="gpct-${k}">—</div>
      </div>
      <div class="gz-meta">
        <span class="gz-meta-item" id="cnt-${k}">— vid</span>
        <span class="gz-meta-item" id="cnt-${k}-q">— quiz</span>
      </div>
      <div class="gz-enter-btn">ENTER →</div>
    </div>`;
  }).join('');
}

/* ── Open Subject ────────────────────────────────────────────── */
async function openSubject(s) {
  subj = s;
  const color = ZONE_COLORS[s];
  const icon  = ZONE_ICONS[s];
  const name  = ZONE_THAI[s];
  const en    = ZONE_EN[s];
  const order = ZONE_ORDER[s];

  // Show loader
  showZoneLoader(s, async () => {
    // Fetch data from backend
    try {
      currentSubjectData = await API.getSubject(s);
    } catch { currentSubjectData = { videos:[], quizzes:[] }; }

    const vCount = (currentSubjectData.videos||[]).length;
    const qCount = (currentSubjectData.quizzes||[]).length;

    // Build modal header
    const overlay = document.getElementById('overlay');
    overlay.style.setProperty('--zone-color', color);
    const mhd = document.querySelector('.modal-hd');
    if (mhd) {
      mhd.style.setProperty('--zone-header-bg', `linear-gradient(135deg,#060e0e,#0d1a18)`);
      mhd.innerHTML = `
        <div class="zone-hero-row">
          <div class="zone-hero-icon-box" style="box-shadow:0 0 30px ${color}44">
            <i class="ti ${icon}" style="color:${color};font-size:1.8rem"></i>
          </div>
          <div class="zone-hero-text">
            <div class="zone-hero-order">${order}</div>
            <div class="zone-hero-title" style="color:${color}">${name}</div>
            <div class="zone-hero-en">${en}</div>
          </div>
          <button class="zone-hero-close" onclick="closeModal()"><i class="ti ti-x"></i></button>
        </div>
        <div class="zone-stat-row">
          <div class="zone-stat-pill"><i class="ti ti-player-play" style="color:${color};font-size:.85rem"></i><strong>${vCount}</strong> Episodes</div>
          <div class="zone-stat-pill"><i class="ti ti-sword" style="color:${color};font-size:.85rem"></i><strong>${qCount}</strong> Quests</div>
        </div>`;
    }

    // Setup admin tab
    const admBtn = document.getElementById('znt-adm');
    if (admBtn) admBtn.style.display = isAdmin ? 'flex' : 'none';
    const aw = document.getElementById('adminWrap');
    if (aw && isAdmin) {
      aw.innerHTML = buildAdminPanel(s, color);
    }

    // Reset to episodes tab
    zoneTabSwitch('vids', document.getElementById('znt-ep'));
    renderVids();
    renderQuizList();

    overlay.classList.add('open');
  });
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
}
function overlayBg(e) {
  if (e.target === document.getElementById('overlay')) closeModal();
}

function zoneTabSwitch(tab, btn) {
  document.querySelectorAll('.znt-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  document.getElementById('panelVids').style.display  = tab==='vids'  ? 'block' : 'none';
  document.getElementById('panelQuiz').style.display  = tab==='quiz'  ? 'block' : 'none';
  const aw = document.getElementById('adminWrap');
  if (aw) aw.style.display = (tab==='admin' && isAdmin) ? 'block' : 'none';
}

/* ── Episode Cards ───────────────────────────────────────────── */
function renderVids() {
  const d = currentSubjectData || { videos:[] };
  const el = document.getElementById('vgrid'); if (!el) return;
  const color = ZONE_COLORS[subj];
  const icon  = ZONE_ICONS[subj];
  if (!d.videos||!d.videos.length) {
    el.innerHTML = `<div class="ep-empty"><div class="ep-empty-icon"><i class="ti ${icon}" style="color:${color};font-size:2.5rem"></i></div><div>ยังไม่มี Episodes</div>${isAdmin?'<div style="font-size:.75rem;color:var(--tx3)">เพิ่มได้ที่ Admin Tab</div>':''}</div>`;
    return;
  }
  el.innerHTML = d.videos.map((v,idx) => {
    const watched = user ? getWatched(user.no, subj).includes(v.id) : false;
    return `<div class="ep-card" onclick="playVid(${JSON.stringify(v.id)})" style="--zone-color:${color}">
      <div class="ep-thumb">
        ${v.type==='yt'?`<img src="https://img.youtube.com/vi/${v.ytId}/hqdefault.jpg" loading="lazy">`:`<div class="ep-thumb-placeholder"><i class="ti ${icon}" style="color:${color};font-size:3rem"></i></div>`}
        <div class="ep-play-mega">▶</div>
        <div class="ep-thumb-bottom"><div class="ep-num-badge" style="color:${color}">EP.${String(idx+1).padStart(2,'0')}</div></div>
      </div>
      <div class="ep-info" style="--zone-color:${color}">
        <div class="ep-title">${esc(v.title)}</div>
        <div class="ep-footer">
          <span class="ep-badge ${v.type==='yt'?'yt':'file'}">${v.type==='yt'?'YouTube':'File'}</span>
          ${watched?`<span class="ep-watched-mark"><i class="ti ti-check" style="color:var(--em)"></i> Watched</span>`:''}
          <span class="ep-xp" style="color:${color};margin-left:auto">+20 XP</span>
          ${isAdmin?`<button class="ep-del-btn" data-id="${v.id}" onclick="event.stopPropagation();delVid(this.dataset.id)"><i class="ti ti-trash" style="color:var(--red)"></i></button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function playVid(vidId) {
  const d = currentSubjectData; if (!d) return;
  const v = d.videos.find(x => x.id === vidId); if (!v) return;
  const color = ZONE_COLORS[subj];
  const ep = d.videos.indexOf(v)+1;

  const labelEl = document.getElementById('vidLabel');
  labelEl.style.cssText='position:relative;top:auto;left:auto;right:auto;display:block;margin-bottom:12px';
  labelEl.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:12px">
    <div style="font-family:Prompt,sans-serif;font-size:.62rem;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${color}">EP.${String(ep).padStart(2,'0')}</div>
    <div style="font-family:Prompt,sans-serif;font-size:.88rem;font-weight:700;color:#fff;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(v.title)}</div>
    <div style="font-size:.68rem;padding:3px 10px;border-radius:999px;background:rgba(251,191,36,.15);color:#fbbf24;font-family:Prompt,sans-serif;font-weight:800">+20 XP</div>
    <button style="background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.2);color:var(--red);width:30px;height:30px;border-radius:50%;cursor:pointer" onclick="closeVid(null,true)">✕</button>
  </div>`;

  const content = document.getElementById('vidContent');
  if (v.type==='yt') {
    content.innerHTML = `<div class="yt-wrap"><iframe src="https://www.youtube.com/embed/${v.ytId}?autoplay=1&rel=0" allow="autoplay;encrypted-media;fullscreen" allowfullscreen></iframe></div>`;
  } else {
    content.innerHTML = `<div style="text-align:center;color:var(--tx3);padding:40px">ไฟล์วิดีโอไม่รองรับใน multi-file version<br>กรุณาใช้ YouTube URL</div>`;
  }
  document.getElementById('vidOverlay').classList.add('open');

  // Award XP after 8s
  setTimeout(async () => {
    if (document.getElementById('vidOverlay').classList.contains('open')) {
      try { await API.addXP(20); } catch {}
      markWatched(user.no, subj, v.id);
      renderVids();
      updateHUD();
    }
  }, 8000);
}

function closeVid(e, force) {
  if (force||(e&&e.target===document.getElementById('vidOverlay'))) {
    document.getElementById('vidOverlay').classList.remove('open');
    const c = document.getElementById('vidContent');
    const fr = c.querySelector('iframe'); if(fr)fr.src=fr.src;
    c.innerHTML='';
  }
}

async function delVid(id) {
  const d = currentSubjectData; if (!d) return;
  d.videos = d.videos.filter(v => v.id !== id);
  try { await API.setSubject(subj, d); currentSubjectData = d; renderVids(); toast('ลบวิดีโอแล้ว'); }
  catch(e) { toast('Error: '+e.message,'err'); }
}

/* ── Quest Cards ─────────────────────────────────────────────── */
function renderQuizList() {
  const d = currentSubjectData || { quizzes:[] };
  const el = document.getElementById('qlistEl'); if (!el) return;
  const color = ZONE_COLORS[subj];
  const icon  = ZONE_ICONS[subj];
  document.getElementById('quizPlay2').style.display='none';
  el.style.display='flex';

  if (!d.quizzes||!d.quizzes.length) {
    el.innerHTML=`<div class="quest-empty"><i class="ti ti-sword" style="color:${color};font-size:2.5rem;display:block;margin-bottom:10px"></i><div>ยังไม่มี Quests</div></div>`;
    return;
  }
  el.innerHTML = d.quizzes.map(q => {
    const nQ = q.questions.length;
    const maxXP = Math.round(nQ*10*2.0*1.8);
    const stars = nQ<=5?'★★☆☆☆':nQ<=10?'★★★☆☆':nQ<=15?'★★★★☆':'★★★★★';
    const lvCount={easy:0,normal:0,hard:0};
    q.questions.forEach(x=>{ lvCount[x.level||'normal']=(lvCount[x.level||'normal']||0)+1; });
    return `<div class="quest-card" style="--zone-color:${color}">
      <div class="quest-bar" style="background:${color}"></div>
      <div class="quest-art"><i class="ti ${icon} quest-art-icon" style="color:${color};font-size:2rem"></i><div class="quest-art-type" style="color:${color}">QUEST</div></div>
      <div class="quest-body">
        <div class="quest-category" style="color:${color}">${ZONE_EN[subj]||''}</div>
        <div class="quest-title">${esc(q.title)}</div>
        <div class="quest-meta-row">
          <span class="quest-meta-chip">${nQ} questions</span>
          <span class="quest-stars">${stars}</span>
          <span class="quest-max-xp"><i class="ti ti-star" style="color:#fbbf24"></i> MAX ${maxXP} XP</span>
        </div>
        <div style="font-size:.65rem;margin-top:4px;color:var(--tx3)">🟢${lvCount.easy} ง่าย · 🟡${lvCount.normal} กลาง · 🔴${lvCount.hard} ยาก</div>
      </div>
      <div class="quest-action">
        <button class="quest-accept-btn" data-id="${q.id}" onclick="openQuizMode(this.dataset.id)" style="background:${color}">ACCEPT →</button>
        ${isAdmin?`<button class="quest-del-btn" data-id="${q.id}" onclick="delQuiz(this.dataset.id)"><i class="ti ti-trash" style="color:var(--red)"></i></button>`:''}
      </div>
    </div>`;
  }).join('');
}

async function delQuiz(id) {
  const d = currentSubjectData; if (!d) return;
  d.quizzes = d.quizzes.filter(q => String(q.id) !== String(id));
  try { await API.setSubject(subj, d); currentSubjectData=d; renderQuizList(); toast('ลบแล้ว'); }
  catch(e) { toast('Error: '+e.message,'err'); }
}

/* ── Admin Panel inside modal ────────────────────────────────── */
function buildAdminPanel(s, color) {
  return `<div class="admin-wrap show">
    <div class="admin-title">⚙️ Admin Panel — ${ZONE_THAI[s]}</div>
    <div class="tabs2" id="adminTabs">
      <button class="tab2 on" onclick="switchAdminTab('vid',this)">📹 เพิ่มวิดีโอ</button>
      <button class="tab2" onclick="switchAdminTab('quiz',this)">📝 สร้าง Quiz</button>
      <button class="tab2" onclick="switchAdminTab('autoquiz',this)">🤖 Auto Quiz</button>
    </div>
    <!-- Video form -->
    <div id="vidForm" class="aform">
      <input class="af-input" id="vTitle" placeholder="ชื่อวิดีโอ (จำเป็น)">
      <input class="af-input" id="vUrl" placeholder="YouTube URL (https://youtu.be/xxxxx)">
      <button class="btn-admin" onclick="addVideo()">➕ เพิ่มวิดีโอ</button>
    </div>
    <!-- Quiz form -->
    <div id="quizForm" class="aform" style="display:none">
      <input class="af-input" id="qTitle" placeholder="ชื่อแบบทดสอบ">
      <div id="qContainer"></div>
      <button class="btn-add-q" onclick="addQ()">+ เพิ่มคำถาม</button>
      <button class="btn-admin" onclick="saveQuiz()">💾 บันทึก</button>
    </div>
    <!-- Auto Quiz form -->
    <div id="autoQuizForm" class="aform" style="display:none">
      <div class="aq-header"><i class="ti ti-robot" style="color:#a78bfa;font-size:1.1rem"></i><strong>Auto Quiz</strong> — วาง text โจทย์ให้ AI แยก</div>
      <input class="af-input" id="aqTitle" placeholder="ชื่อแบบทดสอบ">
      <div class="aq-format-hint">
        <div class="aqfh-title">⚠️ ต้องระบุ [ระดับ] นำหน้าแต่ละข้อ:</div>
        <code>[easy] คำถาม...
ก) ... ข) ... ค) ... ง) ... เฉลย: ก

[normal] คำถาม...

[hard] คำถาม...</code>
      </div>
      <textarea class="aq-paste-area" id="aqPaste" placeholder="วาง text โจทย์ที่มี [easy]/[normal]/[hard] นำหน้า..."></textarea>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn-admin" id="aqParseBtn" onclick="runAutoQuiz()"><i class="ti ti-sparkles"></i> ให้ AI แยกข้อ</button>
        <span class="aq-status" id="aqStatus"></span>
      </div>
      <div id="aqPreview" style="display:none">
        <div class="aq-preview-hd"><span id="aqPreviewCount">0 ข้อ</span><button class="btn-admin" onclick="saveAutoQuiz()"><i class="ti ti-device-floppy"></i> บันทึก</button></div>
        <div id="aqPreviewList"></div>
      </div>
    </div>
  </div>`;
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('#adminTabs .tab2').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('vidForm').style.display      = tab==='vid'      ? 'grid' : 'none';
  document.getElementById('quizForm').style.display     = tab==='quiz'     ? 'grid' : 'none';
  document.getElementById('autoQuizForm').style.display = tab==='autoquiz' ? 'grid' : 'none';
}

function ytId(url) { const m=url.match(/(?:youtu\.be\/|[?&]v=|embed\/)([\w-]{11})/);return m?m[1]:null; }

async function addVideo() {
  const title = document.getElementById('vTitle').value.trim();
  const url   = document.getElementById('vUrl').value.trim();
  if (!title) { toast('กรุณากรอกชื่อวิดีโอ','err'); return; }
  const yid = ytId(url);
  if (!yid)  { toast('YouTube URL ไม่ถูกต้อง','err'); return; }
  const d = currentSubjectData;
  if (!d.videos) d.videos=[];
  d.videos.push({ id: Date.now(), title, type:'yt', ytId:yid });
  try {
    await API.setSubject(subj, d);
    currentSubjectData = d;
    document.getElementById('vTitle').value='';
    document.getElementById('vUrl').value='';
    renderVids();
    toast('✅ เพิ่มวิดีโอแล้ว');
  } catch(e) { toast('Error: '+e.message,'err'); }
}

let tempQs = [];
function addQ() { tempQs.push({qid:Date.now(),text:'',opts:['','','',''],correct:0,level:'normal'}); renderQForm(); }
function removeQ(i) { tempQs.splice(i,1); renderQForm(); }
function renderQForm() {
  if (!document.getElementById('qContainer')) return;
  document.getElementById('qContainer').innerHTML = tempQs.map(function(q,i){
    var diffBtns=['easy','normal','hard'].map(function(lv){
      var sel=(q.level===lv)?' sel-'+lv:'';
      var label={easy:'🟢 Easy',normal:'🟡 Normal',hard:'🔴 Hard'}[lv];
      return '<button class="q-diff-btn'+sel+'" data-i="'+i+'" data-lv="'+lv+'" onclick="setQDiff(parseInt(this.dataset.i),this.dataset.lv)">'+label+'</button>';
    }).join('');
    var optRows=[0,1,2,3].map(function(j){return'<div class="opt-row"><input type="radio" name="c'+i+'" '+(q.correct===j?'checked':'')+' data-qi="'+i+'" data-j="'+j+'" onchange="tempQs[parseInt(this.dataset.qi)].correct=parseInt(this.dataset.j)"><input class="opt-input" placeholder="ตัวเลือก '+(j+1)+'" value="'+esc(q.opts[j])+'" data-qi="'+i+'" data-qj="'+j+'" oninput="tempQs[parseInt(this.dataset.qi)].opts[parseInt(this.dataset.qj)]=this.value"></div>';}).join('');
    return'<div class="qrow"><div class="qrow-hd"><span>ข้อ '+(i+1)+'</span><button class="btn-rm" data-i="'+i+'" onclick="removeQ(parseInt(this.dataset.i))">✕</button></div><input class="af-input" placeholder="คำถาม..." value="'+esc(q.text)+'" data-i="'+i+'" oninput="tempQs[parseInt(this.dataset.i)].text=this.value"><div class="q-diff-selector" style="display:flex;gap:6px;margin-bottom:8px">'+diffBtns+'</div><div class="opts2grid">'+optRows+'</div></div>';
  }).join('');
}
function setQDiff(i,lv) { if(tempQs[i]) tempQs[i].level=lv; renderQForm(); }

async function saveQuiz() {
  const title = document.getElementById('qTitle').value.trim();
  if (!title) { toast('กรุณาตั้งชื่อ','err'); return; }
  if (!tempQs.length) { toast('เพิ่มคำถามก่อน','err'); return; }
  if (!tempQs.every(q=>q.text&&q.opts.every(o=>o))) { toast('กรอกให้ครบ','err'); return; }
  const d = currentSubjectData;
  if (!d.quizzes) d.quizzes=[];
  d.quizzes.push({ id:Date.now(), title, questions:JSON.parse(JSON.stringify(tempQs)) });
  try {
    await API.setSubject(subj, d);
    currentSubjectData=d; document.getElementById('qTitle').value='';
    tempQs=[]; renderQForm(); renderQuizList();
    toast('✅ บันทึกแบบทดสอบแล้ว');
  } catch(e) { toast('Error: '+e.message,'err'); }
}

/* ── Auto Quiz ───────────────────────────────────────────────── */
async function runAutoQuiz() {
  const paste = document.getElementById('aqPaste').value.trim();
  if (!paste) { toast('วาง text โจทย์ก่อน','err'); return; }
  const statusEl = document.getElementById('aqStatus');
  const parseBtn = document.getElementById('aqParseBtn');
  statusEl.innerHTML = '<i class="ti ti-loader spin"></i> AI กำลังแยก...';
  parseBtn.disabled = true;
  try {
    const result = await API.parseQuiz(paste);
    aqParsed = result.questions;
    if (!aqParsed.length) throw new Error('ไม่พบข้อสอบ');
    statusEl.innerHTML = `<i class="ti ti-circle-check" style="color:var(--em)"></i> พบ ${aqParsed.length} ข้อ`;
    renderAQPreview();
  } catch(e) {
    statusEl.innerHTML = `<span style="color:var(--red)"><i class="ti ti-alert-circle"></i> ${e.message}</span>`;
  } finally { parseBtn.disabled=false; }
}

function renderAQPreview() {
  const el=document.getElementById('aqPreview'); if(!el)return;
  const list=document.getElementById('aqPreviewList');
  const count=document.getElementById('aqPreviewCount');
  el.style.display='block';
  var lvC={easy:0,normal:0,hard:0};
  aqParsed.forEach(function(q){ lvC[q.level||'normal']=(lvC[q.level||'normal']||0)+1; });
  count.textContent=aqParsed.length+' ข้อ  🟢'+lvC.easy+' ง่าย  🟡'+lvC.normal+' กลาง  🔴'+lvC.hard+' ยาก';
  var lvMap={easy:'🟢 Easy',normal:'🟡 Normal',hard:'🔴 Hard'};
  list.innerHTML=aqParsed.map(function(q,i){
    var lv=q.level||'normal';
    var opts=(q.opts||[]).map(function(o,j){return'<div class="aq-q-opt'+(j===q.correct?' correct':'')+'">'+['A','B','C','D'][j]+'. '+esc(o)+'</div>';}).join('');
    return'<div class="aq-q-preview"><span class="aq-diff-badge '+lv+'">'+(lvMap[lv]||lv)+'</span><div class="aq-q-preview-text">'+(i+1)+'. '+esc(q.text)+'</div><div class="aq-q-opts">'+opts+'</div></div>';
  }).join('');
}

async function saveAutoQuiz() {
  if (!subj) { toast('กรุณาเปิดวิชาก่อน','err'); return; }
  if (!aqParsed.length) { toast('ยังไม่มีข้อสอบ','err'); return; }
  const title = document.getElementById('aqTitle').value.trim()||'Auto Quiz '+new Date().toLocaleDateString('th-TH');
  const d = currentSubjectData;
  if (!d.quizzes) d.quizzes=[];
  d.quizzes.push({ id:Date.now(), title, questions:aqParsed.map(function(q){return{qid:'q'+Date.now()+'_'+Math.random().toString(36).substr(2,4),text:q.text,opts:q.opts,correct:q.correct,level:q.level||'normal'};}) });
  try {
    await API.setSubject(subj, d);
    currentSubjectData=d;
    toast('✅ บันทึก Auto Quiz — '+d.quizzes[d.quizzes.length-1].questions.length+' ข้อ');
    document.getElementById('aqPaste').value='';
    document.getElementById('aqTitle').value='';
    document.getElementById('aqPreview').style.display='none';
    document.getElementById('aqStatus').innerHTML='';
    aqParsed=[];
    renderQuizList();
  } catch(e) { toast('Error: '+e.message,'err'); }
}

/* ── Quiz Mode Selection ─────────────────────────────────────── */
function openQuizMode(id) {
  const q = (currentSubjectData.quizzes||[]).find(x => String(x.id)===String(id));
  if (!q) return;
  pendingQuizId = id;
  qMode = { diff:'easy', speed:'chill' };

  const lvCount={easy:0,normal:0,hard:0};
  q.questions.forEach(x=>{ lvCount[x.level||'normal']=(lvCount[x.level||'normal']||0)+1; });

  document.getElementById('quizModeModal').innerHTML = buildQuizModeModal(q, lvCount);
  document.getElementById('quizModeModal').classList.add('open');
}

function buildQuizModeModal(q, lvCount) {
  const color = ZONE_COLORS[subj];
  return `<div class="qmode-box" style="--zone-color:${color}">
    <div class="qmode-title">⚔️ เลือกโหมด Quiz</div>
    <div class="qmode-sub">"${esc(q.title)}" · 🟢${lvCount.easy} 🟡${lvCount.normal} 🔴${lvCount.hard} ข้อ</div>
    <div class="qmode-section-lbl">Difficulty</div>
    <div class="qmode-row" id="diffRow">
      ${['easy','normal','hard'].map((d,i)=>`<div class="qmode-chip${i===0?' sel':''}" data-diff="${d}" onclick="selectDiff('${d}',this)"><div class="qmc-icon">${d==='easy'?'🟢':d==='normal'?'🟡':'🔴'}</div><div class="qmc-name">${{easy:'Easy',normal:'Normal',hard:'Hard'}[d]}</div><div class="qmc-xp">×${{easy:'1.0',normal:'1.5',hard:'2.0'}[d]} XP</div></div>`).join('')}
    </div>
    <div class="qmode-section-lbl">Speed</div>
    <div class="qmode-row" id="speedRow">
      ${['chill','normal','speed'].map((s,i)=>`<div class="qmode-chip${i===0?' sel':''}" data-speed="${s}" onclick="selectSpeed('${s}',this)"><div class="qmc-icon">${s==='chill'?'😌':s==='normal'?'⏱️':'⚡'}</div><div class="qmc-name">${{chill:'Chill',normal:'Normal',speed:'Speed'}[s]}</div><div class="qmc-xp">${{chill:'ไม่มีเวลา',normal:'30 วิ/ข้อ',speed:'10 วิ/ข้อ'}[s]}</div></div>`).join('')}
    </div>
    <button class="qmode-start-btn" onclick="confirmStartQuiz()" style="background:${color}">⚔️ เริ่มเลย!</button>
    <div class="qmode-cancel" onclick="document.getElementById('quizModeModal').classList.remove('open')">ยกเลิก</div>
  </div>`;
}

function selectDiff(d,btn) { qMode.diff=d; document.querySelectorAll('#diffRow .qmode-chip').forEach(b=>b.classList.remove('sel')); btn.classList.add('sel'); }
function selectSpeed(s,btn) { qMode.speed=s; document.querySelectorAll('#speedRow .qmode-chip').forEach(b=>b.classList.remove('sel')); btn.classList.add('sel'); }
function confirmStartQuiz() { document.getElementById('quizModeModal').classList.remove('open'); launchQuizFS(pendingQuizId); }

/* ── Quiz Fullscreen ─────────────────────────────────────────── */
function launchQuizFS(id) {
  const quiz = (currentSubjectData.quizzes||[]).find(q=>String(q.id)===String(id));
  if (!quiz) return;
  curQuiz=quiz; qIdx=0; qOk=0; qfsXP=0; qfsCombo=0;
  clearInterval(qfsTimerInt);

  // Filter by difficulty
  let filtered = quiz.questions.filter(q=>(q.level||'normal')===qMode.diff);
  if (!filtered.length) { filtered=quiz.questions; toast('ไม่พบข้อระดับ '+qMode.diff+' — แสดงทุกข้อ','info'); }

  // Shuffle
  curQuiz = { ...quiz, questions: shuffleArr([...filtered]).map(q=>{ const opts=[...q.opts]; const ct=opts[q.correct]; shuffleArr(opts); return{...q,opts,correct:opts.indexOf(ct)}; }) };

  const fs = document.getElementById('quizFullscreen');
  const color = ZONE_COLORS[subj];
  const modeLabels={chill:'CHILL 😌',normal:'NORMAL ⏱️',speed:'SPEED ⚡'};

  fs.innerHTML = `<div id="qfEdge"></div><div id="qfInner">
    <div id="qfHeader">
      <button class="qf-back-btn" onclick="exitQuizFS()">← EXIT</button>
      <span class="qf-title">${esc(quiz.title)}</span>
      <span class="qf-badge" style="background:${color}">${modeLabels[qMode.speed]}</span>
      <span class="qf-combo" id="qfCombo" style="display:none">🔥 ×1</span>
    </div>
    <div id="qfProgress">
      <div class="qf-prog-track"><div class="qf-prog-fill" id="qfProg"></div></div>
      <div class="qf-prog-info"><span id="qfN">1</span>/<span id="qfT">${curQuiz.questions.length}</span><span class="qf-xp-live">⭐ <span id="qfXP">0</span></span></div>
    </div>
    ${qMode.speed!=='chill'?`<div id="qfTimerWrap"><svg class="qf-timer-svg" viewBox="0 0 36 36"><circle class="qf-timer-bg" cx="18" cy="18" r="15.9"/><circle class="qf-timer-ring" id="qfTimerRing" cx="18" cy="18" r="15.9" stroke-dasharray="100 100" stroke-dashoffset="0" style="stroke:${color}"/><text class="qf-timer-num" id="qfTimerNum" x="18" y="18">${qMode.speed==='speed'?10:30}</text></svg></div>`:''}
    <div id="qfQuestionView"><div class="qf-q-difficulty" id="qfDiffBadge"></div><div class="qf-question" id="qfText"></div><div class="qf-options" id="qfOpts"></div></div>
    <div id="qfResult" style="display:none"></div>
  </div>`;

  fs.style.display='flex';
  showQFS();
}

function shuffleArr(a) { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }

function showQFS() {
  const q=curQuiz.questions[qIdx]; const tot=curQuiz.questions.length;
  document.getElementById('qfN').textContent=qIdx+1;
  document.getElementById('qfT').textContent=tot;
  document.getElementById('qfXP').textContent=qfsXP;
  document.getElementById('qfProg').style.width=(qIdx/tot*100)+'%';
  const diff=q.level||'normal';
  const diffEl=document.getElementById('qfDiffBadge');
  if(diffEl){diffEl.textContent={easy:'🟢 EASY',normal:'🟡 NORMAL',hard:'🔴 HARD'}[diff]||'NORMAL';diffEl.className='qf-q-difficulty d-'+diff;}
  document.getElementById('qfText').textContent=q.text;
  const labels=['A','B','C','D'];
  document.getElementById('qfOpts').innerHTML=q.opts.map((o,i)=>
    `<button class="qf-opt" data-letter="${labels[i]}" data-i="${i}" onclick="answerQFS(parseInt(this.dataset.i))"><span class="qf-opt-label">${labels[i]}</span>${esc(o)}</button>`
  ).join('');
  clearInterval(qfsTimerInt);
  if(qMode.speed!=='chill'){
    qfsTimerLeft=qMode.speed==='speed'?10:30;
    updateQFSTimer(qfsTimerLeft);
    qfsTimerInt=setInterval(()=>{qfsTimerLeft--;updateQFSTimer(qfsTimerLeft);if(qfsTimerLeft<=0){clearInterval(qfsTimerInt);answerQFS(-1);}},1000);
  }
}

function updateQFSTimer(left) {
  const max=qMode.speed==='speed'?10:30;
  const ring=document.getElementById('qfTimerRing'); const num=document.getElementById('qfTimerNum');
  if(ring){ring.style.strokeDashoffset=100*(1-left/max);ring.style.stroke=left<=5?'#f87171':(ZONE_COLORS[subj]||'#4ecdc4');}
  if(num)num.textContent=left;
}

async function answerQFS(chosen) {
  clearInterval(qfsTimerInt);
  const q=curQuiz.questions[qIdx];
  const btns=document.querySelectorAll('.qf-opt');
  btns.forEach(b=>b.disabled=true);
  if(btns[q.correct])btns[q.correct].classList.add('correct');
  const isCorrect=chosen===q.correct;
  if(!isCorrect&&chosen>=0)btns[chosen].classList.add('wrong');
  const edge=document.getElementById('qfEdge');
  if(edge){edge.className='';requestAnimationFrame(()=>edge.className=isCorrect?'flash-correct':'flash-wrong');}
  const diffMult={easy:1.0,normal:1.5,hard:2.0};const speedMult={chill:1.0,normal:1.3,speed:1.8};
  let xpGain=0;
  if(isCorrect){qfsCombo++;qOk++;const cb=Math.min(qfsCombo*0.1,0.5);const tb=qMode.speed!=='chill'?Math.max(0,qfsTimerLeft/(qMode.speed==='speed'?10:30))*0.3:0;xpGain=Math.round(10*(diffMult[qMode.diff]||1)*(speedMult[qMode.speed]||1)*(1+cb+tb));}else{qfsCombo=0;}
  qfsXP+=xpGain;
  document.getElementById('qfXP').textContent=qfsXP;
  const comboEl=document.getElementById('qfCombo');
  if(comboEl){if(qfsCombo>=2){comboEl.style.display='inline';comboEl.textContent='🔥 ×'+qfsCombo;comboEl.style.transform='scale(1.4)';setTimeout(()=>comboEl.style.transform='scale(1)',200);}else comboEl.style.display='none';}
  if(xpGain>0)showXPPopFS('+'+xpGain+' XP');
  setTimeout(()=>{qIdx++;if(qIdx<curQuiz.questions.length)showQFS();else showResultFS();},950);
}

function showXPPopFS(text) {
  const pop=document.createElement('div');pop.className='xp-pop-fs';pop.textContent=text;
  pop.style.left=(Math.random()*60+20)+'%';pop.style.top=(Math.random()*30+35)+'%';
  document.body.appendChild(pop);setTimeout(()=>pop.remove(),1400);
}

async function showResultFS() {
  const tot=curQuiz.questions.length;const pct=Math.round(qOk/tot*100);
  const grade=pct>=90?'S':pct>=80?'A':pct>=60?'B':pct>=40?'C':'D';
  const qv=document.getElementById('qfQuestionView');if(qv)qv.style.display='none';
  const res=document.getElementById('qfResult');if(!res)return;
  res.style.display='flex';
  res.innerHTML=`<div class="qfr-grade">${grade}</div>
    <div class="qfr-ring" style="--p:${pct}%"><div class="qfr-ring-inner"><div class="qfr-score">${qOk}/${tot}</div><div class="qfr-lbl">Score</div></div></div>
    <div class="qfr-msg">${pct>=80?'🎉 ยอดเยี่ยม!':pct>=60?'👍 ทำได้ดี!':pct>=40?'📚 ลองใหม่!':'💪 ไม่ท้อ!'}</div>
    <div class="qfr-detail">ตอบถูก ${qOk}/${tot} (${pct}%)</div>
    <div class="qfr-xp">⭐ +${qfsXP} XP</div>
    <div class="qfr-btns"><button class="qfr-retry" onclick="retryQuizFS()">🔄 ทำอีกครั้ง</button><button class="qfr-exit" onclick="exitQuizFS()">← กลับ</button></div>`;
  try { await API.addXP(qfsXP); } catch {}
  markDone(user.no, subj, curQuiz.id);
  updateHUD();
}

function retryQuizFS() { launchQuizFS(curQuiz.id); }
function exitQuizFS() {
  clearInterval(qfsTimerInt);
  document.getElementById('quizFullscreen').style.display='none';
  document.getElementById('overlay').classList.add('open');
  renderQuizList();
}

/* ── Leaderboard ─────────────────────────────────────────────── */
async function renderDramaLB() {
  try { xpDataLib = await API.getXP(); } catch { return; }
  const podium = document.getElementById('dlbPodium');
  const list   = document.getElementById('dlbList');
  const rows = Object.values(xpDataLib).sort((a,b)=>(b.xp||0)-(a.xp||0));
  if (!rows.length) { podium.innerHTML='<div class="dlb-loading">ยังไม่มีข้อมูล XP</div>'; list.innerHTML=''; return; }
  const maxXP = rows[0].xp||1;
  const podSlots=[{rank:1,medal:'👑',cls:'pod-1',base:'1ST'},{rank:2,medal:'🥈',cls:'pod-2',base:'2ND'},{rank:3,medal:'🥉',cls:'pod-3',base:'3RD'}];
  podium.innerHTML=podSlots.map(slot=>{
    const r=rows[slot.rank-1];if(!r)return'';
    const isMe=user&&r.no===user.no;
    const dn=getDisplayName(r.no)||r.name||'?';
    return`<div class="pod-slot ${slot.cls}"><div class="pod-ava-wrap"><div class="pod-crown">${slot.medal}</div><div class="pod-ava">${dn.charAt(0)}</div></div><div class="pod-name">${esc(dn)}${isMe?'<br><span class="dlb-you-tag">YOU</span>':''}</div><div class="pod-xp">⭐ ${(r.xp||0).toLocaleString()}</div><div class="pod-base">${slot.base}</div></div>`;
  }).join('');
  list.innerHTML=rows.slice(3).map((r,i)=>{
    const rank=i+4;const isMe=user&&r.no===user.no;
    const dn=getDisplayName(r.no)||r.name||'?';
    const barW=Math.round((r.xp||0)/maxXP*100);
    return`<div class="dlb-row${isMe?' dlb-me':''}"><div class="dlb-rank">${rank}</div><div class="dlb-ava">${dn.charAt(0)}</div><div class="dlb-info"><div class="dlb-name">${esc(dn)}${isMe?' <span class="dlb-you-tag">YOU</span>':''}</div><div class="dlb-xp-bar-wrap"><div class="dlb-xp-bar" style="width:${barW}%"></div></div></div><div class="dlb-xp-val">⭐ ${(r.xp||0).toLocaleString()}</div></div>`;
  }).join('');
}

/* ── Zone Loader ─────────────────────────────────────────────── */
let zlTimers=[];
function showZoneLoader(s, onDone) {
  const el=document.getElementById('zoneLoader');if(!el){if(onDone)onDone();return;}
  const color=ZONE_COLORS[s];const name=ZONE_THAI[s];const icon=ZONE_ICONS[s];const en=ZONE_EN[s];const order=ZONE_ORDER[s];
  const artCls={sci:'zl-sci',math:'zl-math',eng:'zl-eng',soc:'zl-soc',hist:'zl-hist',comp:'zl-comp'}[s]||'';
  document.getElementById('zlBg').className='zl-art-bg '+artCls;
  document.getElementById('zlIcon').className='ti '+icon+' zl-icon';
  document.getElementById('zlIcon').style.color=color;
  document.getElementById('zlIconWrap').style.boxShadow='0 0 40px '+color+', 0 0 80px '+color+'44';
  document.getElementById('zlName').textContent=name; document.getElementById('zlName').style.color=color;
  document.getElementById('zlEn').textContent=en; document.getElementById('zlZoneId').textContent=order;
  document.getElementById('zlFill').style.background=color; document.getElementById('zlFill').style.boxShadow='0 0 12px '+color;
  document.getElementById('zlPct').textContent='0%'; document.getElementById('zlFill').style.width='0%';
  el.style.display='flex'; el.style.opacity='';
  // Particles
  zlTimers.forEach(clearTimeout); zlTimers=[];
  const pw=document.getElementById('zlParticles');pw.innerHTML='';
  for(let i=0;i<20;i++){const t=setTimeout(()=>{const p=document.createElement('div');p.className='zl-p';const sz=Math.random()*4+2;const dur=Math.random()*4+3;p.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*100}%;bottom:-10px;background:${color};opacity:.7;animation-duration:${dur}s;animation-delay:${Math.random()*2}s;`;pw.appendChild(p);setTimeout(()=>p.remove(),(dur+2)*1000);},i*80);zlTimers.push(t);}
  // Progress animation
  let pct=0;
  const iv=setInterval(()=>{pct+=Math.random()*18+4;if(pct>=100){pct=100;clearInterval(iv);}
    document.getElementById('zlFill').style.width=pct+'%';
    document.getElementById('zlPct').textContent=Math.round(pct)+'%';
    if(pct>=100){setTimeout(()=>{el.style.transition='opacity .3s ease';el.style.opacity='0';setTimeout(()=>{el.style.display='none';el.style.opacity='';zlTimers.forEach(clearTimeout);pw.innerHTML='';if(onDone)onDone();},310);},200);}
  },50);
}
