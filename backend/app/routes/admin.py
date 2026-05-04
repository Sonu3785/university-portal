from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app import db, mail
from app.models.user import User
from app.models.subject import Subject
from app.models.student import Student
from app.models.timetable import TimetableSlot
from app.models.attendance import Attendance
from flask_mail import Message
from datetime import datetime
import pandas as pd
import io

admin_bp = Blueprint("admin", __name__)


def admin_required(fn):
    """Decorator to enforce admin-only access."""
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


# ── Faculty Management ──────────────────────────────────────────────────────

@admin_bp.route("/faculty", methods=["GET"])
@admin_required
def get_all_faculty():
    faculty = User.query.filter_by(role="faculty").all()
    return jsonify([f.to_dict() for f in faculty]), 200


@admin_bp.route("/faculty", methods=["POST"])
@admin_required
def create_faculty():
    data = request.get_json()
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already exists"}), 400

    user = User(
        name=data["name"],
        email=data["email"].lower(),
        role="faculty",
        department=data.get("department"),
        phone=data.get("phone"),
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@admin_bp.route("/faculty/<int:faculty_id>", methods=["PUT"])
@admin_required
def update_faculty(faculty_id):
    user = User.query.get_or_404(faculty_id)
    data = request.get_json()
    user.name = data.get("name", user.name)
    user.department = data.get("department", user.department)
    user.phone = data.get("phone", user.phone)
    user.is_active = data.get("is_active", user.is_active)
    db.session.commit()
    return jsonify(user.to_dict()), 200


@admin_bp.route("/faculty/<int:faculty_id>", methods=["DELETE"])
@admin_required
def delete_faculty(faculty_id):
    user = User.query.get_or_404(faculty_id)
    name = user.name
    try:
        from app.models.timetable import TimetableSlot
        from app.models.extra_lecture import ExtraLecture
        from app.models.leave import LeaveRequest
        from app.models.reminder_setting import ReminderSetting
        from app.models.marks import StudentMarks
        from app.models.attendance import Attendance
        from app.models.notification import Notification
        from app.models.subject import subject_students

        subjects = Subject.query.filter_by(faculty_id=faculty_id).all()
        for subject in subjects:
            Attendance.query.filter_by(subject_id=subject.id).delete()
            StudentMarks.query.filter_by(subject_id=subject.id).delete()
            TimetableSlot.query.filter_by(subject_id=subject.id).delete()
            db.session.execute(
                subject_students.delete().where(subject_students.c.subject_id == subject.id)
            )
            db.session.delete(subject)

        TimetableSlot.query.filter_by(faculty_id=faculty_id).delete()
        ExtraLecture.query.filter_by(faculty_id=faculty_id).delete()
        LeaveRequest.query.filter_by(faculty_id=faculty_id).delete()
        ReminderSetting.query.filter_by(faculty_id=faculty_id).delete()
        StudentMarks.query.filter_by(faculty_id=faculty_id).delete()
        Attendance.query.filter_by(faculty_id=faculty_id).delete()
        Notification.query.filter_by(user_id=faculty_id).delete()

        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": f"Faculty '{name}' deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Delete failed: {str(e)}"}), 500


# ── Subject Management ──────────────────────────────────────────────────────

@admin_bp.route("/subjects", methods=["GET"])
@admin_required
def get_all_subjects():
    subjects = Subject.query.all()
    return jsonify([s.to_dict() for s in subjects]), 200


@admin_bp.route("/subjects", methods=["POST"])
@admin_required
def create_subject():
    data = request.get_json()
    faculty_ids = data.get("faculty_ids", [])  # list of faculty ids
    if not faculty_ids:
        faculty_ids = [data.get("faculty_id")]  # backward compat

    created = []
    for fid in faculty_ids:
        if not fid:
            continue
        existing = Subject.query.filter_by(code=data["code"], faculty_id=fid).first()
        if existing:
            continue  # skip duplicate
        subject = Subject(
            name=data["name"],
            code=data["code"],
            faculty_id=fid,
            semester=data.get("semester"),
            branch=data.get("branch"),
        )
        db.session.add(subject)
        created.append(fid)

    if not created:
        return jsonify({"error": "Subject already assigned to all selected faculty"}), 400

    db.session.commit()
    return jsonify({"message": f"Subject '{data['code']}' assigned to {len(created)} faculty"}), 201


@admin_bp.route("/subjects/<int:subject_id>", methods=["DELETE"])
@admin_required
def delete_subject(subject_id):
    subject = Subject.query.get_or_404(subject_id)
    name = subject.name
    try:
        from app.models.timetable import TimetableSlot
        from app.models.marks import StudentMarks
        from app.models.attendance import Attendance
        from app.models.subject import subject_students

        Attendance.query.filter_by(subject_id=subject_id).delete()
        StudentMarks.query.filter_by(subject_id=subject_id).delete()
        TimetableSlot.query.filter_by(subject_id=subject_id).delete()
        db.session.execute(
            subject_students.delete().where(subject_students.c.subject_id == subject_id)
        )
        db.session.delete(subject)
        db.session.commit()
        return jsonify({"message": f"Subject '{name}' deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Delete failed: {str(e)}"}), 500


# ── Timetable Upload ────────────────────────────────────────────────────────

@admin_bp.route("/timetable/upload", methods=["POST"])
@admin_required
def upload_timetable():
    """
    Upload CSV/Excel timetable.
    Expected columns: faculty_email, subject_code, day, start_time, end_time, room
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    filename = file.filename.lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file.read()))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file.read()))
        else:
            return jsonify({"error": "Only CSV or Excel files are supported"}), 400
    except Exception as e:
        return jsonify({"error": f"Could not parse file: {str(e)}"}), 400

    # Normalize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    required_cols = {"faculty_email", "subject_code", "day", "start_time", "end_time"}
    if not required_cols.issubset(set(df.columns)):
        return jsonify({
            "error": f"Missing columns. Required: {required_cols}"
        }), 400

    valid_days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}
    created, skipped, errors = 0, 0, []

    for _, row in df.iterrows():
        try:
            # Fix: Excel often saves numbers as float (e.g. 123.0) — convert to clean string
            raw_email = str(row["faculty_email"]).strip().lower()
            raw_code = str(row["subject_code"]).strip()
            # Remove .0 suffix if Excel converted code to float
            if raw_code.endswith(".0") and raw_code[:-2].isdigit():
                raw_code = raw_code[:-2]

            # Auto-create faculty if not found
            faculty = User.query.filter(User.email.ilike(raw_email)).first()
            if not faculty:
                faculty = User(
                    name=raw_email.split("@")[0].replace(".", " ").title(),
                    email=raw_email,
                    role="faculty",
                    department="General"
                )
                faculty.set_password("faculty123")
                db.session.add(faculty)
                db.session.flush()
                errors.append(f"Auto-created faculty: {raw_email} (password: faculty123)")

            # Find subject by code AND faculty
            subject = Subject.query.filter(
                Subject.code.ilike(raw_code),
                Subject.faculty_id == faculty.id
            ).first()

            # Auto-create subject if not found
            if not subject:
                subject = Subject(
                    name=raw_code,
                    code=raw_code.upper(),
                    faculty_id=faculty.id,
                    semester=None,
                    branch="General"
                )
                db.session.add(subject)
                db.session.flush()
                errors.append(f"Auto-created subject: {raw_code} for {raw_email}")

            day = str(row["day"]).strip().capitalize()
            if day not in valid_days:
                errors.append(f"Invalid day: {row['day']}")
                skipped += 1
                continue

            start_time = datetime.strptime(str(row["start_time"]).strip(), "%H:%M").time()
            end_time = datetime.strptime(str(row["end_time"]).strip(), "%H:%M").time()

            # Check for duplicate
            existing = TimetableSlot.query.filter_by(
                faculty_id=faculty.id,
                subject_id=subject.id,
                day=day,
                start_time=start_time
            ).first()

            if existing:
                existing.end_time = end_time
                existing.room = str(row.get("room", "")).strip() or existing.room
                skipped += 1
            else:
                slot = TimetableSlot(
                    faculty_id=faculty.id,
                    subject_id=subject.id,
                    day=day,
                    start_time=start_time,
                    end_time=end_time,
                    room=str(row.get("room", "")).strip()
                )
                db.session.add(slot)
                created += 1

        except Exception as e:
            errors.append(f"Row error: {str(e)}")
            skipped += 1

    db.session.commit()
    return jsonify({
        "message": f"Timetable uploaded: {created} created, {skipped} skipped",
        "errors": errors
    }), 200


# ── Student Upload ──────────────────────────────────────────────────────────

@admin_bp.route("/students/upload", methods=["POST"])
@admin_required
def upload_students():
    """
    Upload CSV/Excel student list.
    Expected columns: name, roll_number, email, phone, semester, branch, subject_codes (comma separated)
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    filename = file.filename.lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file.read()))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file.read()))
        else:
            return jsonify({"error": "Only CSV or Excel files are supported"}), 400
    except Exception as e:
        return jsonify({"error": f"Could not parse file: {str(e)}"}), 400

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    required_cols = {"name", "roll_number", "email"}
    if not required_cols.issubset(set(df.columns)):
        return jsonify({"error": f"Missing columns. Required: {required_cols}"}), 400

    created, updated, errors = 0, 0, []

    for _, row in df.iterrows():
        try:
            student = Student.query.filter_by(roll_number=str(row["roll_number"]).strip()).first()

            if not student:
                student = Student(
                    name=str(row["name"]).strip(),
                    roll_number=str(row["roll_number"]).strip(),
                    email=str(row["email"]).strip().lower(),
                    phone=str(row.get("phone", "")).strip(),
                    semester=int(row["semester"]) if "semester" in row and pd.notna(row["semester"]) else None,
                    branch=str(row.get("branch", "")).strip(),
                )
                db.session.add(student)
                db.session.flush()
                created += 1
            else:
                updated += 1

            # Assign to subjects
            if "subject_codes" in row and pd.notna(row["subject_codes"]):
                codes = [c.strip() for c in str(row["subject_codes"]).split(",")]
                for code in codes:
                    # Fix float codes from Excel (e.g. 123.0 → 123)
                    if code.endswith(".0") and code[:-2].isdigit():
                        code = code[:-2]
                    subject = Subject.query.filter(Subject.code.ilike(code)).first()
                    if subject and student not in subject.students:
                        subject.students.append(student)

        except Exception as e:
            errors.append(f"Row error for {row.get('roll_number', '?')}: {str(e)}")

    db.session.commit()
    return jsonify({
        "message": f"Students uploaded: {created} created, {updated} updated",
        "errors": errors
    }), 200


