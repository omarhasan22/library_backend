// in your Mongoose model (e.g. Book.js)
const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  // عنوان الكتاب
  title: {
    type: String,
    required: true,
    trim: true
  },

  // المؤلف
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author',
    required: true
  },

  // المحشي
  muhashi: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author',
  },

  // المحقق
  editor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author',
  },

  // اعتنى به
  caretaker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author',
  },

  // التصنيف
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },

  // الدار
  publisher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publisher',
  },

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

  // موضوع الكتاب
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
    roomNumber:  { type: String, trim: true },
    shelfNumber: { type: String, trim: true },
    wallNumber:  { type: String, trim: true },
    bookNumber:  { type: String, trim: true }
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
