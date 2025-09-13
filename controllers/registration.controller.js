const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');

exports.register = async (req, res) => {
  const { email, username, password } = req.body;

  try {

    const user = await authService.register(email, username, password);
    const accessToken = tokenService.generateAccessToken(user);
    const refreshToken = tokenService.generateRefreshToken(user);

    res.status(201).json({ accessToken, refreshToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
