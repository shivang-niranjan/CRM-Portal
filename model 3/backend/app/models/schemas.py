"""
Pydantic Schemas
Request and response models for API validation.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

from app.models.ticket import TicketCategory, TicketStatus, TicketPriority


# ==================== ENUM SCHEMAS ====================

class CategoryEnum(str, Enum):
    ELECTRICITY = "Electricity"
    WATER = "Water"
    ROADS = "Roads"
    SANITATION = "Sanitation"


class StatusEnum(str, Enum):
    REPORTED = "reported"
    CLUSTERED = "clustered"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    ON_SITE = "on_site"
    RESOLVED = "resolved"
    VERIFIED = "verified"
    CLOSED = "closed"
    ESCALATED = "escalated"


class PriorityEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ==================== CITIZEN REPORT SCHEMAS ====================

class CitizenReportCreate(BaseModel):
    """Schema for creating a new citizen report."""
    description: str = Field(..., min_length=10, max_length=2000, description="Complaint description")
    voice_transcript: Optional[str] = Field(None, description="Voice-to-text transcript")
    latitude: float = Field(..., ge=-90, le=90, description="GPS latitude")
    longitude: float = Field(..., ge=-180, le=180, description="GPS longitude")
    address_text: Optional[str] = Field(None, description="Human-readable address")
    citizen_id: Optional[str] = Field(None, description="Citizen identifier")
    citizen_phone: Optional[str] = Field(None, description="Contact phone")
    citizen_name: Optional[str] = Field(None, description="Citizen name")
    image_url: Optional[str] = Field(None, description="URL to uploaded image")
    voice_url: Optional[str] = Field(None, description="URL to voice recording")
    source: str = Field(default="web", description="Report source: web, mobile, whatsapp, social, voice")
    
    class Config:
        json_schema_extra = {
            "example": {
                "description": "Sparking wires near the main road transformer. Very dangerous!",
                "latitude": 28.7041,
                "longitude": 77.1025,
                "address_text": "Near DTU Main Gate, Bawana Road",
                "citizen_phone": "+91-9876543210",
                "source": "web"
            }
        }


class CitizenReportResponse(BaseModel):
    """Schema for citizen report response."""
    id: int
    description: str
    category: Optional[str]
    confidence_score: Optional[float]
    sentiment_score: Optional[float]
    latitude: float
    longitude: float
    address_text: Optional[str]
    image_url: Optional[str]
    source: str
    created_at: str
    master_ticket_id: Optional[int]
    master_ticket_status: Optional[str] = None
    
    class Config:
        from_attributes = True


# ==================== MASTER TICKET SCHEMAS ====================

class MasterTicketResponse(BaseModel):
    """Schema for master ticket response."""
    id: int
    ticket_number: str
    category: str
    sub_category: Optional[str]
    description: str
    latitude: float
    longitude: float
    cluster_radius: float
    status: str
    priority: str
    urgency_score: float
    sla_hours: int
    sla_deadline: Optional[str]
    sla_breached: bool
    time_remaining_hours: float
    assigned_department: Optional[str]
    assigned_worker: Optional[str]
    created_at: str
    report_count: int
    upvote_count: int
    before_image_url: Optional[str]
    after_image_url: Optional[str]
    verification_status: str
    
    class Config:
        from_attributes = True


class TicketUpdate(BaseModel):
    """Schema for updating ticket status/assignment."""
    status: Optional[StatusEnum] = None
    priority: Optional[PriorityEnum] = None
    assigned_department_id: Optional[int] = None
    assigned_worker_id: Optional[int] = None
    notes: Optional[str] = None


class ResolveTicketRequest(BaseModel):
    """Schema for resolving a ticket with proof of work."""
    after_image_url: str = Field(..., description="URL to 'after' resolution image")
    resolution_notes: Optional[str] = Field(None, description="Notes about the resolution")
    worker_id: str = Field(..., description="ID of resolving worker")
    latitude: float = Field(..., description="Worker's GPS latitude at resolution")
    longitude: float = Field(..., description="Worker's GPS longitude at resolution")


class ResolveTicketResponse(BaseModel):
    """Schema for resolution response with verification."""
    success: bool
    ticket_id: int
    image_similarity_score: float
    verification_status: str
    message: str


# ==================== DASHBOARD SCHEMAS ====================

class DashboardStats(BaseModel):
    """Schema for dashboard statistics."""
    total_active_tickets: int
    tickets_by_status: Dict[str, int]
    tickets_by_category: Dict[str, int]
    sla_breach_count: int
    avg_resolution_time: float
    today_reports: int
    
    
class KanbanColumn(BaseModel):
    """Schema for Kanban board column."""
    id: str
    title: str
    tickets: List[MasterTicketResponse]
    count: int


class KanbanBoard(BaseModel):
    """Schema for complete Kanban board."""
    columns: List[KanbanColumn]
    last_updated: str


# ==================== MAP SCHEMAS ====================

class MapMarker(BaseModel):
    """Schema for map marker."""
    id: int
    ticket_number: str
    latitude: float
    longitude: float
    category: str
    status: str
    priority: str
    urgency_score: float
    cluster_radius: float
    report_count: int


class HeatmapPoint(BaseModel):
    """Schema for heatmap data point."""
    latitude: float
    longitude: float
    intensity: float  # 0-1 based on failure frequency
    category: str
    risk_level: str


# ==================== LEADERBOARD SCHEMAS ====================

class DepartmentLeaderboardEntry(BaseModel):
    """Schema for department leaderboard entry."""
    rank: int
    department_id: int
    name: str
    code: str
    category: str
    total_tickets_resolved: int
    avg_resolution_time_hours: Optional[float]
    satisfaction_score: float
    efficiency_score: float
    trust_badge_count: int
    trend: str  # up, down, stable


class LeaderboardResponse(BaseModel):
    """Schema for leaderboard response."""
    departments: List[DepartmentLeaderboardEntry]
    last_updated: str
    total_tickets_today: int


class CitizenLeaderboardEntry(BaseModel):
    """Schema for a citizen's ranking on the leaderboard."""
    rank: int
    citizen_name: str
    reports_submitted: int
    total_score: int
    badge: str


