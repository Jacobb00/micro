using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using MongoDB.Driver;
using ProductService.Domain;
using ProductService.DTOs;
using ProductService.Services;
using Xunit;

namespace ProductService.Tests.IntegrationTests.Repositories
{
    public class ProductRepositoryIntegrationTests : IClassFixture<MongoDbFixture>, IAsyncLifetime
    {
        private readonly MongoDbFixture _fixture;
        private readonly ProductRepository _repository;
        private readonly List<Product> _testProducts;

        public ProductRepositoryIntegrationTests(MongoDbFixture fixture)
        {
            _fixture = fixture;
            _repository = new ProductRepository(_fixture.MongoDbContext);

            // Setup test data
            _testProducts = new List<Product>
            {
                new Product
                {
                    Name = "Laptop",
                    Description = "Powerful laptop with the latest specs",
                    Price = 1299.99m,
                    StockQuantity = 10,
                    Category = "Electronics",
                    ImageUrl = "laptop.jpg",
                    CreatedAt = DateTime.UtcNow.AddDays(-30),
                    UpdatedAt = DateTime.UtcNow.AddDays(-30),
                    IsActive = true
                },
                new Product
                {
                    Name = "Smartphone",
                    Description = "Latest smartphone with high-resolution camera",
                    Price = 899.99m,
                    StockQuantity = 20,
                    Category = "Electronics",
                    ImageUrl = "smartphone.jpg",
                    CreatedAt = DateTime.UtcNow.AddDays(-20),
                    UpdatedAt = DateTime.UtcNow.AddDays(-20),
                    IsActive = true
                },
                new Product
                {
                    Name = "Coffee Maker",
                    Description = "Automatic coffee maker with timer",
                    Price = 89.99m,
                    StockQuantity = 15,
                    Category = "Home Appliances",
                    ImageUrl = "coffee_maker.jpg",
                    CreatedAt = DateTime.UtcNow.AddDays(-10),
                    UpdatedAt = DateTime.UtcNow.AddDays(-10),
                    IsActive = true
                },
                new Product
                {
                    Name = "Headphones",
                    Description = "Wireless noise-cancelling headphones",
                    Price = 199.99m,
                    StockQuantity = 0, // Out of stock
                    Category = "Electronics",
                    ImageUrl = "headphones.jpg",
                    CreatedAt = DateTime.UtcNow.AddDays(-5),
                    UpdatedAt = DateTime.UtcNow.AddDays(-5),
                    IsActive = true
                },
                new Product
                {
                    Name = "Deleted Product",
                    Description = "This product has been deleted",
                    Price = 9.99m,
                    StockQuantity = 5,
                    Category = "Misc",
                    ImageUrl = "deleted.jpg",
                    CreatedAt = DateTime.UtcNow.AddDays(-60),
                    UpdatedAt = DateTime.UtcNow.AddDays(-1),
                    IsActive = false // Soft deleted
                }
            };
        }

        public async Task InitializeAsync()
        {
            await _fixture.SeedProductsAsync(_testProducts);
        }

        public async Task DisposeAsync()
        {
            await _fixture.ResetDatabaseAsync();
        }

        [Fact]
        public async Task GetAllProductsAsync_ShouldReturnOnlyActiveProducts()
        {
            // Act
            var result = await _repository.GetAllProductsAsync();

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().HaveCount(4); // Only active products
            result.Products.Should().NotContain(p => p.Name == "Deleted Product");
            result.TotalCount.Should().Be(4);
        }

        [Fact]
        public async Task GetProductsAsync_WithCategoryFilter_ShouldReturnFilteredProducts()
        {
            // Arrange
            var filterParams = new ProductFilterParams
            {
                Category = "Electronics"
            };

            // Act
            var result = await _repository.GetProductsAsync(filterParams);

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().HaveCount(3); // 3 electronics products that are active
            result.Products.Should().AllSatisfy(p => p.Category.Should().Be("Electronics"));
        }

        [Fact]
        public async Task GetProductsAsync_WithPriceFilter_ShouldReturnFilteredProducts()
        {
            // Arrange
            var filterParams = new ProductFilterParams
            {
                MinPrice = 100,
                MaxPrice = 1000
            };

            // Act
            var result = await _repository.GetProductsAsync(filterParams);

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().AllSatisfy(p => p.Price.Should().BeGreaterOrEqualTo(100));
            result.Products.Should().AllSatisfy(p => p.Price.Should().BeLessOrEqualTo(1000));
        }

