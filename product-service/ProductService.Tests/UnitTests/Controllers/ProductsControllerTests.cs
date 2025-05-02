using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ProductService.Controllers;
using ProductService.Domain;
using ProductService.DTOs;
using ProductService.Events;
using ProductService.Services;
using MassTransit;
using Xunit;
using FluentAssertions;

namespace ProductService.Tests.UnitTests.Controllers
{
    public class ProductsControllerTests
    {
        private readonly Mock<IProductRepository> _repositoryMock;
        private readonly Mock<IPublishEndpoint> _publishEndpointMock;
        private readonly ProductsController _controller;

        public ProductsControllerTests()
        {
            _repositoryMock = new Mock<IProductRepository>();
            _publishEndpointMock = new Mock<IPublishEndpoint>();
            _controller = new ProductsController(_repositoryMock.Object, _publishEndpointMock.Object);
        }

        [Fact]
        public async Task GetProducts_ShouldReturnOk_WithProductList()
        {
            // Arrange
            var productList = new ProductListResponse
            {
                Products = new List<ProductDto>
                {
                    new ProductDto { Id = "1", Name = "Product 1" },
                    new ProductDto { Id = "2", Name = "Product 2" }
                },
                TotalCount = 2,
                Page = 1,
                PageSize = 10
            };

            _repositoryMock.Setup(r => r.GetAllProductsAsync())
                .ReturnsAsync(productList);

            // Act
            var result = await _controller.GetProducts();

            // Assert
            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            var returnedList = okResult.Value.Should().BeAssignableTo<ProductListResponse>().Subject;
            returnedList.Products.Should().HaveCount(2);
            returnedList.TotalCount.Should().Be(2);
        }

        [Fact]
        public async Task GetProducts_ShouldReturnOk_WithEmptyList_WhenNoProductsExist()
        {
            // Arrange
            var emptyProductList = new ProductListResponse
            {
                Products = new List<ProductDto>(),
                TotalCount = 0,
                Page = 1,
                PageSize = 10
            };

            _repositoryMock.Setup(r => r.GetAllProductsAsync())
                .ReturnsAsync(emptyProductList);

            // Act
            var result = await _controller.GetProducts();

            // Assert
            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            var returnedList = okResult.Value.Should().BeAssignableTo<ProductListResponse>().Subject;
            returnedList.Products.Should().BeEmpty();
            returnedList.TotalCount.Should().Be(0);
        }

        [Fact]
        public async Task GetProduct_ShouldReturnOk_WhenProductExists()
        {
            // Arrange
            var productId = "1";
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

            _repositoryMock.Setup(r => r.GetByIdAsync(productId))
                .ReturnsAsync(product);

            // Act
            var result = await _controller.GetProduct(productId);

            // Assert
            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            var returnedProduct = okResult.Value.Should().BeAssignableTo<ProductDto>().Subject;
            returnedProduct.Id.Should().Be(productId);
            returnedProduct.Name.Should().Be("Test Product");
        }

