import React, { useState, useEffect } from 'react';
import { Card, Container, Row, Col, Button, Form, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import authService from '../services/auth.service';
import axios from 'axios';

const ProfileEdit: React.FC = () => {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setName(currentUser.name || '');
    setEmail(currentUser.email || '');
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = authService.getToken();
      
      // Doğrudan axios ile istek gönder
      const response = await axios.put('/api/auth/profile', 
        { name, email }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data && response.data.user) {
        // Kullanıcı bilgilerini localStorage'da güncelle
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      setSuccess('Profil başarıyla güncellendi.');
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
    } catch (err: any) {
      let errorMessage = 'Profil güncellenirken bir hata oluştu.';
      if (err.response) {
        errorMessage = err.response.data?.message || errorMessage;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Row className="justify-content-md-center mt-5">
        <Col md={8}>
          <h2 className="text-center mb-4">Profil Düzenle</h2>
          
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          
          <Card>
            <Card.Header as="h5" className="text-center">
              Bilgilerinizi Düzenleyin
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>İsim</Form.Label>
                  <Form.Control
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>E-posta</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Form.Group>

                <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                  <Button 
                    variant="secondary" 
                    onClick={() => navigate('/profile')}
                    className="me-md-2"
                    disabled={loading}
                  >
                    İptal
                  </Button>
                  <Button 
                    variant="primary" 
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ProfileEdit; 