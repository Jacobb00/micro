using System;
using MassTransit;
using ProductService.Events;

namespace ProductService.Saga
{
    public class ProductSagaState : SagaStateMachineInstance
    {
        public Guid CorrelationId { get; set; }
        public required string CurrentState { get; set; }
        
        // Product Info
        public required string ProductId { get; set; }
        public required string Name { get; set; }
        public required string Description { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public required string Category { get; set; }
        public required string ImageUrl { get; set; }
        
        // Error Handling
        public required string ErrorMessage { get; set; }
        public DateTime? Created { get; set; }
        public DateTime? Updated { get; set; }
    }

    public class ProductStateMachine : MassTransitStateMachine<ProductSagaState>
    {
        public State? CreatingProduct { get; private set; }
        public State? ProductCreated { get; private set; }
        public State? UpdatingProduct { get; private set; }
        public State? UpdatingStock { get; private set; }
        public State? DeletingProduct { get; private set; }
        public State? Faulted { get; private set; }

        public Event<CreateProductCommand>? ProductCreationRequested { get; private set; }
        public Event<ProductCreatedEvent>? ProductCreationCompleted { get; private set; }
        public Event<UpdateProductCommand>? ProductUpdateRequested { get; private set; }
        public Event<ProductUpdatedEvent>? ProductUpdateCompleted { get; private set; }
        public Event<UpdateStockCommand>? StockUpdateRequested { get; private set; }
        public Event<StockUpdatedEvent>? StockUpdateCompleted { get; private set; }
        public Event<DeleteProductCommand>? ProductDeleteRequested { get; private set; }
        public Event<ProductDeletedEvent>? ProductDeleteCompleted { get; private set; }
        public Event<ProductErrorEvent>? ProductError { get; private set; }
        
        public ProductStateMachine()
        {
            InstanceState(x => x.CurrentState);

            Event(() => ProductCreationRequested!, x => x.CorrelateById(context => context.Message.CorrelationId));
            Event(() => ProductCreationCompleted!, x => x.CorrelateById(context => context.Message.CorrelationId));
            Event(() => ProductUpdateRequested!, x => x.CorrelateById(context => context.Message.CorrelationId));
            Event(() => ProductUpdateCompleted!, x => x.CorrelateById(context => context.Message.CorrelationId));
            Event(() => StockUpdateRequested!, x => x.CorrelateById(context => context.Message.CorrelationId));
            Event(() => StockUpdateCompleted!, x => x.CorrelateById(context => context.Message.CorrelationId));
            Event(() => ProductDeleteRequested!, x => x.CorrelateById(context => context.Message.CorrelationId));
            Event(() => ProductDeleteCompleted!, x => x.CorrelateById(context => context.Message.CorrelationId));
            Event(() => ProductError!, x => x.CorrelateById(context => context.Message.CorrelationId));

            // Product Creation Saga
            Initially(
                When(ProductCreationRequested!)
                    .Then(context =>
                    {
                        context.Saga.Created = DateTime.UtcNow;
                        context.Saga.Name = context.Message.Name;
                        context.Saga.Description = context.Message.Description;
                        context.Saga.Price = context.Message.Price;
                        context.Saga.StockQuantity = context.Message.StockQuantity;
                        context.Saga.Category = context.Message.Category;
                        context.Saga.ImageUrl = context.Message.ImageUrl;
                    })
                    .TransitionTo(CreatingProduct!)
            );

            During(CreatingProduct!,
                When(ProductCreationCompleted!)
                    .Then(context =>
                    {
                        context.Saga.ProductId = context.Message.ProductId;
                    })
                    .TransitionTo(ProductCreated!),
                When(ProductError!)
                    .Then(context =>
                    {
                        context.Saga.ErrorMessage = context.Message.ErrorMessage;
                    })
                    .TransitionTo(Faulted!)
            );

            // Product Update Saga
            During(ProductCreated!,
                When(ProductUpdateRequested!)
                    .Then(context =>
                    {
                        context.Saga.Updated = DateTime.UtcNow;
                        context.Saga.Name = context.Message.Name;
                        context.Saga.Description = context.Message.Description;
                        context.Saga.Price = context.Message.Price;
                        context.Saga.StockQuantity = context.Message.StockQuantity;
                        context.Saga.Category = context.Message.Category;
                        context.Saga.ImageUrl = context.Message.ImageUrl;
                    })
                    .TransitionTo(UpdatingProduct!),
                When(StockUpdateRequested!)
                    .Then(context =>
                    {
                        context.Saga.Updated = DateTime.UtcNow;
                        if (context.Message.IsIncrement)
                            context.Saga.StockQuantity += context.Message.Quantity;
                        else
                            context.Saga.StockQuantity -= context.Message.Quantity;
                    })
                    .TransitionTo(UpdatingStock!),
                When(ProductDeleteRequested!)
                    .TransitionTo(DeletingProduct!)
            );

            During(UpdatingProduct!,
                When(ProductUpdateCompleted!)
                    .TransitionTo(ProductCreated!),
                When(ProductError!)
                    .Then(context =>
                    {
                        context.Saga.ErrorMessage = context.Message.ErrorMessage;
                    })
                    .TransitionTo(Faulted!)
            );

            During(UpdatingStock!,
                When(StockUpdateCompleted!)
                    .TransitionTo(ProductCreated!),
                When(ProductError!)
                    .Then(context =>
                    {
                        context.Saga.ErrorMessage = context.Message.ErrorMessage;
                    })
                    .TransitionTo(Faulted!)
            );

            During(DeletingProduct!,
                When(ProductDeleteCompleted!)
                    .Finalize(),
                When(ProductError!)
                    .Then(context =>
                    {
                        context.Saga.ErrorMessage = context.Message.ErrorMessage;
                    })
                    .TransitionTo(Faulted!)
            );

            // Retry logic from faulted state
            During(Faulted!,
                When(ProductCreationRequested!)
                    .TransitionTo(CreatingProduct!),
                When(ProductUpdateRequested!)
                    .TransitionTo(UpdatingProduct!),
                When(StockUpdateRequested!)
                    .TransitionTo(UpdatingStock!),
                When(ProductDeleteRequested!)
                    .TransitionTo(DeletingProduct!)
            );
        }
    }
} 