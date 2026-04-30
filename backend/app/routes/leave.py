from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db, mail
from app.models.leave import LeaveRequest
from app.models.user import User
from flask_mail import Message
import os

leave_bp = Blueprint("leave", __name__)


@leave_bp.route("/apply", methods=["POST"])
@jwt_required()
def apply_leave():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    leave = LeaveRequest(
        faculty_id=user_id,
        from_date=data["from_date"],
        to_date=data["to_date"],
        reason=data["reason"]
    )
    db.session.add(leave)
    db.session.commit()
    return jsonify({"message": "Leave request submitted", "id": leave.id}), 201


@leave_bp.route("/my", methods=["GET"])
@jwt_required()
def my_leaves():
    user_id = int(get_jwt_identity())
    leaves = LeaveRequest.query.filter_by(faculty_id=user_id).order_by(
        LeaveRequest.applied_at.desc()
    ).all()
    return jsonify([l.to_dict() for l in leaves]), 200


@leave_bp.route("/all", methods=["GET"])
@jwt_required()
def all_leaves():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    leaves = LeaveRequest.query.order_by(LeaveRequest.applied_at.desc()).all()
    return jsonify([l.to_dict() for l in leaves]), 200


@leave_bp.route("/action/<int:leave_id>", methods=["PUT"])
@jwt_required()
def leave_action(leave_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json()
    action = data.get("action")  # "approved" or "rejected"
    remark = data.get("remark", "")

    if action not in ["approved", "rejected"]:
        return jsonify({"error": "Invalid action"}), 400

    leave = LeaveRequest.query.get_or_404(leave_id)
    leave.status = action
    leave.admin_remark = remark
    db.session.commit()

    # Send email notification to faculty
    faculty = User.query.get(leave.faculty_id)
    if faculty:
        # Create in-app notification
        from app.models.notification import Notification
        notif = Notification(
            user_id=faculty.id,
            title=f"Leave Request {'Approved ✅' if action == 'approved' else 'Rejected ❌'}",
            message=f"Your leave from {leave.from_date} to {leave.to_date} has been {action}. {('Remark: ' + remark) if remark else ''}",
            type="leave"
        )
        db.session.add(notif)
        db.session.commit()

        try:
            status_text = "Approved ✅" if action == "approved" else "Rejected ❌"
            msg = Message(
                subject=f"Leave Request {status_text}",
                recipients=[faculty.email],
                body=(
                    f"Dear {faculty.name},\n\n"
                    f"Your leave request from {leave.from_date} to {leave.to_date} "
                    f"has been {action}.\n\n"
                    f"Reason you provided: {leave.reason}\n"
                    f"Admin remark: {remark or 'No remark'}\n\n"
                    f"Regards,\nUniversity Admin"
                )
            )
            mail.send(msg)
        except Exception as e:
            # Don't fail the request if email fails
            print(f"Email error: {e}")

    return jsonify({"message": f"Leave {action} successfully"}), 200
