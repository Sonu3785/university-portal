from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app import db, mail
from app.models.user import User
from app.models.subject import Subject
from app.models.student import Student
from app.models.timetable import TimetableSlot
from app.models.attendance import Attendance
from flask_mail import Message
from datetime import datetime, date
import pandas as pd
import io

admin_bp = Blueprint("admin", __name__)


def admin_required(fn):
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

    # Send welcome email
    try:
        msg = Message(
            subject="🎓 Welcome to MIT-ADT University Faculty Portal!",
            recipients=[user.email],
            body=(
                f"Dear {user.name},\n\n"
                f"Congratulations! 🎉 You have been successfully added as a Faculty Member "
                f"at MIT-ADT University Faculty Management System.\n\n"
                f"Your login credentials:\n"
                f"  📧 Email:    {user.email}\n"
                f"  🔑 Password: {data['password']}\n\n"
                f"Portal Link: https://university-portal-brown.vercel.app\n\n"
                f"You can now:\n"
                f"  ✅ View your timetable\n"
                f"  ✅ Mark attendance\n"
                f"  ✅ Enter CA/TA marks\n"
                f"  ✅ View reports\n"
                f"  ✅ Set lecture reminders\n\n"
                f"Please change your password after first login.\n\n"
                f"Regards,\nMIT-ADT University Admin"
            )
        )
        mail.send(msg)
    except Exception as e:
        print(f"Welcome email failed: {e}")

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


# ── Faculty Attendance (Lectures Conducted) ─────────────────────────────────

@admin_bp.route("/faculty-attendance", methods=["GET"])
@admin_required
def faculty_attendance():
    """
    Returns for each faculty:
    - Total scheduled slots per week
    - Total unique dates attendance was marked (lectures conducted)
    - Subjects taught
    """
    faculty_list = User.query.filter_by(role="faculty", is_active=True).all()
    result = []

    for faculty in faculty_list:
        subjects = Subject.query.filter_by(faculty_id=faculty.id).all()
        subject_stats = []
        total_scheduled = 0
        total_conducted = 0

        for subject in subjects:
            # Scheduled slots per week
            slots = TimetableSlot.query.filter_by(
                faculty_id=faculty.id, subject_id=subject.id
            ).count()

            # Unique dates attendance was marked by this faculty for this subject
            conducted_dates = db.session.query(
                db.func.count(db.func.distinct(Attendance.date))
            ).filter_by(
                faculty_id=faculty.id, subject_id=subject.id
            ).scalar() or 0

            # Total students enrolled
            total_students = len(subject.students)

            subject_stats.append({
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "slots_per_week": slots,
                "lectures_conducted": conducted_dates,
                "total_students": total_students,
            })
            total_scheduled += slots
            total_conducted += conducted_dates

        result.append({
            "faculty_id": faculty.id,
            "faculty_name": faculty.name,
            "faculty_email": faculty.email,
            "department": faculty.department or "—",
            "total_subjects": len(subjects),
            "total_slots_per_week": total_scheduled,
            "total_lectures_conducted": total_conducted,
            "subjects": subject_stats,
        })

    return jsonify(result), 200


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
    faculty_ids = data.get("faculty_ids", [])
    if not faculty_ids:
        faculty_ids = [data.get("faculty_id")]

    created = []
    for fid in faculty_ids:
        if not fid:
            continue
        existing = Subject.query.filter_by(code=data["code"], faculty_id=fid).first()
        if existing:
            continue
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


