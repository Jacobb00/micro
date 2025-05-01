const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderStatus:
 *       type: string
 *       enum:
 *         - PENDING
 *         - CONFIRMED
 *         - SHIPPED
 *         - DELIVERED
 *         - CANCELED
 *       description: Status of an order
 *     Order:
 *       type: object
 *       required:
 *         - orderNumber
 *         - userId
 *         - items
 *         - totalAmount
 *         - status
 *       properties:
 *         orderNumber:
 *           type: string
 *           description: Unique order identifier
 *         userId:
 *           type: string
 *           description: ID of the user who placed the order
 *         items:
 *           type: array
 *           description: List of ordered items
 *           items:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               quantity:
 *                 type: integer
 *         totalAmount:
 *           type: number
 *           description: Total order amount
 *         status:
 *           $ref: '#/components/schemas/OrderStatus'
 *         statusHistory:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               status:
 *                 $ref: '#/components/schemas/OrderStatus'
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               note:
 *                 type: string
 *         shippingAddress:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             zipCode:
 *               type: string
 *             country:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  }
});

const ShippingAddressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  zipCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  }
});

const StatusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELED'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String
  }
});

const OrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  items: [OrderItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELED'],
    default: 'PENDING'
  },
  statusHistory: [StatusHistorySchema],
  shippingAddress: ShippingAddressSchema,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update the updatedAt timestamp
OrderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add the first status history entry when creating a new order
OrderSchema.pre('save', function(next) {
  if (this.isNew) {
    this.statusHistory = [{
      status: this.status,
      timestamp: new Date(),
      note: 'Order created'
    }];
  }
  next();
});

// Method to update order status
OrderSchema.methods.updateStatus = function(newStatus, note) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || `Status updated to ${newStatus}`
  });
  return this.save();
};

module.exports = mongoose.model('Order', OrderSchema); 