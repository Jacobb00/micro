using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ProductService.Domain;
using ProductService.DTOs;
using ProductService.Events;
using ProductService.Services;
using MassTransit;

namespace ProductService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly IProductRepository _productRepository;
        private readonly IPublishEndpoint _publishEndpoint;

        public ProductsController(IProductRepository productRepository, IPublishEndpoint publishEndpoint)
        {
            _productRepository = productRepository;
            _publishEndpoint = publishEndpoint;
        }

        [HttpGet]
        public async Task<ActionResult<ProductListResponse>> GetProducts()
        {
            var result = await _productRepository.GetAllProductsAsync();
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ProductDto>> GetProduct(string id)
        {
            var product = await _productRepository.GetByIdAsync(id);
            if (product == null)
                return NotFound();

            return Ok(new ProductDto
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
            });
        }

        [HttpGet("categories")]
        public async Task<ActionResult<List<string>>> GetCategories()
        {
            var categories = await _productRepository.GetCategoriesAsync();
            return Ok(categories);
        }

        [HttpPost]
        public async Task<ActionResult<string>> CreateProduct([FromBody] CreateProductDto productDto)
        {
            // Create correlation ID for the SAGA
            var correlationId = Guid.NewGuid();

            // Map DTO to domain entity
            var product = new Product
            {
                Name = productDto.Name,
                Description = productDto.Description,
                Price = productDto.Price,
                StockQuantity = productDto.StockQuantity,
                Category = productDto.Category,
                ImageUrl = productDto.ImageUrl,
                IsActive = true
            };

            // Publish creation command to begin the SAGA
            await _publishEndpoint.Publish(new CreateProductCommand
            {
                CorrelationId = correlationId,
                Name = product.Name,
                Description = product.Description,
                Price = product.Price,
                StockQuantity = product.StockQuantity,
                Category = product.Category,
                ImageUrl = product.ImageUrl
            });

            // Save product to database
            var productId = await _productRepository.CreateAsync(product);

            // Publish created event to indicate successful creation
            await _publishEndpoint.Publish(new ProductCreatedEvent
            {
                CorrelationId = correlationId,
                ProductId = productId,
                Name = product.Name,
                Price = product.Price,
                StockQuantity = product.StockQuantity
            });

            return CreatedAtAction(nameof(GetProduct), new { id = productId }, productId);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProduct(string id, [FromBody] UpdateProductDto productDto)
        {
            var existingProduct = await _productRepository.GetByIdAsync(id);
            if (existingProduct == null)
                return NotFound();

            // Create correlation ID for the SAGA
            var correlationId = Guid.NewGuid();

            // Update only provided fields
            if (productDto.Name != null)
                existingProduct.Name = productDto.Name;
            
            if (productDto.Description != null)
                existingProduct.Description = productDto.Description;
            
            if (productDto.Price.HasValue)
                existingProduct.Price = productDto.Price.Value;
            
            if (productDto.StockQuantity.HasValue)
                existingProduct.StockQuantity = productDto.StockQuantity.Value;
            
            if (productDto.Category != null)
                existingProduct.Category = productDto.Category;
            
            if (productDto.ImageUrl != null)
                existingProduct.ImageUrl = productDto.ImageUrl;

            // Publish update command to begin the SAGA
            await _publishEndpoint.Publish(new UpdateProductCommand
            {
                CorrelationId = correlationId,
                ProductId = id,
                Name = existingProduct.Name,
                Description = existingProduct.Description,
                Price = existingProduct.Price,
                StockQuantity = existingProduct.StockQuantity,
                Category = existingProduct.Category,
                ImageUrl = existingProduct.ImageUrl
            });

            // Update product in database
            var success = await _productRepository.UpdateAsync(id, existingProduct);
            if (!success)
                return BadRequest("Failed to update product");

            // Publish updated event to indicate successful update
            await _publishEndpoint.Publish(new ProductUpdatedEvent
            {
                CorrelationId = correlationId,
                ProductId = id,
                Name = existingProduct.Name,
                Price = existingProduct.Price,
                StockQuantity = existingProduct.StockQuantity
            });

            return NoContent();
        }

        [HttpPatch("{id}/stock")]
        public async Task<IActionResult> UpdateStock(string id, [FromBody] UpdateStockDto stockDto)
        {
            if (!await _productRepository.ProductExistsAsync(id))
                return NotFound();

            // Create correlation ID for the SAGA
            var correlationId = Guid.NewGuid();

            // Publish stock update command to begin the SAGA
            await _publishEndpoint.Publish(new UpdateStockCommand
            {
                CorrelationId = correlationId,
                ProductId = id,
                Quantity = stockDto.Quantity,
                IsIncrement = stockDto.IsIncrement
            });

            // Update stock in database
            var success = await _productRepository.UpdateStockAsync(id, stockDto.Quantity, stockDto.IsIncrement);
            if (!success)
                return BadRequest("Failed to update stock. The stock quantity cannot be negative.");

            // Get updated product to include in event
            var updatedProduct = await _productRepository.GetByIdAsync(id);

            // Publish stock updated event to indicate successful update
            await _publishEndpoint.Publish(new StockUpdatedEvent
            {
                CorrelationId = correlationId,
                ProductId = id,
                NewStockQuantity = updatedProduct.StockQuantity
            });

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProduct(string id)
        {
            if (!await _productRepository.ProductExistsAsync(id))
                return NotFound();

            // Create correlation ID for the SAGA
            var correlationId = Guid.NewGuid();

            // Publish delete command to begin the SAGA
            await _publishEndpoint.Publish(new DeleteProductCommand
            {
                CorrelationId = correlationId,
                ProductId = id
            });

            // Delete product from database (soft delete)
            var success = await _productRepository.DeleteAsync(id);
            if (!success)
                return BadRequest("Failed to delete product");

            // Publish deleted event to indicate successful deletion
            await _publishEndpoint.Publish(new ProductDeletedEvent
            {
                CorrelationId = correlationId,
                ProductId = id
            });

            return NoContent();
        }
    }
} 