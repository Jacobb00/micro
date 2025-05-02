using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using ProductService.Domain;
using ProductService.DTOs;
using Xunit;

namespace ProductService.Tests.EndToEndTests
{
    public class ProductApiTests : IClassFixture<CustomWebApplicationFactory>, IAsyncLifetime
    {
        private readonly CustomWebApplicationFactory _factory;
        private readonly HttpClient _client;
        private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions 
        { 
            PropertyNameCaseInsensitive = true 
        };

        public ProductApiTests(CustomWebApplicationFactory factory)
        {
            _factory = factory;
            _client = factory.CreateClient();
        }

        public async Task InitializeAsync()
        {
            // Seed the database with some test products
            var products = new List<Product>
            {
                new Product
                {
                    Name = "Test Laptop",
                    Description = "A test laptop for end-to-end testing",
                    Price = 999.99m,
                    StockQuantity = 10,
                    Category = "Electronics",
                    ImageUrl = "test-laptop.jpg",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsActive = true
                },
                new Product
                {
                    Name = "Test Phone",
                    Description = "A test phone for end-to-end testing",
                    Price = 599.99m,
                    StockQuantity = 20,
                    Category = "Electronics",
                    ImageUrl = "test-phone.jpg",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
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
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsActive = true
                }
            };

            await _factory.MongoDbFixture.SeedProductsAsync(products);
        }

        public async Task DisposeAsync()
        {
            await _factory.MongoDbFixture.ResetDatabaseAsync();
        }

        [Fact]
        public async Task GetProducts_ShouldReturnAllProducts()
        {
            // Act
            var response = await _client.GetAsync("/api/products");

            // Assert
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ProductListResponse>(_jsonOptions);

            result.Should().NotBeNull();
            result.Products.Should().HaveCountGreaterOrEqualTo(2);
            result.TotalCount.Should().BeGreaterOrEqualTo(2);
        }

        [Fact]
        public async Task GetProducts_WithFilters_ShouldReturnFilteredProducts()
        {
            // Act - Filter for in-stock Electronics
            var response = await _client.GetAsync("/api/products?category=Electronics&inStock=true");

            // Assert
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ProductListResponse>(_jsonOptions);

            result.Should().NotBeNull();
            result.Products.Should().AllSatisfy(p => p.Category == "Electronics" && p.StockQuantity > 0);
            result.Products.Should().NotContain(p => p.Name == "Headphones"); // Should not include out-of-stock
        }

        [Fact]
        public async Task GetProducts_WithPriceRange_ShouldReturnFilteredProducts()
        {
            // Act - Filter for products between $200 and $800
            var response = await _client.GetAsync("/api/products?minPrice=200&maxPrice=800");

            // Assert
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ProductListResponse>(_jsonOptions);

            result.Should().NotBeNull();
            result.Products.Should().AllSatisfy(p => p.Price >= 200 && p.Price <= 800);
        }

        [Fact]
        public async Task GetProducts_WithSorting_ShouldReturnSortedProducts()
        {
            // Act - Get products sorted by price descending
            var response = await _client.GetAsync("/api/products?sortBy=price&sortDesc=true");

            // Assert
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ProductListResponse>(_jsonOptions);

            result.Should().NotBeNull();
            // Verify products are sorted by price in descending order
            for (int i = 0; i < result.Products.Count - 1; i++)
            {
                result.Products[i].Price.Should().BeGreaterOrEqualTo(result.Products[i + 1].Price);
            }
        }

        [Fact]
        public async Task GetProduct_WithValidId_ShouldReturnProduct()
        {
            // Arrange
            // First, get all products to find a valid ID
            var productsResponse = await _client.GetAsync("/api/products");
            var productsList = await productsResponse.Content.ReadFromJsonAsync<ProductListResponse>(_jsonOptions);
            var firstProductId = productsList.Products[0].Id;

            // Act
            var response = await _client.GetAsync($"/api/products/{firstProductId}");

            // Assert
            response.EnsureSuccessStatusCode();
            var product = await response.Content.ReadFromJsonAsync<ProductDto>(_jsonOptions);

            product.Should().NotBeNull();
            product.Id.Should().Be(firstProductId);
        }

