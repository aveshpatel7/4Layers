import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from dotenv import load_dotenv
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Define database URL, default is read from DATABASE_URL environment variable or sqlite fallback
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smartnest.db")

# Support postgres:// URL format for newer SQLAlchemy versions which expect postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

# Configure the session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()

# FastAPI dependency to obtain a database session per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
