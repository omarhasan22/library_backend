const tokenService = require('../services/token.service');
const User = require('../models/users.model');

// Verifies the Bearer access token and attaches the user (without password) to req.user.
// Responds 401 for any authentication failure so the client knows to refresh / log in again.
module.exports.isAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authorization token missing' });
    }

    const decoded = tokenService.verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Must run after isAuthenticate.
module.exports.requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};
