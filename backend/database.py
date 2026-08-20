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


def run_auto_migrations(target_engine=None):
    """Ensure all required columns exist in SQLite and PostgreSQL tables without breaking existing data."""
    eng = target_engine or engine
    from sqlalchemy import inspect, text
    import logging
    mig_logger = logging.getLogger("migration")
    try:
        inspector = inspect(eng)
        existing_tables = set(inspector.get_table_names())
        is_sqlite = eng.url.drivername.startswith("sqlite")

        columns_to_migrate = [
            ("users", "terms_accepted", "BOOLEAN", "BOOLEAN", "DEFAULT FALSE"),
            ("users", "is_active", "BOOLEAN", "BOOLEAN", "DEFAULT TRUE"),
            ("users", "block_reason", "VARCHAR(255)", "VARCHAR(255)", None),
            ("users", "profile_pic_url", "TEXT", "TEXT", None),
            ("users", "reset_password_token", "VARCHAR(255)", "VARCHAR(255)", None),
            ("users", "reset_password_sent_at", "TIMESTAMP WITH TIME ZONE", "DATETIME", None),
            ("devices", "local_ip", "VARCHAR(64)", "VARCHAR(64)", None),
            ("devices", "activated_at", "TIMESTAMP WITH TIME ZONE", "DATETIME", "DEFAULT CURRENT_TIMESTAMP"),
            ("devices", "warranty_status", "VARCHAR(32)", "VARCHAR(32)", "DEFAULT 'ACTIVE'"),
            ("devices", "total_toggle_count", "INTEGER", "INTEGER", "DEFAULT 0"),
            ("devices", "total_on_duration_seconds", "INTEGER", "INTEGER", "DEFAULT 0"),
            ("devices", "crash_count", "INTEGER", "INTEGER", "DEFAULT 0"),
            ("devices", "boot_count", "INTEGER", "INTEGER", "DEFAULT 0"),
        ]

        for table, col, pg_type, sqlite_type, default in columns_to_migrate:
            if table in existing_tables:
                current_cols = {c["name"] for c in inspector.get_columns(table)}
                if col not in current_cols:
                    dtype = sqlite_type if is_sqlite else pg_type
                    if is_sqlite:
                        if default and "CURRENT_TIMESTAMP" in default:
                            cmd = f"ALTER TABLE {table} ADD COLUMN {col} {dtype} DEFAULT (datetime('now'))"
                        elif default:
                            cmd = f"ALTER TABLE {table} ADD COLUMN {col} {dtype} {default}"
                        else:
                            cmd = f"ALTER TABLE {table} ADD COLUMN {col} {dtype}"
                    else:
                        cmd = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {dtype}"
                        if default:
                            cmd += f" {default}"
                    try:
                        with eng.begin() as conn:
                            conn.execute(text(cmd))
                        mig_logger.info("Auto-migration: Added %s.%s successfully.", table, col)
                    except Exception as col_err:
                        mig_logger.warning("Auto-migration notice on %s.%s: %s", table, col, col_err)
                        # Fallback without default if SQLite rejected non-constant default
                        if is_sqlite:
                            try:
                                with eng.begin() as conn:
                                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {dtype}"))
                            except Exception:
                                pass
    except Exception as mig_err:
        mig_logger.error("Auto-migration error: %s", mig_err)

# Run auto-migrations on load
try:
    run_auto_migrations(engine)
except Exception:
    pass

# FastAPI dependency to obtain a database session per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

