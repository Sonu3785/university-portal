from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.marks import StudentMarks
from app.models.subject import Subject
from app.models.student import Student
from app.models.attendance import Attendance

marks_bp = Blueprint("marks", __name__)


def get_attendance_pct(student_id, subject_id):
    records = Attendance.query.filter_by(
        student_id=student_id, subject_id=subject_id
    ).all()
    total = len(records)
    present = sum(1 for r in records if r.status == "present")
    return (present / total * 100) if total > 0 else 0.0


@marks_bp.route("/subject/<int:subject_id>", methods=["GET"])
@jwt_required()
def get_marks(subject_id):
    user_id = int(get_jwt_identity())
    claims = get_jwt()

    subject = Subject.query.get_or_404(subject_id)
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Pull students from attendance records (who actually attended at least once)
    attended = db.session.query(Attendance.student_id).filter_by(
        subject_id=subject_id
    ).distinct().all()
    attended_ids = [a.student_id for a in attended]

    # Also include enrolled students who may not have attendance yet
    enrolled_ids = [s.id for s in subject.students]
    all_ids = list(set(attended_ids + enrolled_ids))

    students = Student.query.filter(Student.id.in_(all_ids)).order_by(
        Student.roll_number
    ).all()

    result = []
    for student in students:
        marks = StudentMarks.query.filter_by(
            student_id=student.id, subject_id=subject_id
        ).first()
        att_pct = get_attendance_pct(student.id, subject_id)

        if marks:
            d = marks.to_dict(attendance_pct=att_pct)
        else:
            empty = StudentMarks(
                student_id=student.id,
                subject_id=subject_id,
                faculty_id=user_id
            )
            d = empty.to_dict(attendance_pct=att_pct)
            d["id"] = None

        # Always override with direct student data (fixes blank name/roll issue)
        d["student_name"] = student.name
        d["roll_number"]  = student.roll_number
        d["student_id"]   = student.id

        result.append(d)

    return jsonify(result), 200


@marks_bp.route("/save", methods=["POST"])
@jwt_required()
def save_marks():
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    data = request.get_json()

    subject_id = data.get("subject_id")
    records = data.get("records", [])

    subject = Subject.query.get_or_404(subject_id)
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    saved = 0
    for rec in records:
        student_id = rec.get("student_id")

        # Validate ranges
        def clamp(val, max_val):
            try:
                v = float(val)
                return max(0, min(v, max_val))
            except (TypeError, ValueError):
                return 0.0

        marks = StudentMarks.query.filter_by(
            student_id=student_id, subject_id=subject_id
        ).first()

        if not marks:
            marks = StudentMarks(
                student_id=student_id,
                subject_id=subject_id,
                faculty_id=user_id
            )
            db.session.add(marks)

        marks.assignment1 = clamp(rec.get("assignment1"), 10)
        marks.assignment2 = clamp(rec.get("assignment2"), 10)
        marks.mcq_test    = clamp(rec.get("mcq_test"), 10)
        marks.ta1         = clamp(rec.get("ta1"), 20)
        marks.ta2         = clamp(rec.get("ta2"), 20)
        saved += 1

    db.session.commit()
    return jsonify({"message": f"Marks saved for {saved} students"}), 200


@marks_bp.route("/final/save", methods=["POST"])
@jwt_required()
def save_final_marks():
    """Admin only — save final exam marks (out of 50)."""
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    from flask_jwt_extended import get_jwt_identity
    user_id = int(get_jwt_identity())
    data = request.get_json()
    subject_id = data.get("subject_id")
    records = data.get("records", [])

    Subject.query.get_or_404(subject_id)

    saved = 0
    for rec in records:
        student_id = rec.get("student_id")
        try:
            final = float(rec.get("final_marks", 0))
            final = max(0, min(final, 50))
        except (TypeError, ValueError):
            final = 0.0

        marks = StudentMarks.query.filter_by(
            student_id=student_id, subject_id=subject_id
        ).first()

        if not marks:
            marks = StudentMarks(
                student_id=student_id,
                subject_id=subject_id,
                faculty_id=user_id
            )
            db.session.add(marks)

        marks.final_marks = final
        saved += 1

    db.session.commit()
    return jsonify({"message": f"Final marks saved for {saved} students"}), 200


@marks_bp.route("/summary/<int:subject_id>", methods=["GET"])
@jwt_required()
def marks_summary(subject_id):
    """Returns class average and topper for a subject."""
    user_id = int(get_jwt_identity())
    claims = get_jwt()

    subject = Subject.query.get_or_404(subject_id)
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    students = subject.students
    all_marks = []

    for student in students:
        marks = StudentMarks.query.filter_by(
            student_id=student.id, subject_id=subject_id
        ).first()
        att_pct = get_attendance_pct(student.id, subject_id)
        if marks:
            all_marks.append(marks.to_dict(attendance_pct=att_pct))

    if not all_marks:
        return jsonify({"avg_ca": 0, "avg_ta": 0, "avg_total": 0, "topper": None}), 200

    avg_ca    = round(sum(m["ca_total"] for m in all_marks) / len(all_marks), 2)
    avg_ta    = round(sum(m["ta_total"] for m in all_marks) / len(all_marks), 2)
    avg_total = round(sum(m["grand_total"] for m in all_marks) / len(all_marks), 2)
    topper    = max(all_marks, key=lambda x: x["grand_total"])

    return jsonify({
        "avg_ca": avg_ca,
        "avg_ta": avg_ta,
        "avg_total": avg_total,
        "topper": topper,
        "total_students": len(all_marks)
    }), 200
