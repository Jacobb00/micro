using System;
using System.Linq;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using ProductService.Infrastructure;
using ProductService.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using System.Collections.Generic;
using ProductService.Tests.IntegrationTests;
using DotNet.Testcontainers.Builders;
using Testcontainers.MongoDb;
using Testcontainers.RabbitMq;
using System.Threading.Tasks;

namespace ProductService.Tests.EndToEndTests
{
    public class CustomWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
    {
        private readonly MongoDbContainer _mongoDbContainer;
        private readonly RabbitMqContainer _rabbitMqContainer;

        public MongoDbFixture MongoDbFixture { get; private set; }

        public CustomWebApplicationFactory()
        {
            _mongoDbContainer = new MongoDbBuilder()
                .WithImage("mongo:latest")
                .WithPortBinding(27019, true)
                .Build();

            _rabbitMqContainer = new RabbitMqBuilder()
                .WithImage("rabbitmq:3-management")
                .WithPortBinding(5675, 5672)
                .WithPortBinding(15675, 15672)
                .Build();

            MongoDbFixture = new MongoDbFixture();
        }

        public async Task InitializeAsync()
        {
            await _mongoDbContainer.StartAsync();
            await _rabbitMqContainer.StartAsync();
            await MongoDbFixture.InitializeAsync();
        }

        public new async Task DisposeAsync()
        {
            await _mongoDbContainer.DisposeAsync();
            await _rabbitMqContainer.DisposeAsync();
            await MongoDbFixture.DisposeAsync();
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureAppConfiguration(config =>
            {
                // Add test-specific configuration if needed
                var configValues = new Dictionary<string, string>
                {
                    { "MongoDbSettings:ConnectionString", _mongoDbContainer.GetConnectionString() },
                    { "MongoDbSettings:DatabaseName", "TestProductsDb" },
                    { "MongoDbSettings:ProductsCollectionName", "Products" },
                    { "RabbitMQ:Host", _rabbitMqContainer.Hostname },
                    { "RabbitMQ:Username", "guest" },
                    { "RabbitMQ:Password", "guest" }
                };

                config.AddInMemoryCollection(configValues);
            });

            builder.ConfigureServices(services =>
            {
                // Remove the app's MongoDB context registration
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(IMongoDbContext));

                if (descriptor != null)
                {
                    services.Remove(descriptor);
                }

                // Register test MongoDB context
                services.AddSingleton<IMongoDbContext>(MongoDbFixture.MongoDbContext);
            });
        }
    }
} 