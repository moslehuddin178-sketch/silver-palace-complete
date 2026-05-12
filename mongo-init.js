// MongoDB initialization script
// Runs once when the container is first created

db = db.getSiblingDB('silver_jewelry');

// Create application user with limited permissions
db.createUser({
  user: 'silverapp',
  pwd:  'silverapp_secure_2024',
  roles: [{ role: 'readWrite', db: 'silver_jewelry' }]
});

// Create indexes for performance with 50k+ products
db.products.createIndex({ sku: 1 },       { unique: true });
db.products.createIndex({ barcode: 1 },   { sparse: true });
db.products.createIndex({ status: 1 });
db.products.createIndex({ category: 1, status: 1 });
db.products.createIndex({ isLowStock: 1 });
db.products.createIndex({ name: 'text', description: 'text', tags: 'text' });

db.customers.createIndex({ customerCode: 1 }, { unique: true });
db.customers.createIndex({ phone: 1 });
db.customers.createIndex({ type: 1 });

db.sales.createIndex({ invoiceNo: 1 }, { unique: true });
db.sales.createIndex({ createdAt: -1 });
db.sales.createIndex({ customer: 1 });

db.silverprices.createIndex({ isActive: 1 });
db.silverprices.createIndex({ createdAt: -1 });

print('✅ Silver Palace DB initialized with indexes');
