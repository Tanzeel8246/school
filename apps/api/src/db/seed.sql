-- Massive Demo Data Seed. Password for every seeded user is: Passw0rd!
-- (bcrypt cost 12 hash below)
DO $$
DECLARE
  v_school     UUID;
  v_session    UUID;
  v_principal  UUID;
  v_pw TEXT := '$2a$12$XWn9oEO7Vf21.jv6ON5QHu1sczVqYZviVBHEU5JW0QaQ1SCVAZIiW';
  r_principal  UUID; r_accountant UUID; r_teacher UUID; r_parent UUID; r_student UUID; r_super UUID;
  
  -- Account variables
  a_cash UUID; a_bank UUID; a_rec UUID; a_pay UUID; a_cap UUID; a_ret UUID;
  a_tuit UUID; a_tran UUID; a_host UUID; a_exam UUID; a_oth UUID;
  a_sal UUID; a_util UUID; a_rent UUID; a_maint UUID; a_stat UUID; a_texp UUID;

  -- Fee Heads
  fh_tuition UUID; fh_exam UUID; fh_transport UUID; fh_lab UUID; fh_activity UUID;

  -- Book Categories
  bc_sci UUID; bc_math UUID; bc_eng UUID; bc_urdu UUID; bc_isl UUID;

  -- Vehicles and Routes
  vh_bus UUID; vh_van UUID; rt_a UUID; rt_b UUID; rs_1 UUID; rs_2 UUID; rs_3 UUID; rs_4 UUID;
  v_vehicle UUID;

  -- Hostel
  hst_boys UUID;
  
  -- Temp variables
  v_class UUID; v_secA UUID; v_secB UUID; v_teacher UUID; v_student UUID; v_guardian UUID;
  v_subj UUID; v_exam UUID; v_invoice UUID; v_journal UUID;
  v_book UUID; v_item UUID; v_vendor UUID; v_inv_cat UUID; v_structure UUID;
BEGIN
  INSERT INTO schools (name, code) VALUES ('Demo Public School', 'DPS') RETURNING id INTO v_school;

  -- Roles
  INSERT INTO roles (school_id, name, is_system, permissions) VALUES (v_school, 'super_admin', true, ARRAY['*']) RETURNING id INTO r_super;
  INSERT INTO roles (school_id, name, permissions) VALUES (v_school, 'principal', ARRAY['students:read','students:write','attendance:mark','fees:read','fees:collect','results:read','exams:enter_marks','audit:read','settings:manage','teachers:read','teachers:write','staff:read','staff:write','staff_attendance:mark','leaves:read','leaves:manage','payroll:read','accounting:read','accounting:post','payroll:manage','fees:write','exams:write','exams:manage','library:read','library:write','library:manage','transport:read','transport:write','hostel:read','hostel:write','inventory:read','inventory:write','inventory:manage','communications:read','communications:write','communications:manage','reports:read','academics:read','academics:write','attendance:read','parent:read']) RETURNING id INTO r_principal;
  INSERT INTO roles (school_id, name, permissions) VALUES (v_school, 'accountant', ARRAY['fees:read','fees:collect','fees:write','payroll:run','accounting:post','students:read','staff:read','payroll:read','leaves:read','accounting:read','payroll:manage','library:read','transport:read','hostel:read','inventory:read','inventory:manage','communications:read','reports:read']) RETURNING id INTO r_accountant;
  INSERT INTO roles (school_id, name, permissions) VALUES (v_school, 'teacher', ARRAY['students:read','attendance:mark','attendance:read','exams:enter_marks','results:read','leaves:read','academics:read']) RETURNING id INTO r_teacher;
  INSERT INTO roles (school_id, name, permissions) VALUES (v_school, 'parent', ARRAY['results:read','fees:read','parent:read']) RETURNING id INTO r_parent;
  INSERT INTO roles (school_id, name, permissions) VALUES (v_school, 'student', ARRAY['results:read','fees:read']) RETURNING id INTO r_student;

  -- Core Users
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_principal, 'principal@demo.edu', v_pw, 'Sara Khan') RETURNING id INTO v_principal;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_accountant, 'accountant@demo.edu', v_pw, 'Bilal Ahmed');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_super, 'admin@demo.edu', v_pw, 'System Admin');

  -- Session
  INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_active) VALUES (v_school, '2025-2026', '2025-08-01', '2026-06-30', true) RETURNING id INTO v_session;

  -- Accounts
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '1001', 'Cash in Hand', 'asset', true) RETURNING id INTO a_cash;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '1002', 'Bank Account', 'asset', true) RETURNING id INTO a_bank;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '1003', 'Accounts Receivable', 'asset', true) RETURNING id INTO a_rec;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '2001', 'Accounts Payable', 'liability', true) RETURNING id INTO a_pay;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '3001', 'School Capital', 'equity', true) RETURNING id INTO a_cap;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '3002', 'Retained Earnings', 'equity', true) RETURNING id INTO a_ret;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '4001', 'Tuition Fee Revenue', 'revenue', true) RETURNING id INTO a_tuit;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '4002', 'Transport Fee Revenue', 'revenue', true) RETURNING id INTO a_tran;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '4003', 'Hostel Fee Revenue', 'revenue', true) RETURNING id INTO a_host;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '4004', 'Exam Fee Revenue', 'revenue', true) RETURNING id INTO a_exam;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '4005', 'Other Income', 'revenue', true) RETURNING id INTO a_oth;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '5001', 'Staff Salary Expense', 'expense', true) RETURNING id INTO a_sal;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '5002', 'Utility Expense', 'expense', true) RETURNING id INTO a_util;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '5003', 'Rent Expense', 'expense', true) RETURNING id INTO a_rent;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '5004', 'Maintenance Expense', 'expense', true) RETURNING id INTO a_maint;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '5005', 'Stationery Expense', 'expense', true) RETURNING id INTO a_stat;
  INSERT INTO accounts (school_id, code, name, type, is_system) VALUES (v_school, '5006', 'Transport Expense', 'expense', true) RETURNING id INTO a_texp;

  -- Fee Heads
  INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to, display_order) VALUES (v_school, 'Tuition Fee', 150000, true, 'all', 1) RETURNING id INTO fh_tuition;
  INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to, display_order) VALUES (v_school, 'Examination Fee', 50000, false, 'all', 2) RETURNING id INTO fh_exam;
  INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to, display_order) VALUES (v_school, 'Transport Fee', 100000, true, 'all', 3) RETURNING id INTO fh_transport;
  INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to, display_order) VALUES (v_school, 'Computer Lab Fee', 30000, true, 'all', 4) RETURNING id INTO fh_lab;
  INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to, display_order) VALUES (v_school, 'Activity Fee', 20000, true, 'all', 5) RETURNING id INTO fh_activity;

  -- Grade Config
  INSERT INTO grade_config (school_id, grade_letter, min_percentage, max_percentage, grade_point, display_order) VALUES
      (v_school, 'A+', 90, 100, 4.00, 1),
      (v_school, 'A', 80, 89.99, 3.70, 2),
      (v_school, 'B+', 70, 79.99, 3.30, 3),
      (v_school, 'B', 60, 69.99, 3.00, 4),
      (v_school, 'C+', 50, 59.99, 2.30, 5),
      (v_school, 'C', 40, 49.99, 2.00, 6),
      (v_school, 'D', 33, 39.99, 1.00, 7),
      (v_school, 'F', 0, 32.99, 0.00, 8);

