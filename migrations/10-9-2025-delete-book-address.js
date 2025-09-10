// scripts/deleteAndShiftBooks.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // adjust path if needed

const mongoose = require('mongoose');

const mongoURI = process.env.MONGO_URI_LOCAL;
if (!mongoURI) {
   console.error('❌ MONGO_URI_LOCAL is not defined. Set it in your .env or environment variables.');
   process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

mongoose
   .connect(mongoURI /*, options if you need them */)
   .then(() => console.log(`✅ MongoDB connected (${isProduction ? 'production' : 'development'})`))
   .catch((err) => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
   });

const Book = require('../models/book.model'); // adjust path as necessary

async function deleteAndShiftBooks() {
   try {
      console.log('Starting deletion and shift of books...');

      // Define the target address (use the same types as your schema)
      const targetAddress = {
         roomNumber: '4',
         wallNumber: 'أ',
         shelfNumber: '5',
         bookNumber: '3', // if schema uses Number, change this to 3 (number)
      };

      // Find the book to delete (use object path form or nested object)
      const bookToDelete = await Book.findOne({
         'address.roomNumber': targetAddress.roomNumber,
         'address.wallNumber': targetAddress.wallNumber,
         'address.shelfNumber': targetAddress.shelfNumber,
         // if schema stores bookNumber as Number, pass Number(targetAddress.bookNumber)
         'address.bookNumber': targetAddress.bookNumber,
      });

      if (!bookToDelete) {
         console.log('No book found at the specified address.');
         return;
      }

      // Convert the bookNumber from the found document to a number if needed
      const deletedBookNumber = Number(bookToDelete.address.bookNumber);

      // Delete the book
      await Book.deleteOne({ _id: bookToDelete._id });
      console.log(`Deleted book with ID: ${bookToDelete._id}`);

      // Shift down bookNumber for remaining books in the same address (books with higher bookNumbers)
      const shiftResult = await Book.updateMany(
         {
            'address.roomNumber': bookToDelete.address.roomNumber,
            'address.wallNumber': bookToDelete.address.wallNumber,
            'address.shelfNumber': bookToDelete.address.shelfNumber,
            'address.bookNumber': { $gt: deletedBookNumber },
         },
         { $inc: { 'address.bookNumber': -1 } }
      );

      console.log(`Shifted ${shiftResult.modifiedCount ?? shiftResult.nModified ?? 0} books down by 1`);
      console.log('Deletion and shift completed successfully!');
   } catch (error) {
      console.error('Error during operation:', error);
   } finally {
      await mongoose.connection.close();
      console.log('Database connection closed');
   }
}

deleteAndShiftBooks();
