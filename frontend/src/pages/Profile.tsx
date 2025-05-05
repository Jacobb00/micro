import React, { useState, useEffect } from 'react';
import { Card, Container, Row, Col, Button, Alert } from 'react-bootstrap';
import authService from '../services/auth.service';
import { useNavigate } from 'react-router-dom';

const Profile: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setUser(currentUser);
    setLoading(false);
  }, [navigate]);

  if (loading) {
    return <div className="text-center mt-5">Yükleniyor...</div>;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <Container>
      <Row className="justify-content-md-center mt-5">
        <Col md={8}>
          <h2 className="text-center mb-4">Profil Bilgileri</h2>
          <Card>
            <Card.Header as="h5" className="text-center">
              Kullanıcı Profili
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={4} className="text-md-end fw-bold">Kullanıcı ID:</Col>
                <Col md={8}>{user?.id}</Col>
              </Row>
              <hr />
              
              <Row>
                <Col md={4} className="text-md-end fw-bold">İsim:</Col>
                <Col md={8}>{user?.name}</Col>
              </Row>
              <hr />
              
              <Row>
                <Col md={4} className="text-md-end fw-bold">E-posta:</Col>
                <Col md={8}>{user?.email}</Col>
              </Row>
              <hr />
              
              <Row>
                <Col md={4} className="text-md-end fw-bold">Hesap Oluşturma:</Col>
                <Col md={8}>
                  {user?.createdAt 
                    ? new Date(user.createdAt).toLocaleDateString('tr-TR') 
                    : 'Bilinmiyor'}
                </Col>
              </Row>
            </Card.Body>
            <Card.Footer>
              <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                <Button 
                  variant="primary" 
                  onClick={() => navigate('/profile/edit')}
                >
                  Profili Düzenle
                </Button>
              </div>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Profile; 