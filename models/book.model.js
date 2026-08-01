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
  },

  // Precomputed sortable keys for the address fields, maintained by the
  // pre-save / pre-findOneAndUpdate hooks below. Numeric values are encoded as
  // '0' + zero-padded digits and non-numeric values as '1' + raw string, so a
  // plain ascending string sort orders numbers numerically and before text —
  // the same ordering the old $convert/$cond aggregation stages produced.
  sortKeys: {
    room: { type: String },
    shelf: { type: String },
    wall: { type: String },
    book: { type: String }
  }

}, {
  timestamps: true
});

function addressSortKey(value) {
  const str = value == null ? '' : String(value).trim();
  if (/^\d+$/.test(str)) return '0' + str.padStart(12, '0');
  return '1' + str;
}

function computeSortKeys(address) {
  const a = address || {};
  return {
    room: addressSortKey(a.roomNumber),
    shelf: addressSortKey(a.shelfNumber),
    wall: addressSortKey(a.wallNumber),
    book: addressSortKey(a.bookNumber)
  };
}

BookSchema.statics.computeSortKeys = computeSortKeys;

BookSchema.pre('save', function (next) {
  this.sortKeys = computeSortKeys(this.address);
  next();
});

BookSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  if (update.$set && update.$set.address) {
    update.$set.sortKeys = computeSortKeys(update.$set.address);
  } else if (update.address) {
    update.sortKeys = computeSortKeys(update.address);
  }
  next();
});

// One-time, idempotent backfill for books created before sortKeys existed.
BookSchema.statics.backfillSortKeys = async function () {
  const missing = await this.find({ 'sortKeys.room': { $exists: false } }).select('address').lean();
  if (!missing.length) return 0;
  const ops = missing.map(doc => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { sortKeys: computeSortKeys(doc.address) } }
    }
  }));
  await this.bulkWrite(ops, { ordered: false });
  return ops.length;
};

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

// Supports the default book-list sort (room → shelf → wall → book, _id tiebreaker)
// in both directions without an in-memory sort.
BookSchema.index({ 'sortKeys.room': 1, 'sortKeys.shelf': 1, 'sortKeys.wall': 1, 'sortKeys.book': 1, _id: 1 });

module.exports = mongoose.model('Book', BookSchema);