const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = mongoose.model('User');
const bcrypt = require('bcrypt');
const upload = require('../middlewares/multer');

const registrationCtrl = require('../controllers/registration.controller');
const loginCtrl = require('../controllers/login.controller');
const refreshCtrl = require('../controllers/refresh.controller');
const { isAuthenticate } = require('../middlewares/authenticate');

const bookController = require('../controllers/book.controller');
const BorrowController = require('../controllers/borrow.controller');
const AuthorController = require('../controllers/author.controller');
const PublisherController = require('../controllers/publisher.controller');
const CategoryController = require('../controllers/category.controller');
const SubjectController = require('../controllers/subject.controller');

// AUTH ROUTES
router.post('/auth/register', registrationCtrl.register);
router.post('/auth/login', loginCtrl.login);
router.post('/auth/refresh', refreshCtrl.refresh);
router.get('/auth/profile', isAuthenticate, loginCtrl.getProfile);
router.put('/auth/profile', isAuthenticate, loginCtrl.updateProfile);

// USER CRUD OPERATIONS
router.post('/users/create', async (req, res) => {
  try {
    const user = new User(req.body);
    user.password = bcrypt.hashSync(user.password, bcrypt.genSaltSync(10));
    const result = await User.create(user);
    res.json({ message: `${result.username} successfully created!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/userId/:userId', loginCtrl.getUser);


router.put('/users/update', async (req, res) => {
  try {
    const { username, nickname } = req.body;
    const updatedUser = await User.findOneAndUpdate(
      { username },
      { $set: { nickname } },
      { new: true }
    );
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/delete', async (req, res) => {
  try {
    const { username } = req.body;
    const result = await User.deleteOne({ username });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// BOOK ROUTES
// remove multer for JSON creation
router.post('/books', bookController.createBook);

router.get('/books', bookController.getAllBooks);
router.get('/books/statistics', bookController.getStatistics);
router.get('/books/rooms', bookController.getUniqueRoomNumbers);
router.get('/books/walls', bookController.getUniqueWallNumbers);
router.post('/books/export', bookController.exportBooks);
router.post('/books/export-locations', bookController.exportBookLocations);
router.post('/books/bulk-update-subjects', isAuthenticate, bookController.bulkUpdateSubjects);
router.post('/books/bulk-update-categories', isAuthenticate, bookController.bulkUpdateCategories);
router.post('/books/undo-bulk-update-subjects', isAuthenticate, bookController.undoBulkUpdateSubjects);
router.get('/books/bulk-update-history', isAuthenticate, bookController.getBulkUpdateHistory);
router.get('/books/bulk-update-history/:id', isAuthenticate, bookController.getHistoryById);
router.get('/books/:id', bookController.getBookById);
router.put('/books/:id', bookController.updateBook);
router.delete('/books/:id', bookController.deleteBook);

// CATEGORY ROUTES
router.get('/categories', bookController.getCategories);
router.get('/categories/:category-id', bookController.getCategoryById);
router.post('/categories', bookController.createCategory); // NEW ROUTE

// SUBJECT ROUTES
router.get('/subjects', bookController.getsubjects);
router.post('/subjects', bookController.createSubject); // NEW ROUTE

// PUBLISHER ROUTES
router.get('/publishers', bookController.getPublishers);
router.post('/publishers', bookController.createPublisher); // NEW ROUTE

// PEOPLE ROUTES (for Authors, Commentators, etc.)
router.get('/people', bookController.getPeople);
router.post('/people', bookController.createPerson); // NEW ROUTE


// BORROW ROUTES
router.post('/borrows/borrow', isAuthenticate, BorrowController.borrowBook);
router.put('/borrows/return/:id', isAuthenticate, BorrowController.returnBook);
router.get('/borrows/borrowed', isAuthenticate, BorrowController.getBorrowedBooks);

// User borrow routes
router.get('/borrows/my-borrows', isAuthenticate, BorrowController.getMyBorrows);

// Admin borrow routes
router.get('/borrows/all', isAuthenticate, BorrowController.getAllBorrows);
router.get('/borrows/user/:userId', isAuthenticate, BorrowController.getUserBorrows);
router.get('/borrows/overdue', isAuthenticate, BorrowController.getOverdueBooks);
router.get('/borrows/statistics', isAuthenticate, BorrowController.getBorrowStatistics);
router.post('/borrows/send-reminders', isAuthenticate, BorrowController.sendDueDateReminders);
router.post('/borrows/send-overdue-notifications', isAuthenticate, BorrowController.sendOverdueNotifications);

// AUTHOR ROUTES
router.get('/authors', AuthorController.getAllAuthors);
router.get('/authors/stats', AuthorController.getAuthorStats);
router.get('/authors/:id', AuthorController.getAuthorById);
router.post('/authors', isAuthenticate, AuthorController.createAuthor);
router.put('/authors/:id', isAuthenticate, AuthorController.updateAuthor);
router.delete('/authors/:id', isAuthenticate, AuthorController.deleteAuthor);

// PUBLISHER ROUTES (Dashboard/Admin routes)
// GET /publishers is handled by bookController.getPublishers with isPagination parameter
router.get('/publishers/stats', PublisherController.getPublisherStats);
router.get('/publishers/:id', PublisherController.getPublisherById);
// POST /publishers is handled by bookController.createPublisher (line 102) for backward compatibility
// For authenticated admin operations, use PublisherController methods
router.put('/publishers/:id', isAuthenticate, PublisherController.updatePublisher);
router.delete('/publishers/:id', isAuthenticate, PublisherController.deletePublisher);

// CATEGORY ROUTES
router.get('/categories', CategoryController.getAllCategories);
router.get('/categories/stats', CategoryController.getCategoryStats);
router.get('/categories/:id', CategoryController.getCategoryById);
router.post('/categories', isAuthenticate, CategoryController.createCategory);
router.put('/categories/:id', isAuthenticate, CategoryController.updateCategory);
router.delete('/categories/:id', isAuthenticate, CategoryController.deleteCategory);

// SUBJECT ROUTES
router.get('/subjects', SubjectController.getAllSubjects);
router.get('/subjects/stats', SubjectController.getSubjectStats);
router.get('/subjects/:id', SubjectController.getSubjectById);
router.post('/subjects', isAuthenticate, SubjectController.createSubject);
router.put('/subjects/:id', isAuthenticate, SubjectController.updateSubject);
router.delete('/subjects/:id', isAuthenticate, SubjectController.deleteSubject);

module.exports = router;