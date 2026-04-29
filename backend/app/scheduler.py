"""
Reminder Scheduler — runs in background, checks every minute
and sends email reminders before lectures.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, date, timedelta
import logging

logger = logging.getLogger(__name__)


def send_lecture_reminders(app):
    """Check all faculty timetables and send email reminders."""
    with app.app_context():
        from app import mail, db
        from app.models.timetable import TimetableSlot
        from app.models.extra_lecture import ExtraLecture
        from app.models.reminder_setting import ReminderSetting
        from app.models.user import User
        from flask_mail import Message

        now = datetime.now()
        today = date.today()
        day_name = today.strftime("%A")

        # Only Mon-Fri
        if day_name not in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
            return

        # Get all faculty
        faculty_list = User.query.filter_by(role="faculty", is_active=True).all()

        for faculty in faculty_list:
            # Get reminder settings
            setting = ReminderSetting.query.filter_by(faculty_id=faculty.id).first()
            minutes_before = setting.minutes_before if setting else 10
            email_enabled = setting.email_enabled if setting else True

            if not email_enabled:
                continue

            # Check regular timetable slots
            slots = TimetableSlot.query.filter_by(
                faculty_id=faculty.id, day=day_name
            ).all()

            for slot in slots:
                lecture_time = datetime.combine(today, slot.start_time)
                diff = (lecture_time - now).total_seconds() / 60  # minutes

                # Send if within window: [minutes_before, minutes_before - 1)
                if minutes_before - 1 <= diff <= minutes_before:
                    try:
                        subject_name = slot.subject.name if slot.subject else "Lecture"
                        msg = Message(
                            subject=f"🔔 Reminder: {subject_name} in {minutes_before} minutes",
                            recipients=[faculty.email],
                            body=(
                                f"Dear {faculty.name},\n\n"
                                f"This is a reminder that your lecture is starting soon:\n\n"
                                f"📚 Subject: {subject_name} ({slot.subject.code if slot.subject else ''})\n"
                                f"🕐 Time: {slot.start_time.strftime('%I:%M %p')}\n"
                                f"🏫 Room: {slot.room or 'TBD'}\n\n"
                                f"Please be on time!\n\n"
                                f"— MIT-ADT University Faculty Portal"
                            )
                        )
                        mail.send(msg)
                        logger.info(f"Reminder sent to {faculty.email} for {subject_name}")
                    except Exception as e:
                        logger.error(f"Failed to send reminder to {faculty.email}: {e}")

            # Check extra lectures today
            extras = ExtraLecture.query.filter_by(
                faculty_id=faculty.id, date=today
            ).all()

            for extra in extras:
                lecture_time = datetime.combine(today, extra.start_time)
                diff = (lecture_time - now).total_seconds() / 60

                if minutes_before - 1 <= diff <= minutes_before:
                    try:
                        subject_name = extra.subject.name if extra.subject else "Extra Lecture"
                        msg = Message(
                            subject=f"🔔 Reminder: Extra Lecture — {subject_name} in {minutes_before} minutes",
                            recipients=[faculty.email],
                            body=(
                                f"Dear {faculty.name},\n\n"
                                f"Reminder for your extra lecture:\n\n"
                                f"📚 Subject: {subject_name}\n"
                                f"🕐 Time: {extra.start_time.strftime('%I:%M %p')}\n"
                                f"🏫 Room: {extra.room or 'TBD'}\n"
                                f"📝 Note: {extra.note or '—'}\n\n"
                                f"— MIT-ADT University Faculty Portal"
                            )
                        )
                        mail.send(msg)
                        logger.info(f"Extra lecture reminder sent to {faculty.email}")
                    except Exception as e:
                        logger.error(f"Failed to send extra lecture reminder: {e}")


def start_scheduler(app):
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        func=send_lecture_reminders,
        args=[app],
        trigger="interval",
        minutes=1,
        id="lecture_reminder",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Reminder scheduler started — checking every minute")
    return scheduler
