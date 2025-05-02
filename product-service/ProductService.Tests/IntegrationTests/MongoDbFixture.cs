using System;
using System.Threading.Tasks;
using DotNet.Testcontainers.Builders;
using MongoDB.Driver;
using ProductService.Domain;
using ProductService.Infrastructure;
using Microsoft.Extensions.Options;
using System.Collections.Generic;
using Testcontainers.MongoDb;

namespace ProductService.Tests.IntegrationTests
{
    public class MongoDbFixture : IAsyncDisposable
    {
        private readonly MongoDbContainer _mongoDbContainer;
        private IMongoClient _mongoClient;
        private IMongoDatabase _database;
        private IMongoCollection<Product> _productsCollection;
        
        public string ConnectionString => _mongoDbContainer.GetConnectionString();
        public MongoDbSettings Settings { get; private set; }
        public IMongoDbContext MongoDbContext { get; private set; }

        public MongoDbFixture()
        {
            _mongoDbContainer = new MongoDbBuilder()
                .WithImage("mongo:latest")
                .WithPortBinding(27017, true)
                .Build();
        }

        public async Task InitializeAsync()
        {
            await _mongoDbContainer.StartAsync();

            Settings = new MongoDbSettings
            {
                ConnectionString = ConnectionString,
                DatabaseName = "TestProductsDb",
                ProductsCollectionName = "Products"
            };

            _mongoClient = new MongoClient(ConnectionString);
            _database = _mongoClient.GetDatabase(Settings.DatabaseName);
            _productsCollection = _database.GetCollection<Product>(Settings.ProductsCollectionName);

            // Create text index for search queries
            var indexKeysDefinition = Builders<Product>.IndexKeys
                .Text(p => p.Name)
                .Text(p => p.Description);
            
            await _productsCollection.Indexes.CreateOneAsync(new CreateIndexModel<Product>(indexKeysDefinition));
            
            // Create index on category
            var categoryIndexKeysDefinition = Builders<Product>.IndexKeys.Ascending(p => p.Category);
            await _productsCollection.Indexes.CreateOneAsync(new CreateIndexModel<Product>(categoryIndexKeysDefinition));
            
            // Create index on price
            var priceIndexKeysDefinition = Builders<Product>.IndexKeys.Ascending(p => p.Price);
            await _productsCollection.Indexes.CreateOneAsync(new CreateIndexModel<Product>(priceIndexKeysDefinition));

            MongoDbContext = new TestMongoDbContext(_database, Settings);
        }

        public async Task ResetDatabaseAsync()
        {
            await _productsCollection.DeleteManyAsync(Builders<Product>.Filter.Empty);
        }

        public async Task SeedProductsAsync(IEnumerable<Product> products)
        {
            await _productsCollection.InsertManyAsync(products);
        }

        public async ValueTask DisposeAsync()
        {
            await _mongoDbContainer.DisposeAsync();
        }
    }

    public class TestMongoDbContext : IMongoDbContext
    {
        private readonly IMongoDatabase _database;
        
        public TestMongoDbContext(IMongoDatabase database, MongoDbSettings settings)
        {
            _database = database;
            Products = _database.GetCollection<Product>(settings.ProductsCollectionName);
        }
        
        public IMongoCollection<Product> Products { get; }
    }
} 