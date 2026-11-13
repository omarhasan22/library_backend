const Author = require('../models/author.model');
const { normalizeArabicText, parsePagination, buildNameSearch } = require('../utils/text');

class AuthorController {
   // Get all authors
   async getAllAuthors(req, res) {
      try {
         const { search = '', type = '' } = req.query;
         const { page, limit, skip } = parsePagination(req.query);
         const query = buildNameSearch(search, 'name', 'normalizedName');

         if (type) {
            query.type = String(type);
         }

         const [authors, total] = await Promise.all([
            Author.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
            Author.countDocuments(query)
         ]);

         res.json({
            authors,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Get single author
   async getAuthorById(req, res) {
      try {
         const author = await Author.findById(req.params.id);
         if (!author) {
            return res.status(404).json({ error: 'Author not found' });
         }
         res.json(author);
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Create new author
   async createAuthor(req, res) {
      try {
         const { name, dateOfBirth, dateOfDeath, type } = req.body;
         if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Name is required' });
         }

         const author = new Author({
            name,
            normalizedName: normalizeArabicText(name),
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            dateOfDeath: dateOfDeath ? new Date(dateOfDeath) : undefined,
            type
         });

         await author.save();
         res.status(201).json(author);
      } catch (error) {
         res.status(400).json({ error: error.message });
      }
   }

   // Update author
   async updateAuthor(req, res) {
      try {
         const { name, dateOfBirth, dateOfDeath, type } = req.body;

         const updateData = {};
         if (type) updateData.type = type;

         if (name) {
            updateData.name = name;
            updateData.normalizedName = normalizeArabicText(name);
         }

         if (dateOfBirth) {
            updateData.dateOfBirth = new Date(dateOfBirth);
         }

         if (dateOfDeath) {
            updateData.dateOfDeath = new Date(dateOfDeath);
         }

         const author = await Author.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
         );

         if (!author) {
            return res.status(404).json({ error: 'Author not found' });
         }

         res.json(author);
      } catch (error) {
         res.status(400).json({ error: error.message });
      }
   }

   // Delete author
   async deleteAuthor(req, res) {
      try {
         const author = await Author.findByIdAndDelete(req.params.id);
         if (!author) {
            return res.status(404).json({ error: 'Author not found' });
         }
         res.json({ message: 'Author deleted successfully' });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Get author statistics
   async getAuthorStats(req, res) {
      try {
         const [totalAuthors, authorsByType] = await Promise.all([
            Author.estimatedDocumentCount(),
            Author.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }])
         ]);

         res.json({
            totalAuthors,
            authorsByType
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }
}

module.exports = new AuthorController();
