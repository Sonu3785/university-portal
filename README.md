# UniPortal — University Faculty Management System

A full-stack web portal for university faculty and admin management.

## Tech Stack
- **Backend:** Python + Flask + SQLAlchemy
- **Frontend:** React + Vite + Tailwind CSS
- **Database:** MySQL
- **Email:** Gmail SMTP

---

## Setup Instructions

### 1. MySQL Database
Create the database in MySQL:
```sql
CREATE DATABASE university_portal;
```

### 2. Backend Setup
```bash
cd backend

# Copy and fill in your credentials
cp .env.example .env
# Edit .env with your MySQL credentials and Gmail App Password

# Install dependencies
pip install -r requirements.txt

# Create tables + admin user
python seed.py

# Run the server
python run.py
```
Backend runs at: http://localhost:5000

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: http://localhost:5173

---

## Default Admin Login
```
Email:    admin@university.edu
Password: admin123
```

---

## Features

### Faculty
- Dashboard with today's schedule and subject overview
- Weekly timetable view
- Add extra lectures
- Manual attendance with Tab key navigation
- Attendance reports with defaulter highlighting
- Send defaulter warning emails
- Apply for leave, track status
- Reminder settings (browser + email, customizable timing)

### Admin
- Create and manage faculty accounts
- Create subjects and assign to faculty
- Upload timetable via CSV/Excel
- Upload student list via CSV/Excel (auto-enroll in subjects)
- Approve/reject leave requests (email notification sent)
- Access all faculty features

---

## CSV/Excel Templates

### Timetable Upload
| faculty_email | subject_code | day | start_time | end_time | room |
|---|---|---|---|---|---|
| john@uni.edu | CS301 | Monday | 09:00 | 10:00 | Room 101 |

### Student Upload
| name | roll_number | email | phone | semester | branch | subject_codes |
|---|---|---|---|---|---|---|
| John Doe | CS2024001 | john@student.edu | 9876543210 | 3 | CSE | CS301,CS302 |

---

## Gmail App Password Setup
1. Go to https://myaccount.google.com/apppasswords
2. Generate a 16-character app password
3. Add it to `.env` as `MAIL_PASSWORD`
