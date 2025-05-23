using StackExchange.Redis;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace ProductService.Infrastructure;

public interface IRedisCache
{
    Task<T?> GetAsync<T>(string key);
    Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiry = null);
    Task<bool> DeleteAsync(string key);
    Task<bool> DeletePatternAsync(string pattern);
    Task<T> CacheFunctionAsync<T>(string key, Func<Task<T>> func, TimeSpan? expiry = null);
}

public class RedisCache : IRedisCache
{
    private readonly IDatabase? _database;
    private readonly IConnectionMultiplexer? _connectionMultiplexer;
    private readonly ILogger<RedisCache> _logger;
    private readonly bool _isConnected;

    public RedisCache(IConnectionMultiplexer? connectionMultiplexer, ILogger<RedisCache> logger)
    {
        _connectionMultiplexer = connectionMultiplexer;
        _logger = logger;
        
        try
        {
            if (_connectionMultiplexer != null)
            {
                _database = _connectionMultiplexer.GetDatabase();
                _isConnected = _connectionMultiplexer.IsConnected;
                
                if (_isConnected)
                {
                    _logger.LogInformation("Product Service - Redis bağlantısı başarılı");
                }
                else
                {
                    _logger.LogWarning("Product Service - Redis bağlantısı kurulamadı");
                }
            }
            else
            {
                _logger.LogWarning("Product Service - Redis connection multiplexer null");
                _isConnected = false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Product Service - Redis bağlantı hatası");
            _isConnected = false;
        }
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        if (!_isConnected || _database == null)
        {
            _logger.LogWarning("Redis bağlı değil, cache atlanıyor");
            return default(T);
        }

        try
        {
            var value = await _database.StringGetAsync(key);
            if (!value.HasValue)
                return default(T);

            return JsonSerializer.Deserialize<T>(value!);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis GET hatası: {Key}", key);
            return default(T);
        }
    }

    public async Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiry = null)
    {
        if (!_isConnected || _database == null)
        {
            _logger.LogWarning("Redis bağlı değil, cache atlanıyor");
            return false;
        }

        try
        {
            var jsonValue = JsonSerializer.Serialize(value);
            return await _database.StringSetAsync(key, jsonValue, expiry);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis SET hatası: {Key}", key);
            return false;
        }
    }

    public async Task<bool> DeleteAsync(string key)
    {
        if (!_isConnected || _database == null)
        {
            _logger.LogWarning("Redis bağlı değil, cache atlanıyor");
            return false;
        }

        try
        {
            return await _database.KeyDeleteAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis DELETE hatası: {Key}", key);
            return false;
        }
    }

    public async Task<bool> DeletePatternAsync(string pattern)
    {
        if (!_isConnected || _database == null || _connectionMultiplexer == null)
        {
            _logger.LogWarning("Redis bağlı değil, cache atlanıyor");
            return false;
        }

        try
        {
            var endpoints = _connectionMultiplexer.GetEndPoints();
            if (endpoints.Length == 0) return false;
            
            var server = _connectionMultiplexer.GetServer(endpoints.First());
            var keys = server.Keys(pattern: pattern);
            
            foreach (var key in keys)
            {
                await _database.KeyDeleteAsync(key);
            }
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis DELETE pattern hatası: {Pattern}", pattern);
            return false;
        }
    }

    public async Task<T> CacheFunctionAsync<T>(string key, Func<Task<T>> func, TimeSpan? expiry = null)
    {
        // Önce cache'den kontrol et
        var cached = await GetAsync<T>(key);
        if (cached != null && !cached.Equals(default(T)))
        {
            _logger.LogInformation("Cache hit: {Key}", key);
            return cached;
        }

        // Cache miss - function'ı çalıştır
        _logger.LogInformation("Cache miss: {Key}", key);
        var result = await func();

        // Sonucu cache'le
        if (result != null && !result.Equals(default(T)))
        {
            await SetAsync(key, result, expiry ?? TimeSpan.FromHours(1));
        }

        return result;
    }
}

// Extension methods for easier usage
public static class RedisCacheExtensions
{
    public static async Task<T> CacheProductAsync<T>(this IRedisCache cache, string productId, Func<Task<T>> func, TimeSpan? expiry = null)
    {
        var key = $"product:{productId}";
        return await cache.CacheFunctionAsync(key, func, expiry ?? TimeSpan.FromMinutes(30));
    }

    public static async Task<T> CacheProductListAsync<T>(this IRedisCache cache, string listKey, Func<Task<T>> func, TimeSpan? expiry = null)
    {
        var key = $"products:list:{listKey}";
        return await cache.CacheFunctionAsync(key, func, expiry ?? TimeSpan.FromMinutes(10));
    }

    public static async Task InvalidateProductCacheAsync(this IRedisCache cache, string productId)
    {
        await cache.DeleteAsync($"product:{productId}");
        await cache.DeletePatternAsync("products:list:*");
    }
} 