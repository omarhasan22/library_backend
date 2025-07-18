const mongoose = require('mongoose');

const subject = mongoose.Schema({
   title:{
      type: String,
      required: true,
   },
})
// Export the author model
module.exports = mongoose.model('Subject', subject);