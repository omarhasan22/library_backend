const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // adjust path if needed

const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI_PROD
mongoose.connect(MONGO_URI, {
   useNewUrlParser: true,
   useUnifiedTopology: true,
});

const Book = require('../models/book.model'); // adjust path as necessary

async function deleteAndShiftBooks() {
   try {
      console.log('Starting deletion and shift of books...');

      // Define the target address
      const targetAddress = {
         'address.roomNumber': 4,
         'address.wallNumber': 'أ',
         'address.shelfNumber': 5,
         'address.bookNumber': 3,
      };

      // Find the book to delete
      // const bookToDelete = await Book.findOne(targetAddress);

      // if (!bookToDelete) {
      //    console.log('No book found at the specified address.');
      //    return;
      // }

      // Delete the book
      // await Book.deleteOne({ _id: bookToDelete._id });
      // console.log(`Deleted book with ID: ${bookToDelete._id}`);

      // Shift down bookNumber for remaining books in the same address (higher bookNumbers)
      const shiftResult = await Book.updateMany(
         {
            'address.roomNumber': targetAddress['address.roomNumber'],
            'address.wallNumber': targetAddress['address.wallNumber'],
            'address.shelfNumber': targetAddress['address.shelfNumber'],
            'address.bookNumber': { $gt: targetAddress['address.bookNumber'] }, // higher book numbers
         },
         { $inc: { 'address.bookNumber': -1 } }
      );

      console.log(`Shifted ${shiftResult.modifiedCount} books down by 1`);
      console.log('Deletion and shift completed successfully!');
   } catch (error) {
      console.error('Error during operation:', error);
   } finally {
      await mongoose.connection.close();
      console.log('Database connection closed');
   }
}

deleteAndShiftBooks();