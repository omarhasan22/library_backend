const mongoose = require('mongoose');

// One slide on the library display screen. The frontend renders each `template` with the
// centre's branding; the text fields are reused by the templates that need them.
const TEMPLATES = ['welcome', 'announcement', 'quote', 'event', 'book', 'photo', 'image'];
const THEMES = ['teal', 'light', 'dark'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (max) => ({
  type: String,
  trim: true,
  default: '',
  maxlength: [max, `النص أطول من الحد المسموح (${max} حرفاً)`]
});

// Schedule dates are plain YYYY-MM-DD strings: the screen compares them with its own local date,
// so the server's time zone never shifts a slide by a day.
const day = {
  type: String,
  default: '',
  validate: { validator: v => !v || DATE_RE.test(v), message: 'صيغة التاريخ غير صحيحة' }
};

const displaySlideSchema = new mongoose.Schema({
  template: { type: String, enum: { values: TEMPLATES, message: 'قالب غير معروف' }, required: [true, 'اختر قالباً'] },
  theme: { type: String, enum: { values: THEMES, message: 'لون غير معروف' }, default: 'teal' },

  title: text(150),
  subtitle: text(160),
  body: text(700),
  attribution: text(150),
  eventDate: text(80),
  eventTime: text(80),
  location: text(120),

  image: { type: mongoose.Schema.Types.ObjectId, ref: 'DisplayMedia', default: null },
  imageFit: { type: String, enum: ['cover', 'contain'], default: 'cover' },

  duration: { type: Number, min: [3, 'أقل مدة 3 ثوانٍ'], max: [600, 'أطول مدة 600 ثانية'], default: 12 },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  startDate: day,
  endDate: day
}, { timestamps: true });

displaySlideSchema.index({ order: 1, createdAt: 1 });

displaySlideSchema.statics.TEMPLATES = TEMPLATES;

module.exports = mongoose.model('DisplaySlide', displaySlideSchema);
