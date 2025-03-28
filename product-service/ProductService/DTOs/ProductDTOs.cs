using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ProductService.DTOs
{
    public class ProductDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public string Category { get; set; }
        public string ImageUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsActive { get; set; }
    }

    public class CreateProductDto
    {
        [Required]
        [StringLength(100, MinimumLength = 2)]
        public string Name { get; set; }

        [StringLength(1000)]
        public string Description { get; set; }

        [Required]
        [Range(0.01, 100000)]
        public decimal Price { get; set; }

        [Required]
        [Range(0, 100000)]
        public int StockQuantity { get; set; }

        [Required]
        [StringLength(50)]
        public string Category { get; set; }

        [Url]
        public string ImageUrl { get; set; }
    }

    public class UpdateProductDto
    {
        [StringLength(100, MinimumLength = 2)]
        public string Name { get; set; }

        [StringLength(1000)]
        public string Description { get; set; }

        [Range(0.01, 100000)]
        public decimal? Price { get; set; }

        [Range(0, 100000)]
        public int? StockQuantity { get; set; }

        [StringLength(50)]
        public string Category { get; set; }

        [Url]
        public string ImageUrl { get; set; }
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
        public List<ProductDto> Products { get; set; }
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    public class ProductFilterParams
    {
        public string? SearchTerm { get; set; }
        public string? Category { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public bool? InStock { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public string SortBy { get; set; } = "name";
        public bool SortDesc { get; set; } = false;
    }
}
