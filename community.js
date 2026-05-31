/**
 * community.js — Community page logic
 */

let communityPosts = {};
let aiFilterMode = false;
let replyTargetId = null;

(async function() {
  if (!await initAuth()) return;
  const filterBtn = document.getElementById('aiFilterBtn');
  if (filterBtn) filterBtn.style.display = isAdmin ? 'flex' : 'none';
  // Update compose avatar
  const ava = document.getElementById('cvAva');
  if (ava) {
    const pic = getProfilePic(user.no);
    const dn  = getDisplayName(user.no) || user.first;
    ava.innerHTML = pic ? `<img src="${pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : dn.charAt(0);
  }
  await loadCommunity();
})();

async function loadCommunity() {
  try {
    communityPosts = await API.getCommunity() || {};
    renderCommunity();
  } catch {
    document.getElementById('commFeed').innerHTML = '<div class="cv3-loading">โหลดไม่ได้</div>';
  }
}

function renderCommunity() {
  let posts = Object.values(communityPosts).sort((a,b) => b.ts - a.ts);
  if (aiFilterMode) posts = posts.filter(p => p.aiCheck ? p.aiCheck.educational : true);
  const el = document.getElementById('commFeed'); if (!el) return;
  if (!posts.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--tx3)">' + (aiFilterMode ? '🤖 ไม่พบโพสต์วิชาการ' : 'ยังไม่มีโพสต์') + '</div>';
    return;
  }
  el.innerHTML = posts.map(p => {
    const likes   = Object.keys(p.likes||{}).length;
    const liked   = user && (p.likes||{})['u'+user.no];
    const canDel  = isAdmin || (user && user.no === p.authorNo);
    const replies = Object.values(p.replies||{}).sort((a,b)=>a.ts-b.ts);
    const aiChk   = p.aiCheck;
    let aiBadge = '';
    if (aiChk) {
      aiBadge = `<span class="cv3-ai-badge ${aiChk.educational?'edu':'off'}">${aiChk.educational?'✅ วิชาการ':'⚠️ ไม่เกี่ยวเรียน'}</span>`;
    } else if (isAdmin) {
      aiBadge = `<button style="background:none;border:none;color:var(--muted);font-size:.7rem;cursor:pointer;padding:0" data-postid="${p.id}" data-text="${encodeURIComponent((p.text||'').substring(0,200))}" onclick="aiCheckPost(this.dataset.postid,decodeURIComponent(this.dataset.text))">🤖 ตรวจ</button>`;
    }
    const repliesHtml = replies.length
      ? `<div class="cv3-replies">${replies.map(r=>`<div class="cv3-reply-item"><div class="cv3-reply-ava">${(r.author||'?').charAt(0)}</div><div class="cv3-reply-bubble"><div class="cv3-reply-name">${esc(r.author||'?')}</div><div class="cv3-reply-text">${esc(r.text)}</div><div class="cv3-reply-time">${timeAgo(r.ts)}</div></div></div>`).join('')}</div>`
      : '';
    return `<div class="comm-post" id="post-${p.id}">
      <div class="comm-post-hd"><div class="comm-ava">${(p.author||'?').charAt(0)}</div><div><div class="comm-name">${esc(p.author||'?')}</div></div><div class="comm-time">${timeAgo(p.ts)}</div></div>
      <div class="comm-text">${esc(p.text)}</div>
      ${repliesHtml}
      <div class="cv3-post-footer">
        <button class="comm-like-btn${liked?' liked':''}" data-id="${p.id}" onclick="toggleLike(this.dataset.id)">♥ ${likes}</button>
        <button class="cv3-reply-btn" data-id="${p.id}" onclick="openReplyModal(this.dataset.id)"><i class="ti ti-message-reply"></i> ตอบ</button>
        ${aiBadge}
        ${canDel?`<button class="comm-del-btn" data-id="${p.id}" onclick="deletePost(this.dataset.id)">🗑</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function updateCharCount() {
  const len = (document.getElementById('commInput').value||'').length;
  document.getElementById('charCount').textContent = len + ' / 400';
}

async function submitPost() {
  const text = document.getElementById('commInput').value.trim();
  if (!text) { toast('กรุณาเขียนข้อความ','err'); return; }
  try {
    await API.postCommunity(text);
    document.getElementById('commInput').value = '';
    updateCharCount();
    toast('✅ โพสต์แล้ว');
    await loadCommunity();
  } catch(e) { toast('Error: '+e.message,'err'); }
}

async function toggleLike(id) {
  try {
    const r = await API.likeCommunity(id);
    await loadCommunity();
  } catch(e) { toast('Error: '+e.message,'err'); }
}

async function deletePost(id) {
  try {
    await API.deleteCommunity(id);
    toast('ลบโพสต์แล้ว');
    await loadCommunity();
  } catch(e) { toast('Error: '+e.message,'err'); }
}

function openReplyModal(postId) {
  const p = communityPosts[postId]; if (!p) return;
  replyTargetId = postId;
  document.getElementById('replyParentPost').textContent = p.text||'';
  document.getElementById('replyInput').value = '';
  const m = document.getElementById('replyModal');
  m.style.display = 'flex';
  setTimeout(()=>document.getElementById('replyInput').focus(),100);
}
function closeReplyModal() { document.getElementById('replyModal').style.display='none'; replyTargetId=null; }

async function submitReply() {
  if (!replyTargetId) return;
  const text = document.getElementById('replyInput').value.trim();
  if (!text) { toast('กรุณาเขียนคำตอบ','err'); return; }
  try {
    await API.replyCommunity(replyTargetId, text);
    closeReplyModal();
    toast('✅ ตอบกลับแล้ว');
    await loadCommunity();
  } catch(e) { toast('Error: '+e.message,'err'); }
}

function toggleAIFilter() {
  aiFilterMode = !aiFilterMode;
  const btn = document.getElementById('aiFilterBtn');
  if (btn) btn.classList.toggle('on', aiFilterMode);
  renderCommunity();
  toast(aiFilterMode ? '🤖 แสดงเฉพาะโพสต์วิชาการ' : 'แสดงโพสต์ทั้งหมด');
}

async function aiCheckPost(postId, text) {
  try {
    toast('🤖 AI กำลังตรวจสอบ...','info');
    const r = await API.checkPost(postId, text);
    // The result is saved by the backend if needed, reload
    toast(r.educational ? '✅ วิชาการ: '+r.reason : '⚠️ ไม่เกี่ยวเรียน: '+r.reason, r.educational?'ok':'err');
    await loadCommunity();
  } catch(e) { toast('AI ตรวจไม่ได้: '+e.message,'err'); }
}
