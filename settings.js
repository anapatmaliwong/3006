/**
 * settings.js — Settings page logic
 */

(async function() {
  if (!await initAuth()) return;

  const dn = getDisplayName(user.no) || user.first;
  document.getElementById('displayNameInput').value = dn;
  document.getElementById('svName').textContent = dn;
  document.getElementById('svStudentInfo').textContent = 'เลขที่ ' + user.no + ' · ' + user.first + ' ' + user.last;

  // Load XP
  try {
    const xpData = await API.getXP();
    const myXP = (xpData['u'+user.no]||{}).xp || 0;
    const { rank, lv, nextXP } = getRank(myXP);
    const pct = Math.min(100, Math.round(myXP/nextXP*100));
    document.getElementById('svRank').textContent = rank + ' · Lv.' + lv;
    document.getElementById('svXP').textContent   = myXP;
    document.getElementById('svXPFill').style.width = pct + '%';
  } catch {}

  // Profile pic
  const ava = document.getElementById('svAva');
  const pic = getProfilePic(user.no);
  if (ava) ava.innerHTML = pic ? `<img src="${pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : dn.charAt(0);

  // Load current settings
  const theme = localStorage.getItem('theme') || 'dark';
  const style = localStorage.getItem('btnStyle') || 'solid';
  const lite  = localStorage.getItem('liteMode') === '1';

  document.querySelectorAll('#themeSeg .seg-btn').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase().includes(theme)));
  document.querySelectorAll('#styleSeg .seg-btn').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase().includes(style)));
  if (document.getElementById('liteToggle')) document.getElementById('liteToggle').checked = lite;
})();

function saveDisplayName() {
  const v = document.getElementById('displayNameInput').value.trim();
  if (!v) { toast('กรอกชื่อก่อน','err'); return; }
  localStorage.setItem('dn_'+user.no, v);
  document.getElementById('svName').textContent = v;
  updateNavbar();
  toast('✅ บันทึก Display Name แล้ว');
}

function uploadProfilePicSettings(input) {
  if (!input.files||!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    localStorage.setItem('pic_'+user.no, e.target.result);
    const ava = document.getElementById('svAva');
    if (ava) ava.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    updateNavbar();
    toast('✅ เปลี่ยนรูปโปรไฟล์แล้ว');
  };
  reader.readAsDataURL(input.files[0]);
}

function setTheme(theme, btn) {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('#themeSeg .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setBtnStyle(style, btn) {
  localStorage.setItem('btnStyle', style);
  document.documentElement.setAttribute('data-style', style);
  document.querySelectorAll('#styleSeg .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setLite(on) {
  localStorage.setItem('liteMode', on ? '1' : '0');
  document.documentElement.setAttribute('data-lite', on ? '1' : '0');
}
