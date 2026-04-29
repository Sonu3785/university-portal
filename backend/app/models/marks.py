from app import db
from datetime import datetime


class StudentMarks(db.Model):
    __tablename__ = "student_marks"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id"), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # CA Components (out of 10 each)
    assignment1 = db.Column(db.Float, default=0)   # /10 → /6
    assignment2 = db.Column(db.Float, default=0)   # /10 → /6
    mcq_test    = db.Column(db.Float, default=0)   # /10 → /6
    # attendance is auto-calculated from attendance table → /6

    # TA Components (out of 20 each)
    ta1 = db.Column(db.Float, default=0)           # /20 → /13
    ta2 = db.Column(db.Float, default=0)           # /20 → /13

    # Final Exam — only admin can set (out of 50)
    final_marks = db.Column(db.Float, default=None, nullable=True)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("student_id", "subject_id", name="unique_student_subject_marks"),
    )

    student  = db.relationship("Student",  backref="marks")
    subject  = db.relationship("Subject",  backref="marks")
    faculty  = db.relationship("User",     backref="marks_given")

    # ── Conversion helpers ──────────────────────────────────────
    @staticmethod
    def convert(raw, raw_max, converted_max):
        """Scale raw marks to converted max."""
        if raw_max == 0:
            return 0
        val = (raw / raw_max) * converted_max
        return round(min(val, converted_max), 2)

    @property
    def assignment1_converted(self):
        return self.convert(self.assignment1 or 0, 10, 6)

    @property
    def assignment2_converted(self):
        return self.convert(self.assignment2 or 0, 10, 6)

    @property
    def mcq_converted(self):
        return self.convert(self.mcq_test or 0, 10, 6)

    @property
    def ta1_converted(self):
        return self.convert(self.ta1 or 0, 20, 13)

    @property
    def ta2_converted(self):
        return self.convert(self.ta2 or 0, 20, 13)

    def to_dict(self, attendance_pct=0):
        att_converted = self.convert(min(attendance_pct, 100), 100, 6)
        ca_total = round(
            self.assignment1_converted +
            self.assignment2_converted +
            self.mcq_converted +
            att_converted, 2
        )
        ta_total = round(self.ta1_converted + self.ta2_converted, 2)
        internal_total = round(ca_total + ta_total, 2)  # out of 50
        final = self.final_marks if self.final_marks is not None else None
        grand_total = round(internal_total + final, 2) if final is not None else None

        return {
            "id": self.id,
            "student_id": self.student_id,
            "student_name": self.student.name if self.student else "",
            "roll_number": self.student.roll_number if self.student else "",
            "subject_id": self.subject_id,

            # Raw
            "assignment1": self.assignment1,
            "assignment2": self.assignment2,
            "mcq_test": self.mcq_test,
            "attendance_pct": round(attendance_pct, 2),
            "ta1": self.ta1,
            "ta2": self.ta2,

            # Converted
            "assignment1_converted": self.assignment1_converted,
            "assignment2_converted": self.assignment2_converted,
            "mcq_converted": self.mcq_converted,
            "attendance_converted": att_converted,
            "ta1_converted": self.ta1_converted,
            "ta2_converted": self.ta2_converted,

            # Totals
            "ca_total": ca_total,           # out of 24
            "ta_total": ta_total,           # out of 26
            "grand_total": internal_total,  # CA+TA out of 50
            "final_marks": self.final_marks,# End sem out of 50
            "overall_total": grand_total,   # CA+TA+Final out of 100
        }
