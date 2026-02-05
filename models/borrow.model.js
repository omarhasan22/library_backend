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

// Indexes for Borrow model
BorrowSchema.index({ book: 1 });
BorrowSchema.index({ user: 1 });
BorrowSchema.index({ returned: 1 });
BorrowSchema.index({ endDate: 1 });
BorrowSchema.index({ book: 1, returned: 1 }); // Compound for checking if book is borrowed
BorrowSchema.index({ user: 1, returned: 1 }); // Compound for user borrows
BorrowSchema.index({ returned: 1, endDate: 1 }); // Compound for overdue queries
BorrowSchema.index({ returned: 1, endDate: 1, emailNotificationSent: 1 }); // Compound for reminders

module.exports = mongoose.model('Borrow', BorrowSchema);
