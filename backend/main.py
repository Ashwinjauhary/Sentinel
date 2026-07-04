import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
import socketio

from database import engine, Base, get_db
from models import App, Incident, DetectionRule
from detectors.injection import detect_injection, EXAMPLE_RULES
from detectors.pii import detect_pii
from detectors.jailbreak import detect_jailbreak

# Create tables if not exists
Base.metadata.create_all(bind=engine)

# Setup FastAPI and SocketIO
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
fastapi_app = FastAPI(title="Sentinel Core API")
app = socketio.ASGIApp(sio, fastapi_app)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    app_id: str
    message: str
    user_id: Optional[str] = None

def calculate_risk_score(inj_confidence: float, jb_confidence: float, pii_match_count: int) -> int:
    inj_weight = 40
    jb_weight = 35
    pii_weight = 25

    score_calc = (
        (inj_weight * inj_confidence) + 
        (jb_weight * jb_confidence) + 
        (pii_weight * (min(pii_match_count, 3) / 3.0))
    )
    
    return min(100, int(score_calc))

class ThresholdUpdateRequest(BaseModel):
    threshold: int

@sio.on('connect')
async def connect(sid, environ):
    # Retrieve app_id from query string if needed
    # Usually clients would join a room based on app_id
    query_string = environ.get('QUERY_STRING', '')
    if 'app_id=' in query_string:
        app_id = query_string.split('app_id=')[1].split('&')[0]
        if app_id:
            await sio.enter_room(sid, app_id)

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

@fastapi_app.post("/analyze")
async def analyze_message(req: AnalyzeRequest, db: Session = Depends(get_db), auth_header: str = Depends(api_key_header)):
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    api_key = auth_header.split(" ")[1]
    
    target_app = db.query(App).filter(App.id == req.app_id, App.api_key == api_key).first()
    if not target_app:
        raise HTTPException(status_code=401, detail="Invalid App ID or API Key")
    
    app_threshold = target_app.threshold

    # Get rules (using example rules if db is empty)
    db_rules = db.query(DetectionRule).filter(DetectionRule.active == True).all()
    if db_rules:
        rules = [{"pattern": r.pattern, "category": r.category} for r in db_rules]
    else:
        rules = EXAMPLE_RULES

    # 1. Injection
    inj_res = detect_injection(req.message, rules)
    
    # 2. PII
    pii_res = detect_pii(req.message)
    
    # 3. Jailbreak — always run (heuristic fallback is fast when API key is absent)
    jb_res = await detect_jailbreak(req.message)

    risk_score = calculate_risk_score(
        inj_confidence=inj_res["confidence"],
        jb_confidence=jb_res["confidence"],
        pii_match_count=pii_res["match_count"]
    )
    
    allowed = risk_score < app_threshold
    
    reasons = []
    if inj_res["is_injection"]:
        reasons.append(f"Injection match: {inj_res['matched_rule']}")
    if pii_res["is_pii_leak"]:
        reasons.append(f"PII detected: {', '.join(pii_res['matched_types'])}")
    if jb_res["is_jailbreak_attempt"]:
        reasons.append(f"Jailbreak attempt ({jb_res['category']})")

    incident = Incident(
        app_id=target_app.id,
        message_excerpt=req.message[:200] + ("..." if len(req.message) > 200 else ""),
        risk_score=risk_score,
        injection_flag=inj_res["is_injection"],
        jailbreak_flag=jb_res["is_jailbreak_attempt"],
        pii_flag=pii_res["is_pii_leak"],
        reasons=reasons,
        allowed=allowed
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    
    if risk_score >= 40:
        await sio.emit('new_incident', {
            "id": str(incident.id),
            "app_id": str(incident.app_id),
            "message_excerpt": incident.message_excerpt,
            "risk_score": incident.risk_score,
            "reasons": incident.reasons,
            "allowed": incident.allowed,
            "created_at": incident.created_at.isoformat() if incident.created_at else datetime.utcnow().isoformat()
        }, room=str(target_app.id))

    return {
        "allowed": allowed,
        "score": risk_score,
        "reasons": reasons,
        "incident_id": str(incident.id)
    }

@fastapi_app.get("/incidents")
def get_incidents(app_id: str, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    try:
        app_id_uuid = str(uuid.UUID(app_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid app_id format")

    query = db.query(Incident).filter(Incident.app_id == app_id_uuid).order_by(Incident.created_at.desc())
    total = query.count()
    incidents = query.offset(offset).limit(limit).all()
    
    return {
        "incidents": [{
            "id": str(i.id),
            "app_id": str(i.app_id),
            "message_excerpt": i.message_excerpt,
            "risk_score": i.risk_score,
            "reasons": i.reasons,
            "allowed": i.allowed,
            "created_at": i.created_at.isoformat() if i.created_at else None
        } for i in incidents],
        "total": total
    }

@fastapi_app.get("/stats")
def get_stats(app_id: str, range: str = "7d", db: Session = Depends(get_db)):
    try:
        app_id_uuid = str(uuid.UUID(app_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid app_id format")

    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Simple Python aggregation for SQLite compatibility if needed
    incidents = db.query(Incident).filter(
        Incident.app_id == app_id_uuid,
        Incident.created_at >= seven_days_ago
    ).all()
    
    daily_scores_map = {}
    attack_counts = {"injection": 0, "jailbreak": 0, "pii": 0}
    
    for i in incidents:
        if i.created_at:
            day_str = i.created_at.strftime('%Y-%m-%d')
            if day_str not in daily_scores_map:
                daily_scores_map[day_str] = {"total": 0, "count": 0}
            daily_scores_map[day_str]["total"] += i.risk_score
            daily_scores_map[day_str]["count"] += 1
            
            if i.injection_flag: attack_counts["injection"] += 1
            if i.jailbreak_flag: attack_counts["jailbreak"] += 1
            if i.pii_flag: attack_counts["pii"] += 1

    daily_scores = []
    for day, data in daily_scores_map.items():
        daily_scores.append({
            "date": day,
            "avg_score": data["total"] / data["count"]
        })
    daily_scores = sorted(daily_scores, key=lambda x: x["date"])

    return {
        "daily_scores": daily_scores,
        "attack_type_counts": attack_counts
    }

@fastapi_app.patch("/apps/{id}/threshold")
def update_threshold(id: str, req: ThresholdUpdateRequest, db: Session = Depends(get_db)):
    target_app = db.query(App).filter(App.id == id).first()
    if not target_app:
        raise HTTPException(status_code=404, detail="App not found")
        
    target_app.threshold = req.threshold
    db.commit()
    
    return {"success": True}
