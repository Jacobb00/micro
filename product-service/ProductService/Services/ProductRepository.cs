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
    public interface IProductRepository
    {
        Task<Product> GetByIdAsync(string id);
        Task<ProductListResponse> GetProductsAsync(ProductFilterParams filterParams);
        Task<ProductListResponse> GetAllProductsAsync();
        Task<string> CreateAsync(Product product);
        Task<bool> UpdateAsync(string id, Product product);
        Task<bool> UpdateStockAsync(string id, int quantity, bool isIncrement);
        Task<bool> DeleteAsync(string id);
        Task<bool> ProductExistsAsync(string id);
        Task<List<string>> GetCategoriesAsync();
    }

    public class ProductRepository : IProductRepository
    {
        private readonly IMongoDbContext _context;

        public ProductRepository(IMongoDbContext context)
        {
            _context = context;
        }

        public async Task<Product> GetByIdAsync(string id)
        {
            return await _context.Products.Find(p => p.Id == id && p.IsActive).FirstOrDefaultAsync();
        }

        public async Task<ProductListResponse> GetProductsAsync(ProductFilterParams filterParams)
        {
            var filterBuilder = Builders<Product>.Filter;
            var filter = filterBuilder.Eq(p => p.IsActive, true);

            // Apply search filter
            if (!string.IsNullOrEmpty(filterParams.SearchTerm))
            {
                var searchFilter = filterBuilder.Text(filterParams.SearchTerm);
                filter = filterBuilder.And(filter, searchFilter);
            }

            // Apply category filter
            if (!string.IsNullOrEmpty(filterParams.Category))
            {
                var categoryFilter = filterBuilder.Eq(p => p.Category, filterParams.Category);
                filter = filterBuilder.And(filter, categoryFilter);
            }

            // Apply price filters
            if (filterParams.MinPrice.HasValue)
            {
                var minPriceFilter = filterBuilder.Gte(p => p.Price, filterParams.MinPrice.Value);
                filter = filterBuilder.And(filter, minPriceFilter);
            }

            if (filterParams.MaxPrice.HasValue)
            {
                var maxPriceFilter = filterBuilder.Lte(p => p.Price, filterParams.MaxPrice.Value);
                filter = filterBuilder.And(filter, maxPriceFilter);
            }

            // Apply stock filter
            if (filterParams.InStock.HasValue)
            {
                var stockFilter = filterParams.InStock.Value
                    ? filterBuilder.Gt(p => p.StockQuantity, 0)
                    : filterBuilder.Lte(p => p.StockQuantity, 0);
                filter = filterBuilder.And(filter, stockFilter);
            }

            // Get total count
            var totalCount = await _context.Products.CountDocumentsAsync(filter);

            // Apply sorting
            var sortDefinition = GetSortDefinition(filterParams.SortBy, filterParams.SortDesc);

            // Apply pagination
            var skip = (filterParams.Page - 1) * filterParams.PageSize;
            var products = await _context.Products
                .Find(filter)
                .Sort(sortDefinition)
                .Skip(skip)
                .Limit(filterParams.PageSize)
                .ToListAsync();

            return new ProductListResponse
            {
                Products = products.Select(p => MapToDto(p)).ToList(),
                TotalCount = (int)totalCount,
                Page = filterParams.Page,
                PageSize = filterParams.PageSize
            };
        }

        public async Task<ProductListResponse> GetAllProductsAsync()
        {
            var filter = Builders<Product>.Filter.Eq(p => p.IsActive, true);
            var products = await _context.Products
                .Find(filter)
                .ToListAsync();

            return new ProductListResponse
            {
                Products = products.Select(p => MapToDto(p)).ToList(),
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
                Category = product.Category,
                ImageUrl = product.ImageUrl,
                CreatedAt = product.CreatedAt,
                UpdatedAt = product.UpdatedAt,
                IsActive = product.IsActive
            };
        }
    }
} 