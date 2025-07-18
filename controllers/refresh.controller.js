const tokenService = require('../services/token.service');
const User = require('../models/users.model');

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = tokenService.verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);

    if (!user) throw new Error('User not found');

    const newAccessToken = tokenService.generateAccessToken(user);
    res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
};
