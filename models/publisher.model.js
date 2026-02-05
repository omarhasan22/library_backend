const mongoose = require('mongoose');

const publisherSchema = new mongoose.Schema({
   title: {
      type: String,
      required: true,
   },
   normalizedTitle: {
      type: String,
      required: false
   }
});

// Index for Publisher model
publisherSchema.index({ normalizedTitle: 1 });

module.exports = mongoose.model('Publisher', publisherSchema);
