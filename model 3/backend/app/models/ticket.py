"""
Ticket Models
Core data models for the Smart PS-CRM complaint management system.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from app.db.base import Base


class TicketStatus(str, PyEnum):
    """Ticket lifecycle statuses."""
    REPORTED = "reported"
    CLUSTERED = "clustered"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    ON_SITE = "on_site"
    RESOLVED = "resolved"
    VERIFIED = "verified"
    CLOSED = "closed"
    ESCALATED = "escalated"


class TicketPriority(str, PyEnum):
    """Priority levels with SLA mappings."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketCategory(str, PyEnum):
    """AI-classified complaint categories."""
    ELECTRICITY = "Electricity"
    WATER = "Water"
    ROADS = "Roads"
    SANITATION = "Sanitation"


class CitizenReport(Base):
    """
    Individual citizen complaint reports.
    Multiple reports can be linked to a single MasterTicket via spatial clustering.
    """
    __tablename__ = "citizen_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Citizen Information
    citizen_id = Column(String(50), index=True, nullable=True)
    citizen_phone = Column(String(20), nullable=True)
    citizen_name = Column(String(100), nullable=True)
    
    # Report Content
    description = Column(Text, nullable=False)
    voice_transcript = Column(Text, nullable=True)
    source = Column(String(50), default="web")  # web, mobile, whatsapp, social, voice
    
    # AI Classification
    category = Column(Enum(TicketCategory), nullable=True)
    confidence_score = Column(Float, nullable=True)
    sentiment_score = Column(Float, nullable=True)  # -1 to 1 (negative to positive)
    
    # Location Data
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address_text = Column(Text, nullable=True)
    
    # Media
    image_url = Column(String(500), nullable=True)
    voice_url = Column(String(500), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    master_ticket_id = Column(Integer, ForeignKey("master_tickets.id"), nullable=True)
    master_ticket = relationship("MasterTicket", back_populates="citizen_reports")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        data = {
            "id": self.id,
            "citizen_id": self.citizen_id,
            "citizen_name": self.citizen_name,
            "description": self.description,
            "category": self.category.value if self.category else None,
            "confidence_score": self.confidence_score,
            "sentiment_score": self.sentiment_score,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "address_text": self.address_text,
            "image_url": self.image_url,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "master_ticket_id": self.master_ticket_id
        }
        if self.master_ticket_id and self.master_ticket:
            data["master_ticket_status"] = self.master_ticket.status.value
            
        return data


class MasterTicket(Base):
    """
    Aggregated ticket from spatial clustering of similar reports.
    This is what officials see and work on.
    """
    __tablename__ = "master_tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(20), unique=True, index=True)
    
    # Classification
    category = Column(Enum(TicketCategory), nullable=False)
    sub_category = Column(String(100), nullable=True)
    description = Column(Text, nullable=False)
    
    # Location (centroid of clustered reports)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    cluster_radius = Column(Float, default=30.0)  # meters
    
    # Status & Priority
    status = Column(Enum(TicketStatus), default=TicketStatus.REPORTED)
    priority = Column(Enum(TicketPriority), default=TicketPriority.MEDIUM)
    urgency_score = Column(Float, default=5.0)  # 1-10 calculated score
    
    # SLA Tracking
    sla_hours = Column(Integer, default=48)
    sla_deadline = Column(DateTime(timezone=True), nullable=True)
    sla_breached = Column(Boolean, default=False)
    
    # Assignment
    assigned_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    assigned_worker_id = Column(Integer, ForeignKey("workers.id"), nullable=True)
    
    # Resolution details (worker-side)
    resolution_notes = Column(Text, nullable=True)
    resolution_lat = Column(Float, nullable=True)
    resolution_lon = Column(Float, nullable=True)
    resolution_photo_url = Column(String(500), nullable=True)
    source = Column(String(50), default="web")  # Primary source of the ticket
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Proof of Work
    before_image_url = Column(String(500), nullable=True)
    after_image_url = Column(String(500), nullable=True)
    image_similarity_score = Column(Float, nullable=True)
    verification_status = Column(String(20), default="pending")  # pending, passed, failed
    
    # Analytics
    report_count = Column(Integer, default=1)
    upvote_count = Column(Integer, default=0)
    
    # Relationships
    citizen_reports = relationship("CitizenReport", back_populates="master_ticket")
    assigned_department = relationship("Department", back_populates="tickets")
    assigned_worker = relationship("Worker", back_populates="tickets")
    status_history = relationship("TicketStatusHistory", back_populates="ticket", order_by="desc(TicketStatusHistory.changed_at)")
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.ticket_number:
            self.ticket_number = self._generate_ticket_number()
        self._calculate_sla()
    
    def _generate_ticket_number(self) -> str:
        """Generate unique ticket number: CRM-YYYYMMDD-XXXX"""
        from datetime import datetime
        date_str = datetime.now().strftime("%Y%m%d")
        import random
        random_num = random.randint(1000, 9999)
        return f"CRM-{date_str}-{random_num}"
    
    def _calculate_sla(self):
        """Calculate SLA deadline based on priority."""
        from app.core.config import settings
        
        sla_map = {
            TicketPriority.LOW: settings.SLA_LOW_PRIORITY,
            TicketPriority.MEDIUM: settings.SLA_MEDIUM_PRIORITY,
            TicketPriority.HIGH: settings.SLA_HIGH_PRIORITY,
            TicketPriority.CRITICAL: settings.SLA_CRITICAL_PRIORITY
        }
        
        self.sla_hours = sla_map.get(self.priority, 48)
        if self.created_at:
            self.sla_deadline = self.created_at + timedelta(hours=self.sla_hours)
        else:
            self.sla_deadline = datetime.now() + timedelta(hours=self.sla_hours)
    
    def check_sla_breach(self) -> bool:
        """Check if SLA has been breached."""
        if self.sla_deadline and datetime.now() > self.sla_deadline:
            if self.status not in [TicketStatus.RESOLVED, TicketStatus.VERIFIED, TicketStatus.CLOSED]:
                self.sla_breached = True
                return True
        return False
    
    def get_time_remaining(self) -> Optional[timedelta]:
        """Get remaining time before SLA breach."""
        if self.sla_deadline:
            remaining = self.sla_deadline - datetime.now()
            return remaining if remaining.total_seconds() > 0 else timedelta(0)
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        time_remaining = self.get_time_remaining()
        return {
            "id": self.id,
            "ticket_number": self.ticket_number,
            "category": self.category.value if self.category else None,
            "sub_category": self.sub_category,
            "description": self.description,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "cluster_radius": self.cluster_radius,
            "status": self.status.value if self.status else None,
            "priority": self.priority.value if self.priority else None,
            "urgency_score": self.urgency_score,
            "sla_hours": self.sla_hours,
            "sla_deadline": self.sla_deadline.isoformat() if self.sla_deadline else None,
            "sla_breached": self.sla_breached,
            "time_remaining_hours": time_remaining.total_seconds() / 3600 if time_remaining else 0,
            "assigned_department": self.assigned_department.name if self.assigned_department else None,
            "assigned_worker": self.assigned_worker.name if self.assigned_worker else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "report_count": self.report_count,
            "upvote_count": self.upvote_count,
            "before_image_url": self.before_image_url,
            "after_image_url": self.after_image_url,
            "verification_status": self.verification_status,
            "source": self.source
        }


class TicketStatusHistory(Base):
    """Audit trail of all status changes."""
    __tablename__ = "ticket_status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("master_tickets.id"), nullable=False)
    from_status = Column(Enum(TicketStatus), nullable=True)
    to_status = Column(Enum(TicketStatus), nullable=False)
    changed_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    ticket = relationship("MasterTicket", back_populates="status_history")


class Department(Base):
    """Government departments handling specific issue types."""
    __tablename__ = "departments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    category = Column(Enum(TicketCategory), nullable=False)
    
    # Gamification metrics
    total_tickets_resolved = Column(Integer, default=0)
    avg_resolution_time_hours = Column(Float, nullable=True)
    satisfaction_score = Column(Float, default=5.0)
    efficiency_score = Column(Float, default=0.0)
    trust_badge_count = Column(Integer, default=0)
    
    # Relationships
    tickets = relationship("MasterTicket", back_populates="assigned_department")
    workers = relationship("Worker", back_populates="department")
    
    def calculate_efficiency(self):
        """Calculate department efficiency score."""
        if self.total_tickets_resolved > 0:
            # Weighted score: resolution speed (40%), satisfaction (40%), volume (20%)
            speed_score = max(0, 100 - (self.avg_resolution_time_hours or 48)) / 100 * 40
            satisfaction = (self.satisfaction_score or 5) / 10 * 40
            volume = min(self.total_tickets_resolved / 100, 1) * 20
            self.efficiency_score = speed_score + satisfaction + volume
        return self.efficiency_score
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for leaderboard."""
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "category": self.category.value if self.category else None,
            "total_tickets_resolved": self.total_tickets_resolved,
            "avg_resolution_time_hours": self.avg_resolution_time_hours,
            "satisfaction_score": self.satisfaction_score,
            "efficiency_score": round(self.efficiency_score, 2),
            "trust_badge_count": self.trust_badge_count
        }


class Worker(Base):
    """Field workers assigned to resolve tickets."""
    __tablename__ = "workers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    employee_id = Column(String(50), unique=True, nullable=False)
    
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    department = relationship("Department", back_populates="workers")
    
    # Link to User
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    user = relationship("User", back_populates="worker_profile")
    
    # Performance
    tickets_completed = Column(Integer, default=0)
    rating = Column(Float, default=5.0)
    is_active = Column(Boolean, default=True)
    current_location_lat = Column(Float, nullable=True)
    current_location_lng = Column(Float, nullable=True)
    
    tickets = relationship("MasterTicket", back_populates="assigned_worker")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "employee_id": self.employee_id,
            "department": self.department.name if self.department else None,
            "tickets_completed": self.tickets_completed,
            "rating": self.rating,
            "is_active": self.is_active,
            "current_location": [self.current_location_lat, self.current_location_lng] if self.current_location_lat else None
        }


class RedZone(Base):
    """
    Predictive maintenance zones where assets fail repeatedly.
    Used for proactive infrastructure replacement.
    """
    __tablename__ = "red_zones"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_meters = Column(Float, default=100)
    
    # Analysis
    category = Column(Enum(TicketCategory), nullable=False)
    failure_count_30d = Column(Integer, default=0)
    failure_count_90d = Column(Integer, default=0)
    last_failure_at = Column(DateTime(timezone=True), nullable=True)
    
    # Risk assessment
    risk_level = Column(String(20), default="medium")  # low, medium, high, critical
    recommended_action = Column(Text, nullable=True)
    
    # Asset info
    asset_type = Column(String(100), nullable=True)
    asset_id = Column(String(100), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Proactive Analysis
    predicted_failure_at = Column(DateTime(timezone=True), nullable=True)
    proactive_maintenance_deadline = Column(DateTime(timezone=True), nullable=True)
    improvement_suggestion = Column(Text, nullable=True)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "radius_meters": self.radius_meters,
            "category": self.category.value if self.category else None,
            "failure_count_30d": self.failure_count_30d,
            "failure_count_90d": self.failure_count_90d,
            "risk_level": self.risk_level,
            "recommended_action": self.recommended_action,
            "asset_type": self.asset_type,
            "last_failure_at": self.last_failure_at.isoformat() if self.last_failure_at else None,
            "predicted_failure_at": self.predicted_failure_at.isoformat() if self.predicted_failure_at else None,
            "proactive_maintenance_deadline": self.proactive_maintenance_deadline.isoformat() if self.proactive_maintenance_deadline else None,
            "improvement_suggestion": self.improvement_suggestion
        }


class CitizenTrustScore(Base):
    """Gamification: Track citizen trust scores for quality reporting."""
    __tablename__ = "citizen_trust_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    citizen_id = Column(String(50), unique=True, nullable=False)
    
    # Scoring
    total_reports = Column(Integer, default=0)
    verified_reports = Column(Integer, default=0)
    trust_score = Column(Integer, default=50)  # 0-100
    badge_level = Column(String(20), default="bronze")  # bronze, silver, gold, platinum
    
    # Benefits
    priority_boost = Column(Boolean, default=False)
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def update_badge(self):
        """Update badge level based on trust score."""
        if self.trust_score >= 90:
            self.badge_level = "platinum"
            self.priority_boost = True
        elif self.trust_score >= 75:
            self.badge_level = "gold"
            self.priority_boost = True
        elif self.trust_score >= 60:
            self.badge_level = "silver"
        else:
            self.badge_level = "bronze"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "citizen_id": self.citizen_id,
            "trust_score": self.trust_score,
            "badge_level": self.badge_level,
            "total_reports": self.total_reports,
            "verified_reports": self.verified_reports,
            "priority_boost": self.priority_boost
        }
