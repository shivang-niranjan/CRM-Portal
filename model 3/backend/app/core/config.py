"""
Smart PS-CRM Configuration
Centralized settings management for the Smart Public Service CRM system.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application
    APP_NAME: str = "Smart PS-CRM"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "sqlite:///./smart_ps_crm.db"
    # For PostgreSQL with PostGIS: "postgresql://user:pass@localhost/smart_crm"
    
    # AI/NLP Settings
    SENTENCE_TRANSFORMER_MODEL: str = "all-MiniLM-L6-v2"
    CLASSIFICATION_CATEGORIES: List[str] = [
        "Electricity",
        "Water", 
        "Roads",
        "Sanitation"
    ]
    
    # Spatial Clustering
    CLUSTER_RADIUS_METERS: float = 30.0  # 30-meter radius for clustering
    MIN_CLUSTER_SIZE: int = 2  # Minimum reports to form a master ticket
    
    # SLA Settings (in hours)
    SLA_LOW_PRIORITY: int = 72
    SLA_MEDIUM_PRIORITY: int = 48
    SLA_HIGH_PRIORITY: int = 24
    SLA_CRITICAL_PRIORITY: int = 12
    
    # Image Similarity
    IMAGE_SIMILARITY_THRESHOLD: float = 0.75  # 75% similarity required
    
    # Auth Settings
    SECRET_KEY: str = "super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Gamification
    LEADERBOARD_UPDATE_INTERVAL: int = 300  # 5 minutes
    
    # CORS - Allow all origins in development, restrict in production
    CORS_ORIGINS: List[str] = ["*"]  # Remove in production and use specific origins
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
