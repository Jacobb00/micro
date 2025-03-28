import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import productService, { Product } from '../services/product.service';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError('Product ID is required');
        setLoading(false);
        return;
      }
      
      try {
        const data = await productService.getProduct(id);
        setProduct(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch product details. The product may not exist.');
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (value > 0 && product && value <= product.stockQuantity) {
      setQuantity(value);
    }
  };

  const handleAddToCart = () => {
    // This will be implemented later with a cart service
    alert(`Added ${quantity} item(s) to cart`);
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <Link to="/products" className="btn btn-primary">
          Back to Products
        </Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/products">Products</Link></li>
          <li className="breadcrumb-item active" aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="row">
        <div className="col-md-5">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="img-fluid rounded"
              style={{ maxHeight: '400px', objectFit: 'contain' }}
            />
          ) : (
            <div className="bg-light d-flex justify-content-center align-items-center rounded" style={{ height: '400px' }}>
              <span className="text-muted">No image available</span>
            </div>
          )}
        </div>
        <div className="col-md-7">
          <h2>{product.name}</h2>
          <p className="text-muted">Category: {product.category}</p>
          <h3 className="text-primary">${product.price.toFixed(2)}</h3>

          <div className="mb-3">
            <span className={product.stockQuantity > 0 ? 'badge bg-success' : 'badge bg-danger'}>
              {product.stockQuantity > 0 ? `In Stock (${product.stockQuantity})` : 'Out of Stock'}
            </span>
          </div>

          <p>{product.description}</p>

          {product.stockQuantity > 0 && (
            <div className="d-flex align-items-center mb-3">
              <div className="input-group me-3" style={{ width: '120px' }}>
                <button 
                  className="btn btn-outline-secondary" 
                  type="button"
                  onClick={() => quantity > 1 && setQuantity(quantity - 1)}
                >
                  -
                </button>
                <input
                  type="number"
                  className="form-control text-center"
                  value={quantity}
                  onChange={handleQuantityChange}
                  min="1"
                  max={product.stockQuantity}
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="button"
                  onClick={() => quantity < product.stockQuantity && setQuantity(quantity + 1)}
                >
                  +
                </button>
              </div>
              <button 
                className="btn btn-primary"
                onClick={handleAddToCart}
              >
                Add to Cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail; 