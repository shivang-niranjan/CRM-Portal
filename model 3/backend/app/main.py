"""
Smart PS-CRM - FastAPI Backend
Smart Public Service Customer Relationship Management System
"""

from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import asyncio

from app.core.config import settings
from app.db.base import get_db, init_db, engine
from app.models import ticket as ticket_models
from app.models.schemas import (
    CitizenReportCreate, CitizenReportResponse,
    MasterTicketResponse, TicketUpdate, ResolveTicketRequest, ResolveTicketResponse,
    DashboardStats, KanbanBoard, KanbanColumn,
    MapMarker, HeatmapPoint,
    DepartmentLeaderboardEntry, LeaderboardResponse,
    CitizenLeaderboardEntry, CitizenLeaderboardResponse,
    RedZoneResponse,
    ClassificationResult, SpatialClusterResult,
    StatusEnum,
    VoiceToTextRequest, VoiceToTextResponse
)
from app.services.ai_service import nlp_classifier, image_checker
from app.services.spatial_service import spatial_service, red_zone_service
from app.api import auth_router
from app.core import auth
from app.models.user import UserRole


# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="""
    Smart Public Service CRM API
    
    ## Features
    
    ### Omnichannel Intake
    - Citizen reports via web, mobile, WhatsApp, voice
    - AI-powered auto-classification
    - Sentiment analysis and urgency scoring
    
    ### Spatial Clustering
    - 30-meter radius clustering
    - Master ticket creation
    - Duplicate prevention
    
    ### Command Center
    - Real-time GIS mapping
    - Smart Kanban board with SLA timers
    - Predictive heatmaps (Red Zones)
    
    ### Accountability
    - Corruption-proof proof of work
    - Image similarity verification
    - Department leaderboards
    """,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Register routers
app.include_router(auth_router.router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== LIFECYCLE EVENTS ====================

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    try:
        init_db()
        print(f"Server started")
        print(f"Database: {settings.DATABASE_URL}")
        print(f"AI Model: {settings.SENTENCE_TRANSFORMER_MODEL}")
        print(f"Cluster Radius: {settings.CLUSTER_RADIUS_METERS}m")
    except Exception as e:
        print(f"CRITICAL ERROR IN STARTUP: {e}")
        import traceback
        traceback.print_exc()


# ==================== HEALTH CHECK ====================

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now().isoformat()
    }


# ==================== OMNICHANNEL INTAKE ====================

@app.post("/api/reports", response_model=CitizenReportResponse, tags=["Intake"])
async def create_citizen_report(
    report: CitizenReportCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Create a new citizen report with AI classification and spatial clustering.
    
    This endpoint handles omnichannel intake:
    - Web portal submissions
    - Mobile app reports
    - WhatsApp/Telegram messages
    - Voice-to-text transcriptions
    - Social media monitoring
    
    The system will:
    1. Classify the complaint using NLP
    2. Calculate urgency score
    3. Check for spatial clustering
    4. Link to existing master ticket or create new one
    """
    # Step 1: AI Classification
    classification = nlp_classifier.classify(report.description)
    
    # Step 2: Calculate urgency score
    urgency_score = nlp_classifier.calculate_urgency_score(
        report.description,
        classification
    )
    
    # Step 3: Create citizen report
    db_report = ticket_models.CitizenReport(
        citizen_id=report.citizen_id,
        citizen_phone=report.citizen_phone,
        citizen_name=report.citizen_name,
        description=report.description,
        voice_transcript=report.voice_transcript,
        latitude=report.latitude,
        longitude=report.longitude,
        address_text=report.address_text,
        image_url=report.image_url,
        voice_url=report.voice_url,
        source=report.source,
        category=next((c for c in ticket_models.TicketCategory if c.value.lower() == classification.category.lower()), ticket_models.TicketCategory.ROADS),
        confidence_score=classification.confidence,
        sentiment_score=0.5  # Neutral sentiment as fallback
    )
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    # Step 4: Spatial Clustering (in background)
    cluster_result = spatial_service.cluster_report(db, db_report)
    
    # If not clustered, create new master ticket
    if not cluster_result["clustered"]:
        master_ticket = ticket_models.MasterTicket(
            category=db_report.category,
            description=db_report.description,
            latitude=db_report.latitude,
            longitude=db_report.longitude,
            before_image_url=db_report.image_url,
            urgency_score=urgency_score,
            priority=_urgency_to_priority(urgency_score),
            status=ticket_models.TicketStatus.REPORTED,
            report_count=1
        )
        
        # Assign to department based on category
        department = db.query(ticket_models.Department).filter(
            ticket_models.Department.category == db_report.category
        ).first()
        
        if department:
            master_ticket.assigned_department_id = department.id
        
        db.add(master_ticket)
        db.commit()
        db.refresh(master_ticket)
        
        db_report.master_ticket_id = master_ticket.id
        db.commit()
        
        # Check for red zone
        background_tasks.add_task(
            _check_red_zone,
            db_report.latitude,
            db_report.longitude,
            db_report.category
        )
    
    return db_report.to_dict()