        [Fact]
        public async Task GetProductsAsync_WithStockFilter_ShouldReturnFilteredProducts()
        {
            // Arrange
            var filterParams = new ProductFilterParams
            {
                InStock = true
            };

            // Act
            var result = await _repository.GetProductsAsync(filterParams);

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().AllSatisfy(p => p.StockQuantity.Should().BeGreaterThan(0));
            result.Products.Should().NotContain(p => p.Name == "Headphones"); // Out of stock
        }

        [Fact]
        public async Task GetProductsAsync_WithMultipleFilters_ShouldReturnCorrectResults()
        {
            // Arrange
            var filterParams = new ProductFilterParams
            {
                Category = "Electronics",
                MinPrice = 500, // Only products $500 or more
                InStock = true, // Only in-stock products
                SortBy = "price",
                SortDesc = true // Sort by price descending
            };

            // Act
            var result = await _repository.GetProductsAsync(filterParams);

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().AllSatisfy(p => p.Category.Should().Be("Electronics"));
            result.Products.Should().AllSatisfy(p => p.Price.Should().BeGreaterOrEqualTo(500));
            result.Products.Should().AllSatisfy(p => p.StockQuantity.Should().BeGreaterThan(0));
            // Verify sorting (descending by price)
            for (int i = 0; i < result.Products.Count - 1; i++)
            {
                result.Products[i].Price.Should().BeGreaterOrEqualTo(result.Products[i + 1].Price);
            }
        }

        [Fact]
        public async Task GetProductsAsync_WithSearchTerm_ShouldReturnMatchingProducts()
        {
            // Arrange
            var filterParams = new ProductFilterParams
            {
                SearchTerm = "laptop" // Search for "laptop" in name or description
            };

            // Act
            var result = await _repository.GetProductsAsync(filterParams);

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().Contain(p => p.Name.ToLower().Contains("laptop") || 
                                                 p.Description.ToLower().Contains("laptop"));
        }

        [Fact]
        public async Task GetProductsAsync_WithInvalidCategory_ShouldReturnEmptyList()
        {
            // Arrange
            var filterParams = new ProductFilterParams
            {
                Category = "NonExistentCategory"
            };

            // Act
            var result = await _repository.GetProductsAsync(filterParams);

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }

        [Fact]
        public async Task GetProductsAsync_WithPagination_ShouldReturnCorrectPage()
        {
            // Arrange - Create 25 extra products to ensure pagination
            var extraProducts = new List<Product>();
            for (int i = 1; i <= 25; i++)
            {
                extraProducts.Add(new Product
                {
                    Name = $"Pagination Test Product {i}",
                    Description = "Test product for pagination",
                    Price = 10.99m * i,
                    StockQuantity = i,
                    Category = "Test",
                    ImageUrl = "test.jpg",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsActive = true
                });
            }
            await _fixture.SeedProductsAsync(extraProducts);

            // Arrange filter params for page 2 with 10 items per page
            var filterParams = new ProductFilterParams
            {
                Page = 2,
                PageSize = 10,
                SortBy = "name", // Sort by name to ensure consistent order
                SortDesc = false
            };

            // Act
            var result = await _repository.GetProductsAsync(filterParams);

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().HaveCount(10); // Should return exactly 10 items
            result.Page.Should().Be(2);
            result.PageSize.Should().Be(10);
            result.TotalCount.Should().BeGreaterThan(20); // Should be at least 20+ records total
        }

        [Fact]
        public async Task GetCategoriesAsync_ShouldReturnDistinctCategories()
        {
            // Act
            var categories = await _repository.GetCategoriesAsync();

            // Assert
            categories.Should().NotBeNull();
            categories.Should().HaveCount(2); // Electronics, Home Appliances (excluding inactive)
            categories.Should().Contain("Electronics");
            categories.Should().Contain("Home Appliances");
            categories.Should().NotContain("Misc"); // From inactive product
        }

