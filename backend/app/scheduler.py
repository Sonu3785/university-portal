"""
Reminder Scheduler — runs in background, checks every minute
and sends email reminders before lectures.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, date, timedelta
import logging

logger = logging.getLogger(__name__)


def send_lecture_reminders(app):
    """Check all faculty timetables and send email reminders + create in-app notifications."""
    with app.app_context():
        from app import mail, db
        from app.models.timetable import TimetableSlot
        from app.models.extra_lecture import ExtraLecture
        from app.models.reminder_setting import ReminderSetting
        from app.models.user import User
        from app.models.notification import Notification
        from flask_mail import Message

        now = datetime.now()
        today = date.today()
        day_name = today.strftime("%A")

        # Use IST timezone for India
        try:
            from zoneinfo import ZoneInfo
            ist = ZoneInfo("Asia/Kolkata")
            from datetime import timezone
            now = datetime.now(ist).replace(tzinfo=None)
            today = now.date()
            day_name = now.strftime("%A")
        except Exception:
            pass

        if day_name not in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]:
            return

        faculty_list = User.query.filter_by(role="faculty", is_active=True).all()

        for faculty in faculty_list:
            setting = ReminderSetting.query.filter_by(faculty_id=faculty.id).first()
            minutes_before = setting.minutes_before if setting else 10
            email_enabled = setting.email_enabled if setting else True

            slots = TimetableSlot.query.filter_by(faculty_id=faculty.id, day=day_name).all()
            extras = ExtraLecture.query.filter_by(faculty_id=faculty.id, date=today).all()

            all_lectures = []
            for slot in slots:
                all_lectures.append({
                    "subject_name": slot.subject.name if slot.subject else "Lecture",
                    "subject_code": slot.subject.code if slot.subject else "",
                    "start_time": slot.start_time,
                    "room": slot.room or "TBD",
                    "type": "regular"
                })
            for extra in extras:
                all_lectures.append({
                    "subject_name": extra.subject.name if extra.subject else "Extra Lecture",
                    "subject_code": extra.subject.code if extra.subject else "",
                    "start_time": extra.start_time,
                    "room": extra.room or "TBD",
                    "type": "extra"
                })

            for lec in all_lectures:
                lecture_time = datetime.combine(today, lec["start_time"])
                diff = (lecture_time - now).total_seconds() / 60

                if minutes_before - 1 <= diff <= minutes_before:
                    title = f"🔔 Lecture in {minutes_before} min"
                    message = (
                        f"{lec['subject_name']} ({lec['subject_code']}) — "
                        f"Room {lec['room']} at {lec['start_time'].strftime('%I:%M %p')}"
                    )

                    # Create in-app notification
                    notif = Notification(
                        user_id=faculty.id,
                        title=title,
                        message=message,
                        type="reminder"
                    )
                    db.session.add(notif)

                    # Send email if enabled
                    if email_enabled:
                        try:
                            msg = Message(
                                subject=title,
                                recipients=[faculty.email],
                                body=(
                                    f"Dear {faculty.name},\n\n"
                                    f"Reminder: Your lecture is starting in {minutes_before} minutes.\n\n"
                                    f"📚 Subject: {lec['subject_name']} ({lec['subject_code']})\n"
                                    f"🕐 Time: {lec['start_time'].strftime('%I:%M %p')}\n"
                                    f"🏫 Room: {lec['room']}\n\n"
                                    f"— MIT-ADT University Faculty Portal"
                                )
                            )
                            mail.send(msg)
                            logger.info(f"Reminder sent to {faculty.email}")
                        except Exception as e:
                            logger.error(f"Email failed for {faculty.email}: {e}")

        db.session.commit()


def start_scheduler(app):
    import os
    # Only start scheduler in main process (not in reloader child process)
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or os.environ.get('FLASK_ENV') == 'production':
        scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
        scheduler.add_job(
            func=send_lecture_reminders,
            args=[app],
            trigger="interval",
            minutes=1,
            id="lecture_reminder",
            replace_existing=True
        )
        scheduler.start()
        logger.info("Reminder scheduler started — checking every minute (IST)")
        return scheduler
    else:
        logger.info("Skipping scheduler start in reloader process")
        return None
