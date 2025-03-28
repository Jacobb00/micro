using System;

namespace ProductService.Events
{
    // Command events
    public interface IProductCommand
    {
        Guid CorrelationId { get; }
    }

    public class CreateProductCommand : IProductCommand
    {
        public Guid CorrelationId { get; set; }
        public required string Name { get; set; }
        public required string Description { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public required string Category { get; set; }
        public required string ImageUrl { get; set; }
    }

    public class UpdateProductCommand : IProductCommand
    {
        public Guid CorrelationId { get; set; }
        public required string ProductId { get; set; }
        public required string Name { get; set; }
        public required string Description { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public required string Category { get; set; }
        public required string ImageUrl { get; set; }
    }

    public class UpdateStockCommand : IProductCommand
    {
        public Guid CorrelationId { get; set; }
        public required string ProductId { get; set; }
        public int Quantity { get; set; }
        public bool IsIncrement { get; set; }
    }

    public class DeleteProductCommand : IProductCommand
    {
        public Guid CorrelationId { get; set; }
        public required string ProductId { get; set; }
    }

    // Notification events
    public interface IProductEvent
    {
        Guid CorrelationId { get; }
    }

    public class ProductCreatedEvent : IProductEvent
    {
        public Guid CorrelationId { get; set; }
        public required string ProductId { get; set; }
        public required string Name { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
    }

    public class ProductUpdatedEvent : IProductEvent
    {
        public Guid CorrelationId { get; set; }
        public required string ProductId { get; set; }
        public required string Name { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
    }

    public class StockUpdatedEvent : IProductEvent
    {
        public Guid CorrelationId { get; set; }
        public required string ProductId { get; set; }
        public int NewStockQuantity { get; set; }
    }

    public class ProductDeletedEvent : IProductEvent
    {
        public Guid CorrelationId { get; set; }
        public required string ProductId { get; set; }
    }

    // Error events
    public class ProductErrorEvent : IProductEvent
    {
        public Guid CorrelationId { get; set; }
        public required string ProductId { get; set; }
        public required string ErrorMessage { get; set; }
    }
} 