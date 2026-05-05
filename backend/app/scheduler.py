"""
Reminder Scheduler — runs in background, checks every minute
and sends email reminders before lectures.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, date
import logging

logger = logging.getLogger(__name__)


def send_lecture_reminders(app):
    """Check all faculty timetables and send email reminders + in-app notifications."""
    with app.app_context():
        from app import mail, db
        from app.models.timetable import TimetableSlot
        from app.models.extra_lecture import ExtraLecture
        from app.models.reminder_setting import ReminderSetting
        from app.models.user import User
        from app.models.notification import Notification
        from flask_mail import Message

        # Get IST time
        try:
            from zoneinfo import ZoneInfo
            ist = ZoneInfo("Asia/Kolkata")
            now = datetime.now(ist).replace(tzinfo=None)
        except Exception:
            now = datetime.now()

        today = now.date()
        day_name = now.strftime("%A")

        if day_name not in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]:
            return

        logger.info(f"Scheduler running at {now.strftime('%H:%M:%S')} IST on {day_name}")

        faculty_list = User.query.filter_by(role="faculty", is_active=True).all()

        for faculty in faculty_list:
            # Get reminder settings — default 10 min, both enabled
            setting = ReminderSetting.query.filter_by(faculty_id=faculty.id).first()
            minutes_before = setting.minutes_before if setting else 10
            email_enabled = setting.email_enabled if setting else True
            browser_enabled = setting.browser_enabled if setting else True

            # Get today's slots
            slots = TimetableSlot.query.filter_by(faculty_id=faculty.id, day=day_name).all()
            extras = ExtraLecture.query.filter_by(faculty_id=faculty.id, date=today).all()

            all_lectures = []
            for slot in slots:
                all_lectures.append({
                    "subject_name": slot.subject.name if slot.subject else "Lecture",
                    "subject_code": slot.subject.code if slot.subject else "",
                    "start_time": slot.start_time,
                    "room": slot.room or "TBD",
                })
            for extra in extras:
                all_lectures.append({
                    "subject_name": extra.subject.name if extra.subject else "Extra Lecture",
                    "subject_code": extra.subject.code if extra.subject else "",
                    "start_time": extra.start_time,
                    "room": extra.room or "TBD",
                })

            for lec in all_lectures:
                lecture_time = datetime.combine(today, lec["start_time"])
                diff = (lecture_time - now).total_seconds() / 60

                # Fire if within [minutes_before-1, minutes_before+1] window
                if not (minutes_before - 1 <= diff <= minutes_before + 1):
                    continue

                logger.info(f"Firing reminder for {faculty.name} — {lec['subject_name']} at {lec['start_time']}")

                title = f"🔔 Lecture in {minutes_before} min — {lec['subject_name']}"
                message = (
                    f"{lec['subject_name']} ({lec['subject_code']}) — "
                    f"Room {lec['room']} at {lec['start_time'].strftime('%I:%M %p')}"
                )

                # Always create in-app notification
                try:
                    notif = Notification(
                        user_id=faculty.id,
                        title=title,
                        message=message,
                        type="reminder"
                    )
                    db.session.add(notif)
                    db.session.flush()
                    logger.info(f"In-app notification created for {faculty.name}")
                except Exception as e:
                    logger.error(f"Notification failed for {faculty.name}: {e}")

                # Send email
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
                                f"Please be on time!\n\n"
                                f"— MIT-ADT University Faculty Portal"
                            )
                        )
                        mail.send(msg)
                        logger.info(f"Reminder email sent to {faculty.email}")
                    except Exception as e:
                        logger.error(f"Email failed for {faculty.email}: {e}")

        try:
            db.session.commit()
        except Exception as e:
            logger.error(f"DB commit failed: {e}")
            db.session.rollback()


def start_scheduler(app):
    import os
    # Start in production always, in dev only in main process
    flask_env = os.environ.get('FLASK_ENV', 'development')
    werkzeug_main = os.environ.get('WERKZEUG_RUN_MAIN')

    should_start = (flask_env == 'production') or (werkzeug_main == 'true')

    if should_start:
        try:
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
            logger.info("✅ Reminder scheduler started — checking every minute (IST)")
            return scheduler
        except Exception as e:
            logger.error(f"Scheduler failed to start: {e}")
            return None
    else:
        logger.info("Skipping scheduler (dev reloader process)")
        return None
