/**
 * AI Routes — Gemini proxy
 * The Gemini API key NEVER leaves the server.
 * Browser calls /api/ai/... and server forwards to Gemini.
 *
 * POST /api/ai/parse-quiz    — Auto Quiz: parse text into questions
 * POST /api/ai/check-post    — Community: check if post is educational
 */
const express = require('express');
const fetch   = require('node-fetch');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const GEMINI_MODELS = [
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

async function callGeminiServer(prompt, attempt = 0) {
  const key   = process.env.GEMINI_API_KEY;
  const model = GEMINI_MODELS[attempt] || GEMINI_MODELS[0];
  const url   = `${GEMINI_BASE}${model}:generateContent?key=${key}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  const data = await resp.json();

  if (data.error) {
    const msg  = data.error.message || 'Gemini error';
    const code = data.error.code;
    const isQuota = msg.toLowerCase().includes('quota') || code === 429;
    const isAccess = code === 403 || code === 401 ||
                     msg.toLowerCase().includes('denied') ||
                     msg.toLowerCase().includes('access');

    if (isAccess) throw new Error('ACCESS_DENIED: ' + msg);
    if (isQuota && attempt < GEMINI_MODELS.length - 1) {
      await new Promise(r => setTimeout(r, 600));
      return callGeminiServer(prompt, attempt + 1);
    }
    throw new Error(msg);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * POST /api/ai/parse-quiz
 * Body: { text: "raw quiz text", title: "Quiz title" }
 * Returns: { questions: [...] }
 * Requires admin
 */
router.post('/parse-quiz', requireAdmin, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  if (text.length > 20000) return res.status(400).json({ error: 'text too long (max 20,000 chars)' });

  const prompt = [
    'คุณคือระบบแยกข้อสอบ แยกข้อสอบต่อไปนี้เป็น JSON array',
    'แต่ละ object มีฟิลด์:',
    '  level: "easy" / "normal" / "hard" (ดูจาก tag นำหน้าข้อ เช่น [easy] [ง่าย] [normal] [กลาง] [hard] [ยาก])',
    '  text: คำถาม (ไม่รวมเลขข้อและ tag)',
    '  opts: array 4 string (ลบ ก) ข) ค) ง) หรือ A) B) C) D) นำหน้าออก)',
    '  correct: index 0-3 ของตัวเลือกที่ถูกต้อง (0=ตัวแรก/ก/A)',
    'กฎ: opts ต้องมีครบ 4 เสมอ ตอบกลับ JSON array เท่านั้น ไม่มี markdown backtick',
    '',
    'ข้อสอบ:',
    text,
  ].join('\n');

  try {
    const raw   = await callGeminiServer(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);
    if (!Array.isArray(questions)) throw new Error('Not an array');
    res.json({ questions });
  } catch (err) {
    const isAccess = err.message.startsWith('ACCESS_DENIED');
    res.status(isAccess ? 403 : 500).json({
      error: isAccess
        ? 'Gemini API key ไม่มีสิทธิ์ กรุณาตรวจสอบ key ใน .env'
        : 'แยกโจทย์ไม่สำเร็จ: ' + err.message,
    });
  }
});

/**
 * POST /api/ai/check-post
 * Body: { text: "post content", postId: "..." }
 * Returns: { educational: bool, reason: string }
 * Requires admin
 */
router.post('/check-post', requireAdmin, async (req, res) => {
  const { text, postId } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const prompt = [
    'ตรวจสอบว่าข้อความนี้เกี่ยวกับการเรียน/วิชาการ หรือเนื้อหาวิชาหรือไม่',
    `ข้อความ: "${text.substring(0, 500)}"`,
    'ตอบกลับ JSON เท่านั้น ไม่มีข้อความอื่น: {"educational":true,"reason":"เหตุผลสั้นๆ"}',
  ].join('\n');

  try {
    const raw   = await callGeminiServer(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    res.json({ postId, ...result });
  } catch (err) {
    res.status(500).json({ error: 'AI ตรวจไม่สำเร็จ: ' + err.message });
  }
});

module.exports = router;
