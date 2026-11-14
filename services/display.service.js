const mongoose = require('mongoose');
const sharp = require('sharp');
const DisplaySlide = require('../models/display-slide.model');
const DisplayMedia = require('../models/display-media.model');
const DisplaySettings = require('../models/display-settings.model');

// Fields the admin may set. Anything else in the request body is ignored.
const SLIDE_FIELDS = [
  'template', 'theme', 'title', 'subtitle', 'body', 'attribution', 'eventDate', 'eventTime',
  'location', 'imageFit', 'duration', 'isActive', 'startDate', 'endDate'
];
const SETTINGS_FIELDS = [
  'tickerEnabled', 'tickerText', 'hadithEnabled', 'hadithText', 'showClock', 'hijriOffset', 'transition'
];

// What each template cannot be shown without.
const REQUIRED = {
  welcome: [['title', 'العنوان مطلوب']],
  announcement: [['title', 'العنوان مطلوب']],
  quote: [['body', 'النص مطلوب']],
  event: [['title', 'العنوان مطلوب']],
  book: [['title', 'عنوان الكتاب مطلوب']],
  photo: [['image', 'هذا القالب يحتاج إلى صورة']],
  image: [['image', 'ارفع صورة لعرضها']]
};

const MAX_IMAGE_SIDE = 1920;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function pick(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

function checkRequired(slide) {
  for (const [field, message] of REQUIRED[slide.template] || []) {
    const value = slide[field];
    if (!value || (typeof value === 'string' && !value.trim())) throw badRequest(message);
  }
  if (slide.startDate && slide.endDate && slide.startDate > slide.endDate) {
    throw badRequest('تاريخ النهاية قبل تاريخ البداية');
  }
}

function toPublicSettings(doc) {
  return pick(doc || {}, SETTINGS_FIELDS);
}

class DisplayService {
  static async getSettings() {
    const doc = await DisplaySettings.findOneAndUpdate(
      { key: 'main' },
      { $setOnInsert: { key: 'main' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return toPublicSettings(doc);
  }

  static async updateSettings(data) {
    const doc = await DisplaySettings.findOneAndUpdate(
      { key: 'main' },
      { $set: pick(data || {}, SETTINGS_FIELDS) },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return toPublicSettings(doc);
  }

  // What the screen needs: settings and every enabled slide. The screen applies the date
  // schedule itself, using its local date.
  static async getScreen() {
    const [settings, slides] = await Promise.all([
      this.getSettings(),
      DisplaySlide.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).select('-__v -createdAt').lean()
    ]);
    return { settings, slides };
  }

  static async getAdminData() {
    const [settings, slides] = await Promise.all([
      this.getSettings(),
      DisplaySlide.find().sort({ order: 1, createdAt: 1 }).select('-__v').lean()
    ]);
    return { settings, slides };
  }

  // Re-encode the upload: fixes phone-camera rotation, caps the size, strips metadata (GPS etc.).
  static async storeImage(file) {
    let output;
    try {
      output = await sharp(file.buffer, { failOn: 'error' })
        .rotate()
        .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw badRequest('تعذّرت قراءة الصورة. جرّب صورة بصيغة JPG أو PNG.');
    }
    const media = await DisplayMedia.create({
      data: output.data,
      contentType: 'image/webp',
      width: output.info.width,
      height: output.info.height,
      size: output.info.size
    });
    return media._id;
  }

  static async createSlide(data, file) {
    const slide = new DisplaySlide(pick(data, SLIDE_FIELDS));
    const last = await DisplaySlide.findOne().sort({ order: -1 }).select('order').lean();
    slide.order = last ? last.order + 1 : 0;

    // Validate before storing the image so a rejected slide leaves no orphan image behind.
    await slide.validate();
    if (file) slide.image = await this.storeImage(file);
    try {
      checkRequired(slide);
      await slide.save();
    } catch (err) {
      if (slide.image) await DisplayMedia.deleteOne({ _id: slide.image });
      throw err;
    }
    return slide.toObject({ versionKey: false });
  }

  static async updateSlide(id, data, file) {
    if (!mongoose.isValidObjectId(id)) return null;
    const slide = await DisplaySlide.findById(id);
    if (!slide) return null;

    slide.set(pick(data, SLIDE_FIELDS));
    await slide.validate();

    const previousImage = slide.image;
    let newImage = null;
    if (file) {
      newImage = await this.storeImage(file);
      slide.image = newImage;
    } else if (data.removeImage === true || data.removeImage === 'true') {
      slide.image = null;
    }

    try {
      checkRequired(slide);
      await slide.save();
    } catch (err) {
      if (newImage) await DisplayMedia.deleteOne({ _id: newImage });
      throw err;
    }

    if (previousImage && !previousImage.equals(slide.image || undefined)) {
      await DisplayMedia.deleteOne({ _id: previousImage });
    }
    return slide.toObject({ versionKey: false });
  }

  static async deleteSlide(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    const slide = await DisplaySlide.findByIdAndDelete(id).lean();
    if (slide && slide.image) await DisplayMedia.deleteOne({ _id: slide.image });
    return slide;
  }

  // `ids` is the full new order (first = shown first).
  static async reorderSlides(ids) {
    if (!Array.isArray(ids) || !ids.every(id => mongoose.isValidObjectId(id))) {
      throw badRequest('ترتيب غير صالح');
    }
    if (ids.length) {
      await DisplaySlide.bulkWrite(ids.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } }
      })));
    }
  }

  static async getMedia(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return DisplayMedia.findById(id).select('data contentType');
  }
}

module.exports = DisplayService;