        [Fact]
        public async Task GetProduct_ShouldReturnNotFound_WhenProductDoesNotExist()
        {
            // Arrange
            var productId = "1";

            _repositoryMock.Setup(r => r.GetByIdAsync(productId))
                .ReturnsAsync((Product)null);

            // Act
            var result = await _controller.GetProduct(productId);

            // Assert
            result.Result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task GetProduct_ShouldReturnNotFound_WithEmptyId()
        {
            // Arrange
            var productId = string.Empty;

            _repositoryMock.Setup(r => r.GetByIdAsync(productId))
                .ReturnsAsync((Product)null);

            // Act
            var result = await _controller.GetProduct(productId);

            // Assert
            result.Result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task GetCategories_ShouldReturnOk_WithCategoriesList()
        {
            // Arrange
            var categories = new List<string> { "Electronics", "Clothing", "Books" };

            _repositoryMock.Setup(r => r.GetCategoriesAsync())
                .ReturnsAsync(categories);

            // Act
            var result = await _controller.GetCategories();

            // Assert
            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            var returnedCategories = okResult.Value.Should().BeAssignableTo<List<string>>().Subject;
            returnedCategories.Should().HaveCount(3);
            returnedCategories.Should().Contain("Electronics");
            returnedCategories.Should().Contain("Clothing");
            returnedCategories.Should().Contain("Books");
        }

        [Fact]
        public async Task GetCategories_ShouldReturnOk_WithEmptyList_WhenNoCategories()
        {
            // Arrange
            var emptyCategories = new List<string>();

            _repositoryMock.Setup(r => r.GetCategoriesAsync())
                .ReturnsAsync(emptyCategories);

            // Act
            var result = await _controller.GetCategories();

            // Assert
            var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
            var returnedCategories = okResult.Value.Should().BeAssignableTo<List<string>>().Subject;
            returnedCategories.Should().BeEmpty();
        }

        [Fact]
        public async Task CreateProduct_ShouldReturnCreatedAtAction_WhenProductIsCreated()
        {
            // Arrange
            var createDto = new CreateProductDto
            {
                Name = "New Product",
                Description = "New Description",
                Price = 19.99m,
                StockQuantity = 5,
                Category = "New Category",
                ImageUrl = "new.jpg"
            };

            var newProductId = "new-product-id";

            _repositoryMock.Setup(r => r.CreateAsync(It.IsAny<Product>()))
                .ReturnsAsync(newProductId);

            // Act
            var result = await _controller.CreateProduct(createDto);

            // Assert
            var createdAtResult = result.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
            createdAtResult.ActionName.Should().Be(nameof(ProductsController.GetProduct));
            createdAtResult.RouteValues["id"].Should().Be(newProductId);
            createdAtResult.Value.Should().Be(newProductId);

            // Verify publish was called twice (command and event)
            _publishEndpointMock.Verify(p => p.Publish(It.IsAny<CreateProductCommand>(), default), Times.Once);
            _publishEndpointMock.Verify(p => p.Publish(It.IsAny<ProductCreatedEvent>(), default), Times.Once);
        }

        [Fact]
        public async Task CreateProduct_ShouldMapAllFields_FromDtoToEntity()
        {
            // Arrange
            var createDto = new CreateProductDto
            {
                Name = "Product with Special Characters: !@#$%^&*()",
                Description = "Description with lots of text and numbers: 1234567890",
                Price = 999999.99m, // Very high price
                StockQuantity = 9999, // Very high stock
                Category = "Category with special chars: !@#",
                ImageUrl = "https://very-long-url-with-special-characters.com/image.jpg?param1=value1&param2=value2"
            };

            var newProductId = "new-product-id";
            Product capturedProduct = null;

            _repositoryMock.Setup(r => r.CreateAsync(It.IsAny<Product>()))
                .Callback<Product>(p => capturedProduct = p)
                .ReturnsAsync(newProductId);

            // Act
            await _controller.CreateProduct(createDto);

            // Assert
            capturedProduct.Should().NotBeNull();
            capturedProduct.Name.Should().Be(createDto.Name);
            capturedProduct.Description.Should().Be(createDto.Description);
            capturedProduct.Price.Should().Be(createDto.Price);
            capturedProduct.StockQuantity.Should().Be(createDto.StockQuantity);
            capturedProduct.Category.Should().Be(createDto.Category);
            capturedProduct.ImageUrl.Should().Be(createDto.ImageUrl);
            capturedProduct.IsActive.Should().BeTrue();
        }

        [Fact]
        public async Task UpdateProduct_ShouldReturnNoContent_WhenProductIsUpdated()
        {
            // Arrange
            var productId = "1";
            var updateDto = new UpdateProductDto
            {
                Name = "Updated Product",
                Description = "Updated Description",
                Price = 29.99m,
                StockQuantity = 15,
                Category = "Updated Category",
                ImageUrl = "updated.jpg"
            };

            var existingProduct = new Product
            {
                Id = productId,
                Name = "Original Product",
                Description = "Original Description",
                Price = 19.99m,
                StockQuantity = 10,
                Category = "Original Category",
                ImageUrl = "original.jpg",
                IsActive = true
            };

            _repositoryMock.Setup(r => r.GetByIdAsync(productId))
                .ReturnsAsync(existingProduct);

            _repositoryMock.Setup(r => r.UpdateAsync(productId, It.IsAny<Product>()))
                .ReturnsAsync(true);

            // Act
            var result = await _controller.UpdateProduct(productId, updateDto);

            // Assert
            result.Should().BeOfType<NoContentResult>();

            // Verify fields were updated
            existingProduct.Name.Should().Be("Updated Product");
            existingProduct.Description.Should().Be("Updated Description");
            existingProduct.Price.Should().Be(29.99m);
            existingProduct.StockQuantity.Should().Be(15);
            existingProduct.Category.Should().Be("Updated Category");
            existingProduct.ImageUrl.Should().Be("updated.jpg");

            // Verify publish was called twice (command and event)
            _publishEndpointMock.Verify(p => p.Publish(It.IsAny<UpdateProductCommand>(), default), Times.Once);
            _publishEndpointMock.Verify(p => p.Publish(It.IsAny<ProductUpdatedEvent>(), default), Times.Once);
        }

        [Fact]
        public async Task UpdateProduct_ShouldUpdateOnlyProvidedFields()
        {
            // Arrange
            var productId = "1";
            var updateDto = new UpdateProductDto
            {
                Name = "Updated Product",
                // Description is null (not provided)
                Price = 29.99m,
                // StockQuantity is null (not provided)
                // Category is null (not provided)
                // ImageUrl is null (not provided)
            };

            var existingProduct = new Product
            {
                Id = productId,
                Name = "Original Product",
                Description = "Original Description",
                Price = 19.99m,
                StockQuantity = 10,
                Category = "Original Category",
                ImageUrl = "original.jpg",
                IsActive = true
            };

            _repositoryMock.Setup(r => r.GetByIdAsync(productId))
                .ReturnsAsync(existingProduct);

            _repositoryMock.Setup(r => r.UpdateAsync(productId, It.IsAny<Product>()))
                .ReturnsAsync(true);

            // Act
            var result = await _controller.UpdateProduct(productId, updateDto);

            // Assert
            result.Should().BeOfType<NoContentResult>();

            // Verify only specified fields were updated
            existingProduct.Name.Should().Be("Updated Product"); // This was updated
            existingProduct.Description.Should().Be("Original Description"); // This was not updated
            existingProduct.Price.Should().Be(29.99m); // This was updated
            existingProduct.StockQuantity.Should().Be(10); // This was not updated
            existingProduct.Category.Should().Be("Original Category"); // This was not updated
            existingProduct.ImageUrl.Should().Be("original.jpg"); // This was not updated
        }

        [Fact]
        public async Task UpdateProduct_ShouldReturnNotFound_WhenProductDoesNotExist()
        {
            // Arrange
            var productId = "1";
            var updateDto = new UpdateProductDto
            {
                Name = "Updated Product"
            };

            _repositoryMock.Setup(r => r.GetByIdAsync(productId))
                .ReturnsAsync((Product)null);

            // Act
            var result = await _controller.UpdateProduct(productId, updateDto);

            // Assert
            result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task UpdateProduct_ShouldReturnBadRequest_WhenUpdateFails()
        {
            // Arrange
            var productId = "1";
            var updateDto = new UpdateProductDto
            {
                Name = "Updated Product"
            };

            var existingProduct = new Product
            {
                Id = productId,
                Name = "Original Product"
            };

            _repositoryMock.Setup(r => r.GetByIdAsync(productId))
                .ReturnsAsync(existingProduct);

            _repositoryMock.Setup(r => r.UpdateAsync(productId, It.IsAny<Product>()))
                .ReturnsAsync(false); // Update fails

            // Act
            var result = await _controller.UpdateProduct(productId, updateDto);

            // Assert
            var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
            badRequestResult.Value.Should().Be("Failed to update product");
        }

        [Fact]
        public async Task UpdateStock_ShouldReturnNoContent_WhenStockIsUpdated()
        {
            // Arrange
            var productId = "1";
            var stockDto = new UpdateStockDto
            {
                Quantity = 5,
                IsIncrement = true
            };

            _repositoryMock.Setup(r => r.ProductExistsAsync(productId))
                .ReturnsAsync(true);

            _repositoryMock.Setup(r => r.UpdateStockAsync(productId, stockDto.Quantity, stockDto.IsIncrement))
                .ReturnsAsync(true);

            _repositoryMock.Setup(r => r.GetByIdAsync(productId))
                .ReturnsAsync(new Product { Id = productId, StockQuantity = 15 });

            // Act
            var result = await _controller.UpdateStock(productId, stockDto);

            // Assert
            result.Should().BeOfType<NoContentResult>();

            // Verify publish was called with correct event
            _publishEndpointMock.Verify(p => p.Publish(It.IsAny<StockUpdatedEvent>(), default), Times.Once);
        }

        [Fact]
        public async Task UpdateStock_ShouldReturnNotFound_WhenProductDoesNotExist()
        {
            // Arrange
            var productId = "1";
            var stockDto = new UpdateStockDto
            {
                Quantity = 5,
                IsIncrement = true
            };

            _repositoryMock.Setup(r => r.ProductExistsAsync(productId))
                .ReturnsAsync(false);

            // Act
            var result = await _controller.UpdateStock(productId, stockDto);

            // Assert
            result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task UpdateStock_ShouldReturnBadRequest_WhenStockUpdateFails()
        {
            // Arrange
            var productId = "1";
            var stockDto = new UpdateStockDto
            {
                Quantity = 5,
                IsIncrement = false // Decrement
            };

            _repositoryMock.Setup(r => r.ProductExistsAsync(productId))
                .ReturnsAsync(true);

            _repositoryMock.Setup(r => r.UpdateStockAsync(productId, stockDto.Quantity, stockDto.IsIncrement))
                .ReturnsAsync(false); // Operation fails (e.g., trying to decrease below 0)

            // Act
            var result = await _controller.UpdateStock(productId, stockDto);

            // Assert
            var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
            badRequestResult.Value.Should().Be("Failed to update stock. The stock quantity cannot be negative.");
        }

        [Fact]
        public async Task DeleteProduct_ShouldReturnNoContent_WhenProductIsDeleted()
        {
            // Arrange
            var productId = "1";

            _repositoryMock.Setup(r => r.ProductExistsAsync(productId))
                .ReturnsAsync(true);

            _repositoryMock.Setup(r => r.DeleteAsync(productId))
                .ReturnsAsync(true);

            // Act
            var result = await _controller.DeleteProduct(productId);

            // Assert
            result.Should().BeOfType<NoContentResult>();

            // Verify publish was called twice (command and event)
            _publishEndpointMock.Verify(p => p.Publish(It.IsAny<DeleteProductCommand>(), default), Times.Once);
            _publishEndpointMock.Verify(p => p.Publish(It.IsAny<ProductDeletedEvent>(), default), Times.Once);
        }

        [Fact]
        public async Task DeleteProduct_ShouldReturnNotFound_WhenProductDoesNotExist()
        {
            // Arrange
            var productId = "1";

            _repositoryMock.Setup(r => r.ProductExistsAsync(productId))
                .ReturnsAsync(false);

            // Act
            var result = await _controller.DeleteProduct(productId);

            // Assert
            result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task DeleteProduct_ShouldReturnBadRequest_WhenDeleteFails()
        {
            // Arrange
            var productId = "1";

            _repositoryMock.Setup(r => r.ProductExistsAsync(productId))
                .ReturnsAsync(true);

            _repositoryMock.Setup(r => r.DeleteAsync(productId))
                .ReturnsAsync(false); // Delete fails

            // Act
            var result = await _controller.DeleteProduct(productId);

            // Assert
            var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
            badRequestResult.Value.Should().Be("Failed to delete product");
        }

        [Fact]
        public async Task DeleteProduct_ShouldHandleEmptyId()
        {
            // Arrange
            var productId = string.Empty;

            _repositoryMock.Setup(r => r.ProductExistsAsync(productId))
                .ReturnsAsync(false);

            // Act
            var result = await _controller.DeleteProduct(productId);

            // Assert
            result.Should().BeOfType<NotFoundResult>();
        }
    }
} 