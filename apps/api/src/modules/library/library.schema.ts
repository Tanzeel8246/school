import { z } from 'zod';

// ── Categories ─────────────────────────────────────────────────────────────

export const createBookCategorySchema = z.object({
  name:        z.string().min(1).max(120),
  description: z.string().optional(),
});
export type CreateBookCategoryInput = z.infer<typeof createBookCategorySchema>;

export const updateBookCategorySchema = createBookCategorySchema.partial();
export type UpdateBookCategoryInput = z.infer<typeof updateBookCategorySchema>;

export const listBookCategoriesQuerySchema = z.object({
  q:     z.string().optional(),
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
});
export type ListBookCategoriesQuery = z.infer<typeof listBookCategoriesQuerySchema>;

// ── Books ──────────────────────────────────────────────────────────────────

export const createBookSchema = z.object({
  title:        z.string().min(1).max(255),
  author:       z.string().optional(),
  isbn:         z.string().optional(),
  publisher:    z.string().optional(),
  edition:      z.string().optional(),
  categoryId:   z.string().uuid().optional(),
  totalCopies:  z.number().int().positive().optional().default(1),
  finePerDay:   z.number().int().nonnegative().optional().default(500),
  coverUrl:     z.string().url().optional(),
});
export type CreateBookInput = z.infer<typeof createBookSchema>;

export const updateBookSchema = createBookSchema.partial();
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const listBooksQuerySchema = z.object({
  q:          z.string().optional(),
  categoryId: z.string().uuid().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(1000).default(20),
});
export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;

// ── Copies ─────────────────────────────────────────────────────────────────

export const createBookCopySchema = z.object({
  bookId:    z.string().uuid(),
  barcode:   z.string().optional(),
  condition: z.enum(['good', 'fair', 'poor', 'damaged']).optional().default('good'),
});
export type CreateBookCopyInput = z.infer<typeof createBookCopySchema>;

export const updateBookCopySchema = z.object({
  barcode:   z.string().optional(),
  condition: z.enum(['good', 'fair', 'poor', 'damaged']).optional(),
  status:    z.enum(['available', 'issued', 'lost', 'damaged']).optional(),
});
export type UpdateBookCopyInput = z.infer<typeof updateBookCopySchema>;

export const listBookCopiesQuerySchema = z.object({
  bookId: z.string().uuid().optional(),
  status: z.enum(['available', 'issued', 'lost', 'damaged']).optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(1000).default(20),
});
export type ListBookCopiesQuery = z.infer<typeof listBookCopiesQuerySchema>;

// ── Issues ─────────────────────────────────────────────────────────────────

export const createBookIssueSchema = z.object({
  bookCopyId:   z.string().uuid().optional(),
  bookId:       z.string().uuid().optional(),
  borrowerId:   z.string().uuid(),
  borrowerType: z.enum(['student', 'staff']).optional().default('student'),
  dueDays:      z.number().int().positive().optional().default(14),
}).refine((d) => d.bookCopyId || d.bookId, {
  message: 'Either bookCopyId or bookId is required',
});
export type CreateBookIssueInput = z.infer<typeof createBookIssueSchema>;

export const returnBookSchema = z.object({
  notes: z.string().optional(),
});
export type ReturnBookInput = z.infer<typeof returnBookSchema>;

export const listBookIssuesQuerySchema = z.object({
  status:     z.enum(['issued', 'returned', 'overdue', 'lost']).optional(),
  borrowerId: z.string().uuid().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(1000).default(20),
});
export type ListBookIssuesQuery = z.infer<typeof listBookIssuesQuerySchema>;
