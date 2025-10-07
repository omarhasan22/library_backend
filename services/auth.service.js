const mongoose = require('mongoose');
const User = require('../models/users.model');
const bcrypt = require('bcrypt');

class AuthService {
  async register(email, username, password) {
    const existingUser = await User.findOne({ email: email });
    console.log("existingUser", existingUser);
    console.log("email", email);


    if (existingUser) throw new Error('User already exists');

    const user = new User({ email, username, password });
    return await user.save();
  }

  async login(email, password) {
    console.log("AuthService.login", { email, password: password ? '***' : null });

    if (!email || !password) throw new Error('email and password required');

    const normalizedEmail = String(email).toLowerCase().trim();

    // NOTE: if your schema sets password: { select: false }, you must explicitly request it.
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid credentials');

    // remove password before returning
    user.password = undefined;
    return user;
  }

  async getUser(id) {
    console.log("getUser", id);

    const _id = new mongoose.Types.ObjectId(id);

    console.log("_id", _id);

    const user = await User.findOne({ _id });
    if (!user) throw new Error('User not found');
    return user;
  }

  async updateProfile(userId, updateData) {
    const { username, email, currentPassword, newPassword } = updateData;

    const user = await User.findById(userId).select('+password');
    if (!user) throw new Error('User not found');

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) throw new Error('Email already exists');
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) throw new Error('Username already exists');
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) throw new Error('Current password is required to change password');

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) throw new Error('Current password is incorrect');
    }

    // Update fields
    const updateFields = {};
    if (username) updateFields.username = username;
    if (email) updateFields.email = email.toLowerCase().trim();
    if (newPassword) updateFields.password = newPassword;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    return updatedUser;
  }
}

module.exports = new AuthService();
