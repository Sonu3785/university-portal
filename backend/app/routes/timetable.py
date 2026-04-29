from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models.timetable import TimetableSlot
from app.models.extra_lecture import ExtraLecture

timetable_bp = Blueprint("timetable", __name__)

DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


@timetable_bp.route("/my", methods=["GET"])
@jwt_required()
def get_my_timetable():
    user_id = int(get_jwt_identity())
    slots = TimetableSlot.query.filter_by(faculty_id=user_id).all()

    # Group by day
    timetable = {day: [] for day in DAYS_ORDER}
    for slot in slots:
        timetable[slot.day].append(slot.to_dict())

    # Sort each day by start_time
    for day in DAYS_ORDER:
        timetable[day].sort(key=lambda x: x["start_time"])

    return jsonify(timetable), 200


@timetable_bp.route("/all", methods=["GET"])
@jwt_required()
def get_all_timetable():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    slots = TimetableSlot.query.all()
    result = {}
    for slot in slots:
        fid = slot.faculty_id
        if fid not in result:
            result[fid] = {day: [] for day in DAYS_ORDER}
        result[fid][slot.day].append(slot.to_dict())

    return jsonify(result), 200


@timetable_bp.route("/extra", methods=["GET"])
@jwt_required()
def get_extra_lectures():
    user_id = int(get_jwt_identity())
    extras = ExtraLecture.query.filter_by(faculty_id=user_id).order_by(
        ExtraLecture.date.desc()
    ).all()
    return jsonify([e.to_dict() for e in extras]), 200
