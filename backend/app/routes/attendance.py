from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.attendance import Attendance
from app.models.subject import Subject
from app.models.student import Student
from datetime import date

attendance_bp = Blueprint("attendance", __name__)

DEFAULTER_THRESHOLD = 75.0  # percent


@attendance_bp.route("/students/<int:subject_id>", methods=["GET"])
@jwt_required()
def get_students_for_subject(subject_id):
    user_id = int(get_jwt_identity())
    claims = get_jwt()

    subject = Subject.query.get_or_404(subject_id)

    # Faculty can only access their own subjects
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    students = subject.students
    return jsonify([s.to_dict() for s in students]), 200


@attendance_bp.route("/submit", methods=["POST"])
@jwt_required()
def submit_attendance():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    subject_id = data.get("subject_id")
    attendance_date = data.get("date", str(date.today()))
    records = data.get("records", [])  # [{student_id, status}]

    subject = Subject.query.get_or_404(subject_id)
    claims = get_jwt()
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    saved = 0
    for rec in records:
        existing = Attendance.query.filter_by(
            student_id=rec["student_id"],
            subject_id=subject_id,
            date=attendance_date
        ).first()

        if existing:
            existing.status = rec["status"]
        else:
            new_rec = Attendance(
                student_id=rec["student_id"],
                subject_id=subject_id,
                faculty_id=user_id,
                date=attendance_date,
                status=rec["status"]
            )
            db.session.add(new_rec)
        saved += 1

    db.session.commit()
    return jsonify({"message": f"Attendance saved for {saved} students"}), 200


@attendance_bp.route("/report/<int:subject_id>", methods=["GET"])
@jwt_required()
def attendance_report(subject_id):
    user_id = int(get_jwt_identity())
    claims = get_jwt()

    subject = Subject.query.get_or_404(subject_id)
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    students = subject.students
    report = []

    for student in students:
        records = Attendance.query.filter_by(
            student_id=student.id,
            subject_id=subject_id
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
            "is_defaulter": percentage < DEFAULTER_THRESHOLD
        })

    report.sort(key=lambda x: x["roll_number"])
    return jsonify(report), 200


@attendance_bp.route("/defaulters/<int:subject_id>", methods=["GET"])
@jwt_required()
def get_defaulters(subject_id):
    user_id = int(get_jwt_identity())
    claims = get_jwt()

    subject = Subject.query.get_or_404(subject_id)
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    students = subject.students
    defaulters = []

    for student in students:
        records = Attendance.query.filter_by(
            student_id=student.id,
            subject_id=subject_id
        ).all()
        total = len(records)
        present = sum(1 for r in records if r.status == "present")
        percentage = round((present / total * 100), 2) if total > 0 else 0.0

        if percentage < DEFAULTER_THRESHOLD:
            defaulters.append({
                **student.to_dict(),
                "percentage": percentage,
                "present": present,
                "total_classes": total,
            })

    return jsonify(defaulters), 200
