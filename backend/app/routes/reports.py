from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.subject import Subject
from app.models.attendance import Attendance
from app.models.student import Student

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    user_id = int(get_jwt_identity())
    claims = get_jwt()

    if claims.get("role") == "admin":
        subjects = Subject.query.all()
    else:
        subjects = Subject.query.filter_by(faculty_id=user_id).all()

    summary = []
    for subject in subjects:
        students = subject.students
        total_students = len(students)
        defaulters = 0

        for student in students:
            records = Attendance.query.filter_by(
                student_id=student.id, subject_id=subject.id
            ).all()
            total = len(records)
            present = sum(1 for r in records if r.status == "present")
            pct = (present / total * 100) if total > 0 else 0
            if pct < 75:
                defaulters += 1

        summary.append({
            "subject_id": subject.id,
            "subject_name": subject.name,
            "subject_code": subject.code,
            "total_students": total_students,
            "defaulters": defaulters,
        })

    return jsonify(summary), 200


@reports_bp.route("/subject/<int:subject_id>", methods=["GET"])
@jwt_required()
def subject_report(subject_id):
    user_id = int(get_jwt_identity())
    claims = get_jwt()

    subject = db.session.get(Subject, subject_id)
    if not subject:
        return jsonify({"error": "Subject not found"}), 404
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    students = subject.students
    report = []

    for student in students:
        records = Attendance.query.filter_by(
            student_id=student.id, subject_id=subject_id
        ).all()
        total = len(records)
        present = sum(1 for r in records if r.status == "present")
        percentage = round((present / total * 100), 2) if total > 0 else 0.0

        report.append({
            **student.to_dict(),
            "total_classes": total,
            "present": present,
            "absent": total - present,
            "percentage": percentage,
            "is_defaulter": percentage < 75,
        })

    return jsonify({
        "subject": subject.to_dict(),
        "report": sorted(report, key=lambda x: x["roll_number"])
    }), 200