class CitizenLeaderboardResponse(BaseModel):
    """Schema for the citizen leaderboard."""
    citizens: List[CitizenLeaderboardEntry]
    last_updated: str


# ==================== RED ZONE SCHEMAS ====================

class RedZoneResponse(BaseModel):
    """Schema for red zone (predictive maintenance)."""
    id: int
    latitude: float
    longitude: float
    radius_meters: float
    category: str
    failure_count_30d: int
    failure_count_90d: int
    risk_level: str
    recommended_action: Optional[str]
    asset_type: Optional[str]
    last_failure_at: Optional[str]


# ==================== AI/ANALYTICS SCHEMAS ====================

class ClassificationResult(BaseModel):
    """Schema for AI classification result."""
    category: str
    confidence: float
    keywords_detected: List[str]
    urgency_indicators: List[str]


class SpatialClusterResult(BaseModel):
    """Schema for spatial clustering result."""
    report_id: int
    clustered: bool
    master_ticket_id: Optional[int]
    nearby_reports_count: int
    message: str


class SimilarityCheckResult(BaseModel):
    """Schema for image similarity check."""
    similarity_score: float
    passed: bool
    details: Dict[str, Any]


# ==================== VOICE/CHAT SCHEMAS ====================

class VoiceToTextRequest(BaseModel):
    """Schema for voice transcription request."""
    audio_url: str
    language: str = Field(default="en-IN", description="Language code")


class VoiceToTextResponse(BaseModel):
    """Schema for voice transcription response."""
    transcript: str
    confidence: float
    language: str
    extracted_entities: Dict[str, Any]


# ==================== NOTIFICATION SCHEMAS ====================

class NotificationResponse(BaseModel):
    """Schema for citizen notification."""
    id: int
    citizen_id: str
    ticket_id: int
    message: str
    type: str
    created_at: str
    read: bool
