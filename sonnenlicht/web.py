import os
from datetime import date
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sonnenlicht import feeding, growth
from sonnenlicht.age import age_in_days, weeks_and_days
from sonnenlicht.auth import (
    create_link_code,
    create_reset_token,
    create_token,
    decode_link_code,
    decode_reset_token,
    decode_token,
    hash_password,
    verify_password,
)
from sonnenlicht.database import (
    AccountLink,
    Child,
    MilestoneAchievement,
    SessionLocal,
    User,
    WeightEntry,
    create_tables,
)
from sonnenlicht.mailer import send_email
from sonnenlicht.milestones import load_milestones, relevant_for_week
from sonnenlicht.sleep import bracket_for_week, load_sleep_table

create_tables()

SLEEP_TABLE = load_sleep_table()
LMS = {"m": growth.load_lms("m"), "f": growth.load_lms("f")}
MILESTONES = load_milestones()
MILESTONE_KEYS = {row["key"] for row in MILESTONES}
FEEDING_GUIDE = feeding.load_feeding_guide()

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

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class LinkRequest(BaseModel):
    code: str

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

class SetMilestoneRequest(BaseModel):
    achieved_on: date


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


def _milestones_summary(achievements: list[MilestoneAchievement], week: int) -> dict:
    achieved_keys = {a.milestone_key for a in achievements}
    relevant = relevant_for_week(MILESTONES, week)
    return {
        "achieved_count": len(achieved_keys),
        "total_count": len(MILESTONES),
        "relevant_not_achieved": [m for m in relevant if m["key"] not in achieved_keys],
    }


def _find_link(user_id: int, db: Session) -> AccountLink | None:
    return (
        db.query(AccountLink)
        .filter((AccountLink.user_a_id == user_id) | (AccountLink.user_b_id == user_id))
        .first()
    )


def _partner(user: User, db: Session) -> User | None:
    link = _find_link(user.id, db)
    if link is None:
        return None
    partner_id = link.user_b_id if link.user_a_id == user.id else link.user_a_id
    return db.query(User).filter(User.id == partner_id).first()


def _allowed_user_ids(user: User, db: Session) -> list[int]:
    """The user's own id plus the linked partner's, if any — children of
    either account are visible and editable for both."""
    partner = _partner(user, db)
    return [user.id] if partner is None else [user.id, partner.id]


def _get_child(child_id: int, user: User, db: Session) -> Child:
    child = (
        db.query(Child)
        .filter(Child.id == child_id, Child.user_id.in_(_allowed_user_ids(user, db)))
        .first()
    )
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


# Base URL used in reset links. Set explicitly rather than derived from the
# request Host header, which a sender could spoof to poison reset mails.
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:8000").rstrip("/")


@app.post("/api/auth/forgot-password")
def forgot_password(
    req: ForgotPasswordRequest, background: BackgroundTasks, db: Session = Depends(get_db)
):
    email = req.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        token = create_reset_token(user.id, user.hashed_password)
        link = f"{APP_BASE_URL}/?reset={token}"
        body = (
            f"Hallo,\n\n"
            f"für dieses Sonnenlicht-Konto wurde das Zurücksetzen der Zugangsdaten "
            f"angefordert.\n\n"
            f"Dein Benutzername: {user.username}\n\n"
            f"Neues Passwort setzen (Link ist 30 Minuten gültig):\n{link}\n\n"
            f"Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren — "
            f"dein Passwort bleibt unverändert."
        )
        background.add_task(send_email, user.email, "Sonnenlicht — Zugangsdaten zurücksetzen", body)
    # Always the same response, so the endpoint doesn't reveal which
    # email addresses have an account.
    return {"ok": True}


@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(req.new_password) < 6:
        raise HTTPException(422, "Password must be at least 6 characters")
    decoded = decode_reset_token(req.token)
    if decoded is None:
        raise HTTPException(400, "Invalid or expired reset link")
    user_id, pw_suffix = decoded
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.hashed_password.endswith(pw_suffix):
        raise HTTPException(400, "Invalid or expired reset link")
    user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"access_token": create_token(user.id), "token_type": "bearer"}


