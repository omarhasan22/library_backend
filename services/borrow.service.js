const Borrow = require('../models/borrow.model');
const Book = require('../models/book.model');
const EmailService = require('./email.service');

class BorrowService {
  async borrowBook(data) {
    const [bookExists, existingBorrow] = await Promise.all([
      Book.exists({ _id: data.book }),
      Borrow.exists({ book: data.book, returned: false })
    ]);

    if (!bookExists) throw new Error('Book not found');
    if (existingBorrow) throw new Error('Book is already borrowed');

    const borrow = new Borrow(data);
    const savedBorrow = await borrow.save();

    // Populate the saved borrow with book and user details
    return await Borrow.findById(savedBorrow._id)
      .populate('book', 'title')
      .populate('user', 'username email');
  }

  // Users may only return their own borrow; admins may return any.
  async returnBook(borrowId, user) {
    const borrow = await Borrow.findById(borrowId);
    if (!borrow) throw new Error('Borrow record not found');

    if (user && user.role !== 'admin' && String(borrow.user) !== String(user._id)) {
      const err = new Error('You can only return your own borrowed books');
      err.status = 403;
      throw err;
    }

    if (borrow.returned) throw new Error('Book is already returned');

    borrow.returned = true;
    borrow.returnedDate = new Date();
    return await borrow.save();
  }

  async getBorrowedBooks() {
    return await Borrow.find({ returned: false })
      .populate('book', 'title authors category')
      .populate('user', 'username email')
      .lean();
  }

  // Admin methods
  async getAllBorrows(page = 1, limit = 20, status = 'all') {
    const skip = (page - 1) * limit;
    const query = {};

    if (status === 'active') {
      query.returned = false;
    } else if (status === 'returned') {
      query.returned = true;
    }

    const [borrows, total] = await Promise.all([
      Borrow.find(query)
        .populate('book', 'title authors category')
        .populate('user', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Borrow.countDocuments(query)
    ]);

    return {
      borrows,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getUserBorrows(userId, status = 'all') {
    const query = { user: userId };

    if (status === 'active') {
      query.returned = false;
    } else if (status === 'returned') {
      query.returned = true;
    }

    return await Borrow.find(query)
      .populate('book', 'title authors category')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getOverdueBooks() {
    return await Borrow.find({
      returned: false,
      endDate: { $lt: new Date() }
    })
      .populate('book', 'title authors')
      .populate('user', 'username email')
      .lean();
  }

  // Returns full documents (not lean) because sendDueDateReminders saves them.
  async getBooksNearDue(days = 3) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await Borrow.find({
      returned: false,
      endDate: { $gte: new Date(), $lte: futureDate },
      emailNotificationSent: false
    })
      .populate('book', 'title authors')
      .populate('user', 'username email');
  }

  async sendDueDateReminders() {
    const nearDueBooks = await this.getBooksNearDue(3);
    const results = [];

    for (const borrow of nearDueBooks) {
      // The user or book may have been deleted since the borrow was made.
      if (!borrow.user || !borrow.book) continue;
      try {
        await EmailService.sendDueDateReminder(
          borrow.user.email,
          borrow.user.username,
          borrow.book.title,
          borrow.endDate
        );

        // Mark notification as sent
        borrow.emailNotificationSent = true;
        borrow.notificationDate = new Date();
        await borrow.save();

        results.push({ success: true, borrowId: borrow._id });
      } catch (error) {
        console.error(`Failed to send email for borrow ${borrow._id}:`, error);
        results.push({ success: false, borrowId: borrow._id, error: error.message });
      }
    }

    return results;
  }

  async sendOverdueNotifications() {
    const overdueBooks = await this.getOverdueBooks();
    const results = [];

    for (const borrow of overdueBooks) {
      if (!borrow.user || !borrow.book) continue;
      try {
        const daysOverdue = Math.floor((new Date() - new Date(borrow.endDate)) / (1000 * 60 * 60 * 24));

        await EmailService.sendOverdueNotification(
          borrow.user.email,
          borrow.user.username,
          borrow.book.title,
          daysOverdue
        );

        results.push({ success: true, borrowId: borrow._id, daysOverdue });
      } catch (error) {
        console.error(`Failed to send overdue email for borrow ${borrow._id}:`, error);
        results.push({ success: false, borrowId: borrow._id, error: error.message });
      }
    }

    return results;
  }

  async getBorrowStatistics() {
    const [totalBorrows, activeBorrows, overdueBooks] = await Promise.all([
      Borrow.countDocuments(),
      Borrow.countDocuments({ returned: false }),
      Borrow.countDocuments({ returned: false, endDate: { $lt: new Date() } })
    ]);

    return {
      totalBorrows,
      activeBorrows,
      returnedBooks: totalBorrows - activeBorrows,
      overdueBooks
    };
  }
}

module.exports = new BorrowService();
