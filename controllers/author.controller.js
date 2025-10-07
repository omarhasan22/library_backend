const Author = require('../models/author.model');

class AuthorController {
   // Get all authors
   async getAllAuthors(req, res) {
      try {
         const { page = 1, limit = 10, search = '', type = '' } = req.query;
         const query = {};

         if (search) {
            query.$or = [
               { name: { $regex: search, $options: 'i' } },
               { normalizedName: { $regex: search, $options: 'i' } }
            ];
         }

         if (type) {
            query.type = type;
         }

         const authors = await Author.find(query)
            .sort({ name: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

         const total = await Author.countDocuments(query);

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

         // Create normalized name for searching
         const normalizedName = name.toLowerCase().trim();

         const author = new Author({
            name,
            normalizedName,
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

         const updateData = { type };

         if (name) {
            updateData.name = name;
            updateData.normalizedName = name.toLowerCase().trim();
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
         const totalAuthors = await Author.countDocuments();
         const authorsByType = await Author.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
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
