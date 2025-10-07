const Publisher = require('../models/publisher.model');

class PublisherController {
   // Get all publishers
   async getAllPublishers(req, res) {
      try {
         const { page = 1, limit = 10, search = '' } = req.query;
         const query = {};

         if (search) {
            query.$or = [
               { title: { $regex: search, $options: 'i' } },
               { normalizedTitle: { $regex: search, $options: 'i' } }
            ];
         }

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

         // Create normalized title for searching
         const normalizedTitle = title.toLowerCase().trim();

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

         const updateData = {
            title,
            normalizedTitle: title.toLowerCase().trim()
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
         const totalPublishers = await Publisher.countDocuments();

         res.json({
            totalPublishers
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }
}

module.exports = new PublisherController();
