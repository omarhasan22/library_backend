const mongoose = require('mongoose');

// Screen-wide options. A single document (key: 'main'), created on first read.
const displaySettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  tickerEnabled: { type: Boolean, default: false },
  // One news item per line.
  tickerText: { type: String, trim: true, default: '', maxlength: [3000, 'نص الشريط طويل جداً'] },
  hadithEnabled: { type: Boolean, default: false },
  // One hadith per line, optionally "text | source". Shown one at a time in the bottom bar.
  hadithText: { type: String, trim: true, default: '', maxlength: [5000, 'نص الأحاديث طويل جداً'] },
  showClock: { type: Boolean, default: true },
  // Days to add to the computed Hijri date, to match the locally announced month start.
  hijriOffset: { type: Number, min: -3, max: 3, default: 0 },
  transition: { type: String, enum: ['fade', 'slide', 'zoom'], default: 'fade' }
}, { timestamps: true });

module.exports = mongoose.model('DisplaySettings', displaySettingsSchema);
