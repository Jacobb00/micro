const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const userController = require('../../src/controllers/userController');
const rabbitmq = require('../../src/config/rabbitmq');

describe('User Controller', () => {
  let req;
  let res;
  let userFindOneSpy;
  let userCreateSpy;
  let userFindByPkSpy;
  let rabbitmqPublishSpy;
  let comparePasswordStub;
  let jwtSignStub;

  beforeEach(() => {
    // Mock request ve response
    req = {
      body: {},
      user: {}
    };
    
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };

    // Stubs ve spy'lar oluştur
    userFindOneSpy = sinon.stub(User, 'findOne');
    userCreateSpy = sinon.stub(User, 'create');
    userFindByPkSpy = sinon.stub(User, 'findByPk');
    rabbitmqPublishSpy = sinon.stub(rabbitmq, 'publishMessage').resolves();
    jwtSignStub = sinon.stub(jwt, 'sign').returns('test-token');
    comparePasswordStub = sinon.stub().resolves(true);
  });

  afterEach(() => {
    // Her testten sonra stubs ve spy'ları temizle
    sinon.restore();
  });

  describe('register', () => {
    it('başarılı kullanıcı kaydı yapmalı', async () => {
      // Test verisi
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      // Mock davranışları ayarla
      userFindOneSpy.resolves(null);
      
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: req.body.email,
        name: req.body.name
      };
      
      userCreateSpy.resolves(mockUser);

      // Controller methodunu çağır
      await userController.register(req, res);

      // Assertion'ları gerçekleştir
      expect(userFindOneSpy.calledOnce).to.be.true;
      expect(userCreateSpy.calledOnce).to.be.true;
      expect(rabbitmqPublishSpy.calledOnce).to.be.true;
      expect(jwtSignStub.calledOnce).to.be.true;
      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      const responseArg = res.json.firstCall.args[0];
      expect(responseArg).to.have.property('message').that.includes('başarıyla');
      expect(responseArg).to.have.property('token', 'test-token');
      expect(responseArg).to.have.property('user');
    });

    it('mevcut e-posta ile kayıt denendiğinde hata döndürmeli', async () => {
      // Test verisi
      req.body = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User'
      };

      // Mock davranışı ayarla - kullanıcı zaten var
      userFindOneSpy.resolves({ email: req.body.email });

      // Controller methodunu çağır
      await userController.register(req, res);

      // Assertion'ları gerçekleştir
      expect(userFindOneSpy.calledOnce).to.be.true;
      expect(userCreateSpy.called).to.be.false;
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('zaten kullanımda');
    });
  });

  describe('login', () => {
    it('geçerli kimlik bilgileriyle giriş yapmalı', async () => {
      // Test verisi
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock kullanıcı oluştur
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: req.body.email,
        name: 'Test User',
        comparePassword: comparePasswordStub
      };

      // Mock davranışları ayarla
      userFindOneSpy.resolves(mockUser);

      // Controller methodunu çağır
      await userController.login(req, res);

      // Assertion'ları gerçekleştir
      expect(userFindOneSpy.calledOnce).to.be.true;
      expect(comparePasswordStub.calledOnce).to.be.true;
      expect(jwtSignStub.calledOnce).to.be.true;
      expect(rabbitmqPublishSpy.calledOnce).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      const responseArg = res.json.firstCall.args[0];
      expect(responseArg).to.have.property('message').that.includes('başarılı');
      expect(responseArg).to.have.property('token', 'test-token');
      expect(responseArg).to.have.property('user');
    });

    it('geçersiz e-posta ile giriş yapmayı reddetmeli', async () => {
      // Test verisi
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      // Mock davranışı ayarla - kullanıcı bulunamadı
      userFindOneSpy.resolves(null);

      // Controller methodunu çağır
      await userController.login(req, res);

      // Assertion'ları gerçekleştir
      expect(userFindOneSpy.calledOnce).to.be.true;
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('Geçersiz kimlik bilgileri');
    });

    it('geçersiz şifre ile giriş yapmayı reddetmeli', async () => {
      // Test verisi
      req.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Şifre karşılaştırması başarısız
      comparePasswordStub.resolves(false);

      // Mock kullanıcı oluştur
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: req.body.email,
        comparePassword: comparePasswordStub
      };

      // Mock davranışı ayarla
      userFindOneSpy.resolves(mockUser);

      // Controller methodunu çağır
      await userController.login(req, res);

      // Assertion'ları gerçekleştir
      expect(userFindOneSpy.calledOnce).to.be.true;
      expect(comparePasswordStub.calledOnce).to.be.true;
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('Geçersiz kimlik bilgileri');
    });
  });

  describe('getProfile', () => {
    it('kullanıcı profilini başarıyla getirmeli', async () => {
      // Test verisi
      req.user = {
        id: '123e4567-e89b-12d3-a456-426614174000'
      };

      // Mock kullanıcı oluştur (şifre hariç)
      const mockUser = {
        id: req.user.id,
        email: 'test@example.com',
        name: 'Test User'
      };

      // Mock davranışı ayarla
      userFindByPkSpy.resolves(mockUser);

      // Controller methodunu çağır
      await userController.getProfile(req, res);

      // Assertion'ları gerçekleştir
      expect(userFindByPkSpy.calledOnce).to.be.true;
      expect(userFindByPkSpy.calledWith(req.user.id)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.calledWith(mockUser)).to.be.true;
    });

    it('kullanıcı bulunamadığında hata döndürmeli', async () => {
      // Test verisi
      req.user = {
        id: 'nonexistent-id'
      };

      // Mock davranışı ayarla - kullanıcı bulunamadı
      userFindByPkSpy.resolves(null);

      // Controller methodunu çağır
      await userController.getProfile(req, res);

      // Assertion'ları gerçekleştir
      expect(userFindByPkSpy.calledOnce).to.be.true;
      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('bulunamadı');
    });
  });

  describe('updateProfile', () => {
    it('kullanıcı profilini başarıyla güncellemeli', async () => {
      // Test verisi
      req.user = {
        id: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      req.body = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      // Mock kullanıcı oluştur
      const mockUser = {
        id: req.user.id,
        email: 'test@example.com',
        name: 'Test User',
        update: sinon.stub().resolves()
      };

      // Güncelleme sonrası kullanıcı
      const updatedUser = {
        id: req.user.id,
        email: req.body.email,
        name: req.body.name
      };

      // Mock kullanıcıyı güncelleme işlevi
      mockUser.update.callsFake(() => {
        mockUser.name = req.body.name;
        mockUser.email = req.body.email;
        return Promise.resolve();
      });

      // Mock davranışı ayarla
      userFindByPkSpy.resolves(mockUser);

      // Controller methodunu çağır
      await userController.updateProfile(req, res);

      // Assertion'ları gerçekleştir
      expect(userFindByPkSpy.calledOnce).to.be.true;
      expect(mockUser.update.calledOnce).to.be.true;
      expect(rabbitmqPublishSpy.calledOnce).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      const responseArg = res.json.firstCall.args[0];
      expect(responseArg).to.have.property('message').that.includes('başarıyla güncellendi');
      expect(responseArg).to.have.property('user');
      expect(responseArg.user).to.have.property('name', req.body.name);
      expect(responseArg.user).to.have.property('email', req.body.email);
    });

    it('kullanıcı bulunamadığında hata döndürmeli', async () => {
      // Test verisi
      req.user = {
        id: 'nonexistent-id'
      };
      
      req.body = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      // Mock davranışı ayarla - kullanıcı bulunamadı
      userFindByPkSpy.resolves(null);

      // Controller methodunu çağır
      await userController.updateProfile(req, res);

      // Assertion'ları gerçekleştir
      expect(userFindByPkSpy.calledOnce).to.be.true;
      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('bulunamadı');
    });
  });
}); 