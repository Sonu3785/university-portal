from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.user import User
from app.models.reminder_setting import ReminderSetting

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email, is_active=True).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "name": user.name}
    )
    return jsonify({
        "access_token": access_token,
        "user": user.to_dict()
    }), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict()), 200


@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    data = request.get_json()

    if not user.check_password(data.get("old_password", "")):
        return jsonify({"error": "Current password is incorrect"}), 400

    new_password = data.get("new_password", "")
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password changed successfully"}), 200
