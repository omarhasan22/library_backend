const BorrowService = require('../services/borrow.service');

class BorrowController {
  async borrowBook(req, res) {
    try {
      // Get user ID from authenticated request
      const userId = req.user._id;

      // Combine user id and book borrow data from body
      const borrowData = {
        user: userId,
        book: req.body.book,
        startDate: req.body.startDate || new Date(),
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

  // Admin endpoints
  async getAllBorrows(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status || 'all';

      const result = await BorrowService.getAllBorrows(page, limit, status);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getUserBorrows(req, res) {
    try {
      const userId = req.params.userId || req.user._id;
      const status = req.query.status || 'all';

      const borrows = await BorrowService.getUserBorrows(userId, status);
      res.status(200).json(borrows);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getMyBorrows(req, res) {
    try {
      const userId = req.user._id;
      const status = req.query.status || 'all';

      const borrows = await BorrowService.getUserBorrows(userId, status);
      res.status(200).json(borrows);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getOverdueBooks(req, res) {
    try {
      const overdueBooks = await BorrowService.getOverdueBooks();
      res.status(200).json(overdueBooks);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getBorrowStatistics(req, res) {
    try {
      const stats = await BorrowService.getBorrowStatistics();
      res.status(200).json(stats);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async sendDueDateReminders(req, res) {
    try {
      const results = await BorrowService.sendDueDateReminders();
      res.status(200).json({
        message: 'Due date reminders processed',
        results
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async sendOverdueNotifications(req, res) {
    try {
      const results = await BorrowService.sendOverdueNotifications();
      res.status(200).json({
        message: 'Overdue notifications processed',
        results
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = new BorrowController();