        [Fact]
        public async Task GetProduct_WithInvalidId_ShouldReturnNotFound()
        {
            // Act
            var response = await _client.GetAsync("/api/products/invalid-id");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task GetProduct_WithEmptyId_ShouldReturnNotFound()
        {
            // Act
            var response = await _client.GetAsync("/api/products/");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task GetCategories_ShouldReturnCategories()
        {
            // Act
            var response = await _client.GetAsync("/api/products/categories");

            // Assert
            response.EnsureSuccessStatusCode();
            var categories = await response.Content.ReadFromJsonAsync<List<string>>(_jsonOptions);

            categories.Should().NotBeNull();
            categories.Should().Contain("Electronics");
        }

        [Fact]
        public async Task CreateProduct_WithValidData_ShouldCreateProduct()
        {
            // Arrange
            var newProduct = new CreateProductDto
            {
                Name = "E2E Test Product",
                Description = "A product created in E2E test",
                Price = 499.99m,
                StockQuantity = 15,
                Category = "Test",
                ImageUrl = "test-product.jpg"
            };

            var content = new StringContent(
                JsonSerializer.Serialize(newProduct),
                Encoding.UTF8,
                "application/json");

            // Act
            var response = await _client.PostAsync("/api/products", content);

            // Assert
            response.EnsureSuccessStatusCode();
            response.StatusCode.Should().Be(HttpStatusCode.Created);

            // Get the ID of the created product from the response
            var responseContent = await response.Content.ReadAsStringAsync();
            var productId = JsonSerializer.Deserialize<string>(responseContent, _jsonOptions);

            // Verify the product was created by retrieving it
            var getResponse = await _client.GetAsync($"/api/products/{productId}");
            getResponse.EnsureSuccessStatusCode();

            var createdProduct = await getResponse.Content.ReadFromJsonAsync<ProductDto>(_jsonOptions);
            createdProduct.Should().NotBeNull();
            createdProduct.Name.Should().Be("E2E Test Product");
            createdProduct.Price.Should().Be(499.99m);
        }

        [Fact]
        public async Task CreateProduct_WithExtremeValues_ShouldCreateProduct()
        {
            // Arrange
            var newProduct = new CreateProductDto
            {
                Name = new string('A', 100), // Very long name (100 chars)
                Description = new string('D', 1000), // Very long description (1000 chars)
                Price = 999999.99m, // Very high price
                StockQuantity = 999999, // Very high stock
                Category = "Test Category with Special Chars",
                ImageUrl = "https://example.com/very-long-image-url-with-special-characters.jpg"
            };

            var content = new StringContent(
                JsonSerializer.Serialize(newProduct),
                Encoding.UTF8,
                "application/json");

            // Act
            var response = await _client.PostAsync("/api/products", content);

            // Assert
            response.EnsureSuccessStatusCode();
            response.StatusCode.Should().Be(HttpStatusCode.Created);

            var responseContent = await response.Content.ReadAsStringAsync();
            var productId = JsonSerializer.Deserialize<string>(responseContent, _jsonOptions);

            // Verify the product with extreme values was created correctly
            var getResponse = await _client.GetAsync($"/api/products/{productId}");
            getResponse.EnsureSuccessStatusCode();

            var createdProduct = await getResponse.Content.ReadFromJsonAsync<ProductDto>(_jsonOptions);
            createdProduct.Should().NotBeNull();
            createdProduct.Name.Should().Be(newProduct.Name);
            createdProduct.Description.Should().Be(newProduct.Description);
            createdProduct.Price.Should().Be(newProduct.Price);
            createdProduct.StockQuantity.Should().Be(newProduct.StockQuantity);
        }

        [Fact]
        public async Task CreateProduct_WithMissingRequiredFields_ShouldReturnBadRequest()
        {
            // Arrange
            var invalidProduct = new
            {
                // Missing required Name field
                Description = "Missing required fields",
                // Missing required Price
                StockQuantity = 5,
                // Missing required Category
                ImageUrl = "invalid.jpg"
            };

            var content = new StringContent(
                JsonSerializer.Serialize(invalidProduct),
                Encoding.UTF8,
                "application/json");

            // Act
            var response = await _client.PostAsync("/api/products", content);

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            // Should contain validation errors in response
            var errorResponse = await response.Content.ReadAsStringAsync();
            errorResponse.Should().Contain("validation");
        }

        [Fact]
        public async Task UpdateProduct_WithValidData_ShouldUpdateProduct()
        {
            // Arrange
            // First, create a product to update
            var newProduct = new CreateProductDto
            {
                Name = "Product to Update",
                Description = "This product will be updated",
                Price = 99.99m,
                StockQuantity = 5,
                Category = "Test",
                ImageUrl = "product-to-update.jpg"
            };

            var createContent = new StringContent(
                JsonSerializer.Serialize(newProduct),
                Encoding.UTF8,
                "application/json");

            var createResponse = await _client.PostAsync("/api/products", createContent);
            createResponse.EnsureSuccessStatusCode();
            
            var responseContent = await createResponse.Content.ReadAsStringAsync();
            var productId = JsonSerializer.Deserialize<string>(responseContent, _jsonOptions);

            // Now update the product
            var updateDto = new UpdateProductDto
            {
                Name = "Updated Product Name",
                Description = "Updated description",
                Price = 129.99m,
                StockQuantity = 10,
                Category = "UpdatedTest",
                ImageUrl = "updated-product.jpg"
            };

            var updateContent = new StringContent(
                JsonSerializer.Serialize(updateDto),
                Encoding.UTF8,
                "application/json");

            // Act
            var updateResponse = await _client.PutAsync($"/api/products/{productId}", updateContent);

            // Assert
            updateResponse.EnsureSuccessStatusCode();
            updateResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

            // Verify the product was updated
            var getResponse = await _client.GetAsync($"/api/products/{productId}");
            getResponse.EnsureSuccessStatusCode();

            var updatedProduct = await getResponse.Content.ReadFromJsonAsync<ProductDto>(_jsonOptions);
            updatedProduct.Should().NotBeNull();
            updatedProduct.Name.Should().Be("Updated Product Name");
            updatedProduct.Description.Should().Be("Updated description");
            updatedProduct.Price.Should().Be(129.99m);
            updatedProduct.StockQuantity.Should().Be(10);
            updatedProduct.Category.Should().Be("UpdatedTest");
            updatedProduct.ImageUrl.Should().Be("updated-product.jpg");
        }

        [Fact]
        public async Task UpdateProduct_WithPartialData_ShouldUpdateOnlyProvidedFields()
        {
            // Arrange
            // First, create a product to update
            var newProduct = new CreateProductDto
            {
                Name = "Partial Update Product",
                Description = "This will be partially updated",
                Price = 79.99m,
                StockQuantity = 8,
                Category = "Test",
                ImageUrl = "partial-update.jpg"
            };

            var createContent = new StringContent(
                JsonSerializer.Serialize(newProduct),
                Encoding.UTF8,
                "application/json");

            var createResponse = await _client.PostAsync("/api/products", createContent);
            createResponse.EnsureSuccessStatusCode();
            
            var responseContent = await createResponse.Content.ReadAsStringAsync();
            var productId = JsonSerializer.Deserialize<string>(responseContent, _jsonOptions);

            // Now update only the name and price
            var partialUpdateDto = new
            {
                Name = "Partially Updated Name",
                Price = 89.99m
                // Other fields not provided
            };

            var updateContent = new StringContent(
                JsonSerializer.Serialize(partialUpdateDto),
                Encoding.UTF8,
                "application/json");

            // Act
            var updateResponse = await _client.PutAsync($"/api/products/{productId}", updateContent);

            // Assert
            updateResponse.EnsureSuccessStatusCode();

            // Verify only provided fields were updated
            var getResponse = await _client.GetAsync($"/api/products/{productId}");
            getResponse.EnsureSuccessStatusCode();

            var updatedProduct = await getResponse.Content.ReadFromJsonAsync<ProductDto>(_jsonOptions);
            updatedProduct.Should().NotBeNull();
            updatedProduct.Name.Should().Be("Partially Updated Name"); // This was updated
            updatedProduct.Description.Should().Be("This will be partially updated"); // This should be unchanged
            updatedProduct.Price.Should().Be(89.99m); // This was updated
            updatedProduct.StockQuantity.Should().Be(8); // This should be unchanged
            updatedProduct.Category.Should().Be("Test"); // This should be unchanged
            updatedProduct.ImageUrl.Should().Be("partial-update.jpg"); // This should be unchanged
        }

        [Fact]
        public async Task UpdateProduct_WithNonExistentId_ShouldReturnNotFound()
        {
            // Arrange
            var updateDto = new UpdateProductDto
            {
                Name = "Updated Product",
                Price = 99.99m
            };

            var content = new StringContent(
                JsonSerializer.Serialize(updateDto),
                Encoding.UTF8,
                "application/json");

            // Act
            var response = await _client.PutAsync("/api/products/nonexistent-id", content);

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task DeleteProduct_WithValidId_ShouldDeleteProduct()
        {
            // Arrange
            // First, create a product to delete
            var newProduct = new CreateProductDto
            {
                Name = "Product to Delete",
                Description = "This product will be deleted",
                Price = 49.99m,
                StockQuantity = 3,
                Category = "Test",
                ImageUrl = "product-to-delete.jpg"
            };

            var createContent = new StringContent(
                JsonSerializer.Serialize(newProduct),
                Encoding.UTF8,
                "application/json");

            var createResponse = await _client.PostAsync("/api/products", createContent);
            createResponse.EnsureSuccessStatusCode();
            
            var responseContent = await createResponse.Content.ReadAsStringAsync();
            var productId = JsonSerializer.Deserialize<string>(responseContent, _jsonOptions);

            // Act
            var deleteResponse = await _client.DeleteAsync($"/api/products/{productId}");

            // Assert
            deleteResponse.EnsureSuccessStatusCode();
            deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

            // Verify the product was deleted (should return 404)
            var getResponse = await _client.GetAsync($"/api/products/{productId}");
            getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task DeleteProduct_WithNonExistentId_ShouldReturnNotFound()
        {
            // Act
            var response = await _client.DeleteAsync("/api/products/nonexistent-id");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task UpdateStock_WithValidData_ShouldUpdateStock()
        {
            // Arrange
            // First, create a product
            var newProduct = new CreateProductDto
            {
                Name = "Product for Stock Update",
                Description = "This product's stock will be updated",
                Price = 149.99m,
                StockQuantity = 10,
                Category = "Test",
                ImageUrl = "stock-update.jpg"
            };

            var createContent = new StringContent(
                JsonSerializer.Serialize(newProduct),
                Encoding.UTF8,
                "application/json");

            var createResponse = await _client.PostAsync("/api/products", createContent);
            createResponse.EnsureSuccessStatusCode();
            
            var responseContent = await createResponse.Content.ReadAsStringAsync();
            var productId = JsonSerializer.Deserialize<string>(responseContent, _jsonOptions);

            // Stock update DTO
            var stockDto = new UpdateStockDto
            {
                Quantity = 5,
                IsIncrement = true
            };

            var stockContent = new StringContent(
                JsonSerializer.Serialize(stockDto),
                Encoding.UTF8,
                "application/json");

            // Act
            var stockResponse = await _client.PatchAsync($"/api/products/{productId}/stock", stockContent);

            // Assert
            stockResponse.EnsureSuccessStatusCode();
            stockResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

            // Verify stock was updated
            var getResponse = await _client.GetAsync($"/api/products/{productId}");
            getResponse.EnsureSuccessStatusCode();

            var updatedProduct = await getResponse.Content.ReadFromJsonAsync<ProductDto>(_jsonOptions);
            updatedProduct.Should().NotBeNull();
            updatedProduct.StockQuantity.Should().Be(15); // 10 + 5
        }

        [Fact]
        public async Task UpdateStock_DecrementingBelowZero_ShouldReturnBadRequest()
        {
            // Arrange
            // First create a product with stock = 5
            var newProduct = new CreateProductDto
            {
                Name = "Product for Stock Validation",
                Description = "This product will test stock validation",
                Price = 29.99m,
                StockQuantity = 5,
                Category = "Test",
                ImageUrl = "stock-validation.jpg"
            };

            var createContent = new StringContent(
                JsonSerializer.Serialize(newProduct),
                Encoding.UTF8,
                "application/json");

            var createResponse = await _client.PostAsync("/api/products", createContent);
            createResponse.EnsureSuccessStatusCode();
            
            var responseContent = await createResponse.Content.ReadAsStringAsync();
            var productId = JsonSerializer.Deserialize<string>(responseContent, _jsonOptions);

            // Try to decrement by 10 (which is > current stock of 5)
            var stockDto = new UpdateStockDto
            {
                Quantity = 10,
                IsIncrement = false
            };

            var stockContent = new StringContent(
                JsonSerializer.Serialize(stockDto),
                Encoding.UTF8,
                "application/json");

            // Act
            var stockResponse = await _client.PatchAsync($"/api/products/{productId}/stock", stockContent);

            // Assert
            stockResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            
            // Verify stock remains unchanged
            var getResponse = await _client.GetAsync($"/api/products/{productId}");
            getResponse.EnsureSuccessStatusCode();

            var product = await getResponse.Content.ReadFromJsonAsync<ProductDto>(_jsonOptions);
            product.Should().NotBeNull();
            product.StockQuantity.Should().Be(5); // Should still be 5, not -5
        }

        [Fact]
        public async Task UpdateStock_WithNonExistentId_ShouldReturnNotFound()
        {
            // Arrange
            var stockDto = new UpdateStockDto
            {
                Quantity = 5,
                IsIncrement = true
            };

            var content = new StringContent(
                JsonSerializer.Serialize(stockDto),
                Encoding.UTF8,
                "application/json");

            // Act
            var response = await _client.PatchAsync("/api/products/nonexistent-id/stock", content);

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task ConcurrentRequests_ShouldHandleCorrectly()
        {
            // Arrange
            var newProduct = new CreateProductDto
            {
                Name = "Concurrency Test Product",
                Description = "Testing concurrent operations",
                Price = 99.99m,
                StockQuantity = 10,
                Category = "Test",
                ImageUrl = "concurrency.jpg"
            };

            var createContent = new StringContent(
                JsonSerializer.Serialize(newProduct),
                Encoding.UTF8,
                "application/json");

            var createResponse = await _client.PostAsync("/api/products", createContent);
            createResponse.EnsureSuccessStatusCode();
            
            var responseContent = await createResponse.Content.ReadAsStringAsync();
            var productId = JsonSerializer.Deserialize<string>(responseContent, _jsonOptions);

            // Create 5 concurrent increment stock operations
            var incrementStockDto = new UpdateStockDto
            {
                Quantity = 1,
                IsIncrement = true
            };

            var incrementContent = new StringContent(
                JsonSerializer.Serialize(incrementStockDto),
                Encoding.UTF8,
                "application/json");

            // Act - Send 5 concurrent increment requests
            var tasks = new List<Task<HttpResponseMessage>>();
            for (int i = 0; i < 5; i++)
            {
                tasks.Add(_client.PatchAsync($"/api/products/{productId}/stock", new StringContent(
                    incrementContent.ReadAsStringAsync().Result,
                    Encoding.UTF8,
                    "application/json")));
            }

            await Task.WhenAll(tasks);

            // Assert
            foreach (var task in tasks)
            {
                task.Result.EnsureSuccessStatusCode();
            }

            // Verify final stock is correctly incremented
            var getResponse = await _client.GetAsync($"/api/products/{productId}");
            getResponse.EnsureSuccessStatusCode();

            var updatedProduct = await getResponse.Content.ReadFromJsonAsync<ProductDto>(_jsonOptions);
            updatedProduct.Should().NotBeNull();
            updatedProduct.StockQuantity.Should().Be(15); // 10 + (1 × 5)
        }
    }
} 