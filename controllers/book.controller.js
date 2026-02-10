// وحدة التحكم في الكتاب
const { BookService } = require('../services/book.service');
const path = require('path');
const fs = require('fs'); // For deleting original file
const sharp = require('sharp'); // For image processing

class BookController {

  async createBook(req, res) {
    console.log("Received book data:", req.body);

    try {
      const bookData = { ...req.body };

      // // FIX: Parse the address string into a JSON object
      // if (typeof bookData.address === 'string' && bookData.address.trim() !== '') {
      //   try {
      //     bookData.address = JSON.parse(bookData.address);
      //   } catch (e) {
      //     console.error("Failed to parse address JSON string:", e);
      //     return res.status(400).json({ error: 'Invalid address format. Must be a valid JSON string.' });
      //   }
      // } else {
      //   bookData.address = {}; // Ensure address is an object even if empty or not provided
      // }

      // Image processing logic
      // let processedImagePath = '';
      // if (req.file) {
      //   const originalPath = req.file.path; // Path where multer saved the file
      //   const bookTitleSlug = bookData.title ? bookData.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : `book-${Date.now()}`;
      //   const filename = `${bookTitleSlug}-${Date.now()}.webp`; // Using webp for better compression
      //   const destinationPath = path.join(__dirname, '../assets/books', filename);

      //   try {
      //     await sharp(originalPath)
      //       .resize({
      //         width: 400, // Max width, adjust as needed
      //         height: 600, // Max height, adjust as needed, maintaining aspect ratio or with crop
      //         fit: sharp.fit.inside, // Ensures image fits within dimensions, maintaining aspect ratio
      //         withoutEnlargement: true // Don't enlarge images smaller than dimensions
      //       })
      //       .webp({ quality: 80 }) // Convert to webp and set quality
      //       .toFile(destinationPath);

      //     processedImagePath = `/assets/books/${filename}`; // Path to be saved in DB

      //     // Delete the original file uploaded by multer
      //     fs.unlink(originalPath, (err) => {
      //       if (err) console.error('Error deleting original file:', err);
      //     });

      //   } catch (imageError) {
      //     console.error('Image processing failed:', imageError);
      //     // Delete the original file even if processing fails
      //     fs.unlink(originalPath, (err) => {
      //       if (err) console.error('Error deleting original file after processing failure:', err);
      //     });
      //     return res.status(500).json({ error: 'Failed to process image.' });
      //   }
      // }
      // bookData.imagePath = processedImagePath; // Set the processed image path

      const book = await BookService.createBook(bookData);
      return res.status(201).json(book);
    } catch (err) {
      if (err.message.includes('Invalid address format')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
  };

  async getAllBooks(req, res) {
    try {
      const query = req.query.query || '';
      const searchTerm = req.query.searchTerm || '';

      // Pagination & sorting params (fall back to defaults)
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const sortDirection = req.query.sortDirection === 'desc' ? 'desc' : 'asc';

      const result = await BookService.getAllBooks(
        query,
        searchTerm,
        page,
        limit,
        sortDirection
      );

      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }


  getStatistics = async (req, res) => {
    try {
      const statistics = await BookService.getStatistics();
      return res.status(200).json(statistics);
    } catch (err) {
      console.error('getStatistics error:', err);
      return res.status(500).json({ error: 'Failed to load statistics' });
    }
  };

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
      const bookData = { ...req.body };

      // FIX: Parse the address string into a JSON object for updates too
      if (typeof bookData.address === 'string' && bookData.address.trim() !== '') {
        try {
          bookData.address = JSON.parse(bookData.address);
        } catch (e) {
          console.error("Failed to parse address JSON string during update:", e);
          return res.status(400).json({ error: 'Invalid address format for update. Must be a valid JSON string.' });
        }
      }

      // Image processing logic for update
      if (req.file) { // Only process if a new file is uploaded
        const originalPath = req.file.path;
        const bookTitleSlug = bookData.title ? bookData.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : `book-${Date.now()}`;
        const filename = `${bookTitleSlug}-${Date.now()}.webp`;
        const destinationPath = path.join(__dirname, '../assets/books', filename);

        try {
          await sharp(originalPath)
            .resize({
              width: 400,
              height: 600,
              fit: sharp.fit.inside,
              withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toFile(destinationPath);

          bookData.imagePath = `/assets/books/${filename}`; // Set the new processed image path

          // Delete the original file uploaded by multer
          fs.unlink(originalPath, (err) => {
            if (err) console.error('Error deleting original file during update:', err);
          });

          // OPTIONAL: Delete the old image file if it exists and a new one replaces it
          // This requires fetching the current book's imageUrl before updating
          // For simplicity, I'm omitting this for now but it's good practice for cleanup.

        } catch (imageError) {
          console.error('Image processing failed during update:', imageError);
          fs.unlink(originalPath, (err) => {
            if (err) console.error('Error deleting original file after processing failure during update:', err);
          });
          return res.status(500).json({ error: 'Failed to process new image for update.' });
        }
      }
      // If no new file is uploaded, bookData.imagePath will retain its value from req.body
      // or be undefined, which the service handles.

      const book = await BookService.updateBook(req.params.id, bookData); // Pass bookData including imagePath
      if (!book) return res.status(404).json({ error: 'Book not found' });
      res.status(200).json(book);
    } catch (err) {
      if (err.message.includes('Invalid address format')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
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

  async exportBooks(req, res) {
    try {
      const query = req.query?.query || '';
      const searchTerm = req.query?.searchTerm || '';
      const sortDirection = req.query?.sortDirection || 'asc';

      const excelBuffer = await BookService.exportBooksToExcel(query, searchTerm, sortDirection);

      // Set response headers for Excel file download
      const filename = `books_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      res.send(excelBuffer);
    } catch (err) {
      console.error('Export error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  async getUniqueRoomNumbers(req, res) {
    try {
      const rooms = await BookService.getUniqueRoomNumbers();
      res.status(200).json(rooms);
    } catch (err) {
      console.error('Error getting unique room numbers:', err);
      res.status(500).json({ error: err.message });
    }
  }

  async getUniqueWallNumbers(req, res) {
    try {
      const roomNumber = req.query.roomNumber || req.params.roomNumber;
      if (!roomNumber) {
        return res.status(400).json({ error: 'Room number is required' });
      }
      const walls = await BookService.getUniqueWallNumbers(roomNumber);
      res.status(200).json(walls);
    } catch (err) {
      console.error('Error getting unique wall numbers:', err);
      res.status(500).json({ error: err.message });
    }
  }

  async bulkUpdateSubjects(req, res) {
    try {
      const {
        roomNumber,
        wallNumber,
        shelfNumber,
        bookNumberFrom,
        bookNumberTo,
        subjectId
      } = req.body;

      // Get user ID from authenticated request
      const userId = req.user ? req.user._id : null;
      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const criteria = {
        roomNumber,
        wallNumber,
        shelfNumber,
        bookNumberFrom,
        bookNumberTo
      };

      const result = await BookService.bulkUpdateSubjects(criteria, subjectId, userId);
      res.status(200).json(result);
    } catch (err) {
      console.error('Error in bulk update subjects:', err);
      res.status(400).json({ error: err.message });
    }
  }

  async bulkUpdateCategories(req, res) {
    try {
      const {
        roomNumber,
        wallNumber,
        shelfNumber,
        bookNumberFrom,
        bookNumberTo,
        categoryId
      } = req.body;

      // Get user ID from authenticated request
      const userId = req.user ? req.user._id : null;
      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const criteria = {
        roomNumber,
        wallNumber,
        shelfNumber,
        bookNumberFrom,
        bookNumberTo
      };

      const result = await BookService.bulkUpdateCategories(criteria, categoryId, userId);
      res.status(200).json(result);
    } catch (err) {
      console.error('Error in bulk update categories:', err);
      res.status(400).json({ error: err.message });
    }
  }

  async undoBulkUpdateSubjects(req, res) {
    try {
      const { historyId } = req.body;

      if (!historyId) {
        return res.status(400).json({ error: 'History ID is required' });
      }

      const result = await BookService.undoBulkUpdateSubjects(historyId);
      res.status(200).json(result);
    } catch (err) {
      console.error('Error in undo bulk update subjects:', err);
      res.status(400).json({ error: err.message });
    }
  }

  async getBulkUpdateHistory(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const userId = req.user ? req.user._id : null;

      // If user is not admin, only show their own history
      // If admin, can see all history (pass null to service)
      const filterUserId = req.user && req.user.role === 'admin' ? null : userId;

      const result = await BookService.getBulkUpdateHistory(
        filterUserId,
        parseInt(page),
        parseInt(limit)
      );
      res.status(200).json(result);
    } catch (err) {
      console.error('Error getting bulk update history:', err);
      res.status(400).json({ error: err.message });
    }
  }

  async getHistoryById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'History ID is required' });
      }

      const history = await BookService.getHistoryById(id);
      res.status(200).json(history);
    } catch (err) {
      console.error('Error getting history by ID:', err);
      res.status(400).json({ error: err.message });
    }
  }

  async exportBookLocations(req, res) {
    try {
      const roomNumber = req.body?.roomNumber || req.query?.roomNumber;
      const query = req.body?.query || req.query?.query || '';
      const searchTerm = req.body?.searchTerm || req.query?.searchTerm || '';
      const sortDirection = req.body?.sortDirection || req.query?.sortDirection || 'asc';

      if (!roomNumber) {
        return res.status(400).json({ error: 'Room number is required' });
      }

      const excelBuffer = await BookService.exportBookLocationsToExcel(roomNumber, query, searchTerm, sortDirection);

      // Set response headers for Excel file download
      const filename = `books_locations_room_${roomNumber}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      res.send(excelBuffer);
    } catch (err) {
      console.error('Export locations error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // Existing getCategories
  async getCategories(req, res) {
    try {
      const categories = await BookService.getCategories();
      res.status(200).json(categories);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // NEW: createCategory
  async createCategory(req, res) {
    try {
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Category title is required.' });
      }
      const newCategory = await BookService.createCategory({ title });
      res.status(201).json(newCategory);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // Existing getsubjects
  async getsubjects(req, res) {
    try {
      const subjects = await BookService.getsubjects();
      res.status(200).json(subjects);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // NEW: createSubject
  async createSubject(req, res) {
    try {
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Subject title is required.' });
      }
      const newSubject = await BookService.createSubject({ title });
      res.status(201).json(newSubject);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // Existing getPublishers - now supports both simple array and pagination
  async getPublishers(req, res) {
    try {
      const { page = 1, limit = 10, search = '', isPagination } = req.query;
      const Publisher = require('../models/publisher.model');
      const query = {};

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { normalizedTitle: { $regex: search, $options: 'i' } }
        ];
      }

      // Check if pagination is requested
      const usePagination = isPagination === 'true' || isPagination === true;

      if (usePagination) {
        // Return paginated response (for dashboard)
        const publishers = await Publisher.find(query)
          .sort({ title: 1 })
          .limit(limit * 1)
          .skip((page - 1) * limit)
          .exec();

        const total = await Publisher.countDocuments(query);

        res.json({
          publishers,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        });
      } else {
        // Return simple array (for book forms - existing behavior)
        const publishers = await BookService.getPublishers();
        res.status(200).json(publishers);
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // NEW: createPublisher
  async createPublisher(req, res) {
    try {
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Publisher title is required.' });
      }
      const newPublisher = await BookService.createPublisher({ title });
      res.status(201).json(newPublisher);
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

  // Existing getPeople
  async getPeople(req, res) {
    try {
      const People = await BookService.getPeople();
      res.status(200).json(People);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // NEW: createPerson (for authors, commentators, etc.)
  async createPerson(req, res) {
    try {
      const { name, type } = req.body;
      if (!name || !type) {
        return res.status(400).json({ error: 'Person name and type are required.' });
      }
      // Ensure the type is one of the expected values (e.g., 'author', 'commentator')
      const allowedTypes = ['author', 'commentator', 'editor', 'caretaker', 'muhashi'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid person type. Allowed types are: ${allowedTypes.join(', ')}` });
      }

      const newPerson = await BookService.createPerson({ name, type });
      res.status(201).json(newPerson);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new BookController();