import pytest
from datetime import datetime, timedelta
import uuid

from models import App, Incident

@pytest.fixture(scope="function")
def seed_data(db_session):
    # Create two apps
    app1 = App(id=str(uuid.uuid4()), name="App 1", api_key="key1", threshold=40)
    app2 = App(id=str(uuid.uuid4()), name="App 2", api_key="key2", threshold=40)
    db_session.add(app1)
    db_session.add(app2)
    db_session.commit()
    
    # 3 different days
    today = datetime.utcnow()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)
    
    # Seed incidents for App 1 (10 incidents)
    incidents = [
        Incident(app_id=app1.id, message_excerpt="1", risk_score=50, injection_flag=True, jailbreak_flag=False, pii_flag=False, allowed=False, created_at=today),
        Incident(app_id=app1.id, message_excerpt="2", risk_score=60, injection_flag=False, jailbreak_flag=True, pii_flag=False, allowed=False, created_at=today),
        Incident(app_id=app1.id, message_excerpt="3", risk_score=10, injection_flag=False, jailbreak_flag=False, pii_flag=False, allowed=True, created_at=yesterday),
        Incident(app_id=app1.id, message_excerpt="4", risk_score=10, injection_flag=False, jailbreak_flag=False, pii_flag=False, allowed=True, created_at=yesterday),
        Incident(app_id=app1.id, message_excerpt="5", risk_score=100, injection_flag=True, jailbreak_flag=True, pii_flag=True, allowed=False, created_at=yesterday),
        Incident(app_id=app1.id, message_excerpt="6", risk_score=25, injection_flag=False, jailbreak_flag=False, pii_flag=True, allowed=True, created_at=two_days_ago),
        Incident(app_id=app1.id, message_excerpt="7", risk_score=25, injection_flag=False, jailbreak_flag=False, pii_flag=True, allowed=True, created_at=two_days_ago),
        Incident(app_id=app1.id, message_excerpt="8", risk_score=25, injection_flag=False, jailbreak_flag=False, pii_flag=True, allowed=True, created_at=two_days_ago),
        Incident(app_id=app1.id, message_excerpt="9", risk_score=40, injection_flag=True, jailbreak_flag=False, pii_flag=False, allowed=False, created_at=two_days_ago),
        Incident(app_id=app1.id, message_excerpt="10", risk_score=0, injection_flag=False, jailbreak_flag=False, pii_flag=False, allowed=True, created_at=two_days_ago),
    ]
    
    # Seed incidents for App 2 (3 incidents)
    incidents.extend([
        Incident(app_id=app2.id, message_excerpt="A1", risk_score=90, injection_flag=True, jailbreak_flag=True, pii_flag=True, allowed=False, created_at=today),
        Incident(app_id=app2.id, message_excerpt="A2", risk_score=90, injection_flag=True, jailbreak_flag=True, pii_flag=True, allowed=False, created_at=today),
        Incident(app_id=app2.id, message_excerpt="A3", risk_score=90, injection_flag=True, jailbreak_flag=True, pii_flag=True, allowed=False, created_at=today),
    ])
    
    db_session.bulk_save_objects(incidents)
    db_session.commit()
    
    return {"app1": app1.id, "app2": app2.id, "today": today.strftime('%Y-%m-%d'), "yesterday": yesterday.strftime('%Y-%m-%d'), "two_days_ago": two_days_ago.strftime('%Y-%m-%d')}


def test_incidents_pagination(client, seed_data):
    """1. Pagination works correctly"""
    app_id = seed_data["app1"]
    
    res1 = client.get(f"/incidents?app_id={app_id}&limit=4&offset=0")
    assert len(res1.json()["incidents"]) == 4
    assert res1.json()["total"] == 10
    
    res2 = client.get(f"/incidents?app_id={app_id}&limit=4&offset=4")
    assert len(res2.json()["incidents"]) == 4
    
    res3 = client.get(f"/incidents?app_id={app_id}&limit=4&offset=8")
    assert len(res3.json()["incidents"]) == 2


def test_incidents_tenant_isolation(client, seed_data):
    """2. Filtering by app_id only returns that app's incidents, never another app's"""
    app2_id = seed_data["app2"]
    
    res = client.get(f"/incidents?app_id={app2_id}")
    incidents = res.json()["incidents"]
    assert len(incidents) == 3
    for inc in incidents:
        assert inc["app_id"] == str(app2_id)


def test_incidents_empty_set(client):
    """3. Empty result set (new app with no incidents) returns an empty list, not an error"""
    new_app_id = str(uuid.uuid4())
    res = client.get(f"/incidents?app_id={new_app_id}")
    assert res.status_code == 200
    assert res.json()["incidents"] == []
    assert res.json()["total"] == 0


def test_stats_daily_scores(client, seed_data):
    """1. daily_scores aggregation returns correct averages for a seeded set of incidents"""
    app_id = seed_data["app1"]
    res = client.get(f"/stats?app_id={app_id}")
    assert res.status_code == 200
    daily_scores = res.json()["daily_scores"]
    
    assert len(daily_scores) == 3
    
    # Check averages manually calculated from seed data
    # Today: 50, 60 => Avg 55.0
    # Yesterday: 10, 10, 100 => Avg 40.0
    # Two days ago: 25, 25, 25, 40, 0 => Avg 23.0
    
    avg_map = {ds["date"]: ds["avg_score"] for ds in daily_scores}
    assert avg_map[seed_data["today"]] == 55.0
    assert avg_map[seed_data["yesterday"]] == 40.0
    assert avg_map[seed_data["two_days_ago"]] == 23.0


def test_stats_attack_type_counts(client, seed_data):
    """2. attack_type_counts correctly tallies injection vs jailbreak vs pii flags"""
    app_id = seed_data["app1"]
    res = client.get(f"/stats?app_id={app_id}")
    counts = res.json()["attack_type_counts"]
    
    # Injection: #1(T), #5(T), #9(T) -> 3
    # Jailbreak: #2(T), #5(T) -> 2
    # PII: #5(T), #6(T), #7(T), #8(T) -> 4
    assert counts["injection"] == 3
    assert counts["jailbreak"] == 2
    assert counts["pii"] == 4


def test_stats_empty_app(client):
    """3. Requesting stats for a non-existent app_id returns an empty/zeroed response"""
    new_app_id = str(uuid.uuid4())
    res = client.get(f"/stats?app_id={new_app_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["daily_scores"] == []
    assert data["attack_type_counts"]["injection"] == 0
    assert data["attack_type_counts"]["jailbreak"] == 0
    assert data["attack_type_counts"]["pii"] == 0
