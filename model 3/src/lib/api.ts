/**
 * API Client
 * Smart PS-CRM Frontend API Integration
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { toast } from 'sonner';
import type {
  Ticket,
  CitizenReport,
  DashboardStats,
  KanbanBoard,
  MapMarker,
  HeatmapPoint,
  LeaderboardResponse,
  RedZone,
  ClassificationResult,
  ResolveTicketResponse,
  CitizenLeaderboardResponse
} from '@/types';

// API base URL - Vite will proxy requests to the backend in development
// In production, this can be set via environment variable or use absolute URLs
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with empty baseURL since Vite proxy handles routing
const axiosInstance: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    console.error('❌ Response Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      data: error.response?.data
    });
    
    const errorMessage = 
      (error.response?.data as { detail?: string })?.detail || 
      error.message || 
      'An error occurred';
    
    toast.error(`API Error: ${errorMessage}`);
    return Promise.reject(error);
  }
);

// ==================== API METHODS ====================

export const api = {
  // ==================== AUTH ====================
  
  login: async (username: string, password: string): Promise<{ 
    access_token: string; 
    token_type: string; 
    role: 'admin' | 'worker' | 'citizen' 
  }> => {
    const response = await axiosInstance.post('/api/auth/login', 
      new URLSearchParams({ username, password }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    return response.data;
  },

  getCurrentUser: async (): Promise<{ username: string; role: string; full_name?: string }> => {
    const response = await axiosInstance.get('/api/auth/me');
    return response.data;
  },

  // Health check
  healthCheck: async (): Promise<{ status: string; service: string; version: string }> => {
    const response = await axiosInstance.get('/health');
    return response.data;
  },

  // ==================== INTAKE ====================
  
  createReport: async (report: {
    description: string;
    latitude: number;
    longitude: number;
    address_text?: string;
    citizen_id?: string;
    citizen_phone?: string;
    citizen_name?: string;
    image_url?: string;
    source?: string;
  }): Promise<CitizenReport> => {
    const response = await axiosInstance.post('/api/reports', report);
    return response.data;
  },

  getMyReports: async (citizen_id: string): Promise<CitizenReport[]> => {
    const response = await axiosInstance.get('/api/my-reports', { params: { citizen_id } });
    return response.data;
  },

  transcribeVoice: async (audioUrl: string, language: string = 'en-IN'): Promise<{
    transcript: string;
    confidence: number;
    language: string;
    extracted_entities: Record<string, unknown>;
  }> => {
    const response = await axiosInstance.post('/api/voice/transcribe', {
      audio_url: audioUrl,
      language,
    });
    return response.data;
  },

  // ==================== TICKETS ====================
  
  getTickets: async (params?: {
    status?: string;
    category?: string;
    priority?: string;
    department_id?: number;
    assigned_worker_id?: number;
    sla_breached?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Ticket[]> => {
    const response = await axiosInstance.get('/api/tickets', { params });
    return response.data;
  },

  getTicket: async (id: number): Promise<Ticket> => {
    const response = await axiosInstance.get(`/api/tickets/${id}`);
    return response.data;
  },

  getTicketReports: async (id: number): Promise<CitizenReport[]> => {
    const response = await axiosInstance.get(`/api/tickets/${id}/reports`);
    return response.data;
  },

  updateTicket: async (
    id: number,
    update: {
      status?: string;
      priority?: string;
      assigned_department_id?: number;
      assigned_worker_id?: number;
      notes?: string;
    }
  ): Promise<Ticket> => {
    const response = await axiosInstance.patch(`/api/tickets/${id}`, update);
    return response.data;
  },

  resolveTicket: async (ticketId: number, data: {
    after_image_url: string;
    resolution_notes?: string;
    worker_id: string;
    latitude: number;
    longitude: number;
  }): Promise<ResolveTicketResponse> => {
    const response = await axiosInstance.post(`/api/tickets/${ticketId}/resolve`, data);
    return response.data;
  },

  // ==================== DASHBOARD ====================
  
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await axiosInstance.get('/api/dashboard/stats');
    return response.data;
  },

  getKanbanBoard: async (): Promise<KanbanBoard> => {
    const response = await axiosInstance.get('/api/dashboard/kanban');
    return response.data;
  },

  // ==================== MAPS ====================
  
  getMapMarkers: async (params?: {
    category?: string;
    status?: string;
  }): Promise<MapMarker[]> => {
    const response = await axiosInstance.get('/api/map/markers', { params });
    return response.data;
  },

  getHeatmapData: async (params?: {
    category?: string;
    days?: number;
  }): Promise<HeatmapPoint[]> => {
    const response = await axiosInstance.get('/api/map/heatmap', { params });
    return response.data;
  },

  // ==================== RED ZONES ====================
  
  getRedZones: async (params?: {
    category?: string;
    min_risk?: string;
  }): Promise<RedZone[]> => {
    const response = await axiosInstance.get('/api/red-zones', { params });
    return response.data;
  },

  analyzeLocation: async (
    latitude: number,
    longitude: number,
    category: string
  ): Promise<RedZone> => {
    const response = await axiosInstance.post('/api/red-zones/analyze', null, {
      params: { latitude, longitude, category },
    });
    return response.data;
  },

  // ==================== LEADERBOARD ====================
  
  getDepartmentLeaderboard: async (): Promise<LeaderboardResponse> => {
    const response = await axiosInstance.get('/api/leaderboard');
    return response.data;
  },

  getCitizenLeaderboard: async (): Promise<CitizenLeaderboardResponse> => {
    const response = await axiosInstance.get('/api/leaderboard/citizens');
    return response.data;
  },

  // ==================== UTILITY ====================
  
  classifyText: async (text: string): Promise<ClassificationResult> => {
    const response = await axiosInstance.get('/api/classify', { params: { text } });
    return response.data;
  },

  getCategories: async (): Promise<{
    categories: Array<{
      id: string;
      name: string;
      keywords: string[];
    }>;
  }> => {
    const response = await axiosInstance.get('/api/categories');
    return response.data;
  },

  getDepartments: async (): Promise<Array<{
    id: number;
    name: string;
    code: string;
    category: string;
    efficiency_score: number;
  }>> => {
    const response = await axiosInstance.get('/api/departments');
    return response.data;
  },
};

// Export axios instance for custom requests
export { axiosInstance };
