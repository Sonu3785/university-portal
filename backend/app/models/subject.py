from app import db


class Subject(db.Model):
    __tablename__ = "subjects"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    semester = db.Column(db.Integer)
    branch = db.Column(db.String(100))

    # Relationships
    students = db.relationship(
        "Student", secondary="subject_students", backref="subjects", lazy=True
    )
    timetable_slots = db.relationship("TimetableSlot", backref="subject", lazy=True)
    attendance_records = db.relationship("Attendance", backref="subject", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "faculty_id": self.faculty_id,
            "semester": self.semester,
            "branch": self.branch,
        }


# Association table for subject <-> students
subject_students = db.Table(
    "subject_students",
    db.Column("subject_id", db.Integer, db.ForeignKey("subjects.id"), primary_key=True),
    db.Column("student_id", db.Integer, db.ForeignKey("students.id"), primary_key=True),
)
