const Publisher = require('../models/publisher.model');
const { normalizeArabicText, parsePagination, buildNameSearch } = require('../utils/text');

class PublisherController {
   // Get all publishers
   async getAllPublishers(req, res) {
      try {
         const { search = '' } = req.query;
         const { page, limit, skip } = parsePagination(req.query);
         const query = buildNameSearch(search, 'title', 'normalizedTitle');

         const [publishers, total] = await Promise.all([
            Publisher.find(query).sort({ title: 1 }).skip(skip).limit(limit).lean(),
            Publisher.countDocuments(query)
         ]);

         res.json({
            publishers,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Get single publisher
   async getPublisherById(req, res) {
      try {
         const publisher = await Publisher.findById(req.params.id);
         if (!publisher) {
            return res.status(404).json({ error: 'Publisher not found' });
         }
         res.json(publisher);
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Create new publisher
   async createPublisher(req, res) {
      try {
         const { title } = req.body;

         if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'Title is required' });
         }
         const normalizedTitle = normalizeArabicText(title);

         const publisher = new Publisher({
            title,
            normalizedTitle
         });

         await publisher.save();
         res.status(201).json(publisher);
      } catch (error) {
         res.status(400).json({ error: error.message });
      }
   }

   // Update publisher
   async updatePublisher(req, res) {
      try {
         const { title } = req.body;

         if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'Title is required' });
         }

         const updateData = {
            title,
            normalizedTitle: normalizeArabicText(title)
         };

         const publisher = await Publisher.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
         );

         if (!publisher) {
            return res.status(404).json({ error: 'Publisher not found' });
         }

         res.json(publisher);
      } catch (error) {
         res.status(400).json({ error: error.message });
      }
   }

   // Delete publisher
   async deletePublisher(req, res) {
      try {
         const publisher = await Publisher.findByIdAndDelete(req.params.id);
         if (!publisher) {
            return res.status(404).json({ error: 'Publisher not found' });
         }
         res.json({ message: 'Publisher deleted successfully' });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Get publisher statistics
   async getPublisherStats(req, res) {
      try {
         const totalPublishers = await Publisher.estimatedDocumentCount();

         res.json({
            totalPublishers
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }
}

module.exports = new PublisherController();
