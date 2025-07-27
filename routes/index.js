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

// AUTH ROUTES
router.post('/auth/register', registrationCtrl.register);
router.post('/auth/login', loginCtrl.login);
router.post('/auth/refresh', refreshCtrl.refresh);

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
router.post('/books',
  // isAuthenticate, // Uncomment if authentication is required for creating books
  upload.single('image'),
  bookController.createBook);
router.get('/books', bookController.getAllBooks);
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


module.exports = router;