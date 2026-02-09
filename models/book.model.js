// in your Mongoose model (e.g. Book.js)
const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  // عنوان الكتاب
  title: {
    type: String,
    required: true,
    trim: true
  },

  normalizedTitle: {
    type: String,
    required: false,
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

  muhashis: [{
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

  // عدد المجلدات
  numberOfFolders: {
    type: Number,
    default: 1,
    min: 1
  },

  // رقم الطبعة
  editionNumber: {
    type: Number,
  },

  // سنة الطباعة
  publicationYear: {
    type: Number,
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
    roomNumber: { type: String, trim: true, required: false },
    shelfNumber: { type: String, trim: true, required: false },
    wallNumber: { type: String, trim: true, required: false },
    bookNumber: { type: String, trim: true, required: false }
  },

  // مسار صورة الغلاف
  imageUrl: {
    type: String,
    trim: true
  },

  notes: {
    type: String,
    trim: true
  }

}, {
  timestamps: true
});

// Single field indexes
BookSchema.index({ normalizedTitle: 1 });
BookSchema.index({ category: 1 });
BookSchema.index({ subject: 1 });
BookSchema.index({ publicationYear: 1 });
BookSchema.index({ 'address.roomNumber': 1 });
BookSchema.index({ 'address.shelfNumber': 1 });
BookSchema.index({ 'address.wallNumber': 1 });
BookSchema.index({ 'address.bookNumber': 1 });

// Array field indexes (for $in queries)
BookSchema.index({ authors: 1 });
BookSchema.index({ publishers: 1 });

// Compound indexes for common query patterns
BookSchema.index({ category: 1, subject: 1 });
BookSchema.index({ normalizedTitle: 1, category: 1 });

module.exports = mongoose.model('Book', BookSchema);