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
    public class ProductRepository : IProductRepository
    {
        private readonly IMongoDbContext _context;
        private readonly ICategoryRepository _categoryRepository;

        public ProductRepository(IMongoDbContext context, ICategoryRepository categoryRepository)
        {
            _context = context;
            _categoryRepository = categoryRepository;
        }

        public async Task<Product> GetByIdAsync(string id)
        {
            return await _context.Products.Find(p => p.Id == id && p.IsActive).FirstOrDefaultAsync();
        }

        public async Task<ProductListResponse> GetAllProductsAsync()
        {
            var filter = Builders<Product>.Filter.Eq(p => p.IsActive, true);
            var sortBuilder = Builders<Product>.Sort;
            var sortDefinition = sortBuilder.Ascending(p => p.Name);
            
            var products = await _context.Products
                .Find(filter)
                .Sort(sortDefinition)
                .ToListAsync();

            // Get category details for all products
            var productDtos = new List<ProductDto>();
            foreach (var product in products)
            {
                var productDto = await MapToDtoWithCategoryAsync(product);
                productDtos.Add(productDto);
            }

            return new ProductListResponse
            {
                Products = productDtos,
                TotalCount = products.Count,
                Page = 1,
                PageSize = products.Count
            };
        }

        public async Task<ProductListResponse> GetProductsByCategoryIdAsync(string categoryId)
        {
            var filter = Builders<Product>.Filter.And(
                Builders<Product>.Filter.Eq(p => p.IsActive, true),
                Builders<Product>.Filter.Eq(p => p.CategoryId, categoryId)
            );

            var products = await _context.Products
                .Find(filter)
                .ToListAsync();

            // Get category details for all products
            var productDtos = new List<ProductDto>();
            foreach (var product in products)
            {
                var productDto = await MapToDtoWithCategoryAsync(product);
                productDtos.Add(productDto);
            }

            return new ProductListResponse
            {
                Products = productDtos,
                TotalCount = products.Count,
                Page = 1,
                PageSize = products.Count
            };
        }

        public async Task<string> CreateAsync(Product product)
        {
            product.CreatedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;
            
            await _context.Products.InsertOneAsync(product);
            return product.Id;
        }

        public async Task<bool> UpdateAsync(string id, Product updatedProduct)
        {
            var filter = Builders<Product>.Filter.Eq(p => p.Id, id);
            var existingProduct = await _context.Products.Find(filter).FirstOrDefaultAsync();
            
            if (existingProduct == null)
                return false;

            var update = Builders<Product>.Update
                .Set(p => p.Name, updatedProduct.Name)
                .Set(p => p.Description, updatedProduct.Description)
                .Set(p => p.Price, updatedProduct.Price)
                .Set(p => p.StockQuantity, updatedProduct.StockQuantity)
                .Set(p => p.CategoryId, updatedProduct.CategoryId)
                .Set(p => p.Category, updatedProduct.Category)
                .Set(p => p.ImageUrl, updatedProduct.ImageUrl)
                .Set(p => p.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Products.UpdateOneAsync(filter, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> UpdateStockAsync(string id, int quantity, bool isIncrement)
        {
            var filter = Builders<Product>.Filter.Eq(p => p.Id, id);
            var product = await _context.Products.Find(filter).FirstOrDefaultAsync();
            
            if (product == null)
                return false;

            var newQuantity = isIncrement
                ? product.StockQuantity + quantity
                : product.StockQuantity - quantity;

            if (newQuantity < 0)
                return false;

            var update = Builders<Product>.Update
                .Set(p => p.StockQuantity, newQuantity)
                .Set(p => p.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Products.UpdateOneAsync(filter, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> DeleteAsync(string id)
        {
            // Soft delete by setting IsActive to false
            var filter = Builders<Product>.Filter.Eq(p => p.Id, id);
            var update = Builders<Product>.Update
                .Set(p => p.IsActive, false)
                .Set(p => p.UpdatedAt, DateTime.UtcNow);

            var result = await _context.Products.UpdateOneAsync(filter, update);
            return result.ModifiedCount > 0;
        }

        public async Task<bool> ProductExistsAsync(string id)
        {
            var filter = Builders<Product>.Filter.Eq(p => p.Id, id);
            return await _context.Products.CountDocumentsAsync(filter) > 0;
        }

        public async Task<List<string>> GetCategoriesAsync()
        {
            return await _context.Products
                .Distinct(p => p.Category, p => p.IsActive)
                .ToListAsync();
        }

        private SortDefinition<Product> GetSortDefinition(string sortBy, bool sortDesc)
        {
            var sortBuilder = Builders<Product>.Sort;
            
            switch (sortBy.ToLower())
            {
                case "price":
                    return sortDesc 
                        ? sortBuilder.Descending(p => p.Price) 
                        : sortBuilder.Ascending(p => p.Price);
                case "name":
                    return sortDesc 
                        ? sortBuilder.Descending(p => p.Name) 
                        : sortBuilder.Ascending(p => p.Name);
                case "createdat":
                    return sortDesc 
                        ? sortBuilder.Descending(p => p.CreatedAt) 
                        : sortBuilder.Ascending(p => p.CreatedAt);
                default:
                    return sortDesc 
                        ? sortBuilder.Descending(p => p.Name) 
                        : sortBuilder.Ascending(p => p.Name);
            }
        }

        private ProductDto MapToDto(Product product)
        {
            return new ProductDto
            {
                Id = product.Id,
                Name = product.Name,
                Description = product.Description,
                Price = product.Price,
                StockQuantity = product.StockQuantity,
                CategoryId = product.CategoryId,
                Category = product.Category,
                ImageUrl = product.ImageUrl,
                CreatedAt = product.CreatedAt,
                UpdatedAt = product.UpdatedAt,
                IsActive = product.IsActive
            };
        }

        private async Task<ProductDto> MapToDtoWithCategoryAsync(Product product)
        {
            var dto = MapToDto(product);
            
            if (!string.IsNullOrEmpty(product.CategoryId))
            {
                var category = await _categoryRepository.GetByIdAsync(product.CategoryId);
                if (category != null)
                {
                    dto.CategoryDetails = new CategoryDto
                    {
                        Id = category.Id,
                        Name = category.Name,
                        Description = category.Description,
                        ImageUrl = category.ImageUrl
                    };
                }
            }
            
            return dto;
        }
    }
} 