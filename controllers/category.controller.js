const Category = require('../models/category.model');
const { normalizeArabicText, parsePagination, buildNameSearch } = require('../utils/text');

class CategoryController {
   // Get all categories
   async getAllCategories(req, res) {
      try {
         const { search = '' } = req.query;
         const { page, limit, skip } = parsePagination(req.query);
         const query = buildNameSearch(search, 'title', 'normalizedTitle');

         const [categories, total] = await Promise.all([
            Category.find(query).sort({ title: 1 }).skip(skip).limit(limit).lean(),
            Category.countDocuments(query)
         ]);

         res.json({
            categories,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Get single category
   async getCategoryById(req, res) {
      try {
         const category = await Category.findById(req.params.id);
         if (!category) {
            return res.status(404).json({ error: 'Category not found' });
         }
         res.json(category);
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Create new category
   async createCategory(req, res) {
      try {
         const { title, subjects = [] } = req.body;

         if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'Title is required' });
         }
         const normalizedTitle = normalizeArabicText(title);

         const category = new Category({
            title,
            normalizedTitle,
            subjects
         });

         await category.save();
         res.status(201).json(category);
      } catch (error) {
         res.status(400).json({ error: error.message });
      }
   }

   // Update category
   async updateCategory(req, res) {
      try {
         const { title, subjects } = req.body;

         if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'Title is required' });
         }

         const updateData = {
            title,
            normalizedTitle: normalizeArabicText(title)
         };

         if (subjects !== undefined) {
            updateData.subjects = subjects;
         }

         const category = await Category.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
         );

         if (!category) {
            return res.status(404).json({ error: 'Category not found' });
         }

         res.json(category);
      } catch (error) {
         res.status(400).json({ error: error.message });
      }
   }

   // Delete category
   async deleteCategory(req, res) {
      try {
         const category = await Category.findByIdAndDelete(req.params.id);
         if (!category) {
            return res.status(404).json({ error: 'Category not found' });
         }
         res.json({ message: 'Category deleted successfully' });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }

   // Get category statistics
   async getCategoryStats(req, res) {
      try {
         const totalCategories = await Category.estimatedDocumentCount();

         res.json({
            totalCategories
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }
}

module.exports = new CategoryController();
