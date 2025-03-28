import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import productService, { Product, CreateProductData, UpdateProductData } from '../services/product.service';

const ProductForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<CreateProductData | UpdateProductData>({
    name: '',
    description: '',
    price: 0,
    stockQuantity: 0,
    category: '',
    imageUrl: ''
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch categories
        const categoryList = await productService.getCategories();
        setCategories(categoryList);
        
        // If editing an existing product, fetch its data
        if (id) {
          const productData = await productService.getProduct(id);
          setFormData({
            name: productData.name,
            description: productData.description,
            price: productData.price,
            stockQuantity: productData.stockQuantity,
            category: productData.category,
            imageUrl: productData.imageUrl || ''
          });
        }
      } catch (err) {
        setError('Failed to load form data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'price' || name === 'stockQuantity') {
      setFormData({
        ...formData,
        [name]: parseFloat(value) || 0
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (id) {
        // Update existing product
        await productService.updateProduct(id, formData as UpdateProductData);
      } else {
        // Create new product
        await productService.createProduct(formData as CreateProductData);
      }
      navigate('/products');
    } catch (err) {
      setError('Failed to save product. Please try again.');
      setLoading(false);
    }
  };

  if (loading && !formData.name) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2>{id ? 'Edit Product' : 'Add New Product'}</h2>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="mb-3">
          <label htmlFor="name" className="form-label">Product Name</label>
          <input
            type="text"
            className="form-control"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="description" className="form-label">Description</label>
          <textarea
            className="form-control"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            required
          ></textarea>
        </div>
        
        <div className="row mb-3">
          <div className="col-md-6">
            <label htmlFor="price" className="form-label">Price ($)</label>
            <input
              type="number"
              className="form-control"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min="0.01"
              step="0.01"
              required
            />
          </div>
          <div className="col-md-6">
            <label htmlFor="stockQuantity" className="form-label">Stock Quantity</label>
            <input
              type="number"
              className="form-control"
              id="stockQuantity"
              name="stockQuantity"
              value={formData.stockQuantity}
              onChange={handleChange}
              min="0"
              step="1"
              required
            />
          </div>
        </div>
        
        <div className="mb-3">
          <label htmlFor="category" className="form-label">Category</label>
          <select
            className="form-select"
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >
            <option value="">Select a category</option>
            {categories.map((category, index) => (
              <option key={index} value={category}>{category}</option>
            ))}
          </select>
        </div>
        
        <div className="mb-3">
          <label htmlFor="imageUrl" className="form-label">Image URL (optional)</label>
          <input
            type="url"
            className="form-control"
            id="imageUrl"
            name="imageUrl"
            value={formData.imageUrl}
            onChange={handleChange}
          />
          {formData.imageUrl && (
            <div className="mt-2">
              <img 
                src={formData.imageUrl} 
                alt="Product preview" 
                className="img-thumbnail" 
                style={{ maxHeight: '200px' }}
                onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
              />
            </div>
          )}
        </div>
        
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Product'}
          </button>
          <button 
            type="button" 
            className="btn btn-outline-secondary" 
            onClick={() => navigate('/products')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm; 