        [Fact]
        public async Task CreateAsync_ShouldCreateProduct_AndReturnId()
        {
            // Arrange
            var newProduct = new Product
            {
                Name = "New Test Product",
                Description = "Test description",
                Price = 49.99m,
                StockQuantity = 5,
                Category = "Test Category",
                ImageUrl = "test.jpg"
            };

            // Act
            var productId = await _repository.CreateAsync(newProduct);

            // Assert
            productId.Should().NotBeNull();
            newProduct.Id.Should().Be(productId);

            // Verify product was created
            var createdProduct = await _repository.GetByIdAsync(productId);
            createdProduct.Should().NotBeNull();
            createdProduct.Name.Should().Be("New Test Product");
            
            // Timestamps should be set
            createdProduct.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(10));
            createdProduct.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(10));
        }

        [Fact]
        public async Task CreateAsync_WithExtremeValues_ShouldCreateProduct()
        {
            // Arrange
            var newProduct = new Product
            {
                Name = new string('X', 100), // Very long name (100 chars)
                Description = new string('D', 1000), // Very long description (1000 chars)
                Price = decimal.MaxValue / 2, // Very large price
                StockQuantity = int.MaxValue / 2, // Very large stock
                Category = "Test Category with Spécial Chârs ānd Ümlauts",
                ImageUrl = "https://example.com/very-long-image-url-that-has-a-lot-of-characters-and-special-symbols.jpg?param=value&param2=value2"
            };

            // Act
            var productId = await _repository.CreateAsync(newProduct);

            // Assert
            productId.Should().NotBeNull();

            // Verify product was created with extreme values
            var createdProduct = await _repository.GetByIdAsync(productId);
            createdProduct.Should().NotBeNull();
            createdProduct.Name.Should().Be(newProduct.Name);
            createdProduct.Description.Should().Be(newProduct.Description);
            createdProduct.Price.Should().Be(newProduct.Price);
            createdProduct.StockQuantity.Should().Be(newProduct.StockQuantity);
            createdProduct.Category.Should().Be(newProduct.Category);
            createdProduct.ImageUrl.Should().Be(newProduct.ImageUrl);
        }

        [Fact]
        public async Task UpdateAsync_ShouldUpdateProduct()
        {
            // Arrange
            // First create a product to update
            var product = new Product
            {
                Name = "Product to Update",
                Description = "Original description",
                Price = 29.99m,
                StockQuantity = 3,
                Category = "Test",
                ImageUrl = "original.jpg",
                IsActive = true
            };
            
            var productId = await _repository.CreateAsync(product);

            // Updated product data
            var updatedProduct = new Product
            {
                Id = productId,
                Name = "Updated Product Name",
                Description = "Updated description",
                Price = 39.99m,
                StockQuantity = 8,
                Category = "Updated Category",
                ImageUrl = "updated.jpg",
                IsActive = true
            };

            // Act
            var updateResult = await _repository.UpdateAsync(productId, updatedProduct);

            // Assert
            updateResult.Should().BeTrue();

            // Verify the product was updated
            var retrievedProduct = await _repository.GetByIdAsync(productId);
            retrievedProduct.Should().NotBeNull();
            retrievedProduct.Name.Should().Be("Updated Product Name");
            retrievedProduct.Description.Should().Be("Updated description");
            retrievedProduct.Price.Should().Be(39.99m);
            retrievedProduct.StockQuantity.Should().Be(8);
            retrievedProduct.Category.Should().Be("Updated Category");
            retrievedProduct.ImageUrl.Should().Be("updated.jpg");
            
            // UpdatedAt should be newer than CreatedAt
            retrievedProduct.UpdatedAt.Should().BeAfter(retrievedProduct.CreatedAt);
        }

        [Fact]
        public async Task UpdateAsync_WithNonExistentId_ShouldReturnFalse()
        {
            // Arrange
            var nonExistentId = "507f1f77bcf86cd799439011"; // Valid MongoDB ObjectId that doesn't exist
            var updatedProduct = new Product
            {
                Id = nonExistentId,
                Name = "Updated Product Name",
                Description = "Updated description",
                Price = 39.99m,
                StockQuantity = 8,
                Category = "Updated Category",
                ImageUrl = "updated.jpg"
            };

            // Act
            var updateResult = await _repository.UpdateAsync(nonExistentId, updatedProduct);

            // Assert
            updateResult.Should().BeFalse();
        }

        [Fact]
        public async Task DeleteAsync_ShouldSoftDeleteProduct()
        {
            // Arrange
            // First create a product to delete
            var product = new Product
            {
                Name = "Product to Delete",
                Description = "Will be deleted",
                Price = 19.99m,
                StockQuantity = 3,
                Category = "Test",
                ImageUrl = "delete.jpg",
                IsActive = true
            };
            
            var productId = await _repository.CreateAsync(product);

            // Act
            var deleteResult = await _repository.DeleteAsync(productId);

            // Assert
            deleteResult.Should().BeTrue();

            // The product should not be returned by active product queries
            var allProducts = await _repository.GetAllProductsAsync();
            allProducts.Products.Should().NotContain(p => p.Id == productId);

            // But it should still exist in the database (soft deleted)
            var filter = Builders<Product>.Filter.Eq(p => p.Id, productId);
            var product2 = await _fixture.MongoDbContext.Products.Find(filter).FirstOrDefaultAsync();
            product2.Should().NotBeNull();
            product2.IsActive.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateStockAsync_DecrementingStockToZero_ShouldSucceed()
        {
            // Arrange
            // Create a product with stock of 5
            var product = new Product
            {
                Name = "Stock Test Product",
                Description = "Testing stock updates",
                Price = 9.99m,
                StockQuantity = 5,
                Category = "Test",
                ImageUrl = "stock.jpg",
                IsActive = true
            };
            
            var productId = await _repository.CreateAsync(product);

            // Act
            // Decrement stock by exactly the amount available (5)
            var updateResult = await _repository.UpdateStockAsync(productId, 5, false);

            // Assert
            updateResult.Should().BeTrue();

            // Verify stock is now zero
            var updatedProduct = await _repository.GetByIdAsync(productId);
            updatedProduct.Should().NotBeNull();
            updatedProduct.StockQuantity.Should().Be(0);
        }

        [Fact]
        public async Task UpdateStockAsync_DecrementingBelowZero_ShouldFail()
        {
            // Arrange
            // Create a product with stock of 5
            var product = new Product
            {
                Name = "Stock Test Product 2",
                Description = "Testing stock updates",
                Price = 9.99m,
                StockQuantity = 5,
                Category = "Test",
                ImageUrl = "stock.jpg",
                IsActive = true
            };
            
            var productId = await _repository.CreateAsync(product);

            // Act
            // Try to decrement stock by more than available (10 > 5)
            var updateResult = await _repository.UpdateStockAsync(productId, 10, false);

            // Assert
            updateResult.Should().BeFalse();

            // Verify stock remains unchanged
            var updatedProduct = await _repository.GetByIdAsync(productId);
            updatedProduct.Should().NotBeNull();
            updatedProduct.StockQuantity.Should().Be(5); // Still 5, not -5
        }

        [Fact]
        public async Task ProductExistsAsync_ShouldReturnTrue_ForExistingProduct()
        {
            // Arrange
            var product = new Product
            {
                Name = "Existence Test Product",
                Description = "Testing existence check",
                Price = 9.99m,
                StockQuantity = 5,
                Category = "Test",
                ImageUrl = "test.jpg",
                IsActive = true
            };
            
            var productId = await _repository.CreateAsync(product);

            // Act
            var exists = await _repository.ProductExistsAsync(productId);

            // Assert
            exists.Should().BeTrue();
        }

        [Fact]
        public async Task ProductExistsAsync_ShouldReturnTrue_ForInactiveProduct()
        {
            // Arrange
            var product = new Product
            {
                Name = "Inactive Existence Test Product",
                Description = "Testing existence check with inactive product",
                Price = 9.99m,
                StockQuantity = 5,
                Category = "Test",
                ImageUrl = "test.jpg",
                IsActive = true
            };
            
            var productId = await _repository.CreateAsync(product);
            
            // Soft delete the product
            await _repository.DeleteAsync(productId);

            // Act
            var exists = await _repository.ProductExistsAsync(productId);

            // Assert
            exists.Should().BeTrue(); // Should still exist even if inactive
        }

        [Fact]
        public async Task ProductExistsAsync_ShouldReturnFalse_ForNonExistentProduct()
        {
            // Arrange
            var nonExistentId = "507f1f77bcf86cd799439011"; // Valid MongoDB ObjectId that doesn't exist

            // Act
            var exists = await _repository.ProductExistsAsync(nonExistentId);

            // Assert
            exists.Should().BeFalse();
        }
    }
} 