@app.get("/api/my-reports", response_model=List[CitizenReportResponse], tags=["Intake"])
async def get_my_reports(
    citizen_id: str,
    db: Session = Depends(get_db)
):
    """Get all reports submitted by a specific citizen."""
    reports = db.query(ticket_models.CitizenReport).filter(
        ticket_models.CitizenReport.citizen_id == citizen_id
    ).order_by(ticket_models.CitizenReport.created_at.desc()).all()
    
    return [r.to_dict() for r in reports]


def _urgency_to_priority(urgency_score: float) -> ticket_models.TicketPriority:
    """Convert urgency score to priority level."""
    if urgency_score >= 8:
        return ticket_models.TicketPriority.CRITICAL
    elif urgency_score >= 6:
        return ticket_models.TicketPriority.HIGH
    elif urgency_score >= 4:
        return ticket_models.TicketPriority.MEDIUM
    else:
        return ticket_models.TicketPriority.LOW


async def _check_red_zone(latitude: float, longitude: float, category: ticket_models.TicketCategory):
    """Background task to check and update red zones."""
    # This would run in a proper background worker in production
    pass


@app.post("/api/voice/transcribe", response_model=VoiceToTextResponse, tags=["Intake"])
async def transcribe_voice(
    request: VoiceToTextRequest,
    db: Session = Depends(get_db)
):
    """
    Transcribe voice recording to text with regional support and formal translation.
    """
    result = nlp_classifier.transcribe_voice(request.audio_url, request.language)
    
    return VoiceToTextResponse(
        transcript=result["transcript"],
        confidence=result["confidence"],
        language=result["language_detected"],
        extracted_entities={
            "original_transcript": result["original_transcript"],
            "formalized": result["formalized"],
            "location_hints": ["detected from audio"],
        }
    )


# ==================== TICKET MANAGEMENT ====================

