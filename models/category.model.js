const mongoose = require('mongoose');

const category = mongoose.Schema({
   title: {
      type: String,
      required: true,
   },
   normalizedTitle: {
      type: String,
      required: false
   }
})
// Export the author model
module.exports = mongoose.model('Category', category);