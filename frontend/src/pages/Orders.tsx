import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Table, Badge, Button, Card, Container, Row, Col, Spinner, Alert } from 'react-bootstrap';
import OrderService, { Order } from '../services/order.service';
import { formatCurrency } from '../utils/formatters';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const userOrders = await OrderService.getUserOrders();
        setOrders(userOrders);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Siparişleriniz yüklenirken bir hata oluştu');
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    if (window.confirm('Bu siparişi iptal etmek istediğinize emin misiniz?')) {
      try {
        const cancelledOrder = await OrderService.cancelOrder(orderId);
        setOrders(orders.map(order => order._id === orderId ? cancelledOrder : order));
      } catch (err: any) {
        setError(err.message || 'Sipariş iptal edilirken bir hata oluştu');
        console.error('Error cancelling order:', err);
      }
    }
  };

  const formatDate = (dateString: Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Container className="my-4">
      <h1 className="mb-4">Siparişlerim</h1>

      {loading ? (
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Yükleniyor...</span>
          </Spinner>
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : orders.length === 0 ? (
        <Card className="p-4">
          <Card.Body className="text-center">
            <Card.Title>Henüz Hiç Siparişiniz Yok</Card.Title>
            <Card.Text>
              Ürünlerimize göz atın ve ilk siparişinizi verin!
            </Card.Text>
            <Button variant="primary" onClick={() => navigate('/products')}>
              Alışverişe Başla
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <div>
          {orders.map((order) => (
            <Card key={order._id} className="mb-4">
              <Card.Header>
                <Row className="align-items-center">
                  <Col>
                    <h5 className="mb-0">Sipariş #{order.orderNumber}</h5>
                  </Col>
                  <Col className="text-end">
                    <Badge 
                      bg={OrderService.getStatusLabel(order.status).color}
                      className="fs-6"
                    >
                      {OrderService.getStatusLabel(order.status).text}
                    </Badge>
                  </Col>
                </Row>
              </Card.Header>
              <Card.Body>
                <Row className="mb-3">
                  <Col md={6}>
                    <p className="mb-1"><strong>Sipariş Tarihi:</strong> {formatDate(order.createdAt)}</p>
                    <p className="mb-1"><strong>Son Güncelleme:</strong> {formatDate(order.updatedAt)}</p>
                    <p className="mb-1"><strong>Toplam Tutar:</strong> {formatCurrency(order.totalAmount)}</p>
                  </Col>
                  <Col md={6}>
                    <p className="mb-1"><strong>Teslimat Adresi:</strong></p>
                    <p className="mb-0">
                      {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}, {order.shippingAddress.country}
                    </p>
                  </Col>
                </Row>

                <h6>Sipariş İçeriği</h6>
                <Table striped responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th>Fiyat</th>
                      <th>Adet</th>
                      <th>Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.productId}>
                        <td>{item.name}</td>
                        <td>{formatCurrency(item.price)}</td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
              <Card.Footer>
                <Row className="align-items-center">
                  <Col>
                    <Link to={`/orders/${order._id}`} className="btn btn-outline-primary">
                      Detayları Görüntüle
                    </Link>
                  </Col>
                  <Col className="text-end">
                    {order.status === 'PENDING' && (
                      <Button 
                        variant="outline-danger" 
                        onClick={() => handleCancelOrder(order._id)}
                      >
                        Siparişi İptal Et
                      </Button>
                    )}
                  </Col>
                </Row>
              </Card.Footer>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
};

export default Orders; 