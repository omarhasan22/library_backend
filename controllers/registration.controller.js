const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');

exports.register = async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log('Registration attempt with username:', username);
    console.log('Registration attempt with password:', password);
    const user = await authService.register(username, password);
    console.log('User registered:', user);
    const accessToken = tokenService.generateAccessToken(user);
    const refreshToken = tokenService.generateRefreshToken(user);

    res.status(201).json({ accessToken, refreshToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
