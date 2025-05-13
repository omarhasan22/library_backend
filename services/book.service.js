const BookModel = require('../models/book.model');


class BookService {
  async createBook(data) {
    return await BookModel.create(data);
  }

async getAllBooks(query = '') {
  const searchCriteria = query 
    ? { title: { $regex: query, $options: 'i' } } 
    : {};

  return await BookModel.find(searchCriteria);
}

  async getBookById(id) {
    return await BookModel.findById(id);
  }

  async updateBook(id, data) {
    return await BookModel.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteBook(id) {
    return await BookModel.findByIdAndDelete(id);
  }
}


module.exports = {
  BookService: new BookService(),
};
