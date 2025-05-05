import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../services/auth.service';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = authService.isAuthenticated();
  const currentUser = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container">
        <Link className="navbar-brand" to="/">E-Commerce App</Link>
        
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/products">Products</Link>
            </li>
            {isAuthenticated && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/cart">Sepetim</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/orders">Siparişlerim</Link>
                </li>
              </>
            )}
          </ul>
          
          <div className="navbar-nav ms-auto">
            {isAuthenticated ? (
              <>
                <div className="d-flex align-items-center">
                  <Link to="/profile" className="nav-link text-light me-3">
                    Welcome, {currentUser?.name || 'Kullanıcı'}
                  </Link>
                  <button 
                    className="btn btn-outline-light" 
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">Login</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/register">Register</Link>
                </li>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 