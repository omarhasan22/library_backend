const mongoose = require('mongoose');

const subject = mongoose.Schema({
   title: {
      type: String,
      required: true,
   },
   normalizedTitle: {
      type: String,
      required: false
   }
});

// Index for Subject model
subject.index({ normalizedTitle: 1 });

// Export the author model
module.exports = mongoose.model('Subject', subject);