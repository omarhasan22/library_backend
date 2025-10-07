const Borrow = require('../models/borrow.model');
const Book = require('../models/book.model');
const User = require('../models/users.model');
const EmailService = require('./email.service');

class BorrowService {
  async borrowBook(data) {
    console.log('Borrowing book:', data);

    const book = await Book.findById(data.book);
    console.log('Book found:', book);

    if (!book) throw new Error('Book not found');

    const existingBorrow = await Borrow.findOne({ book: data.book, returned: false });
    console.log('Existing borrow:', existingBorrow);

    if (existingBorrow) throw new Error('Book is already borrowed');

    const borrow = new Borrow(data);
    const savedBorrow = await borrow.save();

    // Populate the saved borrow with book and user details
    return await Borrow.findById(savedBorrow._id)
      .populate('book', 'title')
      .populate('user', 'username email');
  }

  async returnBook(borrowId) {
    const borrow = await Borrow.findById(borrowId);
    if (!borrow) throw new Error('Borrow record not found');

    if (borrow.returned) throw new Error('Book is already returned');

    borrow.returned = true;
    borrow.returnedDate = new Date();
    return await borrow.save();
  }

  async getBorrowedBooks() {
    return await Borrow.find({ returned: false })
      .populate('book', 'title authors category')
      .populate('user', 'username email');
  }

  // Admin methods
  async getAllBorrows(page = 1, limit = 20, status = 'all') {
    const skip = (page - 1) * limit;
    let query = {};

    if (status === 'active') {
      query.returned = false;
    } else if (status === 'returned') {
      query.returned = true;
    }

    const borrows = await Borrow.find(query)
      .populate('book', 'title authors category')
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Borrow.countDocuments(query);

    return {
      borrows,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getUserBorrows(userId, status = 'all') {
    let query = { user: userId };

    if (status === 'active') {
      query.returned = false;
    } else if (status === 'returned') {
      query.returned = true;
    }

    return await Borrow.find(query)
      .populate('book', 'title authors category')
      .sort({ createdAt: -1 });
  }

  async getOverdueBooks() {
    const today = new Date();
    return await Borrow.find({
      returned: false,
      endDate: { $lt: today }
    })
      .populate('book', 'title authors')
      .populate('user', 'username email');
  }

  async getBooksNearDue(days = 3) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const today = new Date();

    return await Borrow.find({
      returned: false,
      endDate: { $gte: today, $lte: futureDate },
      emailNotificationSent: false
    })
      .populate('book', 'title authors')
      .populate('user', 'username email');
  }

  async sendDueDateReminders() {
    try {
      const nearDueBooks = await this.getBooksNearDue(3);
      const results = [];

      for (const borrow of nearDueBooks) {
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
    } catch (error) {
      console.error('Error in sendDueDateReminders:', error);
      throw error;
    }
  }

  async sendOverdueNotifications() {
    try {
      const overdueBooks = await this.getOverdueBooks();
      const results = [];

      for (const borrow of overdueBooks) {
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
    } catch (error) {
      console.error('Error in sendOverdueNotifications:', error);
      throw error;
    }
  }

  async getBorrowStatistics() {
    const totalBorrows = await Borrow.countDocuments();
    const activeBorrows = await Borrow.countDocuments({ returned: false });
    const overdueBooks = await Borrow.countDocuments({
      returned: false,
      endDate: { $lt: new Date() }
    });

    return {
      totalBorrows,
      activeBorrows,
      returnedBooks: totalBorrows - activeBorrows,
      overdueBooks
    };
  }
}

module.exports = new BorrowService();
