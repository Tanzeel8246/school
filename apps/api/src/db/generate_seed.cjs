const fs = require('fs');

const classesData = [
  { level: 1, name: 'Nursery', subjects: ['English', 'Urdu', 'Math', 'Islamiyat', 'Drawing'] },
  { level: 2, name: 'KG', subjects: ['English', 'Urdu', 'Math', 'Islamiyat', 'Drawing'] },
  { level: 3, name: 'Grade 1', subjects: ['English', 'Urdu', 'Math', 'Islamiyat', 'General Science', 'Social Studies', 'Computer'] },
  { level: 4, name: 'Grade 2', subjects: ['English', 'Urdu', 'Math', 'Islamiyat', 'General Science', 'Social Studies', 'Computer'] },
  { level: 5, name: 'Grade 3', subjects: ['English', 'Urdu', 'Math', 'Islamiyat', 'General Science', 'Social Studies', 'Computer'] }
];

const boysNames = ['Ali', 'Ahmad', 'Omar', 'Usman', 'Hamza', 'Bilal', 'Zain', 'Hassan', 'Hussain', 'Abdullah', 'Saad', 'Faizan', 'Raza', 'Shahzaib', 'Noman'];
const girlsNames = ['Ayesha', 'Fatima', 'Zainab', 'Maryam', 'Sana', 'Iqra', 'Khadija', 'Hira', 'Nida', 'Anum', 'Hafsa', 'Rida', 'Sadia', 'Maha', 'Mehwish'];
const lastNames = ['Khan', 'Ahmed', 'Ali', 'Raza', 'Mahmood', 'Sheikh', 'Malik', 'Hussain', 'Iqbal', 'Tariq', 'Shah', 'Nawaz', 'Qureshi', 'Baig', 'Chaudhry'];

