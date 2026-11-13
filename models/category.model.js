const mongoose = require('mongoose');

const category = mongoose.Schema({
   title: {
      type: String,
      required: true,
   },
   normalizedTitle: { type: String, required: false },
   // Embedded copies of subjects ({ _id, title, normalizedTitle }). Stored as Mixed, which is what
   // the previous `[subject]` declaration resolved to (that import was always undefined).
   subjects: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
   }
});

// Index for Category model
category.index({ normalizedTitle: 1 });

module.exports = mongoose.model('Category', category);
