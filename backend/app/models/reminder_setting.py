from app import db


class ReminderSetting(db.Model):
    __tablename__ = "reminder_settings"

    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    minutes_before = db.Column(db.Integer, default=10)
    email_enabled = db.Column(db.Boolean, default=True)
    browser_enabled = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "faculty_id": self.faculty_id,
            "minutes_before": self.minutes_before,
            "email_enabled": self.email_enabled,
            "browser_enabled": self.browser_enabled,
        }
