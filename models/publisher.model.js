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

module.exports = mongoose.model('Publisher', publisherSchema);
