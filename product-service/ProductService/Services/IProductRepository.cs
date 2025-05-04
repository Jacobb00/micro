using System.Collections.Generic;
using System.Threading.Tasks;
using ProductService.Domain;
using ProductService.DTOs;

namespace ProductService.Services
{
    public interface IProductRepository
    {
        Task<Product> GetByIdAsync(string id);
        Task<ProductListResponse> GetAllProductsAsync();
        Task<ProductListResponse> GetProductsByCategoryIdAsync(string categoryId);
        Task<string> CreateAsync(Product product);
        Task<bool> UpdateAsync(string id, Product product);
        Task<bool> UpdateStockAsync(string id, int quantity, bool isIncrement);
        Task<bool> DeleteAsync(string id);
        Task<bool> ProductExistsAsync(string id);
        Task<List<string>> GetCategoriesAsync();
    }
} 