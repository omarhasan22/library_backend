const tokenService = require('../services/token.service');
const User = require('../models/users.model');

module.exports.isAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(403).json({ message: 'Authorization token missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(403).json({ message: 'Token not provided' });
    }

    const decoded = tokenService.verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    next();

  } catch (err) {
    console.error('Authentication error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
};
