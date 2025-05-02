import axios from 'axios';
import { Product, ProductFilterParams, ProductListResponse } from '../types/Product';

const API_URL = '/api/products';

class ProductService {
  async getProducts(category?: string): Promise<ProductListResponse> {
    // Create URLSearchParams to ensure proper parameter formatting
    const params = new URLSearchParams();
  
    // Add default parameters
    params.append('page', '1');
    params.append('pageSize', '10');
    params.append('sortBy', 'name');
    params.append('sortDesc', 'false');
    
    // Add category filter if provided
    if (category) {
      params.append('category', category);
    }
    
    const response = await axios.get(`${API_URL}?${params.toString()}`);
    return response.data;
  }

  async getProductsWithFilter(filterParams: ProductFilterParams): Promise<ProductListResponse> {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filterParams.page) params.append('page', filterParams.page.toString());
    if (filterParams.pageSize) params.append('pageSize', filterParams.pageSize.toString());
    if (filterParams.searchTerm) params.append('searchTerm', filterParams.searchTerm);
    if (filterParams.category) params.append('category', filterParams.category);
    if (filterParams.minPrice) params.append('minPrice', filterParams.minPrice.toString());
    if (filterParams.maxPrice) params.append('maxPrice', filterParams.maxPrice.toString());
    if (filterParams.inStock !== undefined) params.append('inStock', filterParams.inStock.toString());
    if (filterParams.sortBy) params.append('sortBy', filterParams.sortBy);
    if (filterParams.sortDesc !== undefined) params.append('sortDesc', filterParams.sortDesc.toString());
    
    const response = await axios.get(`${API_URL}?${params.toString()}`);
    return response.data;
  }

  async getProduct(id: string): Promise<Product> {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
  }

  async createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Promise<string> {
    const response = await axios.post(API_URL, product);
    return response.data;
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<void> {
    await axios.put(`${API_URL}/${id}`, product);
  }

  async updateStock(id: string, quantity: number, isIncrement: boolean): Promise<void> {
    await axios.patch(`${API_URL}/${id}/stock`, { quantity, isIncrement });
  }

  async deleteProduct(id: string): Promise<void> {
    await axios.delete(`${API_URL}/${id}`);
  }

  async getCategories(): Promise<string[]> {
    const response = await axios.get(`${API_URL}/categories`);
    return response.data;
  }
}

export default new ProductService();
