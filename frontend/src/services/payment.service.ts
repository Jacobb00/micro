import axios from 'axios';
import authService from './auth.service';
import { CartItem } from './cartService';

const API_URL = '/api/payments';

interface PaymentInfo {
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  paymentMethod: string;
}

interface PaymentRequest {
  cartItems: CartItem[];
  paymentInfo: PaymentInfo;
  totalAmount: number;
}

interface PaymentResponse {
  success: boolean;
  message: string;
  orderId?: string;
}

interface TestCard {
  number: string;
  result: string;
}

class PaymentService {
  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    const token = authService.getToken();
    console.log('Processing payment with request:', { ...paymentRequest, paymentInfo: { ...paymentRequest.paymentInfo, cardNumber: '****' } });
    
    try {
      const response = await axios.post<PaymentResponse>(`${API_URL}/process`, paymentRequest, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Payment response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Payment processing error:', error.message, error.response?.data);
      return {
        success: false,
        message: error.response?.data?.error || error.message || 'Ödeme işlemi sırasında bir hata oluştu'
      };
    }
  }

  async getTestCards(): Promise<TestCard[]> {
    try {
      const response = await axios.get<{ testCards: TestCard[] }>(`${API_URL}/test-cards`);
      return response.data.testCards;
    } catch (error: any) {
      console.error('Error fetching test cards:', error);
      return [];
    }
  }
}

export default new PaymentService(); 