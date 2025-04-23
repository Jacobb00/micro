import axios from 'axios';
import authService from './auth.service';

// Tutarlı endpoint kullanımı için tek URL
const API_URL = '/api/cart';

export interface CartItem {
  productId: string;
  quantity: number;
}

class CartService {
  async getCart() {
    const token = authService.getToken();
    console.log('Getting cart with token:', token?.substring(0, 15) + '...');
    try {
      console.log(`Sending GET request to: ${API_URL}`);
      const response = await axios.get(`${API_URL}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Cart response data:', response.data);
      return response.data.cart;
    } catch (error: any) {
      console.error('Get cart error:', error.message, error.response?.data);
      throw error;
    }
  }

  async addToCart(productId: string, quantity: number) {
    const token = authService.getToken();
    console.log(`Adding to cart: ${productId}, quantity: ${quantity}, token: ${token?.substring(0, 15)}...`);
    try {
      console.log(`Sending POST request to: ${API_URL}/add with data:`, { productId, quantity });
      const response = await axios.post(`${API_URL}/add`, { productId, quantity }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Add to cart response:', response.data);
      return response.data.cart;
    } catch (error: any) {
      console.error('Add to cart error:', error.message, error.response?.data);
      throw error;
    }
  }

  async removeFromCart(productId: string) {
    const token = authService.getToken();
    console.log(`Removing from cart: ${productId}, token: ${token?.substring(0, 15)}...`);
    try {
      console.log(`Sending DELETE request to: ${API_URL}/remove with productId:`, productId);
      const response = await axios.delete(`${API_URL}/remove`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { productId }
      });
      console.log('Remove from cart response:', response.data);
      return response.data.cart;
    } catch (error: any) {
      console.error('Remove from cart error:', error.message, error.response?.data);
      throw error;
    }
  }
}

export default new CartService();
