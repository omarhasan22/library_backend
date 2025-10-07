const Category = require('../models/category.model');

class CategoryController {
   // Get all categories
   async getAllCategories(req, res) {
      try {
         const { page = 1, limit = 10, search = '' } = req.query;
         const query = {};

         if (search) {
            query.$or = [
               { title: { $regex: search, $options: 'i' } },
               { normalizedTitle: { $regex: search, $options: 'i' } }
            ];
         }

         const categories = await Category.find(query)
            .sort({ title: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

         const total = await Category.countDocuments(query);

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

         // Create normalized title for searching
         const normalizedTitle = title.toLowerCase().trim();

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

         const updateData = {
            title,
            normalizedTitle: title.toLowerCase().trim()
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
         const totalCategories = await Category.countDocuments();

         res.json({
            totalCategories
         });
      } catch (error) {
         res.status(500).json({ error: error.message });
      }
   }
}

module.exports = new CategoryController();
