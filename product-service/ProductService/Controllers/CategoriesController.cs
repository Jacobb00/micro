using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ProductService.Domain;
using ProductService.DTOs;
using ProductService.Events;
using ProductService.Services;
using MassTransit;
using Swashbuckle.AspNetCore.Annotations;

namespace ProductService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoriesController : ControllerBase
    {
        private readonly ICategoryRepository _categoryRepository;
        private readonly IPublishEndpoint _publishEndpoint;

        public CategoriesController(ICategoryRepository categoryRepository, IPublishEndpoint publishEndpoint)
        {
            _categoryRepository = categoryRepository;
            _publishEndpoint = publishEndpoint;
        }

        [HttpGet]
        public async Task<ActionResult<List<CategoryDto>>> GetCategories()
        {
            var categories = await _categoryRepository.GetAllCategoriesAsync();
            return Ok(categories);
        }

        [HttpGet("{id}")]

        public async Task<ActionResult<CategoryDto>> GetCategory(string id)
        {
            var category = await _categoryRepository.GetByIdAsync(id);
            if (category == null)
                return NotFound();

            return Ok(new CategoryDto
            {
                Id = category.Id,
                Name = category.Name,
                Description = category.Description,
                ImageUrl = category.ImageUrl
            });
        }

        /// <summary>
        /// Create a new category
        /// </summary>
        /// <param name="categoryDto">Category to create</param>
        /// <returns>The created category ID</returns>
        [HttpPost]

        public async Task<ActionResult<string>> CreateCategory([FromBody] CreateCategoryDto categoryDto)
        {
            // Create correlation ID for the SAGA
            var correlationId = Guid.NewGuid();

            // Map DTO to domain entity
            var category = new Category
            {
                Name = categoryDto.Name,
                Description = categoryDto.Description,
                ImageUrl = categoryDto.ImageUrl,
                IsActive = true
            };

            // Publish creation command to begin the SAGA
            await _publishEndpoint.Publish(new CreateCategoryCommand
            {
                CorrelationId = correlationId,
                Name = category.Name,
                Description = category.Description,
                ImageUrl = category.ImageUrl
            });

            // Save category to database
            var categoryId = await _categoryRepository.CreateAsync(category);

            // Publish created event to indicate successful creation
            await _publishEndpoint.Publish(new CategoryCreatedEvent
            {
                CorrelationId = correlationId,
                CategoryId = categoryId,
                Name = category.Name
            });

            return CreatedAtAction(nameof(GetCategory), new { id = categoryId }, categoryId);
        }

        /// <summary>
        /// Update an existing category
        /// </summary>
        /// <param name="id">Category identifier</param>
        /// <param name="categoryDto">Updated category data</param>
        /// <returns>No content if successful</returns>
        [HttpPut("{id}")]

        public async Task<IActionResult> UpdateCategory(string id, [FromBody] UpdateCategoryDto categoryDto)
        {
            var existingCategory = await _categoryRepository.GetByIdAsync(id);
            if (existingCategory == null)
                return NotFound();

            // Create correlation ID for the SAGA
            var correlationId = Guid.NewGuid();

            // Update only provided fields
            if (categoryDto.Name != null)
                existingCategory.Name = categoryDto.Name;
            
            if (categoryDto.Description != null)
                existingCategory.Description = categoryDto.Description;
            
            if (categoryDto.ImageUrl != null)
                existingCategory.ImageUrl = categoryDto.ImageUrl;

            // Publish update command to begin the SAGA
            await _publishEndpoint.Publish(new UpdateCategoryCommand
            {
                CorrelationId = correlationId,
                CategoryId = id,
                Name = existingCategory.Name,
                Description = existingCategory.Description,
                ImageUrl = existingCategory.ImageUrl
            });

            // Update category in database
            var success = await _categoryRepository.UpdateAsync(id, existingCategory);
            if (!success)
                return BadRequest("Failed to update category");

            // Publish updated event to indicate successful update
            await _publishEndpoint.Publish(new CategoryUpdatedEvent
            {
                CorrelationId = correlationId,
                CategoryId = id,
                Name = existingCategory.Name
            });

            return NoContent();
        }

        /// <summary>
        /// Delete a category
        /// </summary>
        /// <param name="id">Category identifier</param>
        /// <returns>No content if successful</returns>
        [HttpDelete("{id}")]

        public async Task<IActionResult> DeleteCategory(string id)
        {
            if (!await _categoryRepository.CategoryExistsAsync(id))
                return NotFound();

            // Create correlation ID for the SAGA
            var correlationId = Guid.NewGuid();

            // Publish delete command to begin the SAGA
            await _publishEndpoint.Publish(new DeleteCategoryCommand
            {
                CorrelationId = correlationId,
                CategoryId = id
            });

            // Delete category from database (soft delete)
            var success = await _categoryRepository.DeleteAsync(id);
            if (!success)
                return BadRequest("Failed to delete category");

            // Publish deleted event to indicate successful deletion
            await _publishEndpoint.Publish(new CategoryDeletedEvent
            {
                CorrelationId = correlationId,
                CategoryId = id
            });

            return NoContent();
        }
    }
} 