import os
from pathlib import Path

from sqlalchemy import (
    Column,
    Date,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./data/sonnenlicht.db")

# Render's PostgreSQL add-on uses the deprecated postgres:// scheme
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Ensure the data directory exists for SQLite
if DATABASE_URL.startswith("sqlite:///"):
    _db_file = DATABASE_URL[len("sqlite:///"):]
    Path(_db_file).parent.mkdir(parents=True, exist_ok=True)

_connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    children = relationship("Child", back_populates="user", cascade="all, delete-orphan")


class Child(Base):
    __tablename__ = "children"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    birth_date = Column(Date, nullable=False)
    sex = Column(String(1), nullable=False)  # 'm' | 'f'
    user = relationship("User", back_populates="children")
    weight_entries = relationship(
        "WeightEntry",
        back_populates="child",
        cascade="all, delete-orphan",
        order_by="WeightEntry.measured_on",
    )


class WeightEntry(Base):
    __tablename__ = "weight_entries"
    __table_args__ = (UniqueConstraint("child_id", "measured_on"),)
    id = Column(Integer, primary_key=True)
    child_id = Column(Integer, ForeignKey("children.id"), nullable=False, index=True)
    measured_on = Column(Date, nullable=False)
    weight_grams = Column(Integer, nullable=False)
    child = relationship("Child", back_populates="weight_entries")


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