# --- Account linking ---

@app.get("/api/link")
def get_link(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    partner = _partner(current_user, db)
    if partner is None:
        return {"linked": False, "partner_username": None}
    return {"linked": True, "partner_username": partner.username}


@app.post("/api/link/code")
def new_link_code(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if _find_link(current_user.id, db) is not None:
        raise HTTPException(409, "Account is already linked")
    return {"code": create_link_code(current_user.id)}


@app.post("/api/link")
def link_account(
    req: LinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inviter_id = decode_link_code(req.code.strip())
    if inviter_id is None:
        raise HTTPException(400, "Invalid or expired link code")
    if inviter_id == current_user.id:
        raise HTTPException(422, "Cannot link an account with itself")
    inviter = db.query(User).filter(User.id == inviter_id).first()
    if inviter is None:
        raise HTTPException(400, "Invalid or expired link code")
    if _find_link(current_user.id, db) is not None or _find_link(inviter.id, db) is not None:
        raise HTTPException(409, "One of the accounts is already linked")
    db.add(AccountLink(user_a_id=inviter.id, user_b_id=current_user.id))
    db.commit()
    return {"linked": True, "partner_username": inviter.username}


@app.delete("/api/link")
def unlink_account(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    link = _find_link(current_user.id, db)
    if link is None:
        raise HTTPException(404, "Account is not linked")
    db.delete(link)
    db.commit()
    return {"ok": True}


# --- Children ---

@app.get("/api/children")
def list_children(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    children = (
        db.query(Child)
        .filter(Child.user_id.in_(_allowed_user_ids(current_user, db)))
        .order_by(Child.id)
        .all()
    )
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


# --- Feeding guide ---

@app.get("/api/feeding-guide")
def feeding_guide(current_user: User = Depends(get_current_user)):
    return FEEDING_GUIDE


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
        "feeding": feeding.bracket_for_week(FEEDING_GUIDE, weeks),
        "milestones": _milestones_summary(child.milestone_achievements, weeks),
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
        .filter(
            WeightEntry.id == entry_id,
            Child.user_id.in_(_allowed_user_ids(current_user, db)),
        )
        .first()
    )
    if entry is None:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


# --- Milestones ---

@app.get("/api/milestones")
def milestones_reference(current_user: User = Depends(get_current_user)):
    return MILESTONES


@app.get("/api/children/{child_id}/milestones")
def list_milestone_achievements(
    child_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = _get_child(child_id, current_user, db)
    return [
        {"milestone_key": a.milestone_key, "achieved_on": a.achieved_on.isoformat()}
        for a in child.milestone_achievements
    ]


@app.put("/api/children/{child_id}/milestones/{key}")
def set_milestone_achieved(
    child_id: int,
    key: str,
    req: SetMilestoneRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = _get_child(child_id, current_user, db)
    if key not in MILESTONE_KEYS:
        raise HTTPException(404, "Unknown milestone")
    if req.achieved_on > date.today():
        raise HTTPException(422, "Achievement date cannot be in the future")
    if req.achieved_on < child.birth_date:
        raise HTTPException(422, "Achievement date is before the birth date")

    entry = (
        db.query(MilestoneAchievement)
        .filter(
            MilestoneAchievement.child_id == child.id, MilestoneAchievement.milestone_key == key
        )
        .first()
    )
    if entry is None:
        entry = MilestoneAchievement(child_id=child.id, milestone_key=key, achieved_on=req.achieved_on)
        db.add(entry)
    else:
        entry.achieved_on = req.achieved_on
    db.commit()
    return {"milestone_key": key, "achieved_on": req.achieved_on.isoformat()}


@app.delete("/api/children/{child_id}/milestones/{key}")
def unset_milestone_achieved(
    child_id: int,
    key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    child = _get_child(child_id, current_user, db)
    entry = (
        db.query(MilestoneAchievement)
        .filter(
            MilestoneAchievement.child_id == child.id, MilestoneAchievement.milestone_key == key
        )
        .first()
    )
    if entry is None:
        raise HTTPException(404, "Not marked as achieved")
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
