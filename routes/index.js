const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/users.model');

const registrationCtrl = require('../controllers/registration.controller');
const loginCtrl = require('../controllers/login.controller');
const refreshCtrl = require('../controllers/refresh.controller');
const { isAuthenticate, requireAdmin } = require('../middlewares/authenticate');

const bookController = require('../controllers/book.controller');
const BorrowController = require('../controllers/borrow.controller');
const AuthorController = require('../controllers/author.controller');
const PublisherController = require('../controllers/publisher.controller');
const CategoryController = require('../controllers/category.controller');
const SubjectController = require('../controllers/subject.controller');
const DisplayController = require('../controllers/display.controller');
const displayUpload = require('../middlewares/display-upload');

// Shorthand for routes that change data or expose other users' data.
const admin = [isAuthenticate, requireAdmin];

// Slow down password guessing / account spam.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' }
});

// AUTH ROUTES
router.post('/auth/register', authLimiter, registrationCtrl.register);
router.post('/auth/login', authLimiter, loginCtrl.login);
router.post('/auth/refresh', refreshCtrl.refresh);
router.get('/auth/profile', isAuthenticate, loginCtrl.getProfile);
router.put('/auth/profile', isAuthenticate, loginCtrl.updateProfile);

// USER ADMIN OPERATIONS (not used by the frontend; admin-only)
router.post('/users/create', admin, async (req, res) => {
  try {
    const { email, username, password, role } = req.body;
    // The users model pre-save hook hashes the password.
    const result = await User.create({ email, username, password, role });
    res.json({ message: `${result.username} successfully created!` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/users/userId/:userId', admin, loginCtrl.getUser);

router.get('/users/:username', admin, async (req, res) => {
  try {
    const user = await User.findOne({ username: String(req.params.username) }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/delete', admin, async (req, res) => {
  try {
    const result = await User.deleteOne({ username: String(req.body.username) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BOOK ROUTES (static paths must stay above /books/:id)
router.get('/books', bookController.getAllBooks);
router.get('/books/statistics', bookController.getStatistics);
router.get('/books/rooms', bookController.getUniqueRoomNumbers);
router.get('/books/walls', bookController.getUniqueWallNumbers);
router.post('/books', admin, bookController.createBook);
router.post('/books/export', admin, bookController.exportBooks);
router.post('/books/export-locations', admin, bookController.exportBookLocations);
router.post('/books/bulk-update-subjects', admin, bookController.bulkUpdateSubjects);
router.post('/books/bulk-update-categories', admin, bookController.bulkUpdateCategories);
router.post('/books/undo-bulk-update-subjects', admin, bookController.undoBulkUpdateSubjects);
router.get('/books/bulk-update-history', admin, bookController.getBulkUpdateHistory);
router.get('/books/bulk-update-history/:id', admin, bookController.getHistoryById);
router.get('/books/:id', bookController.getBookById);
router.put('/books/:id', admin, bookController.updateBook);
router.delete('/books/:id', admin, bookController.deleteBook);

// CATEGORY ROUTES
// GET/POST /categories use the book controller (array response + Arabic-normalized de-duplication),
// which is what the frontend expects. Static paths stay above /:id.
router.get('/categories', bookController.getCategories);
router.post('/categories', admin, bookController.createCategory);
router.get('/categories/stats', CategoryController.getCategoryStats);
router.get('/categories/:id', CategoryController.getCategoryById);
router.put('/categories/:id', admin, CategoryController.updateCategory);
router.delete('/categories/:id', admin, CategoryController.deleteCategory);

// SUBJECT ROUTES
router.get('/subjects', bookController.getsubjects);
router.post('/subjects', admin, bookController.createSubject);
router.get('/subjects/stats', SubjectController.getSubjectStats);
router.get('/subjects/:id', SubjectController.getSubjectById);
router.put('/subjects/:id', admin, SubjectController.updateSubject);
router.delete('/subjects/:id', admin, SubjectController.deleteSubject);

// PUBLISHER ROUTES
// GET /publishers returns a plain array, or a paginated object with ?isPagination=true (dashboard).
router.get('/publishers', bookController.getPublishers);
router.post('/publishers', admin, bookController.createPublisher);
router.get('/publishers/stats', PublisherController.getPublisherStats);
router.get('/publishers/:id', PublisherController.getPublisherById);
router.put('/publishers/:id', admin, PublisherController.updatePublisher);
router.delete('/publishers/:id', admin, PublisherController.deletePublisher);

// PEOPLE ROUTES (authors, commentators, editors, ... used by the book forms)
router.get('/people', bookController.getPeople);
router.post('/people', admin, bookController.createPerson);

// AUTHOR ROUTES (dashboard)
router.get('/authors', AuthorController.getAllAuthors);
router.get('/authors/stats', AuthorController.getAuthorStats);
router.get('/authors/:id', AuthorController.getAuthorById);
router.post('/authors', admin, AuthorController.createAuthor);
router.put('/authors/:id', admin, AuthorController.updateAuthor);
router.delete('/authors/:id', admin, AuthorController.deleteAuthor);

// BORROW ROUTES
// Any logged-in user can borrow, list their own borrows, and return their own borrow
// (ownership is checked in the controller; admins can return any borrow).
router.post('/borrows/borrow', isAuthenticate, BorrowController.borrowBook);
router.put('/borrows/return/:id', isAuthenticate, BorrowController.returnBook);
router.get('/borrows/my-borrows', isAuthenticate, BorrowController.getMyBorrows);

// Admin borrow routes (expose other users' names/emails or send mass email)
router.get('/borrows/borrowed', admin, BorrowController.getBorrowedBooks);
router.get('/borrows/all', admin, BorrowController.getAllBorrows);
router.get('/borrows/user/:userId', admin, BorrowController.getUserBorrows);
router.get('/borrows/overdue', admin, BorrowController.getOverdueBooks);
router.get('/borrows/statistics', admin, BorrowController.getBorrowStatistics);
router.post('/borrows/send-reminders', admin, BorrowController.sendDueDateReminders);
router.post('/borrows/send-overdue-notifications', admin, BorrowController.sendOverdueNotifications);

// DISPLAY SCREEN ROUTES (the slideshow shown on the library screen)
// The screen itself is public (a TV just opens the page); managing it is admin-only.
// Static paths stay above /display/slides/:id.
router.get('/display', DisplayController.getScreen);
router.get('/display/media/:id', DisplayController.getMedia);
router.get('/display/admin', admin, DisplayController.getAdminData);
router.put('/display/settings', admin, DisplayController.updateSettings);
router.put('/display/slides/reorder', admin, DisplayController.reorderSlides);
router.post('/display/slides', admin, displayUpload, DisplayController.createSlide);
router.put('/display/slides/:id', admin, displayUpload, DisplayController.updateSlide);
router.delete('/display/slides/:id', admin, DisplayController.deleteSlide);

module.exports = router;
