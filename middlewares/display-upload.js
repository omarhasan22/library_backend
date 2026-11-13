const multer = require('multer');

// Display-slide images: kept in memory, then re-encoded with sharp and stored in MongoDB
// (see services/display.service.js). Non-multipart requests pass straight through.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_MB = 15;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
    const err = new Error('نوع الملف غير مدعوم. استخدم JPG أو PNG أو WEBP.');
    err.status = 400;
    return cb(err);
  }
}).single('image');

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `حجم الصورة أكبر من ${MAX_MB} ميغابايت` });
    }
    return res.status(400).json({ error: err.status ? err.message : 'تعذّر رفع الملف' });
  });
};
