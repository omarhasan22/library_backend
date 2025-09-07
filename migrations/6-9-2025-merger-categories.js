const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb+srv://omarhasan22:81195404OMAR@cluster0.e47czbw.mongodb.net/myLibrary?retryWrites=true&w=majority', {
   useNewUrlParser: true,
   useUnifiedTopology: true,
});


const Book = require('../models/book.model'); // adjust path as necessary
// Migration function
async function updateBooksSubject() {
   try {
      console.log('Starting book subject update...');

      // Define the subject IDs
      const oldSubjectId = '68a785ee6b3fbe1d69a898a7';
      const newSubjectId = '68aba466cea800ffbed398aa';

      // Count books with the old subject
      const countBefore = await Book.countDocuments({ subject: oldSubjectId });
      console.log(`Found ${countBefore} books with the old subject (${oldSubjectId})`);

      if (countBefore === 0) {
         console.log('No books found with the old subject. Exiting migration.');
         return;
      }

      // Update the books
      const result = await Book.updateMany(
         { subject: oldSubjectId },
         { $set: { subject: newSubjectId } }
      );

      console.log(`Successfully updated ${result.modifiedCount} books`);

      // Verify the update
      const countAfter = await Book.countDocuments({ subject: oldSubjectId });
      console.log(`Books with old subject after migration: ${countAfter}`);

      const countNewSubject = await Book.countDocuments({ subject: newSubjectId });
      console.log(`Books with new subject after migration: ${countNewSubject}`);

      if (countAfter === 0 && countNewSubject >= countBefore) {
         console.log('Migration completed successfully!');
      } else {
         console.log('Warning: Some books may not have been updated correctly');
      }
   } catch (error) {
      console.error('Error during migration:', error);
   } finally {
      // Close the connection
      await mongoose.connection.close();
      console.log('Database connection closed');
   }
}

// Run the migration
updateBooksSubject();