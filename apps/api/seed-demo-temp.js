import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function generateDemoData() {
  console.log('Generating academic demo data...');
  const res = await query('SELECT id FROM schools LIMIT 1');
  if (res.rowCount === 0) {
    console.log('No school found. Run db:seed first.');
    process.exit(1);
  }
  const schoolId = res.rows[0].id;

  // 1. Create 3 sessions
  const sessionData = [
    { name: '2024-2025', start: '2024-03-01', end: '2025-02-28', active: false },
    { name: '2025-2026', start: '2025-03-01', end: '2026-02-28', active: false },
    { name: '2026-2027', start: '2026-03-01', end: '2027-02-28', active: true },
  ];

  const sessions = [];
  for (const s of sessionData) {
    const sRes = await query(
      'INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [schoolId, s.name, s.start, s.end, s.active]
    );
    sessions.push({ ...s, id: sRes.rows[0].id });
  }
  console.log('Created 3 academic sessions.');

  // 2. Create Staff (Teachers) - 30 teachers
  const teachers = [];
  for (let i = 1; i <= 30; i++) {
    const tRes = await query(
      `INSERT INTO staff (school_id, employee_id, staff_type, full_name, gender, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [schoolId, `T-${2000 + i}`, 'teaching', `Teacher ${i}`, i % 2 === 0 ? 'female' : 'male', 'active']
    );
    teachers.push(tRes.rows[0].id);
  }
  console.log('Created 30 teachers.');

  // 3. Create 10 Classes for the active session (2026-2027), 3 sections each
  const activeSession = sessions.find(s => s.active);
  const classes = [];
  let teacherIndex = 0;
  
  let studentCount = 0;
  
  for (const session of sessions) {
    for (let i = 1; i <= 10; i++) {
      const cRes = await query(
        'INSERT INTO classes (school_id, session_id, name, level) VALUES ($1, $2, $3, $4) RETURNING id',
        [schoolId, session.id, `Class ${i}`, i]
      );
      const classId = cRes.rows[0].id;
      
      for (let j = 0; j < 3; j++) {
        const sectionName = ['A', 'B', 'C'][j];
        const teacherId = teachers[teacherIndex % teachers.length];
        teacherIndex++;
        
        const secRes = await query(
          'INSERT INTO sections (class_id, teacher_id, name, capacity) VALUES ($1, $2, $3, $4) RETURNING id',
          [classId, teacherId, sectionName, 40]
        );
        const sectionId = secRes.rows[0].id;
        
        // Create 20 students per section
        let studentValues = [];
        for (let k = 1; k <= 20; k++) {
          studentCount++;
          const admNo = `ADM-${session.name.split('-')[0]}-${studentCount.toString().padStart(4, '0')}`;
          const rollNo = `${i}${sectionName}-${k.toString().padStart(2, '0')}`;
          const stuName = `Student ${studentCount}`;
          studentValues.push(`('${schoolId}', '${sectionId}', '${admNo}', '${rollNo}', '${stuName}', 'active')`);
        }
        
        await query(`
          INSERT INTO students (school_id, section_id, admission_no, roll_no, full_name, status)
          VALUES ${studentValues.join(', ')}
        `);
      }
    }
    console.log(`Created 10 classes, 3 sections, 20 students/section for session ${session.name}`);
  }

  // 4. Generate some attendance records for the active session
  const secRes = await query(`
    SELECT s.id 
    FROM sections s 
    JOIN classes c ON s.class_id = c.id 
    WHERE c.session_id = $1 AND c.level = 1 AND s.name = 'A'
  `, [activeSession.id]);
  
  if (secRes.rowCount > 0) {
    const sectionId = secRes.rows[0].id;
    const studentsRes = await query('SELECT id FROM students WHERE section_id = $1', [sectionId]);
    const studentIds = studentsRes.rows.map(r => r.id);
    
    // Generate attendance for last 10 days
    for (let d = 0; d < 10; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      
      let attValues = [];
      for (const sid of studentIds) {
        // 90% present
        const status = Math.random() > 0.1 ? 'present' : 'absent';
        attValues.push(`('${schoolId}', '${sid}', '${dateStr}', '${status}', 'manual')`);
      }
      
      await query(`
        INSERT INTO student_attendance (school_id, student_id, date, status, method)
        VALUES ${attValues.join(', ')}
      `);
    }
    console.log('Generated sample attendance.');
  }

  console.log('Demo data generation complete!');
  process.exit(0);
}

generateDemoData().catch(err => {
  console.error(err);
  process.exit(1);
});
