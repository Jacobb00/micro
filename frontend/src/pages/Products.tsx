import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import productService from '../services/product.service';
import { Product } from '../types/Product';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await productService.getProducts(selectedCategory);
        setProducts(response.products);
        setLoading(false);
      } catch (err: any) {
        setError('Failed to load products. Please try again later.');
        setLoading(false);
      }
    };

    const fetchCategories = async () => {
      try {
        const response = await productService.getCategories();
        setCategories(Array.isArray(response) ? response : []);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };

    fetchProducts();
    fetchCategories();
  }, [selectedCategory]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
  };

  if (loading) return <div className="text-center my-5"><div className="spinner-border" role="status"></div></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <div className="mb-4">
        <h2>Products</h2>
      </div>
      
      <div className="mb-4">
        <select 
          className="form-select" 
          value={selectedCategory} 
          onChange={handleCategoryChange}
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      {products.length === 0 ? (
        <div className="alert alert-info">No products found.</div>
      ) : (
        <div className="row row-cols-1 row-cols-md-3 g-4">
          {products.map(product => (
            <div className="col" key={product.id}>
              <div className="card h-100">
                {product.imageUrl && (
                  <img 
                    src={product.imageUrl} 
                    className="card-img-top" 
                    alt={product.name} 
                    style={{ height: '200px', objectFit: 'cover' }}
                  />
                )}
                <div className="card-body">
                  <h5 className="card-title">{product.name}</h5>
                  <p className="card-text">{product.description.substring(0, 100)}...</p>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fs-5">${product.price.toFixed(2)}</span>
                    <span className={`badge ${product.stockQuantity > 0 ? 'bg-success' : 'bg-danger'}`}>
                      {product.stockQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                </div>
                <div className="card-footer d-flex justify-content-between">
                  <Link to={`/products/${product.id}`} className="btn btn-sm btn-outline-primary">
                    View Details
                  </Link>
                  <Link to={`/products/edit/${product.id}`} className="btn btn-sm btn-outline-secondary">
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Products;
