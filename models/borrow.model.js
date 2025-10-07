const mongoose = require('mongoose');

const BorrowSchema = new mongoose.Schema({
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  returned: {
    type: Boolean,
    default: false
  },
  returnedDate: {
    type: Date
  },
  emailNotificationSent: {
    type: Boolean,
    default: false
  },
  notificationDate: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Borrow', BorrowSchema);
