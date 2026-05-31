/**
 * Data API Routes — Firebase Realtime DB proxy
 * All Firebase access happens here on the server.
 * The browser never gets Firebase credentials.
 *
 * GET/POST /api/data/subjects/:subject        — video/quiz content
 * GET      /api/data/briefs                   — announcements
 * POST     /api/data/briefs          [admin]  — post announcement
 * DELETE   /api/data/briefs/:id      [admin]  — delete announcement
 * GET      /api/data/community               — posts + replies
 * POST     /api/data/community               — new post
 * POST     /api/data/community/:id/like      — toggle like
 * POST     /api/data/community/:id/reply     — reply to post
 * DELETE   /api/data/community/:id  [admin]  — delete post
 * GET      /api/data/xp                      — XP leaderboard
 * POST     /api/data/xp             [admin]  — adjust XP
 * GET      /api/data/lobby-cards             — admin custom cards
 * POST     /api/data/lobby-cards   [admin]   — upsert card
 * DELETE   /api/data/lobby-cards/:id [admin] — delete card
 * GET      /api/data/banners                 — banner URLs
 * POST     /api/data/banners        [admin]  — update banners
 */
const express  = require('express');
const { getDB } = require('../config/firebase');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper: read a Firebase path
async function fbGet(path) {
  const snap = await getDB().ref(path).once('value');
  return snap.val();
}

// Helper: write to Firebase
async function fbSet(path, data) {
  await getDB().ref(path).set(data);
}

// Helper: push to Firebase
async function fbPush(path, data) {
  const ref = await getDB().ref(path).push(data);
  return ref.key;
}

// Helper: delete from Firebase
async function fbDelete(path) {
  await getDB().ref(path).remove();
}

// ── Subjects (videos + quizzes) ───────────────────────────────────
router.get('/subjects/:subject', async (req, res) => {
  try {
    const data = await fbGet(`ac_library_data/${req.params.subject}`);
    res.json(data || { videos: [], quizzes: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/subjects/:subject', requireAdmin, async (req, res) => {
  try {
    await fbSet(`ac_library_data/${req.params.subject}`, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Briefs (announcements) ────────────────────────────────────────
router.get('/briefs', async (req, res) => {
  try {
    const data = await fbGet('briefs');
    const now  = Date.now();
    // Filter expired server-side
    const briefs = data
      ? Object.values(data).filter(b => !b.expiresAt || b.expiresAt > now)
      : [];
    res.json({ briefs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/briefs', requireAdmin, async (req, res) => {
  try {
    const { title, body, tag, expiresAt } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });
    const id = 'brief_' + Date.now();
    const payload = { id, title, body, tag: tag || 'info',
      author: req.user.first, authorNo: req.user.no,
      ts: Date.now(), expiresAt: expiresAt || null };
    await fbSet(`briefs/${id}`, payload);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/briefs/:id', requireAdmin, async (req, res) => {
  try {
    await fbDelete(`briefs/${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Community ────────────────────────────────────────────────────
router.get('/community', async (req, res) => {
  try {
    const data = await fbGet('community');
    res.json({ posts: data || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/community', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
    if (text.length > 400) return res.status(400).json({ error: 'text too long' });
    const id = 'c_' + Date.now();
    const payload = {
      id, text: text.trim(),
      author: req.user.first, authorNo: req.user.no,
      ts: Date.now(), likes: {}, replies: {}
    };
    await fbSet(`community/${id}`, payload);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/community/:id/like', async (req, res) => {
  try {
    const path = `community/${req.params.id}/likes/u${req.user.no}`;
    const existing = await fbGet(path);
    if (existing) {
      await fbDelete(path);
      res.json({ liked: false });
    } else {
      await fbSet(path, true);
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/community/:id/reply', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
    const rid = 'r_' + Date.now();
    await fbSet(`community/${req.params.id}/replies/${rid}`, {
      id: rid, text: text.trim(),
      author: req.user.first, authorNo: req.user.no, ts: Date.now()
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/community/:id', async (req, res) => {
  try {
    const post = await fbGet(`community/${req.params.id}`);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    // Allow admin or post owner
    if (req.user.role !== 'admin' && post.authorNo !== req.user.no) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await fbDelete(`community/${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── XP Leaderboard ────────────────────────────────────────────────
router.get('/xp', async (req, res) => {
  try {
    const data = await fbGet('xp_leaderboard');
    res.json({ xp: data || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/xp/add', async (req, res) => {
  try {
    const { amount } = req.body;
    const userKey = `u${req.user.no}`;
    const current = await fbGet(`xp_leaderboard/${userKey}`);
    const currentXP = (current && current.xp) || 0;
    await fbSet(`xp_leaderboard/${userKey}`, {
      xp: currentXP + (parseInt(amount) || 0),
      name: req.user.first,
      no: req.user.no,
    });
    res.json({ ok: true, xp: currentXP + (parseInt(amount) || 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/xp/adjust', requireAdmin, async (req, res) => {
  try {
    const { targetNo, amount } = req.body;
    const userKey = `u${targetNo}`;
    const current = await fbGet(`xp_leaderboard/${userKey}`);
    const currentXP = (current && current.xp) || 0;
    const newXP = Math.max(0, currentXP + parseInt(amount));
    await fbSet(`xp_leaderboard/${userKey}`, { xp: newXP, no: targetNo, name: current?.name || '' });
    res.json({ ok: true, xp: newXP });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/xp/reset-all', requireAdmin, async (req, res) => {
  try {
    await fbSet('xp_leaderboard', null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Lobby Cards ──────────────────────────────────────────────────
router.get('/lobby-cards', async (req, res) => {
  try {
    const data = await fbGet('lobby_cards');
    res.json({ cards: data || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lobby-cards', requireAdmin, async (req, res) => {
  try {
    const card = req.body;
    if (!card.id) card.id = 'lc_' + Date.now();
    await fbSet(`lobby_cards/${card.id}`, card);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/lobby-cards/:id', requireAdmin, async (req, res) => {
  try {
    await fbDelete(`lobby_cards/${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Banners ──────────────────────────────────────────────────────
router.get('/banners', async (req, res) => {
  try {
    const data = await fbGet('banners');
    res.json({ banners: data || { urls: [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/banners', requireAdmin, async (req, res) => {
  try {
    await fbSet('banners', req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: clear community / briefs ──────────────────────────────
router.delete('/community-all', requireAdmin, async (req, res) => {
  try { await fbDelete('community'); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/briefs-all', requireAdmin, async (req, res) => {
  try { await fbDelete('briefs'); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
