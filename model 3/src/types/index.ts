/**
 * TypeScript Type Definitions
 * Smart PS-CRM Frontend Types
 */

// ==================== TICKET TYPES ====================

export type TicketStatus = 
  | 'reported' 
  | 'clustered' 
  | 'assigned' 
  | 'in_progress' 
  | 'on_site' 
  | 'resolved' 
  | 'verified' 
  | 'closed' 
  | 'escalated';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export type TicketCategory = 'Electricity' | 'Water' | 'Roads' | 'Sanitation';

export interface Ticket {
  id: number;
  ticket_number: string;
  category: TicketCategory;
  sub_category?: string;
  description: string;
  latitude: number;
  longitude: number;
  cluster_radius: number;
  status: TicketStatus;
  priority: TicketPriority;
  urgency_score: number;
  sla_hours: number;
  sla_deadline?: string;
  sla_breached: boolean;
  time_remaining_hours: number;
  assigned_department?: string;
  assigned_worker?: string;
  created_at: string;
  report_count: number;
  upvote_count: number;
  before_image_url?: string;
  after_image_url?: string;
  verification_status: 'pending' | 'passed' | 'failed';
  image_similarity_score?: number;
  source: string;
  assigned_at?: string;
  started_at?: string;
  resolved_at?: string;
}

export interface CitizenReport {
  id: number;
  description: string;
  category?: TicketCategory;
  confidence_score?: number;
  sentiment_score?: number;
  latitude: number;
  longitude: number;
  address_text?: string;
  image_url?: string;
  source: string;
  created_at: string;
  master_ticket_id?: number;
  master_ticket_status?: string;
  citizen_name?: string;
}

// ==================== DASHBOARD TYPES ====================

export interface DashboardStats {
  total_active_tickets: number;
  tickets_by_status: Record<string, number>;
  tickets_by_category: Record<string, number>;
  sla_breach_count: number;
  avg_resolution_time: number;
  today_reports: number;
}

// ==================== KANBAN TYPES ====================

export interface KanbanColumn {
  id: string;
  title: string;
  tickets: Ticket[];
  count: number;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  last_updated: string;
}

// ==================== MAP TYPES ====================

export interface MapMarker {
  id: number;
  ticket_number: string;
  latitude: number;
  longitude: number;
  category: string;
  status: string;
  priority: string;
  urgency_score: number;
  cluster_radius: number;
  report_count: number;
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
  category: string;
  risk_level: string;
}

// ==================== DEPARTMENT TYPES ====================

export interface Department {
  id: number;
  name: string;
  code: string;
  category: string;
  total_tickets_resolved: number;
  avg_resolution_time_hours?: number;
  satisfaction_score: number;
  efficiency_score: number;
  trust_badge_count: number;
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  name: string;
  code: string;
  category: string;
  total_tickets_resolved: number;
  avg_resolution_time_hours?: number;
  satisfaction_score: number;
  efficiency_score: number;
  trust_badge_count: number;
  trend: 'up' | 'down' | 'stable';
}

export interface CitizenLeaderboardEntry {
  rank: number;
  citizen_name: string;
  reports_submitted: number;
  total_score: number;
  badge: "Bronze" | "Silver" | "Gold" | "Diamond";
}

export interface CitizenLeaderboardResponse {
  citizens: CitizenLeaderboardEntry[];
  last_updated: string;
}

export interface LeaderboardResponse {
  departments: LeaderboardEntry[];
  last_updated: string;
  total_tickets_today: number;
}

// ==================== RED ZONE TYPES ====================

export interface RedZone {
  id: number;
  latitude: number;
  longitude: number;
  radius_meters: number;
  category: string;
  failure_count_30d: number;
  failure_count_90d: number;
  risk_level: string;
  recommended_action?: string;
  asset_type?: string;
  last_failure_at?: string;
  predicted_failure_at?: string;
  proactive_maintenance_deadline?: string;
  improvement_suggestion?: string;
}

// ==================== API RESPONSE TYPES ====================

export interface ClassificationResult {
  category: TicketCategory;
  confidence: number;
  keywords_detected: string[];
  urgency_indicators: string[];
}

export interface ResolveTicketResponse {
  success: boolean;
  ticket_id: number;
  image_similarity_score: number;
  verification_status: 'passed' | 'failed';
  message: string;
}

// ==================== COMPONENT PROP TYPES ====================

export interface TicketCardProps {
  ticket: Ticket;
  onClick?: (ticket: Ticket) => void;
  showSla?: boolean;
}

export interface MapProps {
  markers: MapMarker[];
  heatmapData?: HeatmapPoint[];
  onMarkerClick?: (ticket: Ticket) => void;
  center?: [number, number];
  zoom?: number;
}