@app.get("/api/tickets", response_model=List[MasterTicketResponse], tags=["Tickets"])
async def list_tickets(
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    department_id: Optional[int] = None,
    sla_breached: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    List master tickets with optional filtering.
    
    Query Parameters:
    - **status**: Filter by ticket status
    - **category**: Filter by category (Electricity, Water, Roads, Sanitation)
    - **priority**: Filter by priority level
    - **department_id**: Filter by assigned department
    - **sla_breached**: Filter by SLA breach status
    """
    query = db.query(ticket_models.MasterTicket)
    
    if status:
        query = query.filter(ticket_models.MasterTicket.status == status)
    if category:
        query = query.filter(ticket_models.MasterTicket.category == category)
    if priority:
        query = query.filter(ticket_models.MasterTicket.priority == priority)
    if department_id:
        query = query.filter(ticket_models.MasterTicket.assigned_department_id == department_id)
    if sla_breached is not None:
        query = query.filter(ticket_models.MasterTicket.sla_breached == sla_breached)
    
    tickets = query.order_by(
        ticket_models.MasterTicket.urgency_score.desc()
    ).offset(offset).limit(limit).all()
    
    # Check SLA breaches
    for ticket in tickets:
        ticket.check_sla_breach()
    
    db.commit()
    
    return [t.to_dict() for t in tickets]


@app.get("/api/tickets/{ticket_id}", response_model=MasterTicketResponse, tags=["Tickets"])
async def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific ticket."""
    ticket = db.query(ticket_models.MasterTicket).filter(
        ticket_models.MasterTicket.id == ticket_id
    ).first()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket.check_sla_breach()
    db.commit()
    
    return ticket.to_dict()


@app.get("/api/tickets/{ticket_id}/reports", response_model=List[CitizenReportResponse], tags=["Tickets"])
async def get_ticket_reports(
    ticket_id: int,
    db: Session = Depends(get_db)
):
    """Get all individual citizen reports clustered into this ticket."""
    reports = db.query(ticket_models.CitizenReport).filter(
        ticket_models.CitizenReport.master_ticket_id == ticket_id
    ).all()
    return [report.to_dict() for report in reports]


@app.patch("/api/tickets/{ticket_id}", response_model=MasterTicketResponse, tags=["Tickets"])
async def update_ticket(
    ticket_id: int,
    update: TicketUpdate,
    db: Session = Depends(get_db)
):
    """
    Update ticket status, priority, or assignment.
    
    This endpoint is used by officials to:
    - Assign tickets to departments/workers
    - Update status through the workflow
    - Change priority if needed
    """
    ticket = db.query(ticket_models.MasterTicket).filter(
        ticket_models.MasterTicket.id == ticket_id
    ).first()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Track status change
    old_status = ticket.status
    
    if update.status:
        ticket.status = ticket_models.TicketStatus(update.status.value)
        
        # Update timestamps based on status
        if update.status == StatusEnum.ASSIGNED:
            ticket.assigned_at = datetime.now()
        elif update.status == StatusEnum.IN_PROGRESS:
            ticket.started_at = datetime.now()
        elif update.status == StatusEnum.RESOLVED:
            ticket.resolved_at = datetime.now()
        elif update.status == StatusEnum.CLOSED:
            ticket.closed_at = datetime.now()
    
    if update.priority:
        ticket.priority = ticket_models.TicketPriority(update.priority.value)
        ticket._calculate_sla()
    
    if update.assigned_department_id:
        ticket.assigned_department_id = update.assigned_department_id
    
    if update.assigned_worker_id:
        ticket.assigned_worker_id = update.assigned_worker_id
    
    # Add status history
    if update.status and update.status.value != old_status.value:
        history = ticket_models.TicketStatusHistory(
            ticket_id=ticket.id,
            from_status=old_status,
            to_status=ticket.status,
            notes=update.notes
        )
        db.add(history)
    
    db.commit()
    db.refresh(ticket)
    
    return ticket.to_dict()


@app.post("/api/tickets/{ticket_id}/resolve", response_model=ResolveTicketResponse, tags=["Tickets"])
async def resolve_ticket(
    ticket_id: int,
    request: ResolveTicketRequest,
    db: Session = Depends(get_db)
):
    """
    Resolve a ticket with corruption-proof proof of work.
    
    This endpoint:
    1. Accepts 'after' image URL from field worker
    2. Performs image similarity check with 'before' image
    3. Verifies work was done at the same location
    4. Updates ticket status if verification passes
    """
    ticket = db.query(ticket_models.MasterTicket).filter(
        ticket_models.MasterTicket.id == ticket_id
    ).first()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if not ticket.before_image_url:
        raise HTTPException(
            status_code=400,
            detail="No before image available for comparison"
        )
    
    # Step 1: Geo-fencing check (Worker must be within 100m of the ticket location)
    from app.services.spatial_service import spatial_service
    distance = spatial_service.haversine_distance(
        ticket.latitude, ticket.longitude,
        request.latitude, request.longitude
    )
    
    if distance > 100:
        raise HTTPException(
            status_code=400,
            detail=f"Verification failed: Worker is {round(distance)}m away from the ticket location. You must be on-site (within 100m) to resolve."
        )

    # Perform image similarity check
    similarity_result = await image_checker.check_similarity(
        ticket.before_image_url,
        request.after_image_url
    )
    
    ticket.after_image_url = request.after_image_url
    ticket.resolution_lat = request.latitude
    ticket.resolution_lon = request.longitude
    ticket.image_similarity_score = similarity_result.similarity_score
    
    if similarity_result.passed:
        ticket.verification_status = "passed"
        ticket.status = ticket_models.TicketStatus.RESOLVED
        ticket.resolved_at = datetime.now()
        
        # Update department stats
        if ticket.assigned_department:
            dept = ticket.assigned_department
            dept.total_tickets_resolved += 1
            
            # Calculate resolution time
            if ticket.created_at:
                resolution_time = (datetime.now() - ticket.created_at).total_seconds() / 3600
                if dept.avg_resolution_time_hours:
                    dept.avg_resolution_time_hours = (
                        (dept.avg_resolution_time_hours * (dept.total_tickets_resolved - 1) +
                         resolution_time) / dept.total_tickets_resolved
                    )
                else:
                    dept.avg_resolution_time_hours = resolution_time
            
            dept.calculate_efficiency()
        
        # Update worker stats
        if ticket.assigned_worker:
            ticket.assigned_worker.tickets_completed += 1
        
        db.commit()
        
        return ResolveTicketResponse(
            success=True,
            ticket_id=ticket.id,
            image_similarity_score=similarity_result.similarity_score,
            verification_status="passed",
            message="Ticket resolved successfully. Verification passed."
        )
    else:
        ticket.verification_status = "failed"
        db.commit()
        
        return ResolveTicketResponse(
            success=False,
            ticket_id=ticket.id,
            image_similarity_score=similarity_result.similarity_score,
            verification_status="failed",
            message=f"Verification failed. Similarity score {similarity_result.similarity_score:.2%} below threshold. Please ensure photo is taken at the correct location."
        )


# ==================== COMMAND CENTER DASHBOARD ====================

@app.get("/api/dashboard/stats", response_model=DashboardStats, tags=["Dashboard"])
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user = Depends(auth.role_required([UserRole.ADMIN, UserRole.WORKER]))
):
    """
    Get dashboard statistics for the command center.
    
    Returns:
    - Total active tickets
    - Tickets by status
    - Tickets by category
    - SLA breach count
    - Average resolution time
    - Today's report count
    """
    # Active tickets (not closed/verified)
    active_tickets = db.query(ticket_models.MasterTicket).filter(
        ~ticket_models.MasterTicket.status.in_([
            ticket_models.TicketStatus.CLOSED,
            ticket_models.TicketStatus.VERIFIED
        ])
    ).all()
    
    # Pre-check active tickets for dynamic SLA breaches
    for ticket in active_tickets:
        ticket.check_sla_breach()
    db.commit()
    
    # Tickets by status
    status_counts = {}
    for status in ticket_models.TicketStatus:
        count = db.query(ticket_models.MasterTicket).filter(
            ticket_models.MasterTicket.status == status
        ).count()
        status_counts[status.value] = count
    
    # Tickets by category
    category_counts = {}
    for cat in ticket_models.TicketCategory:
        count = db.query(ticket_models.MasterTicket).filter(
            ticket_models.MasterTicket.category == cat
        ).count()
        category_counts[cat.value] = count
    
    # SLA breaches
    sla_breaches = db.query(ticket_models.MasterTicket).filter(
        ticket_models.MasterTicket.sla_breached == True
    ).count()
    
    # Average resolution time
    resolved_tickets = db.query(ticket_models.MasterTicket).filter(
        ticket_models.MasterTicket.resolved_at.isnot(None)
    ).all()
    
    avg_resolution = 0
    if resolved_tickets:
        valid_tickets = [t for t in resolved_tickets if t.created_at and t.resolved_at]
        if valid_tickets:
            total_hours = sum([
                max(0, (t.resolved_at - t.created_at).total_seconds() / 3600)
                for t in valid_tickets
            ])
            avg_resolution = total_hours / len(valid_tickets)
    
    # Today's reports
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_reports = db.query(ticket_models.CitizenReport).filter(
        ticket_models.CitizenReport.created_at >= today
    ).count()
    
    return DashboardStats(
        total_active_tickets=len(active_tickets),
        tickets_by_status=status_counts,
        tickets_by_category=category_counts,
        sla_breach_count=sla_breaches,
        avg_resolution_time=round(avg_resolution, 2),
        today_reports=today_reports
    )


