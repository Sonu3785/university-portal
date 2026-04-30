from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_mail import Mail
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import os

load_dotenv()

db = SQLAlchemy()
jwt = JWTManager()
mail = Mail()


def create_app():
    app = Flask(__name__)

    # Config
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "jwt-secret")
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
        f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', 3306)}/{os.getenv('DB_NAME')}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Mail config
    app.config["MAIL_SERVER"] = "smtp.gmail.com"
    app.config["MAIL_PORT"] = 587
    app.config["MAIL_USE_TLS"] = True
    app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
    app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
    app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_DEFAULT_SENDER")

    # Init extensions
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.timetable import timetable_bp
    from app.routes.attendance import attendance_bp
    from app.routes.students import students_bp
    from app.routes.leave import leave_bp
    from app.routes.reports import reports_bp
    from app.routes.admin import admin_bp
    from app.routes.reminder import reminder_bp
    from app.routes.marks import marks_bp
    from app.routes.notifications import notifications_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(timetable_bp, url_prefix="/api/timetable")
    app.register_blueprint(attendance_bp, url_prefix="/api/attendance")
    app.register_blueprint(students_bp, url_prefix="/api/students")
    app.register_blueprint(leave_bp, url_prefix="/api/leave")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(reminder_bp, url_prefix="/api/reminder")
    app.register_blueprint(marks_bp, url_prefix="/api/marks")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")

    with app.app_context():
        db.create_all()

    # Start reminder scheduler
    from app.scheduler import start_scheduler
    start_scheduler(app)

    return app
