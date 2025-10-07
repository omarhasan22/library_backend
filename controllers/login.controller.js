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

exports.updateProfile = async (req, res) => {
  const userId = req.user.id; // From JWT token
  const { username, email, currentPassword, newPassword } = req.body;

  try {
    const updatedUser = await authService.updateProfile(userId, {
      username,
      email,
      currentPassword,
      newPassword
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  const userId = req.user.id; // From JWT token

  try {
    const user = await authService.getUser(userId);
    res.status(200).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};