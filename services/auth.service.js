const mongoose = require('mongoose');
const User = require('../models/users.model');
const bcrypt = require('bcrypt');

class AuthService {
  async register(username, password) {
    const existingUser = await User.findOne({ username });
    if (existingUser) throw new Error('User already exists');

    const user = new User({ username, password });
    return await user.save();
  }

  async login(username, password) {
    const user = await User.findOne({ username });
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid credentials');

    return user;
  }

  async getUser(id) {
    console.log("getUser", id);
    
const _id = new mongoose.Types.ObjectId(id);

    console.log("_id", _id);
    
    const user = await User.findOne(  {_id} );
    if (!user) throw new Error('User not found');
    return user;
  }
}

module.exports = new AuthService();
