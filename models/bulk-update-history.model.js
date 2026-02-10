const mongoose = require('mongoose');

const bulkUpdateHistorySchema = new mongoose.Schema({
   // Unique identifier for the update
   updateId: {
      type: String,
      required: true,
      unique: true
   },

   // User who made the change
   userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
   },

   // Search criteria used for the update
   criteria: {
      roomNumber: { type: String, required: false },
      wallNumber: { type: String, required: false },
      shelfNumber: { type: String, required: true },
      bookNumberFrom: { type: Number, required: true },
      bookNumberTo: { type: Number, required: true }
   },

   // Update type: 'subject' or 'category'
   updateType: {
      type: String,
      enum: ['subject', 'category'],
      required: true
   },

   // Previous subject information (optional, for subject updates)
   oldSubject: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: false },
      title: { type: String, required: false }
   },

   // New subject information (optional, for subject updates)
   newSubject: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: false },
      title: { type: String, required: false }
   },

   // Previous category information (optional, for category updates)
   oldCategory: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: false },
      title: { type: String, required: false }
   },

   // New category information (optional, for category updates)
   newCategory: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: false },
      title: { type: String, required: false }
   },

   // List of affected books
   affectedBooks: [{
      bookId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Book',
         required: true
      },
      bookTitle: {
         type: String,
         required: true
      },
      previousSubjectId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Subject',
         required: false
      },
      previousCategoryId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Category',
         required: false
      }
   }],

   // Status of the update
   status: {
      type: String,
      enum: ['active', 'undone'],
      default: 'active'
   },

   // Timestamps
   createdAt: {
      type: Date,
      default: Date.now
   },

   undoneAt: {
      type: Date,
      required: false
   }
});

// Index for faster queries
bulkUpdateHistorySchema.index({ userId: 1, createdAt: -1 });
bulkUpdateHistorySchema.index({ status: 1, createdAt: -1 });
bulkUpdateHistorySchema.index({ updateId: 1 });

module.exports = mongoose.model('BulkUpdateHistory', bulkUpdateHistorySchema);
