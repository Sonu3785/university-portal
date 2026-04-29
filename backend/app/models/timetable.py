from app import db


class TimetableSlot(db.Model):
    __tablename__ = "timetable_slots"

    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    day = db.Column(db.Enum("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    room = db.Column(db.String(50))

    def to_dict(self):
        return {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "subject_id": self.subject_id,
            "subject_name": self.subject.name if self.subject else None,
            "subject_code": self.subject.code if self.subject else None,
            "day": self.day,
            "start_time": str(self.start_time),
            "end_time": str(self.end_time),
            "room": self.room,
        }
