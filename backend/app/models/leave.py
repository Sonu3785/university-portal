from app import db
from datetime import datetime


class LeaveRequest(db.Model):
    __tablename__ = "leave_requests"

    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    from_date = db.Column(db.Date, nullable=False)
    to_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.Enum("pending", "approved", "rejected"), default="pending")
    admin_remark = db.Column(db.Text)
    applied_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "faculty_name": self.faculty.name if self.faculty else None,
            "from_date": str(self.from_date),
            "to_date": str(self.to_date),
            "reason": self.reason,
            "status": self.status,
            "admin_remark": self.admin_remark,
            "applied_at": str(self.applied_at),
        }
