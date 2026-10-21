import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgres://educore:educore@localhost:5432/educore';

async function seed() {
  console.log('Connecting to database...');
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    // 1. Get school
    const { rows: schools } = await client.query('SELECT id, name FROM schools LIMIT 1');
    if (schools.length === 0) {
      throw new Error('No schools found in the database. Please run migrations and seed first.');
    }
    const schoolId = schools[0].id;
    console.log(`Using school: ${schools[0].name} (ID: ${schoolId})`);

    // 2. Fetch all system accounts for this school
    const { rows: accounts } = await client.query(
      'SELECT id, code, name, type FROM accounts WHERE school_id = $1 AND deleted_at IS NULL',
      [schoolId]
    );
    const accMap = new Map<string, typeof accounts[0]>();
    for (const acc of accounts) {
      accMap.set(acc.code, acc);
    }

    const requiredCodes = ['1001', '1002', '1003', '2001', '3001', '4001', '5001', '5002', '5003', '5005'];
    for (const code of requiredCodes) {
      if (!accMap.has(code)) {
        throw new Error(`Required account code ${code} is missing from the Chart of Accounts.`);
      }
    }

    // 3. Clear previous session journal entries
    console.log('Cleaning up existing previous session journal entries...');
    await client.query('BEGIN');
    
    // Cascades to journal_lines automatically due to ON DELETE CASCADE
    await client.query(
      `DELETE FROM journal_entries 
        WHERE school_id = $1 
          AND entry_date >= '2025-07-01'::date 
          AND entry_date <= '2026-06-30'::date`,
      [schoolId]
    );

    console.log('Seeding historical journal entries...');

    const createJournalEntry = async (
      refNo: string,
      description: string,
      dateStr: string,
      lines: { code: string; debit: number; credit: number; desc: string }[]
    ) => {
      const { rows: jeRows } = await client.query(
        `INSERT INTO journal_entries (school_id, ref_no, description, entry_date, status, created_by)
         VALUES ($1, $2, $3, $4::date, 'posted', NULL)
         RETURNING id`,
        [schoolId, refNo, description, dateStr]
      );
      const journalId = jeRows[0].id;

      for (const line of lines) {
        const acc = accMap.get(line.code)!;
        await client.query(
          `INSERT INTO journal_lines (journal_id, account_id, debit, credit, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [journalId, acc.id, line.debit, line.credit, line.desc]
        );
      }
    };

    // A. Capital Injection (July 1, 2025)
    // Debit Bank (1002) - 25,000,000 minor units (250,000.00 PKR/USD)
    // Credit Capital (3001) - 25,000,000
    await createJournalEntry(
      'JE-2025-CAP01',
      'Initial capital injection by school sponsors',
      '2025-07-01',
      [
        { code: '1002', debit: 25000000, credit: 0, desc: 'Initial capital deposited in bank' },
        { code: '3001', debit: 0, credit: 25000000, desc: 'School Capital recognized' }
      ]
    );

    // B. Rent Payment for First Month (July 1, 2025)
    // Debit Rent (5003) - 100,000 minor units (1,000.00)
    // Credit Bank (1002) - 100,000
    await createJournalEntry(
      'JE-2025-RNT01',
      'Rent payment for school building - July 2025',
      '2025-07-01',
      [
        { code: '5003', debit: 100000, credit: 0, desc: 'Rent Expense - July 2025' },
        { code: '1002', debit: 0, credit: 100000, desc: 'Rent paid via bank transfer' }
      ]
    );

    // C. Monthly operational loop (July 2025 to May 2026 - 11 Months)
    const months = [
      { label: 'July 2025', year: 2025, month: '07', nextYear: 2025, nextMonth: '08' },
      { label: 'August 2025', year: 2025, month: '08', nextYear: 2025, nextMonth: '09' },
      { label: 'September 2025', year: 2025, month: '09', nextYear: 2025, nextMonth: '10' },
      { label: 'October 2025', year: 2025, month: '10', nextYear: 2025, nextMonth: '11' },
      { label: 'November 2025', year: 2025, month: '11', nextYear: 2025, nextMonth: '12' },
      { label: 'December 2025', year: 2025, month: '12', nextYear: 2026, nextMonth: '01' },
      { label: 'January 2026', year: 2026, month: '01', nextYear: 2026, nextMonth: '02' },
      { label: 'February 2026', year: 2026, month: '02', nextYear: 2026, nextMonth: '03' },
      { label: 'March 2026', year: 2026, month: '03', nextYear: 2026, nextMonth: '04' },
      { label: 'April 2026', year: 2026, month: '04', nextYear: 2026, nextMonth: '05' },
      { label: 'May 2026', year: 2026, month: '05', nextYear: 2026, nextMonth: '06' }
    ];

    let seq = 1;
    for (const m of months) {
      const dateGen = (day: string) => `${m.year}-${m.month}-${day}`;
      const nextDateGen = (day: string) => `${m.nextYear}-${m.nextMonth}-${day}`;
      const seqStr = String(seq++).padStart(2, '0');

      // 1. Fee Invoicing Accrual (1st of month)
      // Debit Accounts Receivable (1003) - 850,000 minor units (8,500.00)
      // Credit Tuition Revenue (4001) - 850,000
      await createJournalEntry(
        `JE-${m.year}-INV${seqStr}`,
        `Tuition fee billing for ${m.label}`,
        dateGen('01'),
        [
          { code: '1003', debit: 850000, credit: 0, desc: `Tuition fees invoiced for ${m.label}` },
          { code: '4001', debit: 0, credit: 850000, desc: `Tuition revenue accrued for ${m.label}` }
        ]
      );

      // 2. Fee Collection (10th of month)
      // Debit Cash (1001) - 800,000 minor units (8,000.00)
      // Credit Accounts Receivable (1003) - 800,000
      await createJournalEntry(
        `JE-${m.year}-FEE${seqStr}`,
        `Fee collections for ${m.label}`,
        dateGen('10'),
        [
          { code: '1001', debit: 800000, credit: 0, desc: `Cash received from parents - ${m.label}` },
          { code: '1003', debit: 0, credit: 800000, desc: `Receivable cleared for ${m.label}` }
        ]
      );

      // 3. Staff Salary Accrual (28th of month)
      // Debit Salary Expense (5001) - 450,000 minor units (4,500.00)
      // Credit Accounts Payable (2001) - 450,000
      await createJournalEntry(
        `JE-${m.year}-SLR${seqStr}`,
        `Staff salary payroll expense accrued for ${m.label}`,
        dateGen('28'),
        [
          { code: '5001', debit: 450000, credit: 0, desc: `Salary expense recognized for ${m.label}` },
          { code: '2001', debit: 0, credit: 450000, desc: `Salary payable recognized for ${m.label}` }
        ]
      );

      // 4. Staff Salary Disbursement (5th of next month)
      // Debit Accounts Payable (2001) - 450,000
      // Credit Bank (1002) - 450,000
      await createJournalEntry(
        `JE-${m.nextYear}-PAY${seqStr}`,
        `Salary disbursements for ${m.label} paid via bank transfer`,
        nextDateGen('05'),
        [
          { code: '2001', debit: 450000, credit: 0, desc: `Salaries payable cleared for ${m.label}` },
          { code: '1002', debit: 0, credit: 450000, desc: `Cash paid from Bank - ${m.label}` }
        ]
      );

      // 5. Utility Bills Payment (15th of month)
      // Debit Utilities (5002) - 40,000 (400.00)
      // Credit Bank (1002) - 40,000
      await createJournalEntry(
        `JE-${m.year}-UTL${seqStr}`,
        `Utility bills paid for ${m.label}`,
        dateGen('15'),
        [
          { code: '5002', debit: 40000, credit: 0, desc: `Electricity and water bill - ${m.label}` },
          { code: '1002', debit: 0, credit: 40000, desc: `Utilities paid via bank` }
        ]
      );

      // 6. Rent Payment (1st of month, starting August 2025)
      if (m.month !== '07') {
        await createJournalEntry(
          `JE-${m.year}-RNT${seqStr}`,
          `Rent payment for ${m.label}`,
          dateGen('01'),
          [
            { code: '5003', debit: 100000, credit: 0, desc: `Rent Expense - ${m.label}` },
            { code: '1002', debit: 0, credit: 100000, desc: `Rent paid via bank` }
          ]
        );
      }

      // 7. Stationery & Supplies (20th of month)
      // Debit Stationery (5005) - 12,000 (120.00)
      // Credit Cash (1001) - 12,000
      await createJournalEntry(
        `JE-${m.year}-STN${seqStr}`,
        `Stationery and office supplies purchased - ${m.label}`,
        dateGen('20'),
        [
          { code: '5005', debit: 12000, credit: 0, desc: `Stationery and photocopies - ${m.label}` },
          { code: '1001', debit: 0, credit: 12000, desc: `Paid cash from hand` }
        ]
      );
    }

    // D. June 2026 Final Month Billings and Expenses (Current Month of local date)
    // To ensure the ledger reports look completely current as of June 23, 2026:
    await createJournalEntry(
      'JE-2026-INV12',
      'Tuition fee billing for June 2026',
      '2026-06-01',
      [
        { code: '1003', debit: 850000, credit: 0, desc: 'Tuition fees invoiced for June 2026' },
        { code: '4001', debit: 0, credit: 850000, desc: 'Tuition revenue accrued for June 2026' }
      ]
    );

    await createJournalEntry(
      'JE-2026-FEE12',
      'Fee collections for June 2026',
      '2026-06-10',
      [
        { code: '1001', debit: 780000, credit: 0, desc: 'Cash received from parents - June 2026' },
        { code: '1003', debit: 0, credit: 780000, desc: 'Receivable cleared for June 2026' }
      ]
    );

    console.log('Recalculating cached account balances...');
    // For each account of this school, sum all debits and credits from journal_lines (with posted entries)
    // and update accounts.balance accordingly
    for (const acc of accounts) {
      const isDebitNormal = acc.type === 'asset' || acc.type === 'expense';
      const { rows: balanceRes } = await client.query<{ balance: string }>(
        `SELECT COALESCE(
           SUM(CASE WHEN $2 = true THEN jl.debit - jl.credit
                    ELSE jl.credit - jl.debit END), 0
         )::bigint AS balance
           FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.journal_id
          WHERE jl.account_id = $1
            AND je.status = 'posted'
            AND je.deleted_at IS NULL`,
        [acc.id, isDebitNormal]
      );
      const computedBalance = Number(balanceRes[0].balance);
      
      await client.query(
        'UPDATE accounts SET balance = $1 WHERE id = $2',
        [computedBalance, acc.id]
      );
    }

    await client.query('COMMIT');
    console.log('Database seeding for previous academic session completed successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
