const mongoose = require('mongoose');
const Book = require('../models/book.model'); // adjust if path is different

// 🛠 Connect to your DB
const MONGO_URI = process.env.MONGO_URI_PROD

mongoose.connect(MONGO_URI)
   .then(() => {
      console.log('✅ Connected to MongoDB');
      migrate();
   })
   .catch(err => console.error('❌ MongoDB connection error:', err));

async function migrate() {
   try {
      // Retrieve documents including old fields
      const books = await Book.find({})
         .setOptions({ strictQuery: false })
         .lean();

      for (const bookDoc of books) {
         let modified = false;
         const update = {};

         // 1. Convert single author to authors array
         if (bookDoc.author && (!bookDoc.authors || bookDoc.authors.length === 0)) {
            update.$set = update.$set || {};
            update.$set.authors = [bookDoc.author];
            modified = true;
         }

         // 2. Convert muhashi to commentators array
         if (bookDoc.muhashi && (!bookDoc.commentators || bookDoc.commentators.length === 0)) {
            update.$set = update.$set || {};
            update.$set.commentators = [bookDoc.muhashi];
            modified = true;
         }

         // 3. Convert editor to editors array
         if (bookDoc.editor && (!bookDoc.editors || bookDoc.editors.length === 0)) {
            update.$set = update.$set || {};
            update.$set.editors = [bookDoc.editor];
            modified = true;
         }

         // 4. Convert caretaker to caretakers array
         if (bookDoc.caretaker && (!bookDoc.caretakers || bookDoc.caretakers.length === 0)) {
            update.$set = update.$set || {};
            update.$set.caretakers = [bookDoc.caretaker];
            modified = true;
         }

         // 5. Convert publisher/publisher2 to publishers array
         if (!bookDoc.publishers || bookDoc.publishers.length === 0) {
            const pubs = [];
            if (bookDoc.publisher) pubs.push(bookDoc.publisher);
            if (bookDoc.publisher2) pubs.push(bookDoc.publisher2);
            if (pubs.length > 0) {
               update.$set = update.$set || {};
               update.$set.publishers = pubs;
               modified = true;
            }
         }

         // Add unset for old fields
         const oldFields = ['author', 'muhashi', 'editor', 'caretaker', 'publisher', 'publisher2'];
         const unsetFields = oldFields.filter(field => bookDoc[field] !== undefined);

         if (unsetFields.length > 0) {
            update.$unset = {};
            unsetFields.forEach(field => {
               update.$unset[field] = "";
            });
            modified = true;
         }

         if (modified) {
            // Use direct update to avoid document re-insertion
            await Book.updateOne(
               { _id: bookDoc._id },
               update
            );
            console.log(`✅ Migrated book: ${bookDoc.title}`);
         }
      }

      console.log('🎉 Migration completed.');
      mongoose.disconnect();
   } catch (error) {
      console.error('❌ Migration failed:', error);
      mongoose.disconnect();
   }
}
