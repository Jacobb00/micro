const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');
const auth = require('../../src/middleware/auth');

describe('Auth Middleware', () => {
  let req;
  let res;
  let next;
  let userFindByPkStub;
  let jwtVerifyStub;

  beforeEach(() => {
    // Request, response ve next fonksiyonlarını oluştur
    req = {
      header: sinon.stub()
    };
    
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };
    
    next = sinon.spy();
    
    // User ve JWT için stublar oluştur
    userFindByPkStub = sinon.stub(User, 'findByPk');
    jwtVerifyStub = sinon.stub(jwt, 'verify');
    
    // Node.js'in process.env değişkenini mocklamak için
    process.env.JWT_SECRET = 'test-secret';
  });
  
  afterEach(() => {
    // Tüm stubları sıfırla
    sinon.restore();
  });
  
  it('geçerli token ile kullanıcıyı doğrulamalı', async () => {
    // Geçerli kullanıcı ve token
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test User'
    };
    
    const mockToken = 'valid.jwt.token';
    const decodedToken = { id: mockUser.id };
    
    // Mock davranışları ayarla
    req.header.withArgs('Authorization').returns(`Bearer ${mockToken}`);
    jwtVerifyStub.returns(decodedToken);
    userFindByPkStub.resolves(mockUser);
    
    // Middleware'i çağır
    await auth(req, res, next);
    
    // Assertion'ları gerçekleştir
    expect(req.header.calledWith('Authorization')).to.be.true;
    expect(jwtVerifyStub.calledWith(mockToken, process.env.JWT_SECRET)).to.be.true;
    expect(userFindByPkStub.calledWith(mockUser.id)).to.be.true;
    expect(req.user).to.deep.equal(mockUser);
    expect(req.token).to.equal(mockToken);
    expect(next.calledOnce).to.be.true;
    expect(res.status.called).to.be.false;
    expect(res.json.called).to.be.false;
  });
  
  it('token olmadığında yetkilendirme hatası döndürmeli', async () => {
    // Token yok
    req.header.withArgs('Authorization').returns(undefined);
    
    // Middleware'i çağır
    await auth(req, res, next);
    
    // Assertion'ları gerçekleştir
    expect(req.header.calledWith('Authorization')).to.be.true;
    expect(jwtVerifyStub.called).to.be.false;
    expect(userFindByPkStub.called).to.be.false;
    expect(next.called).to.be.false;
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('Yetkilendirme başarısız');
  });
  
  it('geçersiz token ile yetkilendirme hatası döndürmeli', async () => {
    // Geçersiz token
    const mockToken = 'invalid.jwt.token';
    
    // Mock davranışları ayarla
    req.header.withArgs('Authorization').returns(`Bearer ${mockToken}`);
    jwtVerifyStub.throws(new Error('Invalid token'));
    
    // Middleware'i çağır
    await auth(req, res, next);
    
    // Assertion'ları gerçekleştir
    expect(req.header.calledWith('Authorization')).to.be.true;
    expect(jwtVerifyStub.calledWith(mockToken, process.env.JWT_SECRET)).to.be.true;
    expect(userFindByPkStub.called).to.be.false;
    expect(next.called).to.be.false;
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('Lütfen giriş yapın');
  });
  
  it('token geçerli ama kullanıcı bulunamadığında hata döndürmeli', async () => {
    // Geçerli token ama kullanıcı yok
    const mockToken = 'valid.jwt.token';
    const decodedToken = { id: 'nonexistent-id' };
    
    // Mock davranışları ayarla
    req.header.withArgs('Authorization').returns(`Bearer ${mockToken}`);
    jwtVerifyStub.returns(decodedToken);
    userFindByPkStub.resolves(null);
    
    // Middleware'i çağır
    await auth(req, res, next);
    
    // Assertion'ları gerçekleştir
    expect(req.header.calledWith('Authorization')).to.be.true;
    expect(jwtVerifyStub.calledWith(mockToken, process.env.JWT_SECRET)).to.be.true;
    expect(userFindByPkStub.calledWith(decodedToken.id)).to.be.true;
    expect(next.called).to.be.false;
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('Lütfen giriş yapın');
  });
}); 