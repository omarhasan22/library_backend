const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');

exports.login = async (req, res) => {
  const { email, password } = req.body;
  console.log("login controller", { email, password: password ? '***' : null });

  try {
    const user = await authService.login(email, password);

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
