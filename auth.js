/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header or cookie
 */
const jwt = require('jsonwebtoken');

function getToken(req) {
  // Check Authorization header: "Bearer <token>"
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  // Check cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
}

/** Middleware: require any authenticated user */
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    // For HTML page requests, redirect to login
    if (req.accepts('html') && !req.path.startsWith('/api/')) {
      return res.redirect('/?reason=auth');
    }
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    if (req.accepts('html') && !req.path.startsWith('/api/')) {
      return res.redirect('/?reason=expired');
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Middleware: require admin role */
function requireAdmin(req, res, next) {
  const token = getToken(req);
  if (!token) {
    if (req.accepts('html')) return res.redirect('/?reason=auth');
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = verifyToken(token);
    if (decoded.role !== 'admin') {
      if (req.accepts('html')) return res.redirect('/lobby.html');
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (req.accepts('html')) return res.redirect('/?reason=expired');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth, requireAdmin };
