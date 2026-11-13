const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');

exports.login = async (req, res) => {
  const { email, username, password } = req.body;

  try {
    const user = await authService.login(email || username, password);

    const accessToken = tokenService.generateAccessToken(user);
    const refreshToken = tokenService.generateRefreshToken(user);

    // Include the (password-free) user so the client doesn't need a second /auth/profile call.
    res.status(200).json({
      accessToken,
      refreshToken,
      user: { _id: user._id, id: user._id, email: user.email, username: user.username, role: user.role }
    });
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
  try {
    // isAuthenticate already loaded the user without the password.
    const user = req.user;
    res.status(200).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};