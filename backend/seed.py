"""
Run once to create admin user and sample data.
Usage: python seed.py
"""
from app import create_app, db
from app.models.user import User

app = create_app()

with app.app_context():
    db.create_all()

    # Create admin if not exists
    if not User.query.filter_by(email="admin@university.edu").first():
        admin = User(
            name="Admin",
            email="admin@university.edu",
            role="admin",
            department="Administration"
        )
        admin.set_password("admin123")
        db.session.add(admin)
        db.session.commit()
        print("✅ Admin created: admin@university.edu / admin123")
    else:
        print("ℹ️  Admin already exists")

    print("✅ Database tables created")
