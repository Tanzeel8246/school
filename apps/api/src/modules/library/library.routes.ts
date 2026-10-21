/**
 * Library router — all routes require authentication.
 * Literal paths (/overdue, /issues) declared BEFORE /:id routes (blueprint §routing).
 * Permissions: library:read, library:write, library:manage.
 */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listBookCategoriesQuerySchema,
  createBookCategorySchema,
  updateBookCategorySchema,
  listBooksQuerySchema,
  createBookSchema,
  updateBookSchema,
  listBookCopiesQuerySchema,
  createBookCopySchema,
  updateBookCopySchema,
  listBookIssuesQuerySchema,
  createBookIssueSchema,
  returnBookSchema,
} from './library.schema.js';
import * as ctrl from './library.controller.js';

export const libraryRouter = Router();
libraryRouter.use(authenticate);

// ── Categories ─────────────────────────────────────────────────────────────
libraryRouter.get('/categories', requirePermission('library:read'), validate(listBookCategoriesQuerySchema, 'query'), ctrl.listBookCategories);
libraryRouter.post('/categories', requirePermission('library:write'), validate(createBookCategorySchema), ctrl.createBookCategory);
libraryRouter.patch('/categories/:id', requirePermission('library:write'), validate(updateBookCategorySchema), ctrl.updateBookCategory);
libraryRouter.delete('/categories/:id', requirePermission('library:write'), ctrl.deleteBookCategory);

// ── Books — literal paths (/overdue, /issues) BEFORE /:id ─────────────────
libraryRouter.get('/overdue', requirePermission('library:read'), ctrl.getOverdueBooks);
libraryRouter.get('/issues', requirePermission('library:read'), validate(listBookIssuesQuerySchema, 'query'), ctrl.listBookIssues);
libraryRouter.post('/issues', requirePermission('library:write'), validate(createBookIssueSchema), ctrl.issueBook);
libraryRouter.patch('/issues/:id/return', requirePermission('library:write'), validate(returnBookSchema), ctrl.returnBook);

// ── Books CRUD ─────────────────────────────────────────────────────────────
libraryRouter.get('/books', requirePermission('library:read'), validate(listBooksQuerySchema, 'query'), ctrl.listBooks);
libraryRouter.post('/books', requirePermission('library:write'), validate(createBookSchema), ctrl.createBook);
libraryRouter.get('/books/:id', requirePermission('library:read'), ctrl.getBook);
libraryRouter.patch('/books/:id', requirePermission('library:write'), validate(updateBookSchema), ctrl.updateBook);
libraryRouter.delete('/books/:id', requirePermission('library:write'), ctrl.deleteBook);

// ── Copies ─────────────────────────────────────────────────────────────────
libraryRouter.get('/copies', requirePermission('library:read'), validate(listBookCopiesQuerySchema, 'query'), ctrl.listBookCopies);
libraryRouter.post('/copies', requirePermission('library:write'), validate(createBookCopySchema), ctrl.createBookCopy);
libraryRouter.patch('/copies/:id', requirePermission('library:manage'), validate(updateBookCopySchema), ctrl.updateBookCopy);
libraryRouter.delete('/copies/:id', requirePermission('library:manage'), ctrl.deleteBookCopy);
