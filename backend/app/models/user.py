from app import db
from datetime import datetime
import bcrypt


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum("faculty", "admin"), nullable=False, default="faculty")
    department = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    subjects = db.relationship("Subject", backref="faculty", lazy=True)
    timetable_slots = db.relationship("TimetableSlot", backref="faculty", lazy=True)
    leave_requests = db.relationship("LeaveRequest", backref="faculty", lazy=True)
    extra_lectures = db.relationship("ExtraLecture", backref="faculty", lazy=True)
    reminder_setting = db.relationship("ReminderSetting", backref="faculty", uselist=False)

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, password):
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "department": self.department,
            "phone": self.phone,
            "is_active": self.is_active,
        }
