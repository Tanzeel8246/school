/**
 * Library service — multi-tenant, all queries scoped to actor.schoolId.
 * Money (fine_per_day, fine_amount) is BIGINT minor units throughout.
 * Soft-delete via deleted_at; all reads filter deleted_at IS NULL.
 * withTransaction used for multi-statement mutations (transactional integrity).
 */
import { query, withTransaction } from '../../config/db.js';
import type { AccessClaims } from '../../utils/jwt.js';
import { notFound, conflict, unprocessable } from '../../utils/http-error.js';
import type {
  ListBookCategoriesQuery,
  CreateBookCategoryInput,
  UpdateBookCategoryInput,
  ListBooksQuery,
  CreateBookInput,
  UpdateBookInput,
  ListBookCopiesQuery,
  CreateBookCopyInput,
  UpdateBookCopyInput,
  ListBookIssuesQuery,
  CreateBookIssueInput,
  ReturnBookInput,
} from './library.schema.js';

// ── Row types ──────────────────────────────────────────────────────────────

interface BookCategoryRow {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface BookRow {
  id: string;
  school_id: string;
  category_id: string | null;
  category_name: string | null;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  edition: string | null;
  total_copies: number;
  available_copies: number;
  fine_per_day: string | number;
  cover_url: string | null;
  created_at: string;
}

interface BookCopyRow {
  id: string;
  school_id: string;
  book_id: string;
  book_title: string | null;
  barcode: string | null;
  condition: string;
  status: string;
  created_at: string;
}

interface BookIssueRow {
  id: string;
  school_id: string;
  book_copy_id: string;
  book_id: string;
  book_title: string | null;
  copy_barcode: string | null;
  borrower_id: string;
  borrower_name: string | null;
  borrower_type: string;
  issued_at: string;
  due_date: string;
  returned_at: string | null;
  days_overdue: number;
  fine_amount: string | number;
  fine_paid: boolean;
  status: string;
  notes: string | null;
}

// ── DTO mappers (snake_case row → camelCase DTO) ───────────────────────────

const toBookCategoryDto = (r: BookCategoryRow) => ({
  id:          r.id,
  schoolId:    r.school_id,
  name:        r.name,
  description: r.description,
  createdAt:   r.created_at,
});

const toBookDto = (r: BookRow) => ({
  id:              r.id,
  schoolId:        r.school_id,
  categoryId:      r.category_id,
  categoryName:    r.category_name,
  title:           r.title,
  author:          r.author,
  isbn:            r.isbn,
  publisher:       r.publisher,
  edition:         r.edition,
  totalCopies:     r.total_copies,
  availableCopies: r.available_copies,
  finePerDay:      Number(r.fine_per_day),
  coverUrl:        r.cover_url,
  createdAt:       r.created_at,
});

const toBookCopyDto = (r: BookCopyRow) => ({
  id:        r.id,
  schoolId:  r.school_id,
  bookId:    r.book_id,
  bookTitle: r.book_title,
  barcode:   r.barcode,
  condition: r.condition,
  status:    r.status,
  createdAt: r.created_at,
});

const toBookIssueDto = (r: BookIssueRow) => ({
  id:           r.id,
  schoolId:     r.school_id,
  bookCopyId:   r.book_copy_id,
  bookId:       r.book_id,
  bookTitle:    r.book_title,
  copyBarcode:  r.copy_barcode,
  borrowerId:   r.borrower_id,
  borrowerName: r.borrower_name,
  borrowerType: r.borrower_type,
  issuedAt:     r.issued_at,
  dueDate:      r.due_date,
  returnedAt:   r.returned_at,
  daysOverdue:  Number(r.days_overdue),
  fineAmount:   Number(r.fine_amount),
  finePaid:     r.fine_paid,
  status:       r.status,
  notes:        r.notes,
});

// ═══════════════════════════════════════════════════════════════════════════
// BOOK CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

export async function listBookCategories(actor: AccessClaims, q: ListBookCategoriesQuery) {
  // Multi-tenant: all queries scoped to actor.schoolId, soft-delete filtered.
  const where: string[] = ['school_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`name ILIKE $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<BookCategoryRow>(
      `SELECT id, school_id, name, description, created_at
         FROM book_categories
        WHERE ${whereSql}
        ORDER BY name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM book_categories WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toBookCategoryDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createBookCategory(actor: AccessClaims, input: CreateBookCategoryInput) {
  const { rows } = await query<BookCategoryRow>(
    `INSERT INTO book_categories (school_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, school_id, name, description, created_at`,
    [actor.schoolId, input.name, input.description ?? null],
  ).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw conflict('A category with this name already exists');
    }
    throw err;
  });
  return toBookCategoryDto(rows[0]);
}

export async function updateBookCategory(
  actor: AccessClaims,
  id: string,
  input: UpdateBookCategoryInput,
) {
  const { rows: before } = await query<BookCategoryRow>(
    `SELECT id, school_id, name, description, created_at
       FROM book_categories WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Book category not found');

  const { rows } = await query<BookCategoryRow>(
    `UPDATE book_categories
        SET name        = COALESCE($3, name),
            description = COALESCE($4, description)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, name, description, created_at`,
    [id, actor.schoolId, input.name ?? null, input.description ?? null],
  );
  return { before: toBookCategoryDto(before[0]), after: toBookCategoryDto(rows[0]) };
}

export async function deleteBookCategory(actor: AccessClaims, id: string) {
  // Soft-delete; multi-tenant scope via school_id.
  const { rows } = await query<BookCategoryRow>(
    `UPDATE book_categories SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, name, description, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Book category not found');
  return toBookCategoryDto(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOKS
// ═══════════════════════════════════════════════════════════════════════════

const BOOK_SELECT = `
  b.id, b.school_id, b.category_id, bc.name AS category_name,
  b.title, b.author, b.isbn, b.publisher, b.edition,
  b.total_copies, b.available_copies, b.fine_per_day, b.cover_url, b.created_at`;

export async function listBooks(actor: AccessClaims, q: ListBooksQuery) {
  // Multi-tenant, soft-delete filtered, includes category name.
  const where: string[] = ['b.school_id = $1', 'b.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.q) {
    params.push(`%${q.q}%`);
    where.push(`(b.title ILIKE $${params.length} OR b.author ILIKE $${params.length} OR b.isbn ILIKE $${params.length})`);
  }
  if (q.categoryId) {
    params.push(q.categoryId);
    where.push(`b.category_id = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<BookRow>(
      `SELECT ${BOOK_SELECT}
         FROM books b
         LEFT JOIN book_categories bc ON bc.id = b.category_id
        WHERE ${whereSql}
        ORDER BY b.title
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM books b WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toBookDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createBook(actor: AccessClaims, input: CreateBookInput) {
  // Transaction: insert book + auto-create book_copies (totalCopies rows).
  return withTransaction(async (client) => {
    const copies = input.totalCopies ?? 1;

    const { rows } = await client.query<BookRow>(
      `INSERT INTO books
         (school_id, category_id, title, author, isbn, publisher, edition,
          total_copies, available_copies, fine_per_day, cover_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10)
       RETURNING id, school_id, category_id, title, author, isbn, publisher, edition,
                 total_copies, available_copies, fine_per_day, cover_url, created_at`,
      [
        actor.schoolId,
        input.categoryId ?? null,
        input.title,
        input.author ?? null,
        input.isbn ?? null,
        input.publisher ?? null,
        input.edition ?? null,
        copies,
        input.finePerDay ?? 500,
        input.coverUrl ?? null,
      ],
    );
    const book = rows[0];

    // Auto-create `copies` book_copies rows with barcode=NULL, status='available'.
    for (let i = 0; i < copies; i++) {
      await client.query(
        `INSERT INTO book_copies (school_id, book_id, barcode, condition, status)
         VALUES ($1, $2, NULL, 'good', 'available')`,
        [actor.schoolId, book.id],
      );
    }

    // category_name not available from INSERT RETURNING; fetch it if categoryId given.
    if (book.category_id) {
      const { rows: catRows } = await client.query<{ name: string }>(
        `SELECT name FROM book_categories WHERE id = $1`,
        [book.category_id],
      );
      return toBookDto({ ...book, category_name: catRows[0]?.name ?? null });
    }
    return toBookDto({ ...book, category_name: null });
  });
}

export async function getBookById(actor: AccessClaims, id: string) {
  // Multi-tenant, includes copies array.
  const { rows } = await query<BookRow>(
    `SELECT ${BOOK_SELECT}
       FROM books b
       LEFT JOIN book_categories bc ON bc.id = b.category_id
      WHERE b.id = $1 AND b.school_id = $2 AND b.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Book not found');

  const { rows: copies } = await query<BookCopyRow>(
    `SELECT bc.id, bc.school_id, bc.book_id, b.title AS book_title,
            bc.barcode, bc.condition, bc.status, bc.created_at
       FROM book_copies bc
       JOIN books b ON b.id = bc.book_id
      WHERE bc.book_id = $1 AND bc.deleted_at IS NULL`,
    [id],
  );

  return {
    ...toBookDto(rows[0]),
    copies: copies.map(toBookCopyDto),
  };
}

export async function updateBook(actor: AccessClaims, id: string, input: UpdateBookInput) {
  const { rows: before } = await query<BookRow>(
    `SELECT ${BOOK_SELECT}
       FROM books b
       LEFT JOIN book_categories bc ON bc.id = b.category_id
      WHERE b.id = $1 AND b.school_id = $2 AND b.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Book not found');

  const { rows } = await query<BookRow>(
    `UPDATE books
        SET category_id = COALESCE($3, category_id),
            title       = COALESCE($4, title),
            author      = COALESCE($5, author),
            isbn        = COALESCE($6, isbn),
            publisher   = COALESCE($7, publisher),
            edition     = COALESCE($8, edition),
            fine_per_day = COALESCE($9, fine_per_day),
            cover_url   = COALESCE($10, cover_url)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, category_id, title, author, isbn, publisher, edition,
                total_copies, available_copies, fine_per_day, cover_url, created_at`,
    [
      id, actor.schoolId,
      input.categoryId ?? null,
      input.title ?? null,
      input.author ?? null,
      input.isbn ?? null,
      input.publisher ?? null,
      input.edition ?? null,
      input.finePerDay ?? null,
      input.coverUrl ?? null,
    ],
  );

  const after = { ...rows[0], category_name: before[0].category_name };
  return { before: toBookDto(before[0]), after: toBookDto(after) };
}

export async function deleteBook(actor: AccessClaims, id: string) {
  // Reject if any copy has status='issued' (multi-tenant, soft-delete).
  const { rows: issuedRows } = await query<{ cnt: number }>(
    `SELECT count(*)::int AS cnt FROM book_copies
      WHERE book_id = $1 AND school_id = $2 AND status = 'issued' AND deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (Number(issuedRows[0]?.cnt) > 0) {
    throw unprocessable('Cannot delete book: one or more copies are currently issued');
  }

  const { rows } = await query<BookRow>(
    `UPDATE books SET deleted_at = now()
      WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL
      RETURNING id, school_id, category_id, title, author, isbn, publisher, edition,
                total_copies, available_copies, fine_per_day, cover_url, created_at`,
    [id, actor.schoolId],
  );
  if (!rows[0]) throw notFound('Book not found');
  return toBookDto({ ...rows[0], category_name: null });
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOK COPIES
// ═══════════════════════════════════════════════════════════════════════════

export async function listBookCopies(actor: AccessClaims, q: ListBookCopiesQuery) {
  const where: string[] = ['bc.school_id = $1', 'bc.deleted_at IS NULL'];
  const params: unknown[] = [actor.schoolId];

  if (q.bookId) {
    params.push(q.bookId);
    where.push(`bc.book_id = $${params.length}`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`bc.status = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<BookCopyRow>(
      `SELECT bc.id, bc.school_id, bc.book_id, b.title AS book_title,
              bc.barcode, bc.condition, bc.status, bc.created_at
         FROM book_copies bc
         JOIN books b ON b.id = bc.book_id
        WHERE ${whereSql}
        ORDER BY bc.created_at
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM book_copies bc WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toBookCopyDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function createBookCopy(actor: AccessClaims, input: CreateBookCopyInput) {
  // Add one copy; increment book.total_copies + available_copies. Transactional.
  return withTransaction(async (client) => {
    // Verify book belongs to this school (multi-tenant).
    const { rows: bookRows } = await client.query<{ id: string; title: string }>(
      `SELECT id, title FROM books WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.bookId, actor.schoolId],
    );
    if (!bookRows[0]) throw notFound('Book not found');

    const { rows } = await client.query<BookCopyRow>(
      `INSERT INTO book_copies (school_id, book_id, barcode, condition, status)
       VALUES ($1, $2, $3, $4, 'available')
       RETURNING id, school_id, book_id, barcode, condition, status, created_at`,
      [actor.schoolId, input.bookId, input.barcode ?? null, input.condition ?? 'good'],
    ).catch((err: unknown) => {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw conflict('A copy with this barcode already exists');
      }
      throw err;
    });

    // Increment book totals.
    await client.query(
      `UPDATE books SET total_copies = total_copies + 1, available_copies = available_copies + 1
        WHERE id = $1`,
      [input.bookId],
    );

    return toBookCopyDto({ ...rows[0], book_title: bookRows[0].title });
  });
}

export async function updateBookCopy(
  actor: AccessClaims,
  id: string,
  input: UpdateBookCopyInput,
) {
  const { rows: before } = await query<BookCopyRow>(
    `SELECT bc.id, bc.school_id, bc.book_id, b.title AS book_title,
            bc.barcode, bc.condition, bc.status, bc.created_at
       FROM book_copies bc JOIN books b ON b.id = bc.book_id
      WHERE bc.id = $1 AND bc.school_id = $2 AND bc.deleted_at IS NULL`,
    [id, actor.schoolId],
  );
  if (!before[0]) throw notFound('Book copy not found');

  const { rows } = await query<BookCopyRow>(
    `UPDATE book_copies
        SET barcode   = COALESCE($3, barcode),
            condition = COALESCE($4, condition),
            status    = COALESCE($5, status)
      WHERE id = $1 AND school_id = $2
      RETURNING id, school_id, book_id, barcode, condition, status, created_at`,
    [id, actor.schoolId, input.barcode ?? null, input.condition ?? null, input.status ?? null],
  );

  const after = { ...rows[0], book_title: before[0].book_title };
  return { before: toBookCopyDto(before[0]), after: toBookCopyDto(after) };
}

export async function deleteBookCopy(actor: AccessClaims, id: string) {
  // Soft-delete; decrement book totals. Transactional.
  return withTransaction(async (client) => {
    const { rows: copyRows } = await client.query<{ id: string; book_id: string; status: string }>(
      `SELECT id, book_id, status FROM book_copies
        WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [id, actor.schoolId],
    );
    if (!copyRows[0]) throw notFound('Book copy not found');
    if (copyRows[0].status === 'issued') {
      throw unprocessable('Cannot delete an issued copy');
    }

    await client.query(
      `UPDATE book_copies SET deleted_at = now() WHERE id = $1`,
      [id],
    );

    // Decrement totals on the parent book; only decrement available if copy was available.
    const isAvailable = copyRows[0].status === 'available';
    const availDelta = isAvailable ? 1 : 0;
    await client.query(
      `UPDATE books
          SET total_copies     = total_copies - 1,
              available_copies = available_copies - $1
        WHERE id = $2`,
      [availDelta, copyRows[0].book_id],
    );

    return { id };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ISSUES
// ═══════════════════════════════════════════════════════════════════════════

const ISSUE_SELECT = `
  bi.id, bi.school_id, bi.book_copy_id, bi.book_id,
  b.title AS book_title, bc.barcode AS copy_barcode,
  bi.borrower_id,
  COALESCE(u.full_name, '') AS borrower_name,
  bi.borrower_type,
  bi.issued_at, bi.due_date, bi.returned_at,
  GREATEST(0, (current_date - bi.due_date)::int) AS days_overdue,
  bi.fine_amount, bi.fine_paid, bi.status, bi.notes`;

export async function listBookIssues(actor: AccessClaims, q: ListBookIssuesQuery) {
  const where: string[] = ['bi.school_id = $1'];
  const params: unknown[] = [actor.schoolId];

  if (q.status) {
    params.push(q.status);
    where.push(`bi.status = $${params.length}`);
  }
  if (q.borrowerId) {
    params.push(q.borrowerId);
    where.push(`bi.borrower_id = $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const offset = (q.page - 1) * q.limit;

  const [dataRes, countRes] = await Promise.all([
    query<BookIssueRow>(
      `SELECT ${ISSUE_SELECT}
         FROM book_issues bi
         JOIN books b ON b.id = bi.book_id
         JOIN book_copies bc ON bc.id = bi.book_copy_id
         JOIN users u ON u.id = bi.borrower_id
        WHERE ${whereSql}
        ORDER BY bi.issued_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, offset],
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total FROM book_issues bi WHERE ${whereSql}`,
      params,
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  return {
    data: dataRes.rows.map(toBookIssueDto),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function issueBook(actor: AccessClaims, input: CreateBookIssueInput) {
  // All steps in one transaction: find/validate copy, set status, decrement available_copies.
  return withTransaction(async (client) => {
    let copyId = input.bookCopyId;
    let bookId = input.bookId;

    if (copyId) {
      // Verify copy belongs to this school and get its book_id.
      const { rows } = await client.query<{ id: string; book_id: string; status: string }>(
        `SELECT id, book_id, status FROM book_copies
          WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
        [copyId, actor.schoolId],
      );
      if (!rows[0]) throw notFound('Book copy not found');
      if (rows[0].status !== 'available') {
        throw unprocessable(`Copy is not available (status: ${rows[0].status})`);
      }
      bookId = rows[0].book_id;
    } else {
      // Find first available copy for the given bookId (multi-tenant).
      const { rows } = await client.query<{ id: string; status: string }>(
        `SELECT id FROM book_copies
          WHERE book_id = $1 AND school_id = $2 AND status = 'available' AND deleted_at IS NULL
          LIMIT 1`,
        [bookId, actor.schoolId],
      );
      if (!rows[0]) throw unprocessable('No available copies for this book');
      copyId = rows[0].id;
    }

    // Verify borrower exists (multi-tenant).
    const { rows: userRows } = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [input.borrowerId, actor.schoolId],
    );
    if (!userRows[0]) throw notFound('Borrower not found');

    const dueDays = input.dueDays ?? 14;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // SET copy status='issued'.
    await client.query(
      `UPDATE book_copies SET status = 'issued' WHERE id = $1`,
      [copyId],
    );

    // DECREMENT book.available_copies.
    await client.query(
      `UPDATE books SET available_copies = available_copies - 1 WHERE id = $1`,
      [bookId],
    );

    // Insert issue record.
    const { rows: issueRows } = await client.query<BookIssueRow>(
      `INSERT INTO book_issues
         (school_id, book_copy_id, book_id, borrower_id, borrower_type,
          issued_by, due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'issued')
       RETURNING id, school_id, book_copy_id, book_id, borrower_id, borrower_type,
                 issued_at, due_date, returned_at, fine_amount, fine_paid, status, notes`,
      [actor.schoolId, copyId, bookId, input.borrowerId,
       input.borrowerType ?? 'student', actor.sub, dueDateStr],
    );

    const issue = issueRows[0];

    // Fetch names for DTO.
    const [bookRes, copyRes, userRes] = await Promise.all([
      client.query<{ title: string }>(`SELECT title FROM books WHERE id = $1`, [bookId]),
      client.query<{ barcode: string | null }>(`SELECT barcode FROM book_copies WHERE id = $1`, [copyId]),
      client.query<{ full_name: string }>(`SELECT full_name FROM users WHERE id = $1`, [input.borrowerId]),
    ]);

    return toBookIssueDto({
      ...issue,
      book_title:   bookRes.rows[0]?.title ?? null,
      copy_barcode: copyRes.rows[0]?.barcode ?? null,
      borrower_name: userRes.rows[0]?.full_name ?? '',
      days_overdue: 0,
    });
  });
}

export async function returnBook(actor: AccessClaims, id: string, input: ReturnBookInput) {
  // SET copy status='available', INCREMENT available_copies, compute fine. Transactional.
  return withTransaction(async (client) => {
    const { rows: issueRows } = await client.query<{
      id: string; book_copy_id: string; book_id: string;
      due_date: string; status: string; borrower_id: string;
    }>(
      `SELECT id, book_copy_id, book_id, due_date, status, borrower_id
         FROM book_issues WHERE id = $1 AND school_id = $2`,
      [id, actor.schoolId],
    );
    if (!issueRows[0]) throw notFound('Issue record not found');
    if (issueRows[0].status === 'returned') {
      throw unprocessable('Book has already been returned');
    }

    const issue = issueRows[0];

    // Fetch fine_per_day from the book.
    const { rows: bookRows } = await client.query<{ fine_per_day: string }>(
      `SELECT fine_per_day FROM books WHERE id = $1`,
      [issue.book_id],
    );
    const finePerDay = Number(bookRows[0]?.fine_per_day ?? 500);

    // Compute fine: days late * fine_per_day.
    const now = new Date();
    const dueDate = new Date(issue.due_date);
    const msPerDay = 86_400_000;
    const daysLate = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / msPerDay));
    const fineAmount = daysLate * finePerDay;

    // SET copy status='available'.
    await client.query(
      `UPDATE book_copies SET status = 'available' WHERE id = $1`,
      [issue.book_copy_id],
    );

    // INCREMENT book.available_copies.
    await client.query(
      `UPDATE books SET available_copies = available_copies + 1 WHERE id = $1`,
      [issue.book_id],
    );

    // Mark issue as returned.
    const { rows } = await client.query<BookIssueRow>(
      `UPDATE book_issues
          SET status = 'returned', returned_at = now(),
              fine_amount = $3, notes = COALESCE($4, notes)
        WHERE id = $1 AND school_id = $2
        RETURNING id, school_id, book_copy_id, book_id, borrower_id, borrower_type,
                  issued_at, due_date, returned_at, fine_amount, fine_paid, status, notes`,
      [id, actor.schoolId, fineAmount, input.notes ?? null],
    );

    const updated = rows[0];

    // Fetch display names.
    const [bookRes, copyRes, userRes] = await Promise.all([
      client.query<{ title: string }>(`SELECT title FROM books WHERE id = $1`, [updated.book_id]),
      client.query<{ barcode: string | null }>(`SELECT barcode FROM book_copies WHERE id = $1`, [updated.book_copy_id]),
      client.query<{ full_name: string }>(`SELECT full_name FROM users WHERE id = $1`, [updated.borrower_id]),
    ]);

    return toBookIssueDto({
      ...updated,
      book_title:    bookRes.rows[0]?.title ?? null,
      copy_barcode:  copyRes.rows[0]?.barcode ?? null,
      borrower_name: userRes.rows[0]?.full_name ?? '',
      days_overdue:  0, // returned, so 0
    });
  });
}

export async function getOverdueBooks(actor: AccessClaims) {
  // Issues where due_date < current_date AND status='issued'. Multi-tenant.
  const { rows } = await query<BookIssueRow>(
    `SELECT ${ISSUE_SELECT}
       FROM book_issues bi
       JOIN books b ON b.id = bi.book_id
       JOIN book_copies bc ON bc.id = bi.book_copy_id
       JOIN users u ON u.id = bi.borrower_id
      WHERE bi.school_id = $1
        AND bi.status = 'issued'
        AND bi.due_date < current_date
      ORDER BY bi.due_date ASC`,
    [actor.schoolId],
  );
  return { data: rows.map(toBookIssueDto) };
}
