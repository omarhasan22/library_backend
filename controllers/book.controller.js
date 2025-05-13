// وحدة التحكم في الكتاب
const { BookService } = require('../services/book.service');

class BookController {
  async createBook(req, res) {
    try {
      const book = await BookService.createBook(req.body);
      res.status(201).json(book);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

async getAllBooks(req, res) {
  try {
    console.log('Fetching all books');

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
}

module.exports = new BookController();