-- Teachers
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher1@demo.edu', v_pw, 'Asad Ali') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T010', 'teacher', 'Asad Ali', 'Senior Teacher', 9900000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher2@demo.edu', v_pw, 'Nadia Hussain') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T011', 'teacher', 'Nadia Hussain', 'Senior Teacher', 10500000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher3@demo.edu', v_pw, 'Samiullah') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T012', 'teacher', 'Samiullah', 'Senior Teacher', 6100000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher4@demo.edu', v_pw, 'Quratulain') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T013', 'teacher', 'Quratulain', 'Senior Teacher', 10400000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher5@demo.edu', v_pw, 'Kamran Akmal') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T014', 'teacher', 'Kamran Akmal', 'Senior Teacher', 5900000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher6@demo.edu', v_pw, 'Mehwish Hayat') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T015', 'teacher', 'Mehwish Hayat', 'Senior Teacher', 7100000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher7@demo.edu', v_pw, 'Imran Nazir') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T016', 'teacher', 'Imran Nazir', 'Senior Teacher', 6300000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher8@demo.edu', v_pw, 'Sadaf Tariq') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T017', 'teacher', 'Sadaf Tariq', 'Senior Teacher', 7800000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher9@demo.edu', v_pw, 'Zahid Khan') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T018', 'teacher', 'Zahid Khan', 'Senior Teacher', 10100000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher10@demo.edu', v_pw, 'Madiha Rizvi') RETURNING id INTO v_teacher;
  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T019', 'teacher', 'Madiha Rizvi', 'Senior Teacher', 11900000, '2020-08-01', 'active') RETURNING id INTO v_teacher;
  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;
  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);
  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');
-- Other Staff
  INSERT INTO staff (school_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, 'EMP-S010', 'driver', 'Sher Ali', 'DRIVER', 3300000, '2021-01-15', 'active');
  INSERT INTO staff (school_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, 'EMP-S011', 'peon', 'Ghulam Rasool', 'PEON', 3900000, '2021-01-15', 'active');
  INSERT INTO staff (school_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, 'EMP-S012', 'security', 'Nawab Din', 'SECURITY', 3200000, '2021-01-15', 'active');
  INSERT INTO staff (school_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, 'EMP-S013', 'librarian', 'Samina Gul', 'LIBRARIAN', 3400000, '2021-01-15', 'active');
  INSERT INTO staff (school_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, 'EMP-S014', 'lab_assistant', 'Asif Raza', 'LAB ASSISTANT', 2500000, '2021-01-15', 'active');
