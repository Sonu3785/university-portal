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

    # Build DB URI
    database_url = os.getenv("DATABASE_URL")
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '3306')
    db_user = os.getenv('DB_USER', 'root')
    db_pass = os.getenv('DB_PASSWORD', '')
    db_name = os.getenv('DB_NAME', 'university_portal')
    db_ssl  = os.getenv('DB_SSL', 'false').lower() == 'true'

    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"mysql+pymysql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # SSL connect args
    ssl_args = {}
    if db_ssl:
        import os as _os
        cert_path = _os.path.join(_os.path.dirname(__file__), '..', 'aiven-ca.crt')
        cert_path = _os.path.abspath(cert_path)
        if _os.path.exists(cert_path):
            ssl_args = {"ssl": {"ca": cert_path}}
        else:
            # fallback — disable cert verification
            ssl_args = {"ssl": {"ssl_disabled": False}}

    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "connect_args": ssl_args
    }

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
