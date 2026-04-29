-- ============================================================
--  UniPortal — Sample Data for Testing
--  Run AFTER schema.sql and AFTER python seed.py
--  Usage: mysql -u root -p university_portal < sample_data.sql
-- ============================================================

USE university_portal;

-- ── Sample Faculty ───────────────────────────────────────────
-- Passwords are all: faculty123
-- (Use python seed.py to generate proper bcrypt hashes,
--  or register via admin panel)

INSERT IGNORE INTO users (name, email, password_hash, role, department, phone) VALUES
('Dr. Rajesh Kumar',   'rajesh@university.edu',  'USE_SEED_SCRIPT', 'faculty', 'Computer Science', '9876543210'),
('Prof. Sneha Sharma', 'sneha@university.edu',   'USE_SEED_SCRIPT', 'faculty', 'Computer Science', '9876543211'),
('Dr. Amit Verma',     'amit@university.edu',    'USE_SEED_SCRIPT', 'faculty', 'Electronics',      '9876543212');

-- ── Sample Subjects ──────────────────────────────────────────
-- faculty_id 2 = rajesh, 3 = sneha, 4 = amit (adjust if needed)
INSERT IGNORE INTO subjects (name, code, faculty_id, semester, branch) VALUES
('Data Structures & Algorithms', 'CS301', 2, 3, 'CSE'),
('Operating Systems',            'CS302', 2, 3, 'CSE'),
('Database Management Systems',  'CS303', 3, 4, 'CSE'),
('Computer Networks',            'CS304', 3, 4, 'CSE'),
('Digital Electronics',          'EC301', 4, 3, 'ECE');

-- ── Sample Students ──────────────────────────────────────────
INSERT IGNORE INTO students (name, roll_number, email, phone, semester, branch) VALUES
('Aarav Sharma',    'CS2024001', 'aarav@student.edu',    '9000000001', 3, 'CSE'),
('Priya Patel',     'CS2024002', 'priya@student.edu',    '9000000002', 3, 'CSE'),
('Rohan Gupta',     'CS2024003', 'rohan@student.edu',    '9000000003', 3, 'CSE'),
('Sneha Reddy',     'CS2024004', 'sneha.s@student.edu',  '9000000004', 3, 'CSE'),
('Vikram Singh',    'CS2024005', 'vikram@student.edu',   '9000000005', 3, 'CSE'),
('Ananya Iyer',     'CS2024006', 'ananya@student.edu',   '9000000006', 3, 'CSE'),
('Karthik Nair',    'CS2024007', 'karthik@student.edu',  '9000000007', 3, 'CSE'),
('Meera Joshi',     'CS2024008', 'meera@student.edu',    '9000000008', 3, 'CSE'),
('Arjun Desai',     'CS2024009', 'arjun@student.edu',    '9000000009', 3, 'CSE'),
('Kavya Menon',     'CS2024010', 'kavya@student.edu',    '9000000010', 3, 'CSE'),
('Rahul Verma',     'EC2024001', 'rahul@student.edu',    '9000000011', 3, 'ECE'),
('Divya Kapoor',    'EC2024002', 'divya@student.edu',    '9000000012', 3, 'ECE');

-- ── Enroll Students in Subjects ──────────────────────────────
-- CS students → CS301, CS302, CS303, CS304
INSERT IGNORE INTO subject_students (subject_id, student_id)
SELECT s.id, st.id
FROM subjects s, students st
WHERE s.code IN ('CS301','CS302','CS303','CS304')
  AND st.branch = 'CSE';

-- ECE students → EC301
INSERT IGNORE INTO subject_students (subject_id, student_id)
SELECT s.id, st.id
FROM subjects s, students st
WHERE s.code = 'EC301'
  AND st.branch = 'ECE';

-- ── Sample Timetable ─────────────────────────────────────────
-- faculty_id 2 = rajesh (CS301, CS302)
INSERT IGNORE INTO timetable_slots (faculty_id, subject_id, day, start_time, end_time, room)
SELECT 2, id, 'Monday',    '09:00:00', '10:00:00', 'Room 301' FROM subjects WHERE code = 'CS301';
INSERT IGNORE INTO timetable_slots (faculty_id, subject_id, day, start_time, end_time, room)
SELECT 2, id, 'Monday',    '10:00:00', '11:00:00', 'Room 302' FROM subjects WHERE code = 'CS302';
INSERT IGNORE INTO timetable_slots (faculty_id, subject_id, day, start_time, end_time, room)
SELECT 2, id, 'Wednesday', '09:00:00', '10:00:00', 'Room 301' FROM subjects WHERE code = 'CS301';
INSERT IGNORE INTO timetable_slots (faculty_id, subject_id, day, start_time, end_time, room)
SELECT 2, id, 'Friday',    '11:00:00', '12:00:00', 'Room 301' FROM subjects WHERE code = 'CS301';

-- faculty_id 3 = sneha (CS303, CS304)
INSERT IGNORE INTO timetable_slots (faculty_id, subject_id, day, start_time, end_time, room)
SELECT 3, id, 'Tuesday',   '09:00:00', '10:00:00', 'Lab A'    FROM subjects WHERE code = 'CS303';
INSERT IGNORE INTO timetable_slots (faculty_id, subject_id, day, start_time, end_time, room)
SELECT 3, id, 'Thursday',  '10:00:00', '11:00:00', 'Room 303' FROM subjects WHERE code = 'CS304';
INSERT IGNORE INTO timetable_slots (faculty_id, subject_id, day, start_time, end_time, room)
SELECT 3, id, 'Friday',    '09:00:00', '10:00:00', 'Lab A'    FROM subjects WHERE code = 'CS303';

-- faculty_id 4 = amit (EC301)
INSERT IGNORE INTO timetable_slots (faculty_id, subject_id, day, start_time, end_time, room)
SELECT 4, id, 'Monday',    '11:00:00', '12:00:00', 'EC Lab'   FROM subjects WHERE code = 'EC301';
INSERT IGNORE INTO timetable_slots (faculty_id, subject_id, day, start_time, end_time, room)
SELECT 4, id, 'Wednesday', '11:00:00', '12:00:00', 'EC Lab'   FROM subjects WHERE code = 'EC301';

-- ── Sample Attendance (last 2 weeks) ─────────────────────────
-- CS301 attendance for all CSE students
INSERT IGNORE INTO attendance (student_id, subject_id, faculty_id, date, status)
SELECT st.id, s.id, s.faculty_id,
       DATE_SUB(CURDATE(), INTERVAL n DAY),
       IF(RAND() > 0.25, 'present', 'absent')
FROM students st
JOIN subject_students ss ON ss.student_id = st.id
JOIN subjects s ON s.id = ss.subject_id
CROSS JOIN (
    SELECT 1 AS n UNION SELECT 3 UNION SELECT 5
    UNION SELECT 8 UNION SELECT 10 UNION SELECT 12
) dates
WHERE st.branch = 'CSE';

SELECT 'Sample data inserted!' AS Status;