-- Class: Nursery
  INSERT INTO classes (session_id, school_id, name, level) VALUES (v_session, v_school, 'Nursery', 1) RETURNING id INTO v_class;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'English', 'ENG1') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Urdu', 'URD1') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Math', 'MAT1') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Islamiyat', 'ISL1') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Drawing', 'DRA1') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'A', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 1
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student1@demo.edu', v_pw, 'Ayesha Ahmed') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0001', '1A-01', 'Ayesha Ahmed', 'Bilal Ahmed', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent1@demo.edu', v_pw, 'Bilal Ahmed') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Bilal Ahmed', 'Father', '03001234001') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0001', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 2
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student2@demo.edu', v_pw, 'Ali Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0002', '1A-02', 'Ali Qureshi', 'Shahzaib Qureshi', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent2@demo.edu', v_pw, 'Shahzaib Qureshi') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Qureshi', 'Father', '03001234002') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0002', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 3
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student3@demo.edu', v_pw, 'Hassan Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0003', '1A-03', 'Hassan Sheikh', 'Hussain Malik', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent3@demo.edu', v_pw, 'Hussain Malik') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hussain Malik', 'Father', '03001234003') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0003', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 4
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student4@demo.edu', v_pw, 'Bilal Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0004', '1A-04', 'Bilal Qureshi', 'Ali Baig', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent4@demo.edu', v_pw, 'Ali Baig') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ali Baig', 'Father', '03001234004') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0004', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 5
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student5@demo.edu', v_pw, 'Shahzaib Ahmed') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0005', '1A-05', 'Shahzaib Ahmed', 'Shahzaib Mahmood', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent5@demo.edu', v_pw, 'Shahzaib Mahmood') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Mahmood', 'Father', '03001234005') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0005', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 6
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student6@demo.edu', v_pw, 'Faizan Shah') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0006', '1A-06', 'Faizan Shah', 'Hassan Baig', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent6@demo.edu', v_pw, 'Hassan Baig') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hassan Baig', 'Father', '03001234006') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0006', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 7
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student7@demo.edu', v_pw, 'Usman Iqbal') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0007', '1A-07', 'Usman Iqbal', 'Saad Iqbal', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent7@demo.edu', v_pw, 'Saad Iqbal') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Iqbal', 'Father', '03001234007') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0007', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 8
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student8@demo.edu', v_pw, 'Maha Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0008', '1A-08', 'Maha Qureshi', 'Raza Khan', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent8@demo.edu', v_pw, 'Raza Khan') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Raza Khan', 'Father', '03001234008') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0008', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 9
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student9@demo.edu', v_pw, 'Rida Hussain') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0009', '1A-09', 'Rida Hussain', 'Saad Ali', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent9@demo.edu', v_pw, 'Saad Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Ali', 'Father', '03001234009') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0009', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 10
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student10@demo.edu', v_pw, 'Zainab Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0010', '1A-10', 'Zainab Baig', 'Omar Sheikh', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent10@demo.edu', v_pw, 'Omar Sheikh') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Omar Sheikh', 'Father', '03001234010') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0010', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'B', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 11
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student11@demo.edu', v_pw, 'Raza Mahmood') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0011', '1B-01', 'Raza Mahmood', 'Zain Chaudhry', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent11@demo.edu', v_pw, 'Zain Chaudhry') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Zain Chaudhry', 'Father', '03001234011') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0011', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 12
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student12@demo.edu', v_pw, 'Maha Khan') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0012', '1B-02', 'Maha Khan', 'Hassan Tariq', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent12@demo.edu', v_pw, 'Hassan Tariq') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hassan Tariq', 'Father', '03001234012') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0012', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 13
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student13@demo.edu', v_pw, 'Rida Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0013', '1B-03', 'Rida Qureshi', 'Hamza Ahmed', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent13@demo.edu', v_pw, 'Hamza Ahmed') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hamza Ahmed', 'Father', '03001234013') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0013', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 14
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student14@demo.edu', v_pw, 'Noman Raza') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0014', '1B-04', 'Noman Raza', 'Noman Mahmood', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent14@demo.edu', v_pw, 'Noman Mahmood') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Noman Mahmood', 'Father', '03001234014') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0014', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 15
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student15@demo.edu', v_pw, 'Maha Raza') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0015', '1B-05', 'Maha Raza', 'Hussain Raza', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent15@demo.edu', v_pw, 'Hussain Raza') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hussain Raza', 'Father', '03001234015') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0015', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 16
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student16@demo.edu', v_pw, 'Hafsa Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0016', '1B-06', 'Hafsa Baig', 'Noman Raza', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent16@demo.edu', v_pw, 'Noman Raza') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Noman Raza', 'Father', '03001234016') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0016', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 17
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student17@demo.edu', v_pw, 'Zain Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0017', '1B-07', 'Zain Tariq', 'Shahzaib Khan', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent17@demo.edu', v_pw, 'Shahzaib Khan') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Khan', 'Father', '03001234017') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0017', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 18
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student18@demo.edu', v_pw, 'Maryam Iqbal') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0018', '1B-08', 'Maryam Iqbal', 'Ahmad Ali', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent18@demo.edu', v_pw, 'Ahmad Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ahmad Ali', 'Father', '03001234018') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0018', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 19
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student19@demo.edu', v_pw, 'Omar Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0019', '1B-09', 'Omar Tariq', 'Usman Raza', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent19@demo.edu', v_pw, 'Usman Raza') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Usman Raza', 'Father', '03001234019') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0019', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 20
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student20@demo.edu', v_pw, 'Hassan Khan') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0020', '1B-10', 'Hassan Khan', 'Faizan Ahmed', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent20@demo.edu', v_pw, 'Faizan Ahmed') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Faizan Ahmed', 'Father', '03001234020') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0020', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
-- Class: KG
  INSERT INTO classes (session_id, school_id, name, level) VALUES (v_session, v_school, 'KG', 2) RETURNING id INTO v_class;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'English', 'ENG2') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Urdu', 'URD2') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Math', 'MAT2') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Islamiyat', 'ISL2') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Drawing', 'DRA2') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'A', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 21
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student21@demo.edu', v_pw, 'Maryam Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0021', '2A-01', 'Maryam Sheikh', 'Zain Ahmed', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent21@demo.edu', v_pw, 'Zain Ahmed') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Zain Ahmed', 'Father', '03001234021') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0021', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 22
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student22@demo.edu', v_pw, 'Hussain Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0022', '2A-02', 'Hussain Sheikh', 'Hassan Khan', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent22@demo.edu', v_pw, 'Hassan Khan') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hassan Khan', 'Father', '03001234022') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0022', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 23
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student23@demo.edu', v_pw, 'Omar Chaudhry') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0023', '2A-03', 'Omar Chaudhry', 'Hamza Ali', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent23@demo.edu', v_pw, 'Hamza Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hamza Ali', 'Father', '03001234023') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0023', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 24
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student24@demo.edu', v_pw, 'Bilal Malik') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0024', '2A-04', 'Bilal Malik', 'Shahzaib Khan', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent24@demo.edu', v_pw, 'Shahzaib Khan') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Khan', 'Father', '03001234024') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0024', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 25
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student25@demo.edu', v_pw, 'Khadija Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0025', '2A-05', 'Khadija Sheikh', 'Raza Raza', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent25@demo.edu', v_pw, 'Raza Raza') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Raza Raza', 'Father', '03001234025') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0025', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 26
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student26@demo.edu', v_pw, 'Zainab Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0026', '2A-06', 'Zainab Tariq', 'Hamza Ali', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent26@demo.edu', v_pw, 'Hamza Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hamza Ali', 'Father', '03001234026') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0026', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 27
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student27@demo.edu', v_pw, 'Omar Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0027', '2A-07', 'Omar Baig', 'Shahzaib Raza', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent27@demo.edu', v_pw, 'Shahzaib Raza') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Raza', 'Father', '03001234027') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0027', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 28
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student28@demo.edu', v_pw, 'Sadia Shah') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0028', '2A-08', 'Sadia Shah', 'Ahmad Malik', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent28@demo.edu', v_pw, 'Ahmad Malik') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ahmad Malik', 'Father', '03001234028') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0028', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 29
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student29@demo.edu', v_pw, 'Saad Khan') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0029', '2A-09', 'Saad Khan', 'Omar Ali', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent29@demo.edu', v_pw, 'Omar Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Omar Ali', 'Father', '03001234029') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0029', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 30
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student30@demo.edu', v_pw, 'Zain Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0030', '2A-10', 'Zain Sheikh', 'Abdullah Ali', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent30@demo.edu', v_pw, 'Abdullah Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Abdullah Ali', 'Father', '03001234030') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0030', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'B', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 31
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student31@demo.edu', v_pw, 'Rida Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0031', '2B-01', 'Rida Tariq', 'Hamza Nawaz', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent31@demo.edu', v_pw, 'Hamza Nawaz') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hamza Nawaz', 'Father', '03001234031') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0031', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 32
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student32@demo.edu', v_pw, 'Omar Shah') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0032', '2B-02', 'Omar Shah', 'Raza Malik', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent32@demo.edu', v_pw, 'Raza Malik') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Raza Malik', 'Father', '03001234032') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0032', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 33
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student33@demo.edu', v_pw, 'Hussain Ali') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0033', '2B-03', 'Hussain Ali', 'Shahzaib Raza', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent33@demo.edu', v_pw, 'Shahzaib Raza') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Raza', 'Father', '03001234033') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0033', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 34
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student34@demo.edu', v_pw, 'Rida Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0034', '2B-04', 'Rida Qureshi', 'Shahzaib Tariq', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent34@demo.edu', v_pw, 'Shahzaib Tariq') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Tariq', 'Father', '03001234034') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0034', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 35
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student35@demo.edu', v_pw, 'Bilal Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0035', '2B-05', 'Bilal Baig', 'Abdullah Malik', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent35@demo.edu', v_pw, 'Abdullah Malik') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Abdullah Malik', 'Father', '03001234035') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0035', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 36
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student36@demo.edu', v_pw, 'Hira Khan') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0036', '2B-06', 'Hira Khan', 'Saad Malik', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent36@demo.edu', v_pw, 'Saad Malik') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Malik', 'Father', '03001234036') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0036', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 37
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student37@demo.edu', v_pw, 'Rida Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0037', '2B-07', 'Rida Baig', 'Faizan Tariq', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent37@demo.edu', v_pw, 'Faizan Tariq') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Faizan Tariq', 'Father', '03001234037') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0037', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 38
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student38@demo.edu', v_pw, 'Bilal Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0038', '2B-08', 'Bilal Tariq', 'Saad Tariq', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent38@demo.edu', v_pw, 'Saad Tariq') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Tariq', 'Father', '03001234038') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0038', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 39
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student39@demo.edu', v_pw, 'Abdullah Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0039', '2B-09', 'Abdullah Baig', 'Omar Hussain', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent39@demo.edu', v_pw, 'Omar Hussain') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Omar Hussain', 'Father', '03001234039') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0039', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 40
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student40@demo.edu', v_pw, 'Sadia Chaudhry') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0040', '2B-10', 'Sadia Chaudhry', 'Shahzaib Ahmed', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent40@demo.edu', v_pw, 'Shahzaib Ahmed') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Ahmed', 'Father', '03001234040') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0040', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
-- Class: Grade 1
  INSERT INTO classes (session_id, school_id, name, level) VALUES (v_session, v_school, 'Grade 1', 3) RETURNING id INTO v_class;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'English', 'ENG3') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Urdu', 'URD3') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Math', 'MAT3') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Islamiyat', 'ISL3') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'General Science', 'GEN3') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Social Studies', 'SOC3') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Computer', 'COM3') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'A', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 41
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student41@demo.edu', v_pw, 'Raza Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0041', '3A-01', 'Raza Qureshi', 'Usman Chaudhry', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent41@demo.edu', v_pw, 'Usman Chaudhry') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Usman Chaudhry', 'Father', '03001234041') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0041', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 42
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student42@demo.edu', v_pw, 'Raza Malik') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0042', '3A-02', 'Raza Malik', 'Shahzaib Hussain', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent42@demo.edu', v_pw, 'Shahzaib Hussain') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Hussain', 'Father', '03001234042') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0042', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 43
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student43@demo.edu', v_pw, 'Saad Nawaz') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0043', '3A-03', 'Saad Nawaz', 'Saad Tariq', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent43@demo.edu', v_pw, 'Saad Tariq') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Tariq', 'Father', '03001234043') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0043', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 44
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student44@demo.edu', v_pw, 'Khadija Ahmed') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0044', '3A-04', 'Khadija Ahmed', 'Saad Ahmed', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent44@demo.edu', v_pw, 'Saad Ahmed') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Ahmed', 'Father', '03001234044') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0044', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 45
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student45@demo.edu', v_pw, 'Usman Raza') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0045', '3A-05', 'Usman Raza', 'Shahzaib Hussain', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent45@demo.edu', v_pw, 'Shahzaib Hussain') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Hussain', 'Father', '03001234045') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0045', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 46
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student46@demo.edu', v_pw, 'Hassan Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0046', '3A-06', 'Hassan Baig', 'Saad Malik', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent46@demo.edu', v_pw, 'Saad Malik') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Malik', 'Father', '03001234046') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0046', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 47
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student47@demo.edu', v_pw, 'Ayesha Malik') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0047', '3A-07', 'Ayesha Malik', 'Usman Qureshi', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent47@demo.edu', v_pw, 'Usman Qureshi') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Usman Qureshi', 'Father', '03001234047') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0047', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 48
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student48@demo.edu', v_pw, 'Anum Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0048', '3A-08', 'Anum Qureshi', 'Noman Iqbal', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent48@demo.edu', v_pw, 'Noman Iqbal') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Noman Iqbal', 'Father', '03001234048') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0048', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 49
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student49@demo.edu', v_pw, 'Ahmad Chaudhry') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0049', '3A-09', 'Ahmad Chaudhry', 'Hussain Malik', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent49@demo.edu', v_pw, 'Hussain Malik') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hussain Malik', 'Father', '03001234049') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0049', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 50
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student50@demo.edu', v_pw, 'Maryam Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0050', '3A-10', 'Maryam Sheikh', 'Omar Ahmed', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent50@demo.edu', v_pw, 'Omar Ahmed') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Omar Ahmed', 'Father', '03001234050') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0050', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'B', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 51
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student51@demo.edu', v_pw, 'Hamza Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0051', '3B-01', 'Hamza Tariq', 'Saad Baig', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent51@demo.edu', v_pw, 'Saad Baig') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Baig', 'Father', '03001234051') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0051', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 52
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student52@demo.edu', v_pw, 'Ali Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0052', '3B-02', 'Ali Baig', 'Noman Qureshi', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent52@demo.edu', v_pw, 'Noman Qureshi') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Noman Qureshi', 'Father', '03001234052') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0052', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 53
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student53@demo.edu', v_pw, 'Shahzaib Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0053', '3B-03', 'Shahzaib Baig', 'Ahmad Chaudhry', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent53@demo.edu', v_pw, 'Ahmad Chaudhry') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ahmad Chaudhry', 'Father', '03001234053') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0053', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 54
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student54@demo.edu', v_pw, 'Noman Ali') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0054', '3B-04', 'Noman Ali', 'Ali Sheikh', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent54@demo.edu', v_pw, 'Ali Sheikh') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ali Sheikh', 'Father', '03001234054') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0054', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 55
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student55@demo.edu', v_pw, 'Fatima Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0055', '3B-05', 'Fatima Baig', 'Zain Sheikh', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent55@demo.edu', v_pw, 'Zain Sheikh') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Zain Sheikh', 'Father', '03001234055') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0055', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 56
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student56@demo.edu', v_pw, 'Anum Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0056', '3B-06', 'Anum Tariq', 'Omar Ali', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent56@demo.edu', v_pw, 'Omar Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Omar Ali', 'Father', '03001234056') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0056', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 57
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student57@demo.edu', v_pw, 'Noman Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0057', '3B-07', 'Noman Sheikh', 'Zain Malik', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent57@demo.edu', v_pw, 'Zain Malik') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Zain Malik', 'Father', '03001234057') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0057', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 58
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student58@demo.edu', v_pw, 'Sadia Ali') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0058', '3B-08', 'Sadia Ali', 'Omar Shah', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent58@demo.edu', v_pw, 'Omar Shah') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Omar Shah', 'Father', '03001234058') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0058', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 59
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student59@demo.edu', v_pw, 'Ahmad Chaudhry') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0059', '3B-09', 'Ahmad Chaudhry', 'Ahmad Baig', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent59@demo.edu', v_pw, 'Ahmad Baig') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ahmad Baig', 'Father', '03001234059') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0059', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 60
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student60@demo.edu', v_pw, 'Noman Iqbal') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0060', '3B-10', 'Noman Iqbal', 'Ahmad Ali', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent60@demo.edu', v_pw, 'Ahmad Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ahmad Ali', 'Father', '03001234060') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0060', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
-- Class: Grade 2
  INSERT INTO classes (session_id, school_id, name, level) VALUES (v_session, v_school, 'Grade 2', 4) RETURNING id INTO v_class;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'English', 'ENG4') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Urdu', 'URD4') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Math', 'MAT4') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Islamiyat', 'ISL4') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'General Science', 'GEN4') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Social Studies', 'SOC4') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Computer', 'COM4') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'A', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 61
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student61@demo.edu', v_pw, 'Omar Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0061', '4A-01', 'Omar Baig', 'Ali Khan', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent61@demo.edu', v_pw, 'Ali Khan') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ali Khan', 'Father', '03001234061') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0061', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 62
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student62@demo.edu', v_pw, 'Hamza Khan') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0062', '4A-02', 'Hamza Khan', 'Hussain Mahmood', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent62@demo.edu', v_pw, 'Hussain Mahmood') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hussain Mahmood', 'Father', '03001234062') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0062', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 63
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student63@demo.edu', v_pw, 'Ahmad Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0063', '4A-03', 'Ahmad Tariq', 'Usman Mahmood', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent63@demo.edu', v_pw, 'Usman Mahmood') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Usman Mahmood', 'Father', '03001234063') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0063', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 64
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student64@demo.edu', v_pw, 'Fatima Ali') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0064', '4A-04', 'Fatima Ali', 'Ali Nawaz', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent64@demo.edu', v_pw, 'Ali Nawaz') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ali Nawaz', 'Father', '03001234064') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0064', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 65
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student65@demo.edu', v_pw, 'Zainab Khan') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0065', '4A-05', 'Zainab Khan', 'Ali Tariq', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent65@demo.edu', v_pw, 'Ali Tariq') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ali Tariq', 'Father', '03001234065') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0065', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 66
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student66@demo.edu', v_pw, 'Sadia Iqbal') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0066', '4A-06', 'Sadia Iqbal', 'Abdullah Ali', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent66@demo.edu', v_pw, 'Abdullah Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Abdullah Ali', 'Father', '03001234066') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0066', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 67
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student67@demo.edu', v_pw, 'Hussain Khan') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0067', '4A-07', 'Hussain Khan', 'Zain Baig', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent67@demo.edu', v_pw, 'Zain Baig') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Zain Baig', 'Father', '03001234067') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0067', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 68
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student68@demo.edu', v_pw, 'Nida Ahmed') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0068', '4A-08', 'Nida Ahmed', 'Saad Hussain', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent68@demo.edu', v_pw, 'Saad Hussain') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Hussain', 'Father', '03001234068') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0068', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 69
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student69@demo.edu', v_pw, 'Nida Nawaz') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0069', '4A-09', 'Nida Nawaz', 'Omar Raza', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent69@demo.edu', v_pw, 'Omar Raza') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Omar Raza', 'Father', '03001234069') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0069', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 70
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student70@demo.edu', v_pw, 'Hussain Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0070', '4A-10', 'Hussain Baig', 'Abdullah Baig', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent70@demo.edu', v_pw, 'Abdullah Baig') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Abdullah Baig', 'Father', '03001234070') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0070', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'B', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 71
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student71@demo.edu', v_pw, 'Sadia Mahmood') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0071', '4B-01', 'Sadia Mahmood', 'Ali Qureshi', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent71@demo.edu', v_pw, 'Ali Qureshi') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ali Qureshi', 'Father', '03001234071') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0071', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 72
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student72@demo.edu', v_pw, 'Faizan Khan') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0072', '4B-02', 'Faizan Khan', 'Noman Iqbal', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent72@demo.edu', v_pw, 'Noman Iqbal') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Noman Iqbal', 'Father', '03001234072') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0072', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 73
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student73@demo.edu', v_pw, 'Usman Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0073', '4B-03', 'Usman Qureshi', 'Hussain Raza', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent73@demo.edu', v_pw, 'Hussain Raza') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hussain Raza', 'Father', '03001234073') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0073', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 74
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student74@demo.edu', v_pw, 'Shahzaib Iqbal') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0074', '4B-04', 'Shahzaib Iqbal', 'Usman Khan', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent74@demo.edu', v_pw, 'Usman Khan') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Usman Khan', 'Father', '03001234074') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0074', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 75
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student75@demo.edu', v_pw, 'Abdullah Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0075', '4B-05', 'Abdullah Sheikh', 'Hassan Mahmood', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent75@demo.edu', v_pw, 'Hassan Mahmood') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hassan Mahmood', 'Father', '03001234075') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0075', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 76
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student76@demo.edu', v_pw, 'Hira Malik') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0076', '4B-06', 'Hira Malik', 'Usman Hussain', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent76@demo.edu', v_pw, 'Usman Hussain') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Usman Hussain', 'Father', '03001234076') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0076', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 77
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student77@demo.edu', v_pw, 'Hafsa Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0077', '4B-07', 'Hafsa Sheikh', 'Noman Shah', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent77@demo.edu', v_pw, 'Noman Shah') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Noman Shah', 'Father', '03001234077') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0077', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 78
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student78@demo.edu', v_pw, 'Maha Raza') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0078', '4B-08', 'Maha Raza', 'Ahmad Khan', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent78@demo.edu', v_pw, 'Ahmad Khan') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ahmad Khan', 'Father', '03001234078') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0078', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 79
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student79@demo.edu', v_pw, 'Hira Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0079', '4B-09', 'Hira Tariq', 'Abdullah Baig', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent79@demo.edu', v_pw, 'Abdullah Baig') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Abdullah Baig', 'Father', '03001234079') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0079', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 80
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student80@demo.edu', v_pw, 'Omar Iqbal') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0080', '4B-10', 'Omar Iqbal', 'Ali Ahmed', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent80@demo.edu', v_pw, 'Ali Ahmed') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ali Ahmed', 'Father', '03001234080') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0080', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
-- Class: Grade 3
  INSERT INTO classes (session_id, school_id, name, level) VALUES (v_session, v_school, 'Grade 3', 5) RETURNING id INTO v_class;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'English', 'ENG5') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Urdu', 'URD5') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Math', 'MAT5') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Islamiyat', 'ISL5') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'General Science', 'GEN5') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Social Studies', 'SOC5') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO subjects (class_id, name, code) VALUES (v_class, 'Computer', 'COM5') RETURNING id INTO v_subj;
  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'A', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 81
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student81@demo.edu', v_pw, 'Anum Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0081', '5A-01', 'Anum Qureshi', 'Hussain Tariq', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent81@demo.edu', v_pw, 'Hussain Tariq') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hussain Tariq', 'Father', '03001234081') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0081', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 82
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student82@demo.edu', v_pw, 'Maha Shah') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0082', '5A-02', 'Maha Shah', 'Noman Nawaz', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent82@demo.edu', v_pw, 'Noman Nawaz') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Noman Nawaz', 'Father', '03001234082') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0082', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 83
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student83@demo.edu', v_pw, 'Omar Raza') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0083', '5A-03', 'Omar Raza', 'Bilal Nawaz', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent83@demo.edu', v_pw, 'Bilal Nawaz') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Bilal Nawaz', 'Father', '03001234083') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0083', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 84
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student84@demo.edu', v_pw, 'Raza Malik') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0084', '5A-04', 'Raza Malik', 'Usman Malik', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent84@demo.edu', v_pw, 'Usman Malik') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Usman Malik', 'Father', '03001234084') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0084', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 85
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student85@demo.edu', v_pw, 'Hussain Baig') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0085', '5A-05', 'Hussain Baig', 'Faizan Ahmed', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent85@demo.edu', v_pw, 'Faizan Ahmed') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Faizan Ahmed', 'Father', '03001234085') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0085', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 86
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student86@demo.edu', v_pw, 'Hamza Malik') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0086', '5A-06', 'Hamza Malik', 'Raza Raza', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent86@demo.edu', v_pw, 'Raza Raza') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Raza Raza', 'Father', '03001234086') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0086', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 87
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student87@demo.edu', v_pw, 'Sana Nawaz') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0087', '5A-07', 'Sana Nawaz', 'Faizan Iqbal', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent87@demo.edu', v_pw, 'Faizan Iqbal') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Faizan Iqbal', 'Father', '03001234087') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0087', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 88
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student88@demo.edu', v_pw, 'Omar Mahmood') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0088', '5A-08', 'Omar Mahmood', 'Omar Chaudhry', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent88@demo.edu', v_pw, 'Omar Chaudhry') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Omar Chaudhry', 'Father', '03001234088') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0088', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 89
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student89@demo.edu', v_pw, 'Hussain Nawaz') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0089', '5A-09', 'Hussain Nawaz', 'Shahzaib Shah', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent89@demo.edu', v_pw, 'Shahzaib Shah') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Shahzaib Shah', 'Father', '03001234089') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0089', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 90
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student90@demo.edu', v_pw, 'Maryam Khan') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0090', '5A-10', 'Maryam Khan', 'Saad Qureshi', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent90@demo.edu', v_pw, 'Saad Qureshi') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Saad Qureshi', 'Father', '03001234090') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0090', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, 'B', 40) RETURNING id INTO v_secA;
  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;
  -- Student 91
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student91@demo.edu', v_pw, 'Usman Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0091', '5B-01', 'Usman Sheikh', 'Ahmad Baig', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent91@demo.edu', v_pw, 'Ahmad Baig') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ahmad Baig', 'Father', '03001234091') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0091', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 92
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student92@demo.edu', v_pw, 'Hassan Malik') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0092', '5B-02', 'Hassan Malik', 'Hamza Tariq', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent92@demo.edu', v_pw, 'Hamza Tariq') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hamza Tariq', 'Father', '03001234092') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'absent');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0092', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 93
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student93@demo.edu', v_pw, 'Maryam Qureshi') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0093', '5B-03', 'Maryam Qureshi', 'Zain Iqbal', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent93@demo.edu', v_pw, 'Zain Iqbal') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Zain Iqbal', 'Father', '03001234093') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0093', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 94
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student94@demo.edu', v_pw, 'Zainab Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0094', '5B-04', 'Zainab Sheikh', 'Hassan Sheikh', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent94@demo.edu', v_pw, 'Hassan Sheikh') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hassan Sheikh', 'Father', '03001234094') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0094', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 95
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student95@demo.edu', v_pw, 'Zainab Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0095', '5B-05', 'Zainab Sheikh', 'Zain Khan', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent95@demo.edu', v_pw, 'Zain Khan') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Zain Khan', 'Father', '03001234095') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0095', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 96
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student96@demo.edu', v_pw, 'Faizan Tariq') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0096', '5B-06', 'Faizan Tariq', 'Omar Chaudhry', 'male', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent96@demo.edu', v_pw, 'Omar Chaudhry') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Omar Chaudhry', 'Father', '03001234096') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0096', date_trunc('month', current_date), 200000, 0, 0, 200000, 0, current_date + 10, 'unpaid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  -- Student 97
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student97@demo.edu', v_pw, 'Khadija Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0097', '5B-07', 'Khadija Sheikh', 'Hamza Ali', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent97@demo.edu', v_pw, 'Hamza Ali') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hamza Ali', 'Father', '03001234097') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0097', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 98
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student98@demo.edu', v_pw, 'Maha Nawaz') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0098', '5B-08', 'Maha Nawaz', 'Hassan Iqbal', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent98@demo.edu', v_pw, 'Hassan Iqbal') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Hassan Iqbal', 'Father', '03001234098') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0098', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 99
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student99@demo.edu', v_pw, 'Maryam Iqbal') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0099', '5B-09', 'Maryam Iqbal', 'Ahmad Khan', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent99@demo.edu', v_pw, 'Ahmad Khan') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Ahmad Khan', 'Father', '03001234099') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0099', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
  -- Student 100
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student100@demo.edu', v_pw, 'Sadia Sheikh') RETURNING id INTO v_student;
  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, 'ADM-0100', '5B-10', 'Sadia Sheikh', 'Bilal Hussain', 'female', 'active') RETURNING id INTO v_student;
  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent100@demo.edu', v_pw, 'Bilal Hussain') RETURNING id INTO v_guardian;
  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, 'Bilal Hussain', 'Father', '03001234100') RETURNING id INTO v_guardian;
  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);
  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, 'present');
  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, 'CH-2025-0100', date_trunc('month', current_date), 200000, 0, 0, 200000, 200000, current_date + 10, 'paid') RETURNING id INTO v_invoice;
  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);
  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, 200000, 'cash', current_date);
