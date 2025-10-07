const Subject = require('../models/subject.model');

class SubjectController {
   // Get all subjects
   async getAllSubjects(req, res) {
      try {
         const { page = 1, limit = 10, search = '' } = req.query;
         const query = {};

         if (search) {
            query.$or = [
               { title: { $regex: search, $options: 'i' } },
               { normalizedTitle: { $regex: search, $options: 'i' } }
            ];
         }

         const subjects = await Subject.find(query)
            .sort({ title: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

         const total = await Subject.countDocuments(query);

         res.json({
            subjects,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Get single subject
   async getSubjectById(req, res) {
      try {
         const subject = await Subject.findById(req.params.id);
         if (!subject) {
            return res.status(404).json({ error: 'Subject not found' });
         }
         res.json(subject);
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Create new subject
   async createSubject(req, res) {
      try {
         const { title } = req.body;

         // Create normalized title for searching
         const normalizedTitle = title.toLowerCase().trim();

         const subject = new Subject({
            title,
            normalizedTitle
         });

         await subject.save();
         res.status(201).json(subject);
      } catch (error) {
         res.status(400).json({ error: error.message });
      }
   }

   // Update subject
   async updateSubject(req, res) {
      try {
         const { title } = req.body;

         const updateData = {
            title,
            normalizedTitle: title.toLowerCase().trim()
         };

         const subject = await Subject.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
         );

         if (!subject) {
            return res.status(404).json({ error: 'Subject not found' });
         }

         res.json(subject);
      } catch (error) {
         res.status(400).json({ error: error.message });
      }
   }

   // Delete subject
   async deleteSubject(req, res) {
      try {
         const subject = await Subject.findByIdAndDelete(req.params.id);
         if (!subject) {
            return res.status(404).json({ error: 'Subject not found' });
         }
         res.json({ message: 'Subject deleted successfully' });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Get subject statistics
   async getSubjectStats(req, res) {
      try {
         const totalSubjects = await Subject.countDocuments();

         res.json({
            totalSubjects
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }
}

module.exports = new SubjectController();
