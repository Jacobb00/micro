using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Prometheus;

namespace ProductService.Infrastructure
{
    public class MetricsMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<MetricsMiddleware> _logger;
        
        // Define metrics
        private static readonly Counter ProductOperations = Metrics.CreateCounter(
            "product_operations_total",
            "Number of product operations",
            new CounterConfiguration
            {
                LabelNames = new[] { "operation", "status" }
            }
        );
        
        private static readonly Histogram ProductOperationDuration = Metrics.CreateHistogram(
            "product_operation_duration_seconds",
            "Duration of product operations",
            new HistogramConfiguration
            {
                LabelNames = new[] { "operation" },
                Buckets = new[] { 0.001, 0.01, 0.05, 0.1, 0.5, 1, 5 }
            }
        );
        
        public MetricsMiddleware(RequestDelegate next, ILogger<MetricsMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }
        
        public async Task InvokeAsync(HttpContext context)
        {
            var path = context.Request.Path.Value;
            var method = context.Request.Method;
            var operation = DetermineOperation(path, method);
            
            using (ProductOperationDuration.WithLabels(operation).NewTimer())
            {
                try
                {
                    // Call the next middleware in the pipeline
                    await _next(context);
                    
                    // Record the success or failure based on the status code
                    var statusCategory = context.Response.StatusCode < 400 ? "success" : "failure";
                    ProductOperations.WithLabels(operation, statusCategory).Inc();
                }
                catch (Exception ex)
                {
                    // Record exception
                    ProductOperations.WithLabels(operation, "error").Inc();
                    _logger.LogError(ex, "Error during product operation: {Operation}", operation);
                    throw;
                }
            }
        }
        
        private string DetermineOperation(string path, string method)
        {
            if (path.EndsWith("/products", StringComparison.OrdinalIgnoreCase) || 
                path.Equals("/api/products", StringComparison.OrdinalIgnoreCase))
            {
                return method switch
                {
                    "GET" => "list_products",
                    "POST" => "create_product",
                    _ => "unknown"
                };
            }
            else if (path.Contains("/products/") || path.Contains("/api/products/"))
            {
                return method switch
                {
                    "GET" => "get_product",
                    "PUT" => "update_product",
                    "DELETE" => "delete_product",
                    _ => "unknown"
                };
            }
            else if (path.Contains("/categories"))
            {
                return "category_operation";
            }
            
            return "other";
        }
        
        // Helper methods for use in controllers
        public static void RecordStockUpdate(string productId, string productName, int quantity)
        {
            var gauge = Metrics.CreateGauge(
                "product_stock_quantity",
                "Current product stock quantity",
                new GaugeConfiguration
                {
                    LabelNames = new[] { "product_id", "product_name" }
                }
            );
            
            gauge.WithLabels(productId, productName).Set(quantity);
        }
        
        public static void RecordProductOperation(string operation, string status)
        {
            ProductOperations.WithLabels(operation, status).Inc();
        }
    }
    
    // Extension method to make it easier to add the middleware
    public static class MetricsMiddlewareExtensions
    {
        public static IApplicationBuilder UseProductMetrics(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<MetricsMiddleware>();
        }
    }
} 