-- Library
  INSERT INTO book_categories (school_id, name) VALUES (v_school, 'Science') RETURNING id INTO v_inv_cat;
  INSERT INTO books (school_id, category_id, title, author, total_copies, available_copies, fine_per_day) VALUES (v_school, v_inv_cat, 'Science Book 1', 'Author 0', 5, 5, 500) RETURNING id INTO v_book;
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-0-1', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-0-2', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-0-3', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-0-4', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-0-5', 'good', 'available');
  INSERT INTO book_categories (school_id, name) VALUES (v_school, 'Mathematics') RETURNING id INTO v_inv_cat;
  INSERT INTO books (school_id, category_id, title, author, total_copies, available_copies, fine_per_day) VALUES (v_school, v_inv_cat, 'Mathematics Book 1', 'Author 1', 5, 5, 500) RETURNING id INTO v_book;
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-1-1', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-1-2', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-1-3', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-1-4', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-1-5', 'good', 'available');
  INSERT INTO book_categories (school_id, name) VALUES (v_school, 'English Literature') RETURNING id INTO v_inv_cat;
  INSERT INTO books (school_id, category_id, title, author, total_copies, available_copies, fine_per_day) VALUES (v_school, v_inv_cat, 'English Literature Book 1', 'Author 2', 5, 5, 500) RETURNING id INTO v_book;
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-2-1', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-2-2', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-2-3', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-2-4', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-2-5', 'good', 'available');
  INSERT INTO book_categories (school_id, name) VALUES (v_school, 'Urdu Literature') RETURNING id INTO v_inv_cat;
  INSERT INTO books (school_id, category_id, title, author, total_copies, available_copies, fine_per_day) VALUES (v_school, v_inv_cat, 'Urdu Literature Book 1', 'Author 3', 5, 5, 500) RETURNING id INTO v_book;
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-3-1', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-3-2', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-3-3', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-3-4', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-3-5', 'good', 'available');
  INSERT INTO book_categories (school_id, name) VALUES (v_school, 'Islamic Studies') RETURNING id INTO v_inv_cat;
  INSERT INTO books (school_id, category_id, title, author, total_copies, available_copies, fine_per_day) VALUES (v_school, v_inv_cat, 'Islamic Studies Book 1', 'Author 4', 5, 5, 500) RETURNING id INTO v_book;
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-4-1', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-4-2', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-4-3', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-4-4', 'good', 'available');
  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-4-5', 'good', 'available');
