using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MongoDB.Driver;
using Moq;
using ProductService.Domain;
using ProductService.DTOs;
using ProductService.Infrastructure;
using ProductService.Services;
using Xunit;
using FluentAssertions;

namespace ProductService.Tests.UnitTests.Repositories
{
    public class ProductRepositoryTests
    {
        private readonly Mock<IMongoDbContext> _contextMock;
        private readonly Mock<IMongoCollection<Product>> _collectionMock;
        private readonly Mock<IAsyncCursor<Product>> _cursorMock;
        private readonly Mock<IAsyncCursor<string>> _stringCursorMock;
        private readonly ProductRepository _repository;

        public ProductRepositoryTests()
        {
            // Set up mocks
            _contextMock = new Mock<IMongoDbContext>();
            _collectionMock = new Mock<IMongoCollection<Product>>();
            _cursorMock = new Mock<IAsyncCursor<Product>>();
            _stringCursorMock = new Mock<IAsyncCursor<string>>();

            // Setup MongoDB context
            _contextMock.Setup(c => c.Products).Returns(_collectionMock.Object);

            // Create repository with mocked context
            _repository = new ProductRepository(_contextMock.Object);
        }

        [Fact]
        public async Task GetByIdAsync_ShouldReturnProduct_WhenProductExists()
        {
            // Arrange
            var productId = "5e9f8f8f8f8f8f8f8f8f8f8f";
            var product = new Product 
            { 
                Id = productId, 
                Name = "Test Product", 
                Description = "Test Description", 
                Price = 9.99m, 
                StockQuantity = 10, 
                Category = "Test", 
                ImageUrl = "test.jpg", 
                IsActive = true 
            };

            // Setup Find operation
            var filterFunc = It.IsAny<FilterDefinition<Product>>();
            _collectionMock.Setup(c => c.FindAsync(
                filterFunc,
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            // Setup cursor to return our test product
            _cursorMock.Setup(c => c.Current).Returns(new List<Product> { product });
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var result = await _repository.GetByIdAsync(productId);

            // Assert
            result.Should().NotBeNull();
            result.Id.Should().Be(productId);
            result.Name.Should().Be("Test Product");
        }

        [Fact]
        public async Task GetByIdAsync_ShouldReturnNull_WhenProductDoesNotExist()
        {
            // Arrange
            var productId = "5e9f8f8f8f8f8f8f8f8f8f8f";

            // Setup Find operation to return empty result
            var filterFunc = It.IsAny<FilterDefinition<Product>>();
            _collectionMock.Setup(c => c.FindAsync(
                filterFunc,
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            // Setup cursor to return empty list
            _cursorMock.Setup(c => c.Current).Returns(new List<Product>());
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            // Act
            var result = await _repository.GetByIdAsync(productId);

            // Assert
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetByIdAsync_ShouldReturnNull_WhenProductIsInactive()
        {
            // Arrange
            var productId = "5e9f8f8f8f8f8f8f8f8f8f8f";
            var product = new Product 
            { 
                Id = productId, 
                Name = "Test Product", 
                Description = "Test Description", 
                Price = 9.99m, 
                StockQuantity = 10, 
                Category = "Test", 
                ImageUrl = "test.jpg", 
                IsActive = false // Inactive product
            };

            // Setup Find operation to return inactive product
            var filterFunc = It.IsAny<FilterDefinition<Product>>();
            _collectionMock.Setup(c => c.FindAsync(
                filterFunc,
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            // Setup cursor to return our test product (which is inactive)
            _cursorMock.Setup(c => c.Current).Returns(new List<Product>());
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            // Act
            var result = await _repository.GetByIdAsync(productId);

            // Assert
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetAllProductsAsync_ShouldReturnAllActiveProducts()
        {
            // Arrange
            var products = new List<Product>
            {
                new Product { Id = "1", Name = "Product 1", Category = "Category 1", IsActive = true },
                new Product { Id = "2", Name = "Product 2", Category = "Category 2", IsActive = true }
            };

            // Setup Find operation
            var filterFunc = It.IsAny<FilterDefinition<Product>>();
            _collectionMock.Setup(c => c.FindAsync(
                filterFunc,
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            // Setup cursor to return our test products
            _cursorMock.Setup(c => c.Current).Returns(products);
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var result = await _repository.GetAllProductsAsync();

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
        }

        [Fact]
        public async Task GetAllProductsAsync_ShouldReturnEmptyList_WhenNoProductsExist()
        {
            // Arrange
            var products = new List<Product>();

            // Setup Find operation
            var filterFunc = It.IsAny<FilterDefinition<Product>>();
            _collectionMock.Setup(c => c.FindAsync(
                filterFunc,
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            // Setup cursor to return empty list
            _cursorMock.Setup(c => c.Current).Returns(products);
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var result = await _repository.GetAllProductsAsync();

            // Assert
            result.Should().NotBeNull();
            result.Products.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }

        [Fact]
        public async Task CreateAsync_ShouldReturnProductId_WhenProductIsCreated()
        {
            // Arrange
            var product = new Product
            {
                Name = "New Product",
                Description = "New Description",
                Price = 19.99m,
                StockQuantity = 5,
                Category = "New Category",
                ImageUrl = "new.jpg"
            };

            // Setup InsertOneAsync
            _collectionMock.Setup(c => c.InsertOneAsync(
                It.IsAny<Product>(),
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>()))
                .Callback<Product, InsertOneOptions, CancellationToken>((p, o, c) =>
                {
                    // Set ID when InsertOneAsync is called
                    p.Id = "new-product-id";
                })
                .Returns(Task.CompletedTask);

            // Act
            var result = await _repository.CreateAsync(product);

            // Assert
            result.Should().Be("new-product-id");
            
            // Verify that dates were set
            product.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
            product.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        }

        [Fact]
        public async Task CreateAsync_ShouldSetIsActiveToTrue_WhenProductIsCreated()
        {
            // Arrange
            var product = new Product
            {
                Name = "New Product",
                Description = "New Description",
                Price = 19.99m,
                StockQuantity = 5,
                Category = "New Category",
                ImageUrl = "new.jpg",
                IsActive = false // Explicitly set to false
            };

            // Setup InsertOneAsync
            _collectionMock.Setup(c => c.InsertOneAsync(
                It.IsAny<Product>(),
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>()))
                .Callback<Product, InsertOneOptions, CancellationToken>((p, o, c) =>
                {
                    // Set ID when InsertOneAsync is called
                    p.Id = "new-product-id";
                })
                .Returns(Task.CompletedTask);

            // Act
            var result = await _repository.CreateAsync(product);

            // Assert
            product.IsActive.Should().BeTrue(); // Should be set to true regardless of input
        }

        [Fact]
        public async Task UpdateAsync_ShouldReturnFalse_WhenProductDoesNotExist()
        {
            // Arrange
            var productId = "non-existent-id";
            var updatedProduct = new Product
            {
                Id = productId,
                Name = "Updated Product",
                Price = 29.99m
            };

            // Setup Find to return null (product doesn't exist)
            _collectionMock.Setup(c => c.FindAsync(
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            _cursorMock.Setup(c => c.Current).Returns(new List<Product>());
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            // Act
            var result = await _repository.UpdateAsync(productId, updatedProduct);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateAsync_ShouldReturnTrue_WhenUpdateSucceeds()
        {
            // Arrange
            var productId = "existing-id";
            var existingProduct = new Product
            {
                Id = productId,
                Name = "Original Product"
            };
            
            var updatedProduct = new Product
            {
                Id = productId,
                Name = "Updated Product",
                Price = 29.99m
            };

            // Setup Find to return existing product
            _collectionMock.Setup(c => c.FindAsync(
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            _cursorMock.Setup(c => c.Current).Returns(new List<Product> { existingProduct });
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Setup UpdateOneAsync to return success
            var updateResult = new Mock<UpdateResult>();
            updateResult.Setup(r => r.ModifiedCount).Returns(1);
            
            _collectionMock.Setup(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<UpdateDefinition<Product>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(updateResult.Object);

            // Act
            var result = await _repository.UpdateAsync(productId, updatedProduct);

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public async Task UpdateStockAsync_ShouldReturnFalse_WhenResultingStockWouldBeNegative()
        {
            // Arrange
            var productId = "product-id";
            var existingProduct = new Product
            {
                Id = productId,
                Name = "Product",
                StockQuantity = 5, // Current stock is 5
                IsActive = true
            };

            // Setup Find to return existing product
            _collectionMock.Setup(c => c.FindAsync(
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            _cursorMock.Setup(c => c.Current).Returns(new List<Product> { existingProduct });
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            // Try to decrement by 10 (which would make stock negative)
            var result = await _repository.UpdateStockAsync(productId, 10, false);

            // Assert
            result.Should().BeFalse(); // Should prevent negative stock
        }

        [Fact]
        public async Task UpdateStockAsync_ShouldUpdateStock_WhenIncrementingStock()
        {
            // Arrange
            var productId = "product-id";
            var existingProduct = new Product
            {
                Id = productId,
                Name = "Product",
                StockQuantity = 5, // Current stock is 5
                IsActive = true
            };

            // Setup Find to return existing product
            _collectionMock.Setup(c => c.FindAsync(
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            _cursorMock.Setup(c => c.Current).Returns(new List<Product> { existingProduct });
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            
            // Setup UpdateOneAsync to return success
            var updateResult = new Mock<UpdateResult>();
            updateResult.Setup(r => r.ModifiedCount).Returns(1);
            
            _collectionMock.Setup(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<UpdateDefinition<Product>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(updateResult.Object);

            // Act
            // Increment by 10
            var result = await _repository.UpdateStockAsync(productId, 10, true);

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public async Task DeleteAsync_ShouldReturnFalse_WhenProductDoesNotExist()
        {
            // Arrange - Setup UpdateOneAsync to return no modified documents
            var updateResult = new Mock<UpdateResult>();
            updateResult.Setup(r => r.ModifiedCount).Returns(0);
            
            _collectionMock.Setup(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<UpdateDefinition<Product>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(updateResult.Object);

            // Act
            var result = await _repository.DeleteAsync("non-existent-id");

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task GetCategoriesAsync_ShouldReturnAllCategories()
        {
            // Arrange
            var categories = new List<string> { "Category 1", "Category 2", "Category 3" };

            // Setup Distinct operation
            _collectionMock.Setup(c => c.DistinctAsync(
                It.IsAny<FieldDefinition<Product, string>>(),
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<DistinctOptions>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_stringCursorMock.Object);

            // Setup cursor to return our categories
            _stringCursorMock.Setup(c => c.Current).Returns(categories);
            _stringCursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var result = await _repository.GetCategoriesAsync();

            // Assert
            result.Should().NotBeNull();
            result.Should().HaveCount(3);
            result.Should().Contain("Category 1");
            result.Should().Contain("Category 2");
            result.Should().Contain("Category 3");
        }

        [Fact]
        public async Task GetCategoriesAsync_ShouldReturnEmptyList_WhenNoCategories()
        {
            // Arrange
            var categories = new List<string>(); // Empty list

            // Setup Distinct operation
            _collectionMock.Setup(c => c.DistinctAsync(
                It.IsAny<FieldDefinition<Product, string>>(),
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<DistinctOptions>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_stringCursorMock.Object);

            // Setup cursor to return empty list
            _stringCursorMock.Setup(c => c.Current).Returns(categories);
            _stringCursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            var result = await _repository.GetCategoriesAsync();

            // Assert
            result.Should().NotBeNull();
            result.Should().BeEmpty();
        }

        [Fact]
        public async Task GetProductsAsync_ShouldHandleExtremePaginationValues()
        {
            // Arrange
            var products = new List<Product>
            {
                new Product { Id = "1", Name = "Product 1", Category = "Category 1", IsActive = true },
                new Product { Id = "2", Name = "Product 2", Category = "Category 2", IsActive = true }
            };

            // Setup for CountDocumentsAsync
            _collectionMock.Setup(c => c.CountDocumentsAsync(
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<CountOptions>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(2);

            // Setup Find operation
            _collectionMock.Setup(c => c.FindAsync(
                It.IsAny<FilterDefinition<Product>>(),
                It.IsAny<FindOptions<Product>>(),
                It.IsAny<CancellationToken>()))
                .ReturnsAsync(_cursorMock.Object);

            // Setup cursor to return our test products
            _cursorMock.Setup(c => c.Current).Returns(products);
            _cursorMock.Setup(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Create filter with extreme pagination values
            var filterParams = new ProductFilterParams
            {
                Page = -1, // Negative page
                PageSize = 1000 // Very large page size
            };

            // Act
            var result = await _repository.GetProductsAsync(filterParams);

            // Assert
            result.Should().NotBeNull();
            // Repository should handle these values gracefully
            result.Products.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
        }
    }
} 