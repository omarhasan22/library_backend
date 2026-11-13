const Subject = require('../models/subject.model');
const { normalizeArabicText, parsePagination, buildNameSearch } = require('../utils/text');

class SubjectController {
   // Get all subjects
   async getAllSubjects(req, res) {
      try {
         const { search = '' } = req.query;
         const { page, limit, skip } = parsePagination(req.query);
         const query = buildNameSearch(search, 'title', 'normalizedTitle');

         const [subjects, total] = await Promise.all([
            Subject.find(query).sort({ title: 1 }).skip(skip).limit(limit).lean(),
            Subject.countDocuments(query)
         ]);

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

         if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'Title is required' });
         }
         const normalizedTitle = normalizeArabicText(title);

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

         if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'Title is required' });
         }

         const updateData = {
            title,
            normalizedTitle: normalizeArabicText(title)
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
         const totalSubjects = await Subject.estimatedDocumentCount();

         res.json({
            totalSubjects
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }
}

module.exports = new SubjectController();
