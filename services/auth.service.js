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
}

module.exports = new AuthService();
