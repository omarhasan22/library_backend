const mongoose = require('mongoose');

// Images for display slides are kept in MongoDB rather than on disk: the hosting disk is wiped on
// every redeploy, and these images are few and small (re-encoded to WebP, at most 1920px).
const displayMediaSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  width: Number,
  height: Number,
  size: Number
}, { timestamps: true });

module.exports = mongoose.model('DisplayMedia', displayMediaSchema);