@app.get("/api/dashboard/kanban", response_model=KanbanBoard, tags=["Dashboard"])
async def get_kanban_board(db: Session = Depends(get_db)):
    """
    Get smart Kanban board with SLA timers.
    
    Returns tickets organized by status columns with real-time SLA information.
    Tickets are color-coded based on urgency and SLA status.
    """
    columns = [
        ("reported", "Reported"),
        ("clustered", "Clustered"),
        ("assigned", "Assigned"),
        ("in_progress", "In Progress"),
        ("on_site", "On Site"),
        ("resolved", "Resolved")
    ]
    
    kanban_columns = []
    
    for status_id, title in columns:
        tickets = db.query(ticket_models.MasterTicket).filter(
            ticket_models.MasterTicket.status == status_id
        ).order_by(
            ticket_models.MasterTicket.urgency_score.desc()
        ).all()
        
        # Check SLA for each ticket
        for ticket in tickets:
            ticket.check_sla_breach()
        
        db.commit()
        
        kanban_columns.append(KanbanColumn(
            id=status_id,
            title=title,
            tickets=[t.to_dict() for t in tickets],
            count=len(tickets)
        ))
    
    return KanbanBoard(
        columns=kanban_columns,
        last_updated=datetime.now().isoformat()
    )


# ==================== MAP & GEOSPATIAL ====================

