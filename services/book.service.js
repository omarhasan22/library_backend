const mongoose = require('mongoose');
const BookModel = require('../models/book.model');
const Category = require('../models/category.model');
const Subject = require('../models/subject.model');
const Author = require('../models/author.model');
const Publisher = require('../models/publisher.model');


class BookService {
 async resolveEntity(data, Model, field, filter = {}) {
    if (!data || !data[field]) return null;
    const query = { [field]: data[field], ...filter };
    let doc   = await Model.findOne(query);
    if (!doc) doc = await new Model({ ...filter, [field]: data[field] }).save();
    return doc._id;
  }

  async createBook(bookData) {
    // 1) resolve IDs
    const categoryId  = await this.resolveEntity(bookData.category,  Category,  'title');
    const subjectId  = await this.resolveEntity(bookData.subject,  Subject,  'title');
    const publisherId = await this.resolveEntity(bookData.publisher, Publisher, 'title');

    const authorId    = await this.resolveEntity(bookData.author,    Author, 'name', { type: 'author' });
    const muhashiId   = await this.resolveEntity(bookData.muhashi,   Author, 'name', { type: 'muhashi' });
    const editorId    = await this.resolveEntity(bookData.editor,    Author, 'name', { type: 'editor' });
    const caretakerId = await this.resolveEntity(bookData.caretaker, Author, 'name', { type: 'caretaker' });

    // 2) build document
    const bookObj = {
      title:           bookData.title,
      author:          authorId,
      muhashi:         muhashiId,
      editor:          editorId,
      caretaker:       caretakerId,
      category:        categoryId,
      publisher:       publisherId,
      numberOfVolumes: bookData.numberOfVolumes,
      editionNumber:   bookData.editionNumber,
      publicationYear: bookData.publicationYear,
      subject:         subjectId,
      pageCount:       bookData.pageCount,
      address: {
        roomNumber:  bookData.address?.roomNumber,
        shelfNumber: bookData.address?.shelfNumber,
        wallNumber:  bookData.address?.wallNumber,
        bookNumber:  bookData.address?.bookNumber
      },
      imageUrl:        bookData.imagePath   // saved by controller
    };

    // 3) save
    const book = new BookModel(bookObj);
    return await book.save();
  }

async getAllBooks(query = '') {
  const searchCriteria = query 
    ? { title: { $regex: query, $options: 'i' } } 
    : {};

  return await BookModel.find(searchCriteria).populate([
    { path: 'category', select: 'title' },
    { path: 'subject', select: 'title' },
    { path: 'author', select: 'name type' },    // type helps if you want to show role
    { path: 'editor', select: 'name type' },
    { path: 'caretaker', select: 'name type' },
    { path: 'publisher', select:'title' },
  ]);
}

  async getBookById(id) {
    return await BookModel.findById(id);
  }

  async updateBook(id, bookData) {
    // if new imagePath provided, overwrite imageUrl
    const update = { ...bookData };
    if (bookData.imagePath) update.imageUrl = bookData.imagePath;
    return BookModel.findByIdAndUpdate(id, update, { new: true });
  }

  async deleteBook(id) {
    return await BookModel.findByIdAndDelete(id);
  }
  async getCategories() {
    return await Category.find();
  }

  async getsubjects() {
    return await Subject.find();
  }

  async getPeople() {
    return await Author.find();
  }

  async getPublishers() {
    return await Publisher.find();
  }
}


module.exports = {
  BookService: new BookService(),
};
