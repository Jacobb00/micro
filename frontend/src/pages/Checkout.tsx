import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import cartService, { CartItem } from '../services/cartService';
import productService from '../services/product.service';
import paymentService from '../services/payment.service';
import { Product } from '../types/Product';

interface EnhancedCartItem extends CartItem {
  product?: Product;
  loading?: boolean;
}

interface PaymentFormData {
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  paymentMethod: string;
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const [cart, setCart] = useState<EnhancedCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [testCards, setTestCards] = useState<Array<{number: string, result: string}>>([]);
  
  const [formData, setFormData] = useState<PaymentFormData>({
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '01',
    expiryYear: '2025',
    cvv: '',
    paymentMethod: 'credit_card'
  });

  useEffect(() => {
    const fetchCart = async () => {
      try {
        setLoading(true);
        const cartData = await cartService.getCart();
        
        // Initialize cart with loading state for each item
        const enhancedCart = (cartData || []).map(item => ({
          ...item,
          loading: true
        }));
        
        setCart(enhancedCart);
        
        // Load product details for each cart item
        await Promise.all(
          enhancedCart.map(async (item, index) => {
            try {
              const product = await productService.getProduct(item.productId);
              
              // Check if stock is sufficient
              if (product.stockQuantity < item.quantity) {
                setError(`Not enough stock for ${product.name}. Available: ${product.stockQuantity}`);
              }
              
              setCart(prevCart => {
                const newCart = [...prevCart];
                newCart[index] = {
                  ...newCart[index],
                  product,
                  loading: false
                };
                return newCart;
              });
            } catch (err) {
              console.error(`Error fetching product ${item.productId}:`, err);
              setCart(prevCart => {
                const newCart = [...prevCart];
                newCart[index] = {
                  ...newCart[index],
                  loading: false
                };
                return newCart;
              });
            }
          })
        );
      } catch (err: any) {
        console.error('Cart fetch error:', err.message);
        setError('Sepet yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        setLoading(false);
      }
    };
    
    const fetchTestCards = async () => {
      const cards = await paymentService.getTestCards();
      setTestCards(cards);
    };
    
    fetchCart();
    fetchTestCards();
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      return total + (item.product?.price || 0) * item.quantity;
    }, 0);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPaymentMessage(null);
    
    if (cart.length === 0) {
      setError('Sepetiniz boş, ödeme yapılamaz.');
      return;
    }
    
    try {
      setProcessingPayment(true);
      
      const paymentRequest = {
        cartItems: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        paymentInfo: formData,
        totalAmount: calculateTotal()
      };
      
      const result = await paymentService.processPayment(paymentRequest);
      
      if (result.success) {
        setPaymentSuccess(true);
        setOrderId(result.orderId || null);
        setPaymentMessage(result.message);
        
        // Redirect to success page after delay
        setTimeout(() => {
          navigate('/payment-success', { 
            state: { 
              orderId: result.orderId,
              totalAmount: calculateTotal(),
              items: cart.length
            } 
          });
        }, 2000);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError('Ödeme işlemi sırasında bir hata oluştu.');
    } finally {
      setProcessingPayment(false);
    }
  };
  
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };
  
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData({ ...formData, cardNumber: formatCardNumber(value) });
  };
  
  if (loading) return <div className="text-center my-5"><div className="spinner-border" role="status"><span className="visually-hidden">Yükleniyor...</span></div></div>;
  
  if (paymentSuccess) {
    return (
      <div className="container mt-4">
        <div className="card">
          <div className="card-body text-center">
            <h2 className="text-success">
              <i className="bi bi-check-circle-fill me-2"></i>
              Ödeme Başarılı
            </h2>
            <p>{paymentMessage}</p>
            {orderId && <p>Sipariş Numarası: <strong>{orderId}</strong></p>}
            <p>Teşekkür ederiz.</p>
            <div className="mt-4">
              <Link to="/products" className="btn btn-primary">
                Alışverişe Devam Et
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mt-4">
      <h2>Ödeme</h2>
      
      {error && <div className="alert alert-danger">{error}</div>}
      
      <div className="row">
        <div className="col-md-8">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Ödeme Bilgileri</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="cardNumber" className="form-label">Kart Numarası</label>
                  <input
                    type="text"
                    className="form-control"
                    id="cardNumber"
                    name="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={formData.cardNumber}
                    onChange={handleCardNumberChange}
                    maxLength={19}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="cardHolder" className="form-label">Kart Sahibi</label>
                  <input
                    type="text"
                    className="form-control"
                    id="cardHolder"
                    name="cardHolder"
                    placeholder="Ad Soyad"
                    value={formData.cardHolder}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label htmlFor="expiryMonth" className="form-label">Son Kullanma Ay</label>
                    <select
                      className="form-select"
                      id="expiryMonth"
                      name="expiryMonth"
                      value={formData.expiryMonth}
                      onChange={handleInputChange}
                      required
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = (i + 1).toString().padStart(2, '0');
                        return <option key={month} value={month}>{month}</option>;
                      })}
                    </select>
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <label htmlFor="expiryYear" className="form-label">Son Kullanma Yıl</label>
                    <select
                      className="form-select"
                      id="expiryYear"
                      name="expiryYear"
                      value={formData.expiryYear}
                      onChange={handleInputChange}
                      required
                    >
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = (new Date().getFullYear() + i).toString();
                        return <option key={year} value={year}>{year}</option>;
                      })}
                    </select>
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <label htmlFor="cvv" className="form-label">CVV</label>
                    <input
                      type="text"
                      className="form-control"
                      id="cvv"
                      name="cvv"
                      placeholder="123"
                      value={formData.cvv}
                      onChange={handleInputChange}
                      maxLength={3}
                      required
                    />
                  </div>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">Ödeme Yöntemi</label>
                  <div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="paymentMethod"
                        id="credit_card"
                        value="credit_card"
                        checked={formData.paymentMethod === 'credit_card'}
                        onChange={handleInputChange}
                      />
                      <label className="form-check-label" htmlFor="credit_card">
                        Kredi Kartı
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="paymentMethod"
                        id="debit_card"
                        value="debit_card"
                        checked={formData.paymentMethod === 'debit_card'}
                        onChange={handleInputChange}
                      />
                      <label className="form-check-label" htmlFor="debit_card">
                        Banka Kartı
                      </label>
                    </div>
                  </div>
                </div>
                
                {testCards.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label">Test Kartları:</label>
                    <ul className="list-group">
                      {testCards.map((card, idx) => (
                        <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                          <span>{card.number}</span>
                          <span className={`badge ${card.result === 'Success' ? 'bg-success' : 'bg-danger'}`}>
                            {card.result}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="d-grid gap-2 mt-4">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={processingPayment || cart.length === 0}
                  >
                    {processingPayment ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        İşleniyor...
                      </>
                    ) : (
                      `${calculateTotal().toFixed(2)} TL Öde`
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Sipariş Özeti</h5>
            </div>
            <div className="card-body">
              {cart.length === 0 ? (
                <div className="alert alert-warning">Sepetinizde ürün yok.</div>
              ) : (
                <ul className="list-group list-group-flush mb-3">
                  {cart.map((item, idx) => (
                    <li key={idx} className="list-group-item d-flex justify-content-between">
                      <div>
                        {item.loading ? (
                          <div className="placeholder-glow">
                            <span className="placeholder col-12"></span>
                          </div>
                        ) : item.product ? (
                          <div>
                            <span>{item.product.name}</span>
                            <span className="text-muted d-block">Adet: {item.quantity}</span>
                          </div>
                        ) : (
                          <span>Ürün #{item.productId} (Detaylar yüklenemedi)</span>
                        )}
                      </div>
                      <div>
                        {item.loading ? (
                          <div className="placeholder-glow">
                            <span className="placeholder col-6"></span>
                          </div>
                        ) : item.product ? (
                          `$${(item.product.price * item.quantity).toFixed(2)}`
                        ) : (
                          'N/A'
                        )}
                      </div>
                    </li>
                  ))}
                  <li className="list-group-item d-flex justify-content-between">
                    <strong>Toplam</strong>
                    <strong>
                      {cart.some(item => item.loading || !item.product) ? (
                        <div className="placeholder-glow">
                          <span className="placeholder col-6"></span>
                        </div>
                      ) : (
                        `$${calculateTotal().toFixed(2)}`
                      )}
                    </strong>
                  </li>
                </ul>
              )}
              
              <div className="d-grid gap-2">
                <Link to="/cart" className="btn btn-outline-secondary">
                  <i className="bi bi-arrow-left me-2"></i>
                  Sepete Dön
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout; 