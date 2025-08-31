const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema({
  // Name of the person (author/editor/etc.) - الاسم
  name: {
    type: String,
    required: true,
    trim: true
  },

  normalizedName: {
    type: String,
    required: true,
    trim: true
  },
  // Date of birth - تاريخ الميلاد
  dateOfBirth: {
    type: Date
  },

  // Date of death - تاريخ الوفاة
  dateOfDeath: {
    type: Date
  },

  // Role type - النوع (مؤلف، محقق، معتني، ناشر)
  type: {
    type: String,
    enum: ['author', 'editor', 'caretaker', 'publisher', 'commentator', 'muhashi'],
    required: true
  }
});

module.exports = mongoose.model('Author', authorSchema);
