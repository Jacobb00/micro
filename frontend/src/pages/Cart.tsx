import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import cartService, { CartItem } from '../services/cartService';
import productService from '../services/product.service';
import { Product } from '../types/Product';

interface EnhancedCartItem extends CartItem {
  product?: Product;
  loading?: boolean;
}

const Cart: React.FC = () => {
  const [cart, setCart] = useState<EnhancedCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        setLoading(true);
        const cartData = await cartService.getCart();
        console.log('Cart data loaded:', cartData);
        
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
    fetchCart();
  }, []);

  const handleRemoveItem = async (productId: string) => {
    try {
      await cartService.removeFromCart(productId);
      setCart(prevCart => prevCart.filter(item => item.productId !== productId));
    } catch (err: any) {
      console.error('Remove item error:', err);
      setError('Ürün sepetten çıkarılamadı. Lütfen tekrar deneyin.');
    }
  };

  if (loading) return <div className="text-center my-5"><div className="spinner-border" role="status"><span className="visually-hidden">Sepet yükleniyor...</span></div></div>;

  return (
    <div className="container mt-4">
      <h2>Sepetim</h2>
      
      {error && <div className="alert alert-danger">{error}</div>}
      
      {cart.length === 0 ? (
        <div className="alert alert-info">
          <p>Sepetinizde ürün yok.</p>
          <Link to="/products" className="btn btn-primary mt-2">Alışverişe Devam Et</Link>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Fiyat</th>
                    <th>Adet</th>
                    <th>Toplam</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        {item.loading ? (
                          <div className="placeholder-glow">
                            <span className="placeholder col-12"></span>
                          </div>
                        ) : item.product ? (
                          <div className="d-flex align-items-center">
                            {item.product.imageUrl && (
                              <img 
                                src={item.product.imageUrl} 
                                alt={item.product.name} 
                                className="img-thumbnail me-2" 
                                style={{ width: '50px', height: '50px', objectFit: 'contain' }} 
                              />
                            )}
                            <Link to={`/products/${item.productId}`}>{item.product.name}</Link>
                          </div>
                        ) : (
                          <span>Ürün #{item.productId} (Detaylar yüklenemedi)</span>
                        )}
                      </td>
                      <td>
                        {item.loading ? (
                          <div className="placeholder-glow">
                            <span className="placeholder col-6"></span>
                          </div>
                        ) : item.product ? (
                          `$${item.product.price.toFixed(2)}`
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td>{item.quantity}</td>
                      <td>
                        {item.loading ? (
                          <div className="placeholder-glow">
                            <span className="placeholder col-6"></span>
                          </div>
                        ) : item.product ? (
                          `$${(item.product.price * item.quantity).toFixed(2)}`
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemoveItem(item.productId)}
                        >
                          <i className="bi bi-trash"></i> Kaldır
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>Toplam</th>
                    <th>
                      {cart.some(item => item.loading || !item.product) ? (
                        <div className="placeholder-glow">
                          <span className="placeholder col-6"></span>
                        </div>
                      ) : (
                        `$${cart.reduce((total, item) => total + (item.product?.price || 0) * item.quantity, 0).toFixed(2)}`
                      )}
                    </th>
                    <th></th>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="d-flex justify-content-between mt-3">
              <Link to="/products" className="btn btn-outline-primary">
                <i className="bi bi-arrow-left"></i> Alışverişe Devam Et
              </Link>
              <Link to="/checkout" className="btn btn-success">
                <i className="bi bi-credit-card"></i> Ödemeye Geç
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
