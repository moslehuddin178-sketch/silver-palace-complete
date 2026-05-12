import client from './client';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data)  => client.post('/auth/signup', data),
  signin: (data)  => client.post('/auth/signin', data),
  me:     ()      => client.get('/auth/me'),
};

// ── Silver Price ──────────────────────────────────────────────────────────────
export const silverAPI = {
  getActive:  ()        => client.get('/silver/active'),
  getHistory: ()        => client.get('/silver/history'),
  setPrice:   (data)    => client.post('/silver', data),
  preview:    (id)      => client.get(`/silver/preview/${id}`),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productAPI = {
  list:       (params)  => client.get('/products', { params }),
  get:        (id)      => client.get(`/products/${id}`),
  scan:       (query)   => client.get(`/products/scan/${query}`),
  create:     (data)    => client.post('/products', data),
  update:     (id, data)=> client.put(`/products/${id}`, data),
  adjustStock:(id, data)=> client.patch(`/products/${id}/stock`, data),
  regenQR:    (id)      => client.patch(`/products/${id}/qr`),
  delete:     (id)      => client.delete(`/products/${id}`),
  analytics:  ()        => client.get('/products/analytics'),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customerAPI = {
  list:   (params)    => client.get('/customers', { params }),
  get:    (id)        => client.get(`/customers/${id}`),
  create: (data)      => client.post('/customers', data),
  update: (id, data)  => client.put(`/customers/${id}`, data),
  delete: (id)        => client.delete(`/customers/${id}`),
};

// ── Sales ─────────────────────────────────────────────────────────────────────
export const saleAPI = {
  list:       (params)  => client.get('/sales', { params }),
  get:        (id)      => client.get(`/sales/${id}`),
  checkout:   (data)    => client.post('/sales', data),
  return:     (id, data)=> client.post(`/sales/${id}/return`, data),
  dailyReport:(params)  => client.get('/sales/report/daily', { params }),
};
