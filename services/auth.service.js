const mongoose = require('mongoose');
const User = require('../models/users.model');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 10;

class AuthService {
  async register(email, username, password) {
    if (!email || !username || !password) throw new Error('email, username and password are required');

    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await User.exists({ $or: [{ email: normalizedEmail }, { username }] });
    if (existingUser) throw new Error('User already exists');

    // The users model pre-save hook hashes the password.
    const user = new User({ email: normalizedEmail, username, password });
    return await user.save();
  }

  // `identifier` may be an email or a username (the login form sends either in the email field).
  async login(identifier, password) {
    if (!identifier || !password) throw new Error('email and password required');

    const value = String(identifier).trim();
    const user = await User.findOne({
      $or: [{ email: value.toLowerCase() }, { username: value }]
    });

    // Same message for unknown user and wrong password, so emails can't be enumerated.
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;
    if (!isMatch) throw new Error('Invalid email or password');

    user.password = undefined;
    return user;
  }

  async getUser(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error('User not found');
    const user = await User.findById(id).select('-password');
    if (!user) throw new Error('User not found');
    return user;
  }

  async updateProfile(userId, updateData) {
    const { username, email, currentPassword, newPassword } = updateData;

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;

    // Check if email is being changed and if it's already taken
    if (normalizedEmail && normalizedEmail !== user.email) {
      const existingUser = await User.exists({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existingUser) throw new Error('Email already exists');
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.exists({ username, _id: { $ne: user._id } });
      if (existingUser) throw new Error('Username already exists');
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) throw new Error('Current password is required to change password');

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) throw new Error('Current password is incorrect');
    }

    const updateFields = {};
    if (username) updateFields.username = username;
    if (normalizedEmail) updateFields.email = normalizedEmail;
    // findByIdAndUpdate skips the pre-save hashing hook, so hash here.
    if (newPassword) updateFields.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    return await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');
  }
}

module.exports = new AuthService();
