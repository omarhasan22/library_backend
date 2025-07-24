// وحدة التحكم في الكتاب
const { BookService } = require('../services/book.service');
const path = require('path');

class BookController {

  async createBook(req, res) {
    try {
      // copy incoming form‑fields
      const bookData = { ...req.body };

      // Attach image path
      if (req.file) {
        bookData.imagePath = `/uploads/books/${req.file}`;
      }

      const book = await BookService.createBook(bookData);
      return res.status(201).json(book);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  };

  async getAllBooks(req, res) {
    try {
      const query = req.query.q || '';
      const books = await BookService.getAllBooks(query);

      res.status(200).json(books);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }


  async getBookById(req, res) {
    try {
      const book = await BookService.getBookById(req.params.id);
      if (!book) return res.status(404).json({ error: 'Book not found' });
      res.status(200).json(book);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async updateBook(req, res) {
    try {
      const book = await BookService.updateBook(req.params.id, req.body);
      if (!book) return res.status(404).json({ error: 'Book not found' });
      res.status(200).json(book);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async deleteBook(req, res) {
    try {
      const book = await BookService.deleteBook(req.params.id);
      if (!book) return res.status(404).json({ error: 'Book not found' });
      res.status(200).json({ message: 'Book deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getCategories(req, res) {
    try {
      // Assuming categories are stored in the book model
      const categories = await BookService.getCategories();
      console.log('Categories fetched:', categories);
      res.status(200).json(categories);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getsubjects(req, res) {
    try {
      const subjects = await BookService.getsubjects();
      res.status(200).json(subjects);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getPublishers(req, res) {
    try {
      const publishers = await BookService.getPublishers();
      res.status(200).json(publishers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getCategoryById(req, res) {
    try {
      const category = await BookService.getCategoryById(req.params['category-id']);
      if (!category) return res.status(404).json({ error: 'Category not found' });
      res.status(200).json(category);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getPeople(req, res) {
    try {
      console.log('Fetching all People');

      // Assuming categories are stored in the book model
      const People = await BookService.getPeople();
      console.log('People fetched:', People);
      res.status(200).json(People);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

}

module.exports = new BookController();
