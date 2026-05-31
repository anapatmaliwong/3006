/**
 * admin.js — Admin panel (only served to verified admins by server)
 */

let xpDataAdmin = {};

(async function() {
  if (!await initAuth()) return;
  if (!isAdmin) { window.location.href = '/lobby.html'; return; }

  await Promise.all([loadAdmMembers(), loadAdmContent(), loadAdmXP()]);
})();

async function loadAdmXP() {
  try { xpDataAdmin = await API.getXP(); } catch { xpDataAdmin = {}; }
  populateXPSelect();
}

async function loadAdmMembers(filter = '') {
  const tbody = document.getElementById('admMembersTbody'); if (!tbody) return;
  let list = STUDENTS;
  if (filter) {
    const q = filter.toLowerCase();
    list = STUDENTS.filter(s => s.first.includes(q)||s.last.includes(q)||String(s.no)===q);
  }
  const xp = await API.getXP().catch(() => ({}));
  tbody.innerHTML = list.map(s => {
    const myXP = (xp['u'+s.no]||{}).xp||0;
    const { rank } = getRank(myXP);
    const dn = getDisplayName(s.no)||s.first;
    const role = s.no===27?'ADMIN':'นักเรียน';
    return `<tr>
      <td>${s.no}</td><td>${esc(s.first)}</td><td>${esc(s.last)}</td>
      <td class="td-xp">${myXP}</td>
      <td class="td-rank">${rank}</td>
      <td>${esc(dn)}</td>
      <td>${role==='ADMIN'?'<span style="color:var(--ac);font-weight:700">ADMIN</span>':role}</td>
    </tr>`;
  }).join('');
}

function admFilterMembers(q) { loadAdmMembers(q); }

async function loadAdmContent() {
  const grid = document.getElementById('admContentGrid'); if (!grid) return;
  const data = await Promise.all(ZONE_KEYS.map(k => API.getSubject(k).catch(() => ({videos:[],quizzes:[]}))));
  grid.innerHTML = ZONE_KEYS.map((k,i) => {
    const d = data[i];
    return `<div class="adm-zone-chip" onclick="goPage('library')">
      <div class="azc-icon"><i class="ti ${ZONE_ICONS[k]}" style="color:${ZONE_COLORS[k]};font-size:1.6rem"></i></div>
      <div class="azc-name">${ZONE_THAI[k]}</div>
      <div class="azc-count">${(d.videos||[]).length} vid · ${(d.quizzes||[]).length} quiz</div>
    </div>`;
  }).join('');
}

function populateXPSelect() {
  const sel = document.getElementById('admXPTarget'); if (!sel) return;
  sel.innerHTML = '<option value="">เลือกนักเรียน...</option>' +
    STUDENTS.map(s => `<option value="${s.no}">${s.no}. ${s.first} ${s.last}</option>`).join('');
}

async function admAdjustXP() {
  const no  = document.getElementById('admXPTarget').value;
  const amt = parseInt(document.getElementById('admXPAmount').value||0);
  if (!no||!amt) { toast('เลือกนักเรียนและระบุจำนวน XP','err'); return; }
  try { await API.adjustXP(no, amt); toast('✅ ปรับ XP แล้ว'); loadAdmMembers(); }
  catch(e) { toast('Error: '+e.message,'err'); }
}

async function admResetXP() {
  const no = document.getElementById('admXPTarget').value;
  if (!no) { toast('เลือกนักเรียนก่อน','err'); return; }
  try { await API.adjustXP(no, -999999); toast('Reset XP แล้ว'); loadAdmMembers(); }
  catch(e) { toast('Error: '+e.message,'err'); }
}

async function admResetAllXP() {
  if (!confirm('Reset XP ทุกคน?')) return;
  try { await API.resetAllXP(); toast('Reset XP ทุกคนแล้ว'); loadAdmMembers(); }
  catch(e) { toast('Error: '+e.message,'err'); }
}

async function admClearCommunity() {
  if (!confirm('ล้าง Community ทั้งหมด?')) return;
  try { await API.deleteCommunity('all-clear-admin'); toast('ล้าง Community แล้ว'); }
  catch(e) { toast('Error: '+e.message,'err'); }
}

async function admClearBriefs() {
  if (!confirm('ล้างประกาศทั้งหมด?')) return;
  try { await API.deleteBrief('all-clear-admin'); toast('ล้างประกาศแล้ว'); }
  catch(e) { toast('Error: '+e.message,'err'); }
}
