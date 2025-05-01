import api from './api';

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface StatusHistory {
  status: OrderStatus;
  timestamp: Date;
  note?: string;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELED';

export interface Order {
  _id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  statusHistory: StatusHistory[];
  shippingAddress: ShippingAddress;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service to interact with the order tracking API
 */
const OrderService = {
  /**
   * Get all orders for the current user
   */
  getUserOrders: async (): Promise<Order[]> => {
    const response = await api.get('/api/orders');
    return response.data;
  },

  /**
   * Get a specific order by ID
   */
  getOrderById: async (orderId: string): Promise<Order> => {
    const response = await api.get(`/api/orders/${orderId}`);
    return response.data;
  },

  /**
   * Cancel an order
   */
  cancelOrder: async (orderId: string, note?: string): Promise<Order> => {
    const response = await api.post(`/api/orders/${orderId}/cancel`, { note });
    return response.data;
  },

  /**
   * Get status label with proper formatting and color
   */
  getStatusLabel: (status: OrderStatus): { text: string; color: string } => {
    switch (status) {
      case 'PENDING':
        return { text: 'Onay Bekliyor', color: 'warning' };
      case 'CONFIRMED':
        return { text: 'Onaylandı', color: 'info' };
      case 'SHIPPED':
        return { text: 'Kargoya Verildi', color: 'primary' };
      case 'DELIVERED':
        return { text: 'Teslim Edildi', color: 'success' };
      case 'CANCELED':
        return { text: 'İptal Edildi', color: 'danger' };
      default:
        return { text: status, color: 'secondary' };
    }
  }
};

export default OrderService; 