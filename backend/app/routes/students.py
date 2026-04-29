from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.student import Student
from app.models.subject import Subject

students_bp = Blueprint("students", __name__)


@students_bp.route("/subject/<int:subject_id>", methods=["GET"])
@jwt_required()
def get_students_by_subject(subject_id):
    user_id = int(get_jwt_identity())
    claims = get_jwt()

    subject = Subject.query.get_or_404(subject_id)
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    return jsonify([s.to_dict() for s in subject.students]), 200


@students_bp.route("/all", methods=["GET"])
@jwt_required()
def get_all_students():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    students = Student.query.all()
    return jsonify([s.to_dict() for s in students]), 200
