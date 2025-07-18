const BorrowService = require('../services/borrow.service');

class BorrowController {
  async borrowBook(req, res) {
    try {
      // Get user ID from authenticated request
      const userId = req.user._id;
      console.log('User ID:', userId);
      

      // Combine user id and book borrow data from body
      const borrowData = {
        user: userId,
        book: req.body.book,
        startDate: new Date(),       // can set start date to current date here or from frontend
        endDate: req.body.endDate
      };

      const borrow = await BorrowService.borrowBook(borrowData);
      res.status(201).json(borrow);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async returnBook(req, res) {
    try {
      const borrowId = req.params.id;
      const returnedBorrow = await BorrowService.returnBook(borrowId);
      res.status(200).json(returnedBorrow);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getBorrowedBooks(req, res) {
    try {
      const borrows = await BorrowService.getBorrowedBooks();
      res.status(200).json(borrows);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = new BorrowController();