function randomName(gender) {
  const first = gender === 'male' ? boysNames[Math.floor(Math.random() * boysNames.length)] : girlsNames[Math.floor(Math.random() * girlsNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first} ${last}`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let sql = `-- Massive Demo Data Seed. Password for every seeded user is: Passw0rd!
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

`;

// Generate Teachers
sql += `-- Teachers\n`;
const teacherNames = ['Asad Ali', 'Nadia Hussain', 'Samiullah', 'Quratulain', 'Kamran Akmal', 'Mehwish Hayat', 'Imran Nazir', 'Sadaf Tariq', 'Zahid Khan', 'Madiha Rizvi'];
for (let i=0; i<10; i++) {
  sql += `  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_teacher, 'teacher${i+1}@demo.edu', v_pw, '${teacherNames[i]}') RETURNING id INTO v_teacher;\n`;
  sql += `  INSERT INTO staff (school_id, user_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, v_teacher, 'EMP-T0${i+10}', 'teacher', '${teacherNames[i]}', 'Senior Teacher', ${randInt(50, 120)*100000}, '2020-08-01', 'active') RETURNING id INTO v_teacher;\n`;
  
  // Salary Structure
  sql += `  INSERT INTO salary_structures (school_id, staff_id, name, effective_from) VALUES (v_school, v_teacher, 'Standard Package', '2025-08-01') RETURNING id INTO v_structure;\n`;
  sql += `  INSERT INTO salary_components (structure_id, name, component_type, amount, is_percentage) VALUES (v_structure, 'HRA', 'allowance', 1500000, false), (v_structure, 'Medical', 'allowance', 500000, false), (v_structure, 'Income Tax', 'deduction', 200000, false);\n`;
  
  // Staff Attendance
  sql += `  INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in) VALUES (v_school, v_teacher, current_date, 'present', '07:45');\n`;
}

// Generate Other Staff
sql += `-- Other Staff\n`;
const staffTypes = ['driver', 'peon', 'security', 'librarian', 'lab_assistant'];
const staffNames = ['Sher Ali', 'Ghulam Rasool', 'Nawab Din', 'Samina Gul', 'Asif Raza'];
for (let i=0; i<5; i++) {
  sql += `  INSERT INTO staff (school_id, employee_id, staff_type, full_name, designation, base_salary, joining_date, status) VALUES (v_school, 'EMP-S0${i+10}', '${staffTypes[i]}', '${staffNames[i]}', '${staffTypes[i].replace('_',' ').toUpperCase()}', ${randInt(25, 45)*100000}, '2021-01-15', 'active');\n`;
}

// Classes and Students
let studentCount = 1;
classesData.forEach((cls) => {
  sql += `-- Class: ${cls.name}\n`;
  sql += `  INSERT INTO classes (session_id, school_id, name, level) VALUES (v_session, v_school, '${cls.name}', ${cls.level}) RETURNING id INTO v_class;\n`;
  
  // Subjects
  cls.subjects.forEach(sub => {
    const code = sub.substring(0,3).toUpperCase() + cls.level;
    sql += `  INSERT INTO subjects (class_id, name, code) VALUES (v_class, '${sub}', '${code}') RETURNING id INTO v_subj;\n`;
    // Assign subject to random teacher
    sql += `  INSERT INTO teacher_subjects (staff_id, subject_id, school_id) SELECT id, v_subj, v_school FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1;\n`;
  });

  // Sections
  ['A', 'B'].forEach(secName => {
    sql += `  INSERT INTO sections (class_id, name, capacity) VALUES (v_class, '${secName}', 40) RETURNING id INTO v_secA;\n`;
    sql += `  UPDATE sections SET teacher_id = (SELECT id FROM staff WHERE staff_type='teacher' ORDER BY random() LIMIT 1) WHERE id = v_secA;\n`;
    
    // 10 students per section
    for (let i=1; i<=10; i++) {
      const gender = Math.random() > 0.5 ? 'male' : 'female';
      const sName = randomName(gender);
      const fName = randomName('male');
      const adm = `ADM-${studentCount.toString().padStart(4, '0')}`;
      const roll = `${cls.level}${secName}-${i.toString().padStart(2, '0')}`;
      
      sql += `  -- Student ${studentCount}\n`;
      sql += `  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_student, 'student${studentCount}@demo.edu', v_pw, '${sName}') RETURNING id INTO v_student;\n`;
      sql += `  INSERT INTO students (school_id, user_id, section_id, admission_no, roll_no, full_name, father_name, gender, status) VALUES (v_school, v_student, v_secA, '${adm}', '${roll}', '${sName}', '${fName}', '${gender}', 'active') RETURNING id INTO v_student;\n`;
      
      // Parent
      sql += `  INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES (v_school, r_parent, 'parent${studentCount}@demo.edu', v_pw, '${fName}') RETURNING id INTO v_guardian;\n`;
      sql += `  INSERT INTO guardians (school_id, user_id, full_name, relation, phone) VALUES (v_school, v_guardian, '${fName}', 'Father', '03001234${studentCount.toString().padStart(3,'0')}') RETURNING id INTO v_guardian;\n`;
      sql += `  INSERT INTO guardian_students (guardian_id, student_id, is_primary) VALUES (v_guardian, v_student, true);\n`;

      // Attendance
      sql += `  INSERT INTO attendance (school_id, student_id, section_id, date, status) VALUES (v_school, v_student, v_secA, current_date, '${Math.random() > 0.1 ? 'present' : 'absent'}');\n`;

      // Invoice
      const invTotal = 150000 + 30000 + 20000;
      const isPaid = Math.random() > 0.4;
      const invPaid = isPaid ? invTotal : 0;
      const invStat = isPaid ? 'paid' : 'unpaid';
      const challan = `CH-2025-${studentCount.toString().padStart(4, '0')}`;
      
      sql += `  INSERT INTO fee_invoices (school_id, student_id, challan_no, billing_month, subtotal, discount, fine, total, paid, due_date, status) VALUES (v_school, v_student, '${challan}', date_trunc('month', current_date), ${invTotal}, 0, 0, ${invTotal}, ${invPaid}, current_date + 10, '${invStat}') RETURNING id INTO v_invoice;\n`;
      sql += `  INSERT INTO fee_invoice_lines (invoice_id, fee_head_id, fee_head_name, amount) VALUES (v_invoice, fh_tuition, 'Tuition Fee', 150000), (v_invoice, fh_lab, 'Computer Lab Fee', 30000), (v_invoice, fh_activity, 'Activity Fee', 20000);\n`;
      
      if (isPaid) {
        sql += `  INSERT INTO fee_payments (invoice_id, amount, method, paid_at) VALUES (v_invoice, ${invTotal}, 'cash', current_date);\n`;
      }

      studentCount++;
    }
  });
});

sql += `-- Library\n`;
const libCats = ['Science', 'Mathematics', 'English Literature', 'Urdu Literature', 'Islamic Studies'];
libCats.forEach((cat, idx) => {
  sql += `  INSERT INTO book_categories (school_id, name) VALUES (v_school, '${cat}') RETURNING id INTO v_inv_cat;\n`;
  sql += `  INSERT INTO books (school_id, category_id, title, author, total_copies, available_copies, fine_per_day) VALUES (v_school, v_inv_cat, '${cat} Book 1', 'Author ${idx}', 5, 5, 500) RETURNING id INTO v_book;\n`;
  for(let c=1; c<=5; c++) {
    sql += `  INSERT INTO book_copies (school_id, book_id, barcode, condition, status) VALUES (v_school, v_book, 'BK-${idx}-${c}', 'good', 'available');\n`;
  }
});

sql += `-- Transport\n`;
sql += `  INSERT INTO vehicles (school_id, reg_no, vehicle_type, capacity, is_active) VALUES (v_school, 'BUS-01', 'bus', 40, true) RETURNING id INTO v_vehicle;\n`;
sql += `  INSERT INTO routes (school_id, name, vehicle_id, monthly_fee, is_active) VALUES (v_school, 'City Route', v_vehicle, 100000, true) RETURNING id INTO rt_a;\n`;
sql += `  INSERT INTO route_stops (route_id, school_id, name, stop_order, pickup_time) VALUES (rt_a, v_school, 'Stop 1', 1, '07:00'), (rt_a, v_school, 'Stop 2', 2, '07:15');\n`;

sql += `-- Hostel\n`;
sql += `  INSERT INTO hostels (school_id, name, hostel_type, total_capacity) VALUES (v_school, 'Main Boys Hostel', 'boys', 100) RETURNING id INTO hst_boys;\n`;
for(let r=1; r<=5; r++) {
  sql += `  INSERT INTO hostel_rooms (school_id, hostel_id, room_no, room_type, capacity, monthly_fee, is_active) VALUES (v_school, hst_boys, '10${r}', 'double', 2, 500000, true);\n`;
}

sql += `-- Inventory\n`;
sql += `  INSERT INTO inventory_categories (school_id, name) VALUES (v_school, 'Stationery') RETURNING id INTO v_inv_cat;\n`;
sql += `  INSERT INTO vendors (school_id, name, contact_person, phone) VALUES (v_school, 'ABC Stationers', 'Ali', '03001112223') RETURNING id INTO v_vendor;\n`;
for(let it=1; it<=5; it++) {
  sql += `  INSERT INTO inventory_items (school_id, category_id, name, unit, quantity_in_stock, unit_cost) VALUES (v_school, v_inv_cat, 'Item ${it}', 'pcs', 100, 5000);\n`;
}

sql += `
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
`;

fs.writeFileSync('c:/Users/am252/Downloads/School/school-erp-starter/apps/api/src/db/seed.sql', sql);
console.log('Seed generated!');
