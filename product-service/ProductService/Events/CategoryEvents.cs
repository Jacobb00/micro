using System;

namespace ProductService.Events
{
    // Command events
    public interface ICategoryCommand
    {
        Guid CorrelationId { get; }
    }

    public class CreateCategoryCommand : ICategoryCommand
    {
        public Guid CorrelationId { get; set; }
        public required string Name { get; set; }
        public required string Description { get; set; }
        public required string ImageUrl { get; set; }
    }

    public class UpdateCategoryCommand : ICategoryCommand
    {
        public Guid CorrelationId { get; set; }
        public required string CategoryId { get; set; }
        public required string Name { get; set; }
        public required string Description { get; set; }
        public required string ImageUrl { get; set; }
    }

    public class DeleteCategoryCommand : ICategoryCommand
    {
        public Guid CorrelationId { get; set; }
        public required string CategoryId { get; set; }
    }

    // Notification events
    public interface ICategoryEvent
    {
        Guid CorrelationId { get; }
    }

    public class CategoryCreatedEvent : ICategoryEvent
    {
        public Guid CorrelationId { get; set; }
        public required string CategoryId { get; set; }
        public required string Name { get; set; }
    }

    public class CategoryUpdatedEvent : ICategoryEvent
    {
        public Guid CorrelationId { get; set; }
        public required string CategoryId { get; set; }
        public required string Name { get; set; }
    }

    public class CategoryDeletedEvent : ICategoryEvent
    {
        public Guid CorrelationId { get; set; }
        public required string CategoryId { get; set; }
    }
} 