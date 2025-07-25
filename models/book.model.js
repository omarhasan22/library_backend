// in your Mongoose model (e.g. Book.js)
const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  // عنوان الكتاب
  title: {
    type: String,
    required: true,
    trim: true
  },

  // المؤلفون - Array to support multiple authors
  authors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author'
  }],

  // الشارحون - Array to support multiple commentator
  commentators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author'
  }],

  // المحققون - Array to support multiple editors
  editors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author'
  }],

  // من اعتنى بهم - Array to support multiple caretakers
  caretakers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author'
  }],

  // التصنيف - Single object reference
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },

  // دور النشر - Array to support multiple publishers
  publishers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publisher'
  }],

  // عدد الأجزاء
  numberOfVolumes: {
    type: Number,
    default: 1,
    min: 1
  },

  // رقم الطبعة
  editionNumber: {
    type: Number,
    min: 1
  },

  // سنة الطباعة
  publicationYear: {
    type: Number,
    min: 0
  },

  // موضوع الكتاب - Single object reference
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  },

  // عدد الصفحات
  pageCount: {
    type: Number,
    min: 1
  },

  address: {
    roomNumber: { type: String, trim: true },
    shelfNumber: { type: String, trim: true },
    wallNumber: { type: String, trim: true },
    bookNumber: { type: String, trim: true }
  },

  // مسار صورة الغلاف
  imageUrl: {
    type: String,
    trim: true
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Book', BookSchema);