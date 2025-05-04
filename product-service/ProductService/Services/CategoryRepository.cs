using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MongoDB.Driver;
using ProductService.Domain;
using ProductService.DTOs;
using ProductService.Infrastructure;
using System.Linq;

namespace ProductService.Services
{
    public interface ICategoryRepository
    {
        Task<Category> GetByIdAsync(string id);
        Task<List<CategoryDto>> GetAllCategoriesAsync();
        Task<string> CreateAsync(Category category);
        Task<bool> UpdateAsync(string id, Category category);
        Task<bool> DeleteAsync(string id);
        Task<bool> CategoryExistsAsync(string id);
    }

    public class CategoryRepository : ICategoryRepository
    {
        private readonly IMongoDbContext _context;

        public CategoryRepository(IMongoDbContext context)
        {
            _context = context;
        }

        public async Task<Category> GetByIdAsync(string id)
        {
            return await _context.Categories.Find(c => c.Id == id && c.IsActive).FirstOrDefaultAsync();
        }

        public async Task<List<CategoryDto>> GetAllCategoriesAsync()
        {
            var filter = Builders<Category>.Filter.Eq(c => c.IsActive, true);
            var categories = await _context.Categories
                .Find(filter)
                .ToListAsync();

            return categories.Select(c => MapToDto(c)).ToList();
        }

        public async Task<string> CreateAsync(Category category)
        {
            category.CreatedAt = DateTime.UtcNow;
            category.UpdatedAt = DateTime.UtcNow;
            
            await _context.Categories.InsertOneAsync(category);
            return category.Id;
        }

        public async Task<bool> UpdateAsync(string id, Category updatedCategory)
        {
            var filter = Builders<Category>.Filter.Eq(c => c.Id, id);
            var existingCategory = await _context.Categories.Find(filter).FirstOrDefaultAsync();
            
            if (existingCategory == null)
                return false;

            var update = Builders<Category>.Update
                .Set(c => c.Name, updatedCategory.Name)
                .Set(c => c.Description, updatedCategory.Description)
                .Set(c => c.ImageUrl, updatedCategory.ImageUrl)
                .Set(c => c.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Categories.UpdateOneAsync(filter, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> DeleteAsync(string id)
        {
            // Soft delete by setting IsActive to false
            var filter = Builders<Category>.Filter.Eq(c => c.Id, id);
            var update = Builders<Category>.Update
                .Set(c => c.IsActive, false)
                .Set(c => c.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Categories.UpdateOneAsync(filter, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> CategoryExistsAsync(string id)
        {
            var filter = Builders<Category>.Filter.Eq(c => c.Id, id);
            return await _context.Categories.CountDocumentsAsync(filter) > 0;
        }

        private CategoryDto MapToDto(Category category)
        {
            return new CategoryDto
            {
                Id = category.Id,
                Name = category.Name,
                Description = category.Description,
                ImageUrl = category.ImageUrl
            };
        }
    }
} 