using System;
using System.ComponentModel.DataAnnotations;

namespace ProductService.DTOs
{
    public class CategoryDto
    {
        public string Id { get; set; }=string.Empty;
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
    }

    public class CreateCategoryDto
    {
        [Required]
        [StringLength(50, MinimumLength = 2)]
        public string Name { get; set; }=string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        [Url]
        public string? ImageUrl { get; set; }
    }

    public class UpdateCategoryDto
    {
        [StringLength(50, MinimumLength = 2)]
        public string Name { get; set; }=string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        [Url]
        public string? ImageUrl { get; set; }
    }
} 