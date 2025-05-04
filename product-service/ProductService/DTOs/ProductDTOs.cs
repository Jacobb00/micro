using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ProductService.DTOs
{
    public class ProductDto
    {
        public string Id { get; set; }=string.Empty;
        public string? Name { get; set; }
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public string CategoryId { get; set; }=string.Empty;
        public string Category { get; set; }=string.Empty;
        public CategoryDto CategoryDetails { get; set; }=new CategoryDto();
        public string? ImageUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsActive { get; set; }
    }

    public class CreateProductDto
    {
        [Required]
        [StringLength(100, MinimumLength = 2)]
        public string Name { get; set; }=string.Empty;

        [StringLength(1000)]
        public string? Description { get; set; }

        [Required]
        [Range(0.01, 100000)]
        public decimal Price { get; set; }

        [Required]
        [Range(0, 100000)]
        public int StockQuantity { get; set; }

        [Required]
        public string? CategoryId { get; set; }

        [Required]
        [StringLength(50)]
        public string Category { get; set; }=string.Empty;

        [Url]
        public string? ImageUrl { get; set; }
    }

    public class UpdateProductDto
    {
        [StringLength(100, MinimumLength = 2)]
        public string? Name { get; set; }

        [StringLength(1000)]
        public string? Description { get; set; }

        [Range(0.01, 100000)]
        public decimal Price { get; set; }

        [Range(0, 100000)]
        public int? StockQuantity { get; set; }

        public string? CategoryId { get; set; }

        [StringLength(50)]
        public string Category { get; set; }=string.Empty;

        [Url]
        public string? ImageUrl { get; set; }
    }

    public class UpdateStockDto
    {
        [Required]
        [Range(1, 100000)]
        public int Quantity { get; set; }

        [Required]
        public bool IsIncrement { get; set; }
    }

    public class ProductListResponse
    {
        public List<ProductDto> Products { get; set; } = new List<ProductDto>();
        public int TotalCount { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }
}
