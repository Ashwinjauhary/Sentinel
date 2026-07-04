import uuid
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from database import Base

class App(Base):
    __tablename__ = "apps"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    api_key = Column(String(255), unique=True, nullable=False)
    threshold = Column(Integer, default=70)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    app_id = Column(String(36), ForeignKey("apps.id"))
    message_excerpt = Column(Text, nullable=False)
    risk_score = Column(Integer, nullable=False)
    injection_flag = Column(Boolean, default=False)
    jailbreak_flag = Column(Boolean, default=False)
    pii_flag = Column(Boolean, default=False)
    reasons = Column(JSON)
    allowed = Column(Boolean, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DetectionRule(Base):
    __tablename__ = "detection_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pattern = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)
    weight = Column(Integer, default=10)
    active = Column(Boolean, default=True)
