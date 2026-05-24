import client from './client';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => client.post('/auth/signup', data),
  signin: (data) => client.post('/auth/signin', data),
  me:     ()     => client.get('/auth/me'),
};

// ── Silver Price ──────────────────────────────────────────────────────────────
export const silverAPI = {
  getActive:  ()     => client.get('/silver/active'),
  getHistory: ()     => client.get('/silver/history'),
  setPrice:   (data) => client.post('/silver', data),
  preview:    (id)   => client.get(`/silver/preview/${id}`),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productAPI = {
  list:        (params)    => client.get('/products', { params }),
  get:         (id)        => client.get(`/products/${id}`),
  scan:        (query)     => client.get(`/products/scan/${query}`),
  create:      (data)      => client.post('/products', data),
  update:      (id, data)  => client.put(`/products/${id}`, data),
  adjustStock: (id, data)  => client.patch(`/products/${id}/stock`, data),
  regenQR:     (id)        => client.patch(`/products/${id}/qr`),
  delete:      (id)        => client.delete(`/products/${id}`),
  analytics:   ()          => client.get('/products/analytics'),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customerAPI = {
  list:   (params)   => client.get('/customers', { params }),
  get:    (id)       => client.get(`/customers/${id}`),
  create: (data)     => client.post('/customers', data),
  update: (id, data) => client.put(`/customers/${id}`, data),
  delete: (id)       => client.delete(`/customers/${id}`),
};

// ── Sales ─────────────────────────────────────────────────────────────────────
export const saleAPI = {
  list:        (params)    => client.get('/sales', { params }),
  get:         (id)        => client.get(`/sales/${id}`),
  checkout:    (data)      => client.post('/sales', data),
  return:      (id, data)  => client.post(`/sales/${id}/return`, data),
  dailyReport: (params)    => client.get('/sales/report/daily', { params }),
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentAPI = {
  getConfig:    ()         => client.get('/payments/config'),
  createIntent: (data)     => client.post('/payments/create-intent', data),
  verifyIntent: (intentId) => client.get(`/payments/verify/${intentId}`),
  refund:       (data)     => client.post('/payments/refund', data),
};

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const supplierAPI = {
  list:   (params)   => client.get('/suppliers', { params }),
  get:    (id)       => client.get(`/suppliers/${id}`),
  create: (data)     => client.post('/suppliers', data),
  update: (id, data) => client.put(`/suppliers/${id}`, data),
  delete: (id)       => client.delete(`/suppliers/${id}`),
  stats:  ()         => client.get('/suppliers/stats'),
};

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expenseAPI = {
  list:         (params)   => client.get('/expenses', { params }),
  get:          (id)       => client.get(`/expenses/${id}`),
  create:       (data)     => client.post('/expenses', data),
  update:       (id, data) => client.put(`/expenses/${id}`, data),
  delete:       (id)       => client.delete(`/expenses/${id}`),
  profitReport: (params)   => client.get('/expenses/profit-report', { params }),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiAPI = {
  assistant: (data) => client.post('/ai/assistant', data),
  describe:  (data) => client.post('/ai/describe', data),
  insights:  (data) => client.post('/ai/insights', data),
};

// ── Weather ───────────────────────────────────────────────────────────────────
export const weatherAPI = {
  getCurrent:  (city) => client.get('/weather',          { params: city ? { city } : {} }),
  getForecast: (city) => client.get('/weather/forecast', { params: city ? { city } : {} }),
  clearCache:  ()     => client.delete('/weather/cache'),
};