import os
from pathlib import Path

from sqlalchemy import (
    Column,
    Date,
    DateTime,
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
# pool_pre_ping: Neon suspends idle databases; revalidate pooled connections
engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
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
    feeding_entries = relationship(
        "FeedingEntry",
        back_populates="child",
        cascade="all, delete-orphan",
        order_by="FeedingEntry.fed_at",
    )
    milestone_achievements = relationship(
        "MilestoneAchievement",
        back_populates="child",
        cascade="all, delete-orphan",
    )


class AccountLink(Base):
    """Symmetric link between two user accounts (e.g. both parents).

    Linked users see and edit each other's children. One link per user;
    a user may appear in either column, which is enforced in the web layer.
    """
    __tablename__ = "account_links"
    id = Column(Integer, primary_key=True)
    user_a_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    user_b_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)


class WeightEntry(Base):
    __tablename__ = "weight_entries"
    __table_args__ = (UniqueConstraint("child_id", "measured_on"),)
    id = Column(Integer, primary_key=True)
    child_id = Column(Integer, ForeignKey("children.id"), nullable=False, index=True)
    measured_on = Column(Date, nullable=False)
    weight_grams = Column(Integer, nullable=False)
    child = relationship("Child", back_populates="weight_entries")


class FeedingEntry(Base):
    __tablename__ = "feeding_entries"
    id = Column(Integer, primary_key=True)
    child_id = Column(Integer, ForeignKey("children.id"), nullable=False, index=True)
    fed_at = Column(DateTime, nullable=False)
    amount_ml = Column(Integer, nullable=False)
    milk_type = Column(String(20), nullable=False)  # 'breast' | 'formula'
    child = relationship("Child", back_populates="feeding_entries")


class MilestoneAchievement(Base):
    __tablename__ = "milestone_achievements"
    __table_args__ = (UniqueConstraint("child_id", "milestone_key"),)
    id = Column(Integer, primary_key=True)
    child_id = Column(Integer, ForeignKey("children.id"), nullable=False, index=True)
    milestone_key = Column(String(50), nullable=False)
    achieved_on = Column(Date, nullable=False)
    child = relationship("Child", back_populates="milestone_achievements")


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
