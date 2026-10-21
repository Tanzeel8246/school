import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const firstNames = ['Ali', 'Ayesha', 'Fatima', 'Usman', 'Zainab', 'Omar', 'Hassan', 'Bilal', 'Sara', 'Khadija', 'Abdullah', 'Maryam', 'Tariq', 'Zara', 'Hamza', 'Imran', 'Kamran', 'Nadia', 'Sana', 'Ameer'];
const lastNames = ['Khan', 'Ahmed', 'Ali', 'Shah', 'Raza', 'Hussain', 'Malik', 'Noor', 'Iqbal', 'Qureshi', 'Sheikh', 'Mahmood', 'Abbas', 'Farooq', 'Javed'];
function getRandomName() {
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

async function runSeeder() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Truncating existing data...');
    await client.query('TRUNCATE TABLE schools CASCADE');

    console.log('Creating School and Roles...');
    const schoolRes = await client.query(`INSERT INTO schools (name, code) VALUES ('Demo Public School', 'DPS') RETURNING id`);
    const schoolId = schoolRes.rows[0].id;

    // Roles
    const superRoleId = (await client.query(`INSERT INTO roles (school_id, name, is_system, permissions) VALUES ($1, 'super_admin', true, ARRAY['*']) RETURNING id`, [schoolId])).rows[0].id;
    const principalRoleId = (await client.query(`INSERT INTO roles (school_id, name, permissions) VALUES ($1, 'principal', ARRAY['students:read','students:write','attendance:mark','fees:read','fees:collect','results:read','exams:enter_marks','audit:read','settings:manage','teachers:read','teachers:write','staff:read','staff:write','staff_attendance:mark','leaves:read','leaves:manage','payroll:read','accounting:read','accounting:post','payroll:manage','fees:write','exams:write','exams:manage','library:read','library:write','library:manage','transport:read','transport:write','hostel:read','hostel:write','inventory:read','inventory:write','inventory:manage','communications:read','communications:write','communications:manage','reports:read','academics:read','academics:write','attendance:read','parent:read']) RETURNING id`, [schoolId])).rows[0].id;
    const accountantRoleId = (await client.query(`INSERT INTO roles (school_id, name, permissions) VALUES ($1, 'accountant', ARRAY['fees:read','fees:collect','fees:write','payroll:run','accounting:post','students:read','staff:read','payroll:read','leaves:read','accounting:read','payroll:manage','library:read','transport:read','hostel:read','inventory:read','inventory:manage','communications:read','reports:read']) RETURNING id`, [schoolId])).rows[0].id;
    const teacherRoleId = (await client.query(`INSERT INTO roles (school_id, name, permissions) VALUES ($1, 'teacher', ARRAY['students:read','attendance:mark','attendance:read','exams:enter_marks','results:read','leaves:read','academics:read']) RETURNING id`, [schoolId])).rows[0].id;

    // Users
    const v_pw = await bcrypt.hash('Passw0rd!', 12);
    const principalUserId = (await client.query(`INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES ($1, $2, 'principal@demo.edu', $3, 'Dr. Sarah Chen') RETURNING id`, [schoolId, principalRoleId, v_pw])).rows[0].id;
    await client.query(`INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES ($1, $2, 'accountant@demo.edu', $3, 'Bilal Ahmed')`, [schoolId, accountantRoleId, v_pw]);
    await client.query(`INSERT INTO users (school_id, role_id, email, password_hash, full_name) VALUES ($1, $2, 'admin@demo.edu', $3, 'System Admin')`, [schoolId, superRoleId, v_pw]);

    console.log('Creating Sessions...');
    const session1 = (await client.query(`INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_active) VALUES ($1, '2024-2025', '2024-03-01', '2025-02-28', false) RETURNING id`, [schoolId])).rows[0].id;
    const session2 = (await client.query(`INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_active) VALUES ($1, '2025-2026', '2025-03-01', '2026-02-28', false) RETURNING id`, [schoolId])).rows[0].id;
    const session3 = (await client.query(`INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_active) VALUES ($1, '2026-2027', '2026-03-01', '2027-02-28', true) RETURNING id`, [schoolId])).rows[0].id;

    const sessionIds = [session1, session2, session3];
    
    // Fee Head
    await client.query(`INSERT INTO fee_heads (school_id, name, amount, is_recurring, applicable_to) VALUES ($1, 'Tuition', 500000, true, 'all')`, [schoolId]);

    // Subjects
    const subjs = ['Mathematics', 'English', 'Science', 'History', 'Geography', 'Computer', 'Art', 'Urdu'];

    console.log('Creating Classes and Sections...');
    const studentsBySession = new Map();
    const sectionsData = [];
    const classDataList = [];

    let admissionCounter = 1000;

    for (let sid of sessionIds) {
      let studentsList = [];
      for (let i = 1; i <= 10; i++) {
        const classId = (await client.query(`INSERT INTO classes (session_id, name, level) VALUES ($1, $2, $3) RETURNING id`, [sid, `Grade ${i}`, i])).rows[0].id;
        classDataList.push(classId);

        // add subjects
        for (let s of subjs) {
            await client.query(`INSERT INTO subjects (class_id, name, code) VALUES ($1, $2, $3)`, [classId, s, `${s.substring(0,3).toUpperCase()}${i}`]);
        }

        for (let s of ['A', 'B', 'C']) {
          const sectionId = (await client.query(`INSERT INTO sections (class_id, name, capacity) VALUES ($1, $2, 40) RETURNING id`, [classId, s])).rows[0].id;
          sectionsData.push(sectionId);

          for (let st = 1; st <= 20; st++) {
            admissionCounter++;
            const studentId = (await client.query(`
              INSERT INTO students (school_id, section_id, admission_no, roll_no, full_name, father_name, gender)
              VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
            `, [schoolId, sectionId, `ADM-${admissionCounter}`, `${i}${s}-${st}`, getRandomName(), getRandomName(), Math.random() > 0.5 ? 'male' : 'female'])).rows[0].id;
            studentsList.push({ id: studentId, sectionId, classId, session: sid });
          }
        }
      }
      studentsBySession.set(sid, studentsList);
    }

    console.log('Creating Teachers and Staff...');
    const teacherIds = [];
    for (let i = 1; i <= 40; i++) {
        const teacherId = (await client.query(`
            INSERT INTO staff (school_id, employee_id, staff_type, full_name, gender, designation, qualification, experience_years, base_salary, joining_date, status)
            VALUES ($1, $2, 'teacher', $3, $4, 'Teacher', 'Masters', 5, 5000000, '2024-01-01', 'active') RETURNING id
        `, [schoolId, `EMP-T${i}`, getRandomName(), Math.random() > 0.5 ? 'male' : 'female'])).rows[0].id;
        teacherIds.push(teacherId);
    }
    
    // Assign teachers to sections
    for (let i = 0; i < sectionsData.length; i++) {
        await client.query(`UPDATE sections SET teacher_id = $1 WHERE id = $2`, [teacherIds[i % teacherIds.length], sectionsData[i]]);
    }

    // Other staff
    for (let i = 1; i <= 20; i++) {
        await client.query(`
            INSERT INTO staff (school_id, employee_id, staff_type, full_name, gender, designation, base_salary, joining_date, status)
            VALUES ($1, $2, 'admin', $3, $4, 'Clerk', 3000000, '2024-01-01', 'active')
        `, [schoolId, `EMP-A${i}`, getRandomName(), Math.random() > 0.5 ? 'male' : 'female']);
    }

    // Generate Attendance
    console.log('Generating Attendance Data (this might take a minute)...');
    
    // Start date: Mar 1 2024, End date: Today
    let currentDate = new Date('2024-03-01T00:00:00Z');
    const endDate = new Date();
    
    while (currentDate <= endDate) {
        // Skip Sunday (0) and Saturday (6)
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
            let activeSession = null;
            if (currentDate < new Date('2025-03-01T00:00:00Z')) activeSession = session1;
            else if (currentDate < new Date('2026-03-01T00:00:00Z')) activeSession = session2;
            else activeSession = session3;

            const students = studentsBySession.get(activeSession);
            if (students) {
                // To avoid massive memory leak in Node, build batch string
                let vals = [];
                let params = [];
                let paramIndex = 1;
                
                const dateStr = currentDate.toISOString().split('T')[0];

                for (let stu of students) {
                    // 95% chance present, 5% absent
                    const stat = Math.random() > 0.05 ? 'present' : 'absent';
                    vals.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                    params.push(schoolId, stu.id, dateStr, stat);
                    
                    if (vals.length >= 2000) {
                        await client.query(`INSERT INTO attendance (school_id, student_id, date, status) VALUES ${vals.join(',')}`, params);
                        vals = [];
                        params = [];
                        paramIndex = 1;
                    }
                }
                if (vals.length > 0) {
                    await client.query(`INSERT INTO attendance (school_id, student_id, date, status) VALUES ${vals.join(',')}`, params);
                }
            }
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log('Generating Exams and Grades...');
    
    await client.query(`
        INSERT INTO grade_config (school_id, grade_letter, min_percentage, max_percentage, grade_point, display_order)
        VALUES
        ($1, 'A+', 90, 100, 4.00, 1),
        ($1, 'A', 80, 89.99, 3.70, 2),
        ($1, 'B', 70, 79.99, 3.00, 3),
        ($1, 'C', 60, 69.99, 2.00, 4),
        ($1, 'D', 50, 59.99, 1.00, 5),
        ($1, 'F', 0, 49.99, 0.00, 6)
    `, [schoolId]);

    // Add a midterm exam for session 3 classes
    for (let i = 0; i < 10; i++) {
        // Find session 3 classes
        const classIdsRes = await client.query(`SELECT id FROM classes WHERE session_id = $1`, [session3]);
        for (const cls of classIdsRes.rows) {
            const examId = (await client.query(`
                INSERT INTO exams (school_id, session_id, class_id, name, exam_type, start_date, end_date)
                VALUES ($1, $2, $3, 'Midterm 2026', 'midterm', '2026-05-10', '2026-05-20') RETURNING id
            `, [schoolId, session3, cls.id])).rows[0].id;
            
            const subjRes = await client.query(`SELECT id FROM subjects WHERE class_id = $1`, [cls.id]);
            for (const subj of subjRes.rows) {
                await client.query(`INSERT INTO exam_subjects (exam_id, subject_id, school_id, total_marks, passing_marks) VALUES ($1, $2, $3, 100, 40)`, [examId, subj.id, schoolId]);
            }

            // Students in class
            const stus = studentsBySession.get(session3).filter(s => s.classId === cls.id);
            for (const stu of stus) {
                for (const subj of subjRes.rows) {
                    const marks = Math.floor(Math.random() * 60) + 40; // 40-100
                    await client.query(`
                        INSERT INTO exam_results (exam_id, student_id, subject_id, school_id, marks_obtained, total_marks)
                        VALUES ($1, $2, $3, $4, $5, 100)
                    `, [examId, stu.id, subj.id, schoolId, marks]);
                }
            }
        }
        break; // Only once
    }

    console.log('Generating Journal Entries (Revenue)...');
    const accRevenue = (await client.query(`INSERT INTO accounts (school_id, code, name, type, is_system) VALUES ($1, '4001', 'Tuition Revenue', 'revenue', true) RETURNING id`, [schoolId])).rows[0].id;
    const accCash = (await client.query(`INSERT INTO accounts (school_id, code, name, type, is_system) VALUES ($1, '1001', 'Cash', 'asset', true) RETURNING id`, [schoolId])).rows[0].id;

    for (let m = 1; m <= 12; m++) {
        // Random revenue per month for the last year
        const rev = Math.floor(Math.random() * 5000000) + 10000000;
        const jId = (await client.query(`INSERT INTO journal_entries (school_id, ref_no, description, entry_date, status) VALUES ($1, $2, 'Monthly Revenue', $3, 'posted') RETURNING id`, [schoolId, `REV-2025-${m}`, `2025-${m.toString().padStart(2, '0')}-05`])).rows[0].id;
        await client.query(`INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`, [jId, accCash, rev]);
        await client.query(`INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`, [jId, accRevenue, rev]);
    }
    for (let m = 1; m <= 6; m++) {
        const rev = Math.floor(Math.random() * 5000000) + 12000000;
        const jId = (await client.query(`INSERT INTO journal_entries (school_id, ref_no, description, entry_date, status) VALUES ($1, $2, 'Monthly Revenue', $3, 'posted') RETURNING id`, [schoolId, `REV-2026-${m}`, `2026-${m.toString().padStart(2, '0')}-05`])).rows[0].id;
        await client.query(`INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES ($1, $2, $3, 0)`, [jId, accCash, rev]);
        await client.query(`INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES ($1, $2, 0, $3)`, [jId, accRevenue, rev]);
    }

    await client.query('COMMIT');
    console.log('Seeding completed successfully.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runSeeder();
