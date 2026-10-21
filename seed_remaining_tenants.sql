DO $$
DECLARE
  v_school     UUID;
  v_session    UUID;
  v_class      UUID;
  v_section    UUID;
  v_principal  UUID;
  v_pw TEXT := '$2b$12$uQYUWc1cz8uuORBX4iIvaObA/l/ObeOzxbAW4GX90MaLq5Eow/nIm';
  r_principal  UUID; r_accountant UUID; r_teacher UUID; r_super UUID; r_parent UUID; r_student UUID;
  v_student    UUID;
  v_subj_math  UUID; v_subj_eng UUID; v_subj_sci UUID; v_subj_urdu UUID;
  v_teacher1   UUID; v_teacher2 UUID; v_driver UUID;
  v_acc_cash   UUID; v_acc_revenue UUID;
  v_journal    UUID; v_structure  UUID;
  v_fh_tuition UUID; v_fh_exam    UUID; v_fh_transport UUID; v_fh_lab UUID;
  v_exam       UUID;
  v_student2   UUID;
  v_book_cat   UUID;
  v_book       UUID;
  v_vehicle    UUID;
  v_route      UUID;
  v_route_stop UUID;
  v_hostel     UUID;
  v_room       UUID;
  v_inv_cat    UUID;
  v_item       UUID;
  v_vendor     UUID;
  school_record RECORD;
  user_count   INT;
