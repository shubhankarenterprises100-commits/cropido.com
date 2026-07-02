// Cropido API client
import { storage } from '@/src/utils/storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function request<T = any>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  requireAuth: boolean = true,
): Promise<T> {
  const url = `${BASE}/api${path}`;
  const token = requireAuth ? await storage.secureGet('cropido_token', '') : '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.detail || j.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (data: any) => request('/auth/register', 'POST', data, false),
  login: (email: string, password: string) => request('/auth/login', 'POST', { email, password }, false),
  forgot: (email: string) => request('/auth/forgot-password', 'POST', { email }, false),
  sendOtp: (phone: string) => request('/auth/otp/send', 'POST', { phone }, false),
  verifyOtp: (data: any) => request('/auth/otp/verify', 'POST', data, false),
  googleSession: (session_id: string) => request('/auth/google/session', 'POST', { session_id }, false),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', 'POST'),
  updateProfile: (data: any) => request('/profile', 'PUT', data),

  // Dashboard
  dashboard: () => request('/dashboard'),

  // Marketplace
  products: (category?: string, q?: string) => {
    const p = new URLSearchParams();
    if (category) p.set('category', category);
    if (q) p.set('q', q);
    return request(`/products?${p}`, 'GET', undefined, false);
  },
  product: (id: string) => request(`/products/${id}`, 'GET', undefined, false),
  addToCart: (product_id: string, quantity: number) => request('/cart/add', 'POST', { product_id, quantity }),
  getCart: () => request('/cart'),
  removeFromCart: (product_id: string) => request(`/cart/${product_id}`, 'DELETE'),
  placeOrder: (items: any[], address: string, payment_method: string) => request('/orders', 'POST', { items, address, payment_method }),
  orders: () => request('/orders'),

  // Crop trading
  crops: (category?: string) => request(`/crops${category ? `?category=${category}` : ''}`, 'GET', undefined, false),
  createCrop: (data: any) => request('/crops', 'POST', data),

  // Equipment
  equipment: (category?: string) => request(`/equipment${category ? `?category=${category}` : ''}`, 'GET', undefined, false),
  bookEquipment: (data: any) => request('/equipment/bookings', 'POST', data),
  equipmentBookings: () => request('/equipment/bookings'),

  // Services
  services: (category?: string) => request(`/services${category ? `?category=${category}` : ''}`, 'GET', undefined, false),
  bookService: (data: any) => request('/services/bookings', 'POST', data),
  serviceBookings: () => request('/services/bookings'),

  // Community
  posts: (tab: string = 'feed') => request(`/community/posts?tab=${tab}`, 'GET', undefined, false),
  createPost: (data: any) => request('/community/posts', 'POST', data),
  likePost: (id: string) => request(`/community/posts/${id}/like`, 'POST'),
  comments: (id: string) => request(`/community/posts/${id}/comments`, 'GET', undefined, false),
  addComment: (id: string, text: string) => request(`/community/posts/${id}/comments`, 'POST', { text }),

  // Knowledge
  knowledge: (category?: string) => request(`/knowledge${category ? `?category=${category}` : ''}`, 'GET', undefined, false),

  // Directory
  businesses: (category?: string, q?: string) => {
    const p = new URLSearchParams();
    if (category) p.set('category', category);
    if (q) p.set('q', q);
    return request(`/businesses?${p}`, 'GET', undefined, false);
  },

  // Messaging
  threads: () => request('/messages/threads'),
  threadMessages: (id: string) => request(`/messages/threads/${id}`),
  sendMessage: (to_user_id: string, text: string) => request('/messages/send', 'POST', { to_user_id, text }),

  // Notifications
  notifications: () => request('/notifications'),
  markAllRead: () => request('/notifications/read-all', 'POST'),

  // AI
  aiChat: (session_id: string, message: string, language: string, image_base64?: string) =>
    request('/ai/chat', 'POST', { session_id, message, language, image_base64 }),
  aiHistory: (session_id: string) => request(`/ai/history/${session_id}`),

  // Subscriptions
  plans: () => request('/subscriptions/plans'),
  subscribe: (plan_id: string) => request('/subscriptions/subscribe', 'POST', { plan_id }),
  payments: () => request('/payments'),
};

export type Product = {
  product_id: string; title: string; category: string; price: number; unit: string;
  description: string; image?: string; stock: number; rating?: number; reviews_count?: number;
  seller_name?: string;
};