-- Transport
  INSERT INTO vehicles (school_id, reg_no, vehicle_type, capacity, is_active) VALUES (v_school, 'BUS-01', 'bus', 40, true) RETURNING id INTO v_vehicle;
  INSERT INTO routes (school_id, name, vehicle_id, monthly_fee, is_active) VALUES (v_school, 'City Route', v_vehicle, 100000, true) RETURNING id INTO rt_a;
  INSERT INTO route_stops (route_id, school_id, name, stop_order, pickup_time) VALUES (rt_a, v_school, 'Stop 1', 1, '07:00'), (rt_a, v_school, 'Stop 2', 2, '07:15');
-- Hostel
  INSERT INTO hostels (school_id, name, hostel_type, total_capacity) VALUES (v_school, 'Main Boys Hostel', 'boys', 100) RETURNING id INTO hst_boys;
  INSERT INTO hostel_rooms (school_id, hostel_id, room_no, room_type, capacity, monthly_fee, is_active) VALUES (v_school, hst_boys, '101', 'double', 2, 500000, true);
  INSERT INTO hostel_rooms (school_id, hostel_id, room_no, room_type, capacity, monthly_fee, is_active) VALUES (v_school, hst_boys, '102', 'double', 2, 500000, true);
  INSERT INTO hostel_rooms (school_id, hostel_id, room_no, room_type, capacity, monthly_fee, is_active) VALUES (v_school, hst_boys, '103', 'double', 2, 500000, true);
  INSERT INTO hostel_rooms (school_id, hostel_id, room_no, room_type, capacity, monthly_fee, is_active) VALUES (v_school, hst_boys, '104', 'double', 2, 500000, true);
  INSERT INTO hostel_rooms (school_id, hostel_id, room_no, room_type, capacity, monthly_fee, is_active) VALUES (v_school, hst_boys, '105', 'double', 2, 500000, true);