BEGIN
  FOR school_record IN SELECT id FROM schools LOOP
    v_school := school_record.id;
    
    -- Check if this school already has principal demo user
    SELECT COUNT(*) INTO user_count FROM users WHERE school_id = v_school AND email = 'principal@demo.edu';
    
    IF user_count = 0 THEN
      -- Roles
      INSERT INTO roles (school_id, name, is_system, permissions) VALUES
        (v_school, 'super_admin', true, ARRAY['*'])
        ON CONFLICT (school_id, name) DO UPDATE SET permissions = EXCLUDED.permissions
        RETURNING id INTO r_super;

      INSERT INTO roles (school_id, name, permissions) VALUES
        (v_school, 'principal', ARRAY['students:read','students:write','attendance:mark',
           'fees:read','fees:collect','results:read','exams:enter_marks','audit:read',
           'settings:manage',
           'teachers:read','teachers:write','staff:read','staff:write',
           'staff_attendance:mark','leaves:read','leaves:manage','payroll:read',
           'accounting:read','accounting:post','payroll:manage','fees:write',
           'exams:write','exams:manage',
           'library:read','library:write','library:manage',
           'transport:read','transport:write',
           'hostel:read','hostel:write',
           'inventory:read','inventory:write','inventory:manage',
           'communications:read','communications:write','communications:manage',
           'reports:read',
           'academics:read','academics:write','attendance:read','parent:read'])
        ON CONFLICT (school_id, name) DO UPDATE SET permissions = EXCLUDED.permissions
        RETURNING id INTO r_principal;

      INSERT INTO roles (school_id, name, permissions) VALUES
        (v_school, 'accountant', ARRAY['fees:read','fees:collect','fees:write',
           'payroll:run','accounting:post','students:read',
           'staff:read','payroll:read','leaves:read',
           'accounting:read','payroll:manage',
           'library:read','transport:read','hostel:read',
           'inventory:read','inventory:manage',
           'communications:read',
           'reports:read'])
        ON CONFLICT (school_id, name) DO UPDATE SET permissions = EXCLUDED.permissions
        RETURNING id INTO r_accountant;

      INSERT INTO roles (school_id, name, permissions) VALUES
        (v_school, 'teacher', ARRAY['students:read','attendance:mark','attendance:read',
           'exams:enter_marks','results:read','leaves:read','academics:read'])
        ON CONFLICT (school_id, name) DO UPDATE SET permissions = EXCLUDED.permissions
        RETURNING id INTO r_teacher;

      INSERT INTO roles (school_id, name, permissions) VALUES
        (v_school, 'parent', ARRAY['results:read','fees:read','parent:read'])
        ON CONFLICT (school_id, name) DO UPDATE SET permissions = EXCLUDED.permissions
        RETURNING id INTO r_parent;

      INSERT INTO roles (school_id, name, permissions) VALUES
        (v_school, 'student', ARRAY['results:read','fees:read'])
        ON CONFLICT (school_id, name) DO UPDATE SET permissions = EXCLUDED.permissions
        RETURNING id INTO r_student;

      -- Users
      INSERT INTO users (school_id, role_id, email, password_hash, full_name)
        VALUES (v_school, r_principal, 'principal@demo.edu', v_pw, 'Sara Khan')
        RETURNING id INTO v_principal;

      INSERT INTO users (school_id, role_id, email, password_hash, full_name)
        VALUES (v_school, r_accountant, 'accountant@demo.edu', v_pw, 'Bilal Ahmed');
      
      SELECT COUNT(*) INTO user_count FROM users WHERE school_id = v_school AND email = 'admin@demo.edu';
      IF user_count = 0 THEN
        INSERT INTO users (school_id, role_id, email, password_hash, full_name)
          VALUES (v_school, r_super, 'admin@demo.edu', v_pw, 'System Admin');
      END IF;

      -- Academic structure
      INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_active)
        VALUES (v_school, '2025-2026', '2025-08-01', '2026-06-30', true)
        RETURNING id INTO v_session;

      INSERT INTO classes (session_id, name, level) VALUES (v_session, 'Grade 9', 9)
        RETURNING id INTO v_class;

      INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'A', 40)
        RETURNING id INTO v_section;

      -- Students
      INSERT INTO students (school_id, section_id, admission_no, roll_no, full_name, father_name, gender)
        VALUES (v_school, v_section, 'ADM-0001', '9A-01', 'Ali Raza', 'Imran Raza', 'male')
        RETURNING id INTO v_student;

      INSERT INTO students (school_id, section_id, admission_no, roll_no, full_name, father_name, gender)
        VALUES (v_school, v_section, 'ADM-0002', '9A-02', 'Ayesha Noor', 'Tariq Noor', 'female');

      -- A fee invoice to pay against
      SELECT id INTO v_fh_tuition FROM fee_heads WHERE school_id = v_school AND name = 'tuition';
      IF v_fh_tuition IS NULL THEN
          INSERT INTO fee_heads (school_id, name, amount) VALUES (v_school, 'tuition', 150000) RETURNING id INTO v_fh_tuition;
      ELSE
          UPDATE fee_heads SET amount = 150000 WHERE id = v_fh_tuition;
      END IF;

      INSERT INTO fee_invoices (school_id, student_id, challan_no, total, due_date)
        VALUES (v_school, v_student, 'CH-2026-0001', 1500000, current_date + 10);

      -- Subjects for Grade 9
      INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Mathematics', 'MATH9')
        RETURNING id INTO v_subj_math;
      INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'English', 'ENG9')
        RETURNING id INTO v_subj_eng;
      INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Science', 'SCI9')
        RETURNING id INTO v_subj_sci;
      INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Urdu', 'URD9')
        RETURNING id INTO v_subj_urdu;

      -- Teaching staff
      INSERT INTO staff (school_id, employee_id, staff_type, full_name, gender, designation,
                         qualification, experience_years, base_salary, joining_date, status)
        VALUES (v_school, 'EMP-T001', 'teacher', 'Hassan Mahmood', 'male', 'Senior Teacher',
                'M.Sc Mathematics', 8, 8000000, '2020-08-01', 'active')
        RETURNING id INTO v_teacher1;
      INSERT INTO staff (school_id, employee_id, staff_type, full_name, gender, designation,
                         qualification, experience_years, base_salary, joining_date, status)
        VALUES (v_school, 'EMP-T002', 'teacher', 'Fatima Sheikh', 'female', 'Teacher',
                'M.A English', 5, 6500000, '2022-08-01', 'active')
        RETURNING id INTO v_teacher2;

      UPDATE sections SET teacher_id = v_teacher1 WHERE id = v_section;

      INSERT INTO teacher_subjects (staff_id, subject_id, school_id) VALUES
        (v_teacher1, v_subj_math, v_school),
        (v_teacher1, v_subj_sci, v_school),
        (v_teacher2, v_subj_eng, v_school),
        (v_teacher2, v_subj_urdu, v_school);

      -- A non-teaching staff member.
      INSERT INTO staff (school_id, employee_id, staff_type, full_name, gender, designation,
                         base_salary, joining_date, status)
        VALUES (v_school, 'EMP-D001', 'driver', 'Akram Ali', 'male', 'Bus Driver',
                3500000, '2021-01-15', 'active')
        RETURNING id INTO v_driver;

      INSERT INTO staff_leaves (school_id, staff_id, leave_type, from_date, to_date, days, reason, status)
        VALUES (v_school, v_teacher2, 'casual', current_date + 3, current_date + 4, 2,
                'Family event', 'pending');

      INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in)
        VALUES (v_school, v_teacher1, current_date, 'present', '08:00'),
               (v_school, v_driver,   current_date, 'present', '07:30');

      -- Phase 4: additional fee heads
      INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to, display_order)
        VALUES (v_school, 'Examination Fee',  50000,  false, 'all', 10)
        RETURNING id INTO v_fh_exam;
      INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to, display_order)
        VALUES (v_school, 'Transport Fee',   100000,  true,  'all', 20)
        RETURNING id INTO v_fh_transport;
      INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to, display_order)
        VALUES (v_school, 'Computer Lab Fee', 30000,  true,  'all', 30)
        RETURNING id INTO v_fh_lab;

      -- Phase 4: Chart of Accounts
      INSERT INTO accounts (school_id, code, name, type, is_system)
        VALUES (v_school, '1001', 'Cash', 'asset', true)
        RETURNING id INTO v_acc_cash;
      INSERT INTO accounts (school_id, code, name, type, is_system)
        VALUES (v_school, '2001', 'Accounts Payable', 'liability', true);
      INSERT INTO accounts (school_id, code, name, type, is_system)
        VALUES (v_school, '3001', 'School Capital', 'equity', true);
      INSERT INTO accounts (school_id, code, name, type, is_system)
        VALUES (v_school, '4001', 'Tuition Revenue', 'revenue', true)
        RETURNING id INTO v_acc_revenue;
      INSERT INTO accounts (school_id, code, name, type, is_system)
        VALUES (v_school, '5001', 'Salary Expense', 'expense', true);

      INSERT INTO journal_entries (school_id, ref_no, description, entry_date, status)
        VALUES (v_school, 'JE-SEED-001', 'Seed: tuition receipt demo', current_date, 'posted')
        RETURNING id INTO v_journal;
      INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
        VALUES (v_journal, v_acc_cash,    150000, 0,      'Cash received for tuition'),
               (v_journal, v_acc_revenue, 0,      150000, 'Tuition revenue recognised');
      UPDATE accounts SET balance = balance + 150000 WHERE id = v_acc_cash;
      UPDATE accounts SET balance = balance + 150000 WHERE id = v_acc_revenue;

      -- Phase 4: salary structure
      INSERT INTO salary_structures (school_id, staff_id, name, effective_from)
        VALUES (v_school, v_teacher1, 'Senior Teacher Package', '2025-08-01')
        RETURNING id INTO v_structure;
      INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage)
        VALUES (v_structure, 'HRA',         'allowance', 20000, false),
               (v_structure, 'Medical',     'allowance', 10000, false),
               (v_structure, 'Income Tax',  'deduction', 15000, false);

      -- Phase 5: grade config
      INSERT INTO grade_config (school_id, grade_letter, min_percentage, max_percentage, grade_point, display_order)
        VALUES
          (v_school, 'A+', 90,    100,   4.00, 1),
          (v_school, 'A',  80,    89.99, 3.70, 2),
          (v_school, 'B+', 70,    79.99, 3.30, 3),
          (v_school, 'B',  60,    69.99, 3.00, 4),
          (v_school, 'C+', 50,    59.99, 2.30, 5),
          (v_school, 'C',  40,    49.99, 2.00, 6),
          (v_school, 'D',  33,    39.99, 1.00, 7),
          (v_school, 'F',   0,    32.99, 0.00, 8);

      -- Phase 5: exams
      INSERT INTO exams (school_id, session_id, class_id, name, exam_type, start_date, end_date)
        VALUES (v_school, v_session, v_class, 'First Midterm 2025', 'midterm', '2025-11-01', '2025-11-10')
        RETURNING id INTO v_exam;

      INSERT INTO exam_subjects (exam_id, subject_id, school_id, total_marks, passing_marks)
        VALUES
          (v_exam, v_subj_math, v_school, 100, 40),
          (v_exam, v_subj_eng,  v_school, 100, 40),
          (v_exam, v_subj_sci,  v_school, 100, 40),
          (v_exam, v_subj_urdu, v_school, 100, 40);

      SELECT id INTO v_student2
        FROM students WHERE school_id = v_school AND admission_no = 'ADM-0002';

      INSERT INTO exam_results (exam_id, student_id, subject_id, school_id, marks_obtained, total_marks, entered_by)
        VALUES
          (v_exam, v_student, v_subj_math, v_school, 78, 100, NULL),
          (v_exam, v_student, v_subj_eng,  v_school, 85, 100, NULL),
          (v_exam, v_student, v_subj_sci,  v_school, 72, 100, NULL),
          (v_exam, v_student, v_subj_urdu, v_school, 90, 100, NULL);

      INSERT INTO exam_results (exam_id, student_id, subject_id, school_id, marks_obtained, total_marks, entered_by)
        VALUES
          (v_exam, v_student2, v_subj_math, v_school, 55, 100, NULL),
          (v_exam, v_student2, v_subj_eng,  v_school, 88, 100, NULL),
          (v_exam, v_student2, v_subj_sci,  v_school, 60, 100, NULL),
          (v_exam, v_student2, v_subj_urdu, v_school, 75, 100, NULL);

      -- Phase 6: Library
      INSERT INTO book_categories (school_id, name, description)
        VALUES (v_school, 'Science & Technology', 'Science and technology books for all grades')
        RETURNING id INTO v_book_cat;

      INSERT INTO books (school_id, category_id, title, author, isbn, total_copies, available_copies, fine_per_day)
        VALUES (v_school, v_book_cat, 'Physics for Class 9', 'Dr. A. Salam', '978-969-35-1234-' || SUBSTRING(v_school::text, 1, 4), 5, 5, 500)
        RETURNING id INTO v_book;

      INSERT INTO book_copies (school_id, book_id, barcode, condition, status)
        VALUES (v_school, v_book, 'PHY9-001-' || SUBSTRING(v_school::text, 1, 4), 'good', 'available'),
               (v_school, v_book, 'PHY9-002-' || SUBSTRING(v_school::text, 1, 4), 'good', 'available'),
               (v_school, v_book, 'PHY9-003-' || SUBSTRING(v_school::text, 1, 4), 'good', 'available'),
               (v_school, v_book, 'PHY9-004-' || SUBSTRING(v_school::text, 1, 4), 'good', 'available'),
               (v_school, v_book, 'PHY9-005-' || SUBSTRING(v_school::text, 1, 4), 'good', 'available');

      -- Phase 6: Transport
      INSERT INTO vehicles (school_id, reg_no, vehicle_type, capacity, driver_id, is_active)
        VALUES (v_school, 'ABC-123-' || SUBSTRING(v_school::text, 1, 4), 'bus', 40, v_driver, true)
        RETURNING id INTO v_vehicle;

      INSERT INTO routes (school_id, name, description, vehicle_id, monthly_fee, is_active)
        VALUES (v_school, 'Route A - North City', 'Morning/evening route covering North City area', v_vehicle, 150000, true)
        RETURNING id INTO v_route;

      INSERT INTO route_stops (route_id, school_id, name, stop_order, pickup_time)
        VALUES (v_route, v_school, 'Main Gate', 1, '07:00')
        RETURNING id INTO v_route_stop;
      INSERT INTO route_stops (route_id, school_id, name, stop_order, pickup_time)
        VALUES (v_route, v_school, 'City Park',  2, '07:15');
      INSERT INTO route_stops (route_id, school_id, name, stop_order, pickup_time)
        VALUES (v_route, v_school, 'Mall Road',  3, '07:30');

      INSERT INTO student_transport (school_id, student_id, route_id, stop_id, valid_from, is_active)
        VALUES (v_school, v_student, v_route, v_route_stop, current_date, true);

      -- Phase 6: Hostel
      INSERT INTO hostels (school_id, name, hostel_type, total_capacity)
        VALUES (v_school, 'Boys Hostel Block A', 'boys', 100)
        RETURNING id INTO v_hostel;

      INSERT INTO hostel_rooms (school_id, hostel_id, room_no, room_type, floor, capacity, monthly_fee, is_active)
        VALUES (v_school, v_hostel, '101', 'double', 1, 2, 500000, true)
        RETURNING id INTO v_room;

      INSERT INTO hostel_allocations
        (school_id, student_id, hostel_id, room_id, bed_no, allocated_from, monthly_fee, status)
        VALUES (v_school, v_student, v_hostel, v_room, 'A', current_date, 500000, 'active');

      UPDATE hostel_rooms SET occupied = 1 WHERE id = v_room;

      -- Phase 6: Inventory
      INSERT INTO inventory_categories (school_id, name, description)
        VALUES (v_school, 'Stationery', 'Office and classroom stationery items')
        RETURNING id INTO v_inv_cat;

      INSERT INTO vendors (school_id, name, contact_person, phone)
        VALUES (v_school, 'ABC Stationery Supplies', 'Raheel Ahmed', '0300-1234567')
        RETURNING id INTO v_vendor;

      INSERT INTO inventory_items
        (school_id, category_id, name, unit, quantity_in_stock, reorder_level, unit_cost)
        VALUES (v_school, v_inv_cat, 'A4 Paper Ream', 'ream', 50, 10, 70000)
        RETURNING id INTO v_item;

      INSERT INTO stock_transactions
        (school_id, item_id, txn_type, quantity, reference_type, notes)
        VALUES (v_school, v_item, 'in', 50, 'direct', 'Initial stock entry');

      -- Phase 7: Communications
      INSERT INTO notification_settings (school_id, event_type, channel, is_enabled) VALUES
        (v_school, 'attendance_absent',  'sms',       false),
        (v_school, 'attendance_absent',  'whatsapp',  false),
        (v_school, 'attendance_absent',  'email',     false),
        (v_school, 'fee_due',            'sms',       false),
        (v_school, 'fee_due',            'whatsapp',  false),
        (v_school, 'fee_due',            'email',     false),
        (v_school, 'result_published',   'sms',       false),
        (v_school, 'result_published',   'whatsapp',  false),
        (v_school, 'result_published',   'email',     false);

      INSERT INTO message_templates
        (school_id, name, event_type, channel, body, is_default)
      VALUES
        (v_school, 'Fee Reminder SMS', 'fee_due', 'sms', 'Dear Parent, fee of PKR {{amount}} for {{studentName}} is due on {{dueDate}}. Please pay at the earliest. - {{schoolName}}', true);

      INSERT INTO message_templates
        (school_id, name, event_type, channel, subject, body, is_default)
      VALUES
        (v_school, 'Result Published Email', 'result_published', 'email', 'Exam Results Published - {{examName}}', '<p>Dear Student,</p><p>Results for <strong>{{examName}}</strong> have been published. Please login to EduCore to view your result card.</p><p>Regards,<br>{{schoolName}}</p>', true);

      INSERT INTO announcements
        (school_id, title, message, channels, target_type, status, sent_count, created_by)
      VALUES
        (v_school, 'Welcome to EduCore ERP', 'EduCore ERP system is now live. Students and parents can login to access their portals.', '{sms,email}', 'all_users', 'sent', 3, v_principal);

      RAISE NOTICE 'Seeded school %', v_school;
    END IF;
  END LOOP;
END $$;
