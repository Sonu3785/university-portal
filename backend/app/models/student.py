from app import db


class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    roll_number = db.Column(db.String(30), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    semester = db.Column(db.Integer)
    branch = db.Column(db.String(100))

    attendance_records = db.relationship("Attendance", backref="student", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "roll_number": self.roll_number,
            "email": self.email,
            "phone": self.phone,
            "semester": self.semester,
            "branch": self.branch,
        }
