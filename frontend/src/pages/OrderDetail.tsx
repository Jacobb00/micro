import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Container, Card, Row, Col, Table, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import OrderService, { Order, StatusHistory } from '../services/order.service';
import { formatCurrency } from '../utils/formatters';

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const orderDetails = await OrderService.getOrderById(id);
        setOrder(orderDetails);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Sipariş detayları yüklenirken bir hata oluştu');
        console.error('Error fetching order details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [id]);

  const handleCancelOrder = async () => {
    if (!order) return;
    
    if (window.confirm('Bu siparişi iptal etmek istediğinize emin misiniz?')) {
      try {
        const cancelledOrder = await OrderService.cancelOrder(order._id);
        setOrder(cancelledOrder);
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

  if (loading) {
    return (
      <Container className="text-center my-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Yükleniyor...</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="my-4">
        <Alert variant="danger">{error}</Alert>
        <Button variant="primary" onClick={() => navigate('/orders')}>
          Siparişlerime Dön
        </Button>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container className="my-4">
        <Alert variant="warning">Sipariş bulunamadı.</Alert>
        <Button variant="primary" onClick={() => navigate('/orders')}>
          Siparişlerime Dön
        </Button>
      </Container>
    );
  }

  return (
    <Container className="my-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Sipariş Detayı</h1>
        <Button variant="outline-secondary" onClick={() => navigate('/orders')}>
          Siparişlerime Dön
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Header>
          <Row className="align-items-center">
            <Col>
              <h4 className="mb-0">Sipariş #{order.orderNumber}</h4>
            </Col>
            <Col className="text-end">
              <Badge 
                bg={OrderService.getStatusLabel(order.status).color}
                className="fs-5 p-2"
              >
                {OrderService.getStatusLabel(order.status).text}
              </Badge>
            </Col>
          </Row>
        </Card.Header>
        <Card.Body>
          <Row className="mb-4">
            <Col md={6}>
              <h5>Sipariş Bilgileri</h5>
              <p><strong>Sipariş Tarihi:</strong> {formatDate(order.createdAt)}</p>
              <p><strong>Son Güncelleme:</strong> {formatDate(order.updatedAt)}</p>
              <p><strong>Toplam Tutar:</strong> {formatCurrency(order.totalAmount)}</p>
            </Col>
            <Col md={6}>
              <h5>Teslimat Adresi</h5>
              <p>
                {order.shippingAddress.street}<br />
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}<br />
                {order.shippingAddress.country}
              </p>
            </Col>
          </Row>

          <h5 className="mb-3">Sipariş İçeriği</h5>
          <Table striped bordered responsive>
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Birim Fiyat</th>
                <th>Adet</th>
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.productId}>
                  <td>
                    <Link to={`/products/${item.productId}`}>
                      {item.name}
                    </Link>
                  </td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.price * item.quantity)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="text-end"><strong>Toplam:</strong></td>
                <td><strong>{formatCurrency(order.totalAmount)}</strong></td>
              </tr>
            </tbody>
          </Table>

          <h5 className="mt-4 mb-3">Sipariş Durumu Geçmişi</h5>
          <Table striped bordered>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Durum</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {[...order.statusHistory].reverse().map((history: StatusHistory, index) => (
                <tr key={index}>
                  <td>{formatDate(history.timestamp)}</td>
                  <td>
                    <Badge bg={OrderService.getStatusLabel(history.status).color}>
                      {OrderService.getStatusLabel(history.status).text}
                    </Badge>
                  </td>
                  <td>{history.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
        {order.status === 'PENDING' && (
          <Card.Footer>
            <Button 
              variant="danger" 
              onClick={handleCancelOrder}
            >
              Siparişi İptal Et
            </Button>
          </Card.Footer>
        )}
      </Card>
    </Container>
  );
};

export default OrderDetail; 