@admin_bp.route("/subjects/<int:subject_id>", methods=["PUT"])
@admin_required
def update_subject(subject_id):
    subject = Subject.query.get_or_404(subject_id)
    data = request.get_json()
    subject.name = data.get("name", subject.name)
    subject.code = data.get("code", subject.code)
    subject.semester = data.get("semester", subject.semester)
    subject.branch = data.get("branch", subject.branch)
    if data.get("faculty_id"):
        subject.faculty_id = data["faculty_id"]
    db.session.commit()
    return jsonify(subject.to_dict()), 200


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

    required_cols = {"faculty_email", "subject_code", "day", "start_time", "end_time"}
    if not required_cols.issubset(set(df.columns)):
        return jsonify({"error": f"Missing columns. Required: {required_cols}"}), 400

    valid_days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}
    created, skipped, errors = 0, 0, []

    for _, row in df.iterrows():
        try:
            raw_email = str(row["faculty_email"]).strip().lower()
            raw_code = str(row["subject_code"]).strip()
            if raw_code.endswith(".0") and raw_code[:-2].isdigit():
                raw_code = raw_code[:-2]

            if not raw_email or raw_email == 'nan':
                skipped += 1
                continue

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

            subject = Subject.query.filter(
                Subject.code.ilike(raw_code),
                Subject.faculty_id == faculty.id
            ).first()

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
            if not str(row.get("roll_number", "")).strip() or str(row.get("roll_number", "")).strip() == 'nan':
                continue

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

            col_faculty_email = str(row.get("faculty_email", "")).strip().lower() if "faculty_email" in row and pd.notna(row.get("faculty_email")) else None

            if "subject_codes" in row and pd.notna(row["subject_codes"]):
                entries = [c.strip() for c in str(row["subject_codes"]).split(",")]
                for entry in entries:
                    if not entry or entry == 'nan':
                        continue
                    if entry.endswith(".0") and entry[:-2].isdigit():
                        entry = entry[:-2]

                    if ":" in entry:
                        parts = entry.split(":", 1)
                        code = parts[0].strip()
                        faculty_email = parts[1].strip().lower()
                    elif col_faculty_email:
                        code = entry
                        faculty_email = col_faculty_email
                    else:
                        subjects_list = Subject.query.filter(Subject.code.ilike(entry)).all()
                        for subject in subjects_list:
                            if student not in subject.students:
                                subject.students.append(student)
                        continue

                    faculty_user = User.query.filter(User.email.ilike(faculty_email)).first()
                    if faculty_user:
                        subject = Subject.query.filter(
                            Subject.code.ilike(code),
                            Subject.faculty_id == faculty_user.id
                        ).first()
                    else:
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
    user_id = int(get_jwt_identity())

    subject = db.session.get(Subject, subject_id)
    if not subject:
        return jsonify({"error": "Subject not found"}), 404
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    students = subject.students
    sent, failed = 0, 0

    faculty_name = "Faculty"
    try:
        if subject.faculty:
            faculty_name = subject.faculty.name
    except Exception:
        pass

    for student in students:
        records = Attendance.query.filter_by(
            student_id=student.id, subject_id=subject_id
        ).all()
        total = len(records)
        present = sum(1 for r in records if r.status == "present")
        percentage = round((present / total * 100), 2) if total > 0 else 0.0

        if total > 0 and percentage < 75 and student.email:
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
                        f"Regards,\n{faculty_name}\nMIT-ADT University"
                    )
                )
                mail.send(msg)
                sent += 1
            except Exception as e:
                print(f"Failed to send mail to {student.email}: {e}")
                failed += 1

    if sent == 0 and failed == 0:
        return jsonify({"message": "No defaulters found — all students have attendance >= 75% or no classes taken yet"}), 200

    return jsonify({"message": f"Defaulter emails sent: {sent} sent, {failed} failed"}), 200


# ── Extra Lecture ───────────────────────────────────────────────────────────

@admin_bp.route("/extra-lecture", methods=["POST"])
@jwt_required()
def add_extra_lecture():
    from app.models.extra_lecture import ExtraLecture
    user_id = int(get_jwt_identity())
    data = request.get_json()

    subject = db.session.get(Subject, data["subject_id"])
    if not subject:
        return jsonify({"error": "Subject not found"}), 404
    claims = get_jwt()
    if claims.get("role") == "faculty" and subject.faculty_id != user_id:
        return jsonify({"error": "Access denied"}), 403

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
