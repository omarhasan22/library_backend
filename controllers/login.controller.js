const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await authService.login(username, password);

    const accessToken = tokenService.generateAccessToken(user);
    const refreshToken = tokenService.generateRefreshToken(user);

    res.status(200).json({ accessToken, refreshToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getUser = async (req, res) => {
  const _id = req.params.userId;

  try {
    const user = await authService.getUser(_id);
    res.status(200).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
