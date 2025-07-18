const Borrow = require('../models/borrow.model');
const Book = require('../models/book.model');

class BorrowService {
  async borrowBook(data) {
    console.log('Borrowing book:', data);
    
    const book = await Book.findById(data.book);
    console.log('Book found:', book);
    
    if (!book) throw new Error('Book not found');

    const existingBorrow = await Borrow.findOne({ book: data.book, returned: false });
    console.log('Existing borrow:', existingBorrow);
    
    if (existingBorrow) throw new Error('Book is already borrowed');
    data.user = data.user  
    const borrow = new Borrow(data);
    return await borrow.save();
  }

  async returnBook(borrowId) {
    const borrow = await Borrow.findById(borrowId);
    if (!borrow) throw new Error('Borrow record not found');

    if (borrow.returned) throw new Error('Book is already returned');

    borrow.returned = true;
    return await borrow.save();
  }

  async getBorrowedBooks() {
    return await Borrow.find({ returned: false }).populate('book');
  }
}

module.exports = new BorrowService();
