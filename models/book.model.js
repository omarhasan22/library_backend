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
    type: String,
    required: true,
    trim: true
  },
  // عدد الأجزاء
  volumes: {
    type: Number,
    default: 1,
    min: 1
  },
  // الدار (الناشر)
  publisher: {
    type: String,
    trim: true
  },
  // المحقق
  editor: {
    type: String,
    trim: true
  },
  // اعتنى به
  caretaker: {
    type: String,
    trim: true
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
    type: String,
    trim: true
  },
  // عدد الصفحات
  pageCount: {
    type: Number,
    min: 1
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Book', BookSchema);
