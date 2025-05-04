using System;
using MassTransit;
using ProductService.Events;

namespace ProductService.Saga
{
    public class CategorySagaState : SagaStateMachineInstance, ISagaVersion
    {
        public Guid CorrelationId { get; set; }
        public string CurrentState { get; set; }
        public int Version { get; set; }
        
        // Category properties
        public string CategoryId { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string ImageUrl { get; set; }
    }

    public class CategoryStateMachine : MassTransitStateMachine<CategorySagaState>
    {
        public CategoryStateMachine()
        {
            InstanceState(x => x.CurrentState);

            Event(() => CategoryCreated, x => x.CorrelateById(m => m.Message.CorrelationId));
            Event(() => CategoryUpdated, x => x.CorrelateById(m => m.Message.CorrelationId));
            Event(() => CategoryDeleted, x => x.CorrelateById(m => m.Message.CorrelationId));

            Initially(
                When(CreateCategory)
                    .Then(context =>
                    {
                        context.Saga.Name = context.Message.Name;
                        context.Saga.Description = context.Message.Description;
                        context.Saga.ImageUrl = context.Message.ImageUrl;
                    })
                    .TransitionTo(Creating)
            );

            During(Creating,
                When(CategoryCreated)
                    .Then(context =>
                    {
                        context.Saga.CategoryId = context.Message.CategoryId;
                    })
                    .TransitionTo(Created)
            );

            During(Created,
                When(UpdateCategory)
                    .Then(context =>
                    {
                        context.Saga.Name = context.Message.Name;
                        context.Saga.Description = context.Message.Description;
                        context.Saga.ImageUrl = context.Message.ImageUrl;
                    })
                    .TransitionTo(Updating),
                    
                When(DeleteCategory)
                    .TransitionTo(Deleting)
            );

            During(Updating,
                When(CategoryUpdated)
                    .TransitionTo(Created)
            );

            During(Deleting,
                When(CategoryDeleted)
                    .Finalize()
            );
        }

        public State Creating { get; private set; }
        public State Created { get; private set; }
        public State Updating { get; private set; }
        public State Deleting { get; private set; }

        public Event<CreateCategoryCommand> CreateCategory { get; private set; }
        public Event<CategoryCreatedEvent> CategoryCreated { get; private set; }
        public Event<UpdateCategoryCommand> UpdateCategory { get; private set; }
        public Event<CategoryUpdatedEvent> CategoryUpdated { get; private set; }
        public Event<DeleteCategoryCommand> DeleteCategory { get; private set; }
        public Event<CategoryDeletedEvent> CategoryDeleted { get; private set; }
    }
} 