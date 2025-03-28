using System;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using ProductService.Domain;

namespace ProductService.Infrastructure
{
    public class MongoDbSettings
    {
        public required string ConnectionString { get; set; }
        public required string DatabaseName { get; set; }
        public required string ProductsCollectionName { get; set; }
    }

    public interface IMongoDbContext
    {
        IMongoCollection<Product> Products { get; }
    }

    public class MongoDbContext : IMongoDbContext
    {
        private readonly IMongoDatabase _database;

        public MongoDbContext(IOptions<MongoDbSettings> settings)
        {
            var client = new MongoClient(settings.Value.ConnectionString);
            _database = client.GetDatabase(settings.Value.DatabaseName);
            
            Products = _database.GetCollection<Product>(settings.Value.ProductsCollectionName);
            
            // Create indexes
            CreateIndexes();
        }

        public IMongoCollection<Product> Products { get; }

        private void CreateIndexes()
        {
            // Create text search index on name and description
            var indexKeysDefinition = Builders<Product>.IndexKeys
                .Text(p => p.Name)
                .Text(p => p.Description);
            
            Products.Indexes.CreateOne(new CreateIndexModel<Product>(indexKeysDefinition));
            
            // Create index on category for faster filtering
            var categoryIndexKeysDefinition = Builders<Product>.IndexKeys.Ascending(p => p.Category);
            Products.Indexes.CreateOne(new CreateIndexModel<Product>(categoryIndexKeysDefinition));
            
            // Create index on price for faster filtering
            var priceIndexKeysDefinition = Builders<Product>.IndexKeys.Ascending(p => p.Price);
            Products.Indexes.CreateOne(new CreateIndexModel<Product>(priceIndexKeysDefinition));
        }
    }
} 