@app.get("/api/map/markers", response_model=List[MapMarker], tags=["Maps"])
async def get_map_markers(
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get map markers for live GIS display.
    
    Returns all active tickets as map markers with clustering information.
    """
    query = db.query(ticket_models.MasterTicket).filter(
        ~ticket_models.MasterTicket.status.in_([
            ticket_models.TicketStatus.CLOSED,
            ticket_models.TicketStatus.VERIFIED
        ])
    )
    
    if category:
        query = query.filter(ticket_models.MasterTicket.category == category)
    if status:
        query = query.filter(ticket_models.MasterTicket.status == status)
    
    tickets = query.all()
    
    markers = []
    for ticket in tickets:
        markers.append(MapMarker(
            id=ticket.id,
            ticket_number=ticket.ticket_number,
            latitude=ticket.latitude,
            longitude=ticket.longitude,
            category=ticket.category.value if ticket.category else "Unknown",
            status=ticket.status.value if ticket.status else "Unknown",
            priority=ticket.priority.value if ticket.priority else "Unknown",
            urgency_score=ticket.urgency_score,
            cluster_radius=ticket.cluster_radius,
            report_count=ticket.report_count
        ))
    
    return markers


@app.get("/api/map/heatmap", response_model=List[HeatmapPoint], tags=["Maps"])
async def get_heatmap_data(
    category: Optional[str] = None,
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db)
):
    """
    Get predictive heatmap data showing 'Red Zones'.
    
    Returns intensity-weighted points for heatmap visualization
    based on failure frequency in different areas.
    """
    from_date = datetime.now() - timedelta(days=days)
    
    query = db.query(ticket_models.MasterTicket).filter(
        ticket_models.MasterTicket.created_at >= from_date
    )
    
    if category:
        query = query.filter(ticket_models.MasterTicket.category == category)
    
    tickets = query.all()
    
    # Group by location (rounded to 3 decimal places ~100m)
    location_groups = {}
    for ticket in tickets:
        key = (round(ticket.latitude, 3), round(ticket.longitude, 3))
        if key not in location_groups:
            location_groups[key] = []
        location_groups[key].append(ticket)
    
    heatmap_points = []
    for (lat, lon), tickets_in_area in location_groups.items():
        # Calculate intensity based on failure count and recency
        failure_count = len(tickets_in_area)
        
        # Weight by urgency scores
        avg_urgency = sum(t.urgency_score for t in tickets_in_area) / failure_count
        
        # Normalize intensity (0-1)
        intensity = min(failure_count / 10, 1.0) * (avg_urgency / 10)
        
        # Determine category (most common)
        categories = [t.category.value for t in tickets_in_area]
        dominant_category = max(set(categories), key=categories.count)
        
        # Determine risk level
        if failure_count >= 5:
            risk_level = "critical"
        elif failure_count >= 3:
            risk_level = "high"
        elif failure_count >= 2:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        heatmap_points.append(HeatmapPoint(
            latitude=lat,
            longitude=lon,
            intensity=round(intensity, 2),
            category=dominant_category,
            risk_level=risk_level
        ))
    
    # Sort by intensity (highest first)
    heatmap_points.sort(key=lambda x: x.intensity, reverse=True)
    
    return heatmap_points


# ==================== RED ZONES (PREDICTIVE MAINTENANCE) ====================

@app.get("/api/red-zones", response_model=List[RedZoneResponse], tags=["Red Zones"])
async def get_red_zones(
    category: Optional[str] = None,
    min_risk: str = Query("medium", regex="^(low|medium|high|critical)$"),
    db: Session = Depends(get_db)
):
    """
    Get Red Zones for predictive maintenance.
    
    Red Zones are areas where infrastructure fails repeatedly,
    indicating need for replacement rather than repair.
    """
    cat_enum = None
    if category:
        cat_enum = ticket_models.TicketCategory(category)
    
    zones = red_zone_service.get_red_zones(db, cat_enum, min_risk)
    
    return [z.to_dict() for z in zones]


@app.post("/api/red-zones/analyze", response_model=RedZoneResponse, tags=["Red Zones"])
async def analyze_location(
    latitude: float,
    longitude: float,
    category: str,
    db: Session = Depends(get_db)
):
    """
    Analyze a specific location for red zone classification.
    
    This triggers analysis of failure history in the area and
    creates/updates a red zone record.
    """
    cat_enum = ticket_models.TicketCategory(category)
    
    red_zone = red_zone_service.update_or_create_red_zone(
        db, latitude, longitude, cat_enum
    )
    
    return red_zone.to_dict()


# ==================== LEADERBOARD (GAMIFICATION) ====================

@app.get("/api/leaderboard", response_model=LeaderboardResponse, tags=["Leaderboard"])
async def get_department_leaderboard(db: Session = Depends(get_db)):
    """
    Get department leaderboard for gamified accountability.
    
    Ranks government departments by:
    - Resolution speed (40%)
    - Citizen satisfaction (40%)
    - Ticket volume handled (20%)
    
    Returns ranked list with efficiency scores and trends.
    """
    departments = db.query(ticket_models.Department).all()
    
    # Calculate efficiency scores
    for dept in departments:
        dept.calculate_efficiency()
    
    db.commit()
    
    # Sort by efficiency score
    sorted_depts = sorted(
        departments,
        key=lambda d: d.efficiency_score,
        reverse=True
    )
    
    # Build leaderboard entries
    entries = []
    for i, dept in enumerate(sorted_depts, 1):
        # Determine trend (would be based on historical data in production)
        trend = "stable"
        if dept.efficiency_score > 70:
            trend = "up"
        elif dept.efficiency_score < 40:
            trend = "down"
        
        entries.append(DepartmentLeaderboardEntry(
            rank=i,
            department_id=dept.id,
            name=dept.name,
            code=dept.code,
            category=dept.category.value if dept.category else "Unknown",
            total_tickets_resolved=dept.total_tickets_resolved,
            avg_resolution_time_hours=dept.avg_resolution_time_hours,
            satisfaction_score=dept.satisfaction_score,
            efficiency_score=round(dept.efficiency_score, 2),
            trust_badge_count=dept.trust_badge_count,
            trend=trend
        ))
    
    # Today's tickets
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = db.query(ticket_models.MasterTicket).filter(
        ticket_models.MasterTicket.created_at >= today
    ).count()
    
    return LeaderboardResponse(
        departments=entries,
        last_updated=datetime.now().isoformat(),
        total_tickets_today=today_count
    )


@app.get("/api/leaderboard/citizens", response_model=CitizenLeaderboardResponse, tags=["Analytics"])
def get_citizen_leaderboard(db: Session = Depends(get_db)):
    """Get the public leaderboard of top contributing citizens."""
    
    # Simple aggregation from CitizenReports
    from sqlalchemy import func
    
    reports_by_citizen = db.query(
        ticket_models.CitizenReport.citizen_name,
        func.count(ticket_models.CitizenReport.id).label('report_count')
    ).filter(
        ticket_models.CitizenReport.citizen_name.isnot(None)
    ).group_by(
        ticket_models.CitizenReport.citizen_name
    ).order_by(
        func.count(ticket_models.CitizenReport.id).desc()
    ).limit(10).all()
    
    leaderboard = []
    
    for idx, row in enumerate(reports_by_citizen):
        score = row.report_count * 10
        
        if score >= 300:
            badge = "Diamond"
        elif score >= 150:
            badge = "Gold"
        elif score >= 50:
            badge = "Silver"
        else:
            badge = "Bronze"
            
        leaderboard.append({
            "rank": idx + 1,
            "citizen_name": row.citizen_name,
            "reports_submitted": row.report_count,
            "total_score": score,
            "badge": badge
        })
        
    return {
        "citizens": leaderboard,
        "last_updated": datetime.now().isoformat()
    }


# ==================== UTILITY ENDPOINTS ====================

@app.get("/api/classify", response_model=ClassificationResult, tags=["AI"])
async def classify_text(text: str):
    """
    Test endpoint for AI classification.
    
    Returns classification result for any input text.
    Useful for testing the NLP model.
    """
    return nlp_classifier.classify(text)


@app.get("/api/categories", tags=["Utility"])
async def get_categories():
    """Get all ticket categories."""
    return {
        "categories": [
            {"id": cat.value, "name": cat.value, "keywords": keywords}
            for cat, keywords in nlp_classifier.CATEGORY_KEYWORDS.items()
        ]
    }


@app.get("/api/departments", tags=["Utility"])
async def get_departments(db: Session = Depends(get_db)):
    """Get all departments."""
    departments = db.query(ticket_models.Department).all()
    return [d.to_dict() for d in departments]


# ==================== ERROR HANDLERS ====================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc),
            "timestamp": datetime.now().isoformat()
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
