from datetime import date
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sonnenlicht import growth
from sonnenlicht.age import age_in_days, weeks_and_days
from sonnenlicht.auth import create_token, decode_token, hash_password, verify_password
from sonnenlicht.database import Child, SessionLocal, User, WeightEntry, create_tables
from sonnenlicht.sleep import bracket_for_week, load_sleep_table

create_tables()

SLEEP_TABLE = load_sleep_table()
LMS = {"m": growth.load_lms("m"), "f": growth.load_lms("f")}

app = FastAPI(title="Sonnenlicht")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_bearer = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(401, "Not authenticated")
    user_id = decode_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(401, "Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(401, "User not found")
    return user


# --- Request bodies ---

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class CreateChildRequest(BaseModel):
    name: str
    birth_date: date
    sex: str

class UpdateChildRequest(BaseModel):
    name: str | None = None
    birth_date: date | None = None
    sex: str | None = None

class AddWeightRequest(BaseModel):
    measured_on: date
    weight_grams: int


# --- Helpers ---

def _child_dict(child: Child) -> dict:
    return {
        "id": child.id,
        "name": child.name,
        "birth_date": child.birth_date.isoformat(),
        "sex": child.sex,
    }


def _entry_dict(entry: WeightEntry, child: Child) -> dict:
    days = age_in_days(child.birth_date, entry.measured_on)
    assessment = growth.assess_weight(LMS[child.sex], days, entry.weight_grams)
    return {
        "id": entry.id,
        "measured_on": entry.measured_on.isoformat(),
        "weight_grams": entry.weight_grams,
        "age_days": days,
        "age_weeks": round(days / 7, 2),
        "z": assessment["z"] if assessment else None,
        "percentile": assessment["percentile"] if assessment else None,
    }


def _get_child(child_id: int, user: User, db: Session) -> Child:
    child = db.query(Child).filter(Child.id == child_id, Child.user_id == user.id).first()
    if child is None:
        raise HTTPException(404, "Child not found")
    return child


def _validate_child_fields(birth_date: date | None, sex: str | None, name: str | None):
    if sex is not None and sex not in ("m", "f"):
        raise HTTPException(422, "Sex must be 'm' or 'f'")
    if birth_date is not None and birth_date > date.today():
        raise HTTPException(422, "Birth date cannot be in the future")
    if name is not None and not name.strip():
        raise HTTPException(422, "Name must not be empty")


# --- Auth endpoints (no authentication required) ---

@app.post("/api/auth/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    username = req.username.strip().lower()
    email = req.email.strip().lower()
    if len(username) < 3:
        raise HTTPException(422, "Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(422, "Password must be at least 6 characters")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(409, "Username already taken")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Email already registered")
    user = User(username=username, email=email, hashed_password=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_token(user.id), "token_type": "bearer"}


@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    username = req.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(req.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": create_token(user.id), "token_type": "bearer"}


# --- Children ---

@app.get("/api/children")
def list_children(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    children = db.query(Child).filter(Child.user_id == current_user.id).order_by(Child.id).all()
    return [_child_dict(c) for c in children]


@app.post("/api/children", status_code=201)
def create_child(
    req: CreateChildRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_child_fields(req.birth_date, req.sex, req.name)
    child = Child(
        user_id=current_user.id, name=req.name.strip(), birth_date=req.birth_date, sex=req.sex
    )
    db.add(child)
    db.commit()
    db.refresh(child)
    return _child_dict(child)


@app.patch("/api/children/{child_id}")
def update_child(
    child_id: int,
    req: UpdateChildRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = _get_child(child_id, current_user, db)
    _validate_child_fields(req.birth_date, req.sex, req.name)
    if req.name is not None:
        child.name = req.name.strip()
    if req.birth_date is not None:
        child.birth_date = req.birth_date
    if req.sex is not None:
        child.sex = req.sex
    db.commit()
    db.refresh(child)
    return _child_dict(child)


# --- Sleep phases ---

@app.get("/api/sleep-phases")
def sleep_phases(current_user: User = Depends(get_current_user)):
    return SLEEP_TABLE


# --- Overview ---

@app.get("/api/children/{child_id}/overview")
def overview(
    child_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = _get_child(child_id, current_user, db)
    total_days = age_in_days(child.birth_date, date.today())
    weeks, days = weeks_and_days(total_days)

    entries = child.weight_entries
    weight = None
    if entries:
        latest = entries[-1]
        weight = {"latest": _entry_dict(latest, child), "delta": None}
        if len(entries) > 1:
            previous = entries[-2]
            weight["delta"] = {
                "grams": latest.weight_grams - previous.weight_grams,
                "days": (latest.measured_on - previous.measured_on).days,
            }

    return {
        "child": _child_dict(child),
        "age": {"total_days": total_days, "weeks": weeks, "days": days},
        "sleep": bracket_for_week(SLEEP_TABLE, weeks),
        "weight": weight,
    }


# --- Weight entries ---

@app.get("/api/children/{child_id}/weights")
def list_weights(
    child_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = _get_child(child_id, current_user, db)
    return [_entry_dict(e, child) for e in child.weight_entries]


@app.post("/api/children/{child_id}/weights", status_code=201)
def add_weight(
    child_id: int,
    req: AddWeightRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = _get_child(child_id, current_user, db)
    if req.measured_on < child.birth_date:
        raise HTTPException(422, "Measurement date is before the birth date")
    if req.measured_on > date.today():
        raise HTTPException(422, "Measurement date cannot be in the future")
    if not 300 <= req.weight_grams <= 40000:
        raise HTTPException(422, "Weight must be between 300 g and 40000 g")

    entry = (
        db.query(WeightEntry)
        .filter(WeightEntry.child_id == child.id, WeightEntry.measured_on == req.measured_on)
        .first()
    )
    if entry is None:
        entry = WeightEntry(
            child_id=child.id, measured_on=req.measured_on, weight_grams=req.weight_grams
        )
        db.add(entry)
    else:
        entry.weight_grams = req.weight_grams
    db.commit()
    db.refresh(entry)
    return _entry_dict(entry, child)


@app.delete("/api/weights/{entry_id}")
def delete_weight(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(WeightEntry)
        .join(Child)
        .filter(WeightEntry.id == entry_id, Child.user_id == current_user.id)
        .first()
    )
    if entry is None:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


# --- Growth curve ---

@app.get("/api/children/{child_id}/growth-curve")
def growth_curve(
    child_id: int,
    to_week: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = _get_child(child_id, current_user, db)
    if to_week is None:
        current_week = age_in_days(child.birth_date, date.today()) // 7
        last_entry_week = 0
        if child.weight_entries:
            last_entry = child.weight_entries[-1]
            last_entry_week = age_in_days(child.birth_date, last_entry.measured_on) // 7
        to_week = max(current_week, last_entry_week, 8) + 4
    return growth.curve_points(LMS[child.sex], to_week)


# Serve built frontend (production)
_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