# ── Send Defaulter Emails ───────────────────────────────────────────────────

@admin_bp.route("/send-defaulter-mails/<int:subject_id>", methods=["POST"])
@jwt_required()
def send_defaulter_mails(subject_id):
    claims = get_jwt()
    # Both admin and faculty (owner) can send
    from flask_jwt_extended import get_jwt_identity
    user_id = int(get_jwt_identity())

    subject = Subject.query.get_or_404(subject_id)
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    students = subject.students
    sent, failed = 0, 0

    for student in students:
        records = Attendance.query.filter_by(
            student_id=student.id, subject_id=subject_id
        ).all()
        total = len(records)
        present = sum(1 for r in records if r.status == "present")
        percentage = round((present / total * 100), 2) if total > 0 else 0.0

        if percentage < 75 and student.email:
            try:
                msg = Message(
                    subject=f"⚠️ Low Attendance Warning — {subject.name}",
                    recipients=[student.email],
                    body=(
                        f"Dear {student.name},\n\n"
                        f"This is to inform you that your attendance in "
                        f"{subject.name} ({subject.code}) is {percentage}%, "
                        f"which is below the required 75%.\n\n"
                        f"Classes attended: {present} / {total}\n\n"
                        f"Please ensure regular attendance to avoid academic consequences.\n\n"
                        f"Regards,\n{subject.faculty.name if subject.faculty else 'Faculty'}\n"
                        f"University"
                    )
                )
                mail.send(msg)
                sent += 1
            except Exception as e:
                print(f"Failed to send mail to {student.email}: {e}")
                failed += 1

    return jsonify({
        "message": f"Defaulter emails sent: {sent} sent, {failed} failed"
    }), 200


# ── Extra Lecture ───────────────────────────────────────────────────────────

@admin_bp.route("/extra-lecture", methods=["POST"])
@jwt_required()
def add_extra_lecture():
    from app.models.extra_lecture import ExtraLecture
    from flask_jwt_extended import get_jwt_identity
    user_id = int(get_jwt_identity())
    data = request.get_json()

    subject = Subject.query.get_or_404(data["subject_id"])
    claims = get_jwt()
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    from datetime import datetime
    extra = ExtraLecture(
        faculty_id=user_id,
        subject_id=data["subject_id"],
        date=data["date"],
        start_time=datetime.strptime(data["start_time"], "%H:%M").time(),
        end_time=datetime.strptime(data["end_time"], "%H:%M").time(),
        room=data.get("room", ""),
        note=data.get("note", ""),
    )
    db.session.add(extra)
    db.session.commit()
    return jsonify(extra.to_dict()), 201
