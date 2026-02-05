const mongoose = require('mongoose');
const { subject } = require('./subject.model'); // adjust path

const category = mongoose.Schema({
   title: {
      type: String,
      required: true,
   },
   normalizedTitle: { type: String, required: false },
   subjects: {
      type: [subject],
      default: []
   }
});

// Index for Category model
category.index({ normalizedTitle: 1 });

module.exports = mongoose.model('Category', category);
