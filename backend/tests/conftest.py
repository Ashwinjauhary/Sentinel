import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from database import Base, get_db
from models import App, Incident, DetectionRule
from main import fastapi_app

# Use a file-based SQLite database for testing to avoid StaticPool memory issues
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_sentinel.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

fastapi_app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="function")
def db_session():
    # Drop then re-create to ensure clean state (handles crashed previous runs)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    yield db
    
    # Cleanup after the test
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    return TestClient(fastapi_app)

@pytest.fixture(scope="function")
def test_app(db_session):
    # Seed a test app with a unique api_key to avoid UNIQUE constraint issues
    app_id = str(uuid.uuid4())
    api_key = f"test_api_key_{uuid.uuid4().hex[:8]}"
    test_app = App(
        id=app_id,
        name="Test App",
        api_key=api_key,
        threshold=40
    )
    db_session.add(test_app)
    db_session.commit()
    db_session.refresh(test_app)
    return test_app

