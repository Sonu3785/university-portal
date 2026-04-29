from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.reminder_setting import ReminderSetting

reminder_bp = Blueprint("reminder", __name__)


@reminder_bp.route("/settings", methods=["GET"])
@jwt_required()
def get_settings():
    user_id = int(get_jwt_identity())
    setting = ReminderSetting.query.filter_by(faculty_id=user_id).first()
    if not setting:
        # Return defaults
        return jsonify({
            "faculty_id": user_id,
            "minutes_before": 10,
            "email_enabled": True,
            "browser_enabled": True
        }), 200
    return jsonify(setting.to_dict()), 200


@reminder_bp.route("/settings", methods=["PUT"])
@jwt_required()
def update_settings():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    setting = ReminderSetting.query.filter_by(faculty_id=user_id).first()
    if not setting:
        setting = ReminderSetting(faculty_id=user_id)
        db.session.add(setting)

    setting.minutes_before = data.get("minutes_before", 10)
    setting.email_enabled = data.get("email_enabled", True)
    setting.browser_enabled = data.get("browser_enabled", True)
    db.session.commit()

    return jsonify({"message": "Reminder settings updated", **setting.to_dict()}), 200


@reminder_bp.route("/upcoming", methods=["GET"])
@jwt_required()
def get_upcoming_reminders():
    """Returns today's upcoming lectures for frontend to schedule browser notifications."""
    from app.models.timetable import TimetableSlot
    from app.models.extra_lecture import ExtraLecture
    from datetime import datetime, date

    user_id = int(get_jwt_identity())
    today = date.today()
    day_name = today.strftime("%A")

    slots = TimetableSlot.query.filter_by(faculty_id=user_id, day=day_name).all()
    extras = ExtraLecture.query.filter_by(faculty_id=user_id, date=today).all()

    setting = ReminderSetting.query.filter_by(faculty_id=user_id).first()
    minutes_before = setting.minutes_before if setting else 10

    lectures = []
    for slot in slots:
        lectures.append({
            "type": "regular",
            "subject_name": slot.subject.name if slot.subject else "",
            "subject_code": slot.subject.code if slot.subject else "",
            "start_time": str(slot.start_time),
            "room": slot.room,
            "minutes_before": minutes_before,
        })

    for extra in extras:
        lectures.append({
            "type": "extra",
            "subject_name": extra.subject.name if extra.subject else "",
            "subject_code": extra.subject.code if extra.subject else "",
            "start_time": str(extra.start_time),
            "room": extra.room,
            "minutes_before": minutes_before,
        })

    return jsonify(lectures), 200