-- Inventory
  INSERT INTO inventory_categories (school_id, name) VALUES (v_school, 'Stationery') RETURNING id INTO v_inv_cat;
  INSERT INTO vendors (school_id, name, contact_person, phone) VALUES (v_school, 'ABC Stationers', 'Ali', '03001112223') RETURNING id INTO v_vendor;
  INSERT INTO inventory_items (school_id, category_id, name, unit, quantity_in_stock, unit_cost) VALUES (v_school, v_inv_cat, 'Item 1', 'pcs', 100, 5000);
  INSERT INTO inventory_items (school_id, category_id, name, unit, quantity_in_stock, unit_cost) VALUES (v_school, v_inv_cat, 'Item 2', 'pcs', 100, 5000);
  INSERT INTO inventory_items (school_id, category_id, name, unit, quantity_in_stock, unit_cost) VALUES (v_school, v_inv_cat, 'Item 3', 'pcs', 100, 5000);
  INSERT INTO inventory_items (school_id, category_id, name, unit, quantity_in_stock, unit_cost) VALUES (v_school, v_inv_cat, 'Item 4', 'pcs', 100, 5000);
  INSERT INTO inventory_items (school_id, category_id, name, unit, quantity_in_stock, unit_cost) VALUES (v_school, v_inv_cat, 'Item 5', 'pcs', 100, 5000);

  -- Notification Settings
  INSERT INTO notification_settings (school_id, event_type, channel, is_enabled) VALUES
    (v_school, 'attendance_absent',  'sms',       true),
    (v_school, 'fee_due',            'sms',       true),
    (v_school, 'result_published',   'email',     true);

  -- Plans
  INSERT INTO subscription_plans (name, fee, billing_cycle, max_students, max_teachers, features) VALUES
    ('Starter (Monthly)', 500000, 'monthly', 500, 20, ARRAY['students', 'attendance', 'fees']),
    ('Professional (Monthly)', 1500000, 'monthly', 2000, 100, ARRAY['students', 'attendance', 'fees', 'exams', 'payroll']),
    ('Enterprise (Monthly)', 3000000, 'monthly', NULL, NULL, ARRAY['students', 'attendance', 'fees', 'exams', 'payroll', 'library', 'transport', 'hostel']),
    ('Lifetime Ultimate', 150000000, 'lifetime', NULL, NULL, ARRAY['students', 'attendance', 'fees', 'exams', 'payroll', 'library', 'transport', 'hostel']);

  RAISE NOTICE 'Massive seed complete! Login with principal@demo.edu / Passw0rd!';
END $$;
