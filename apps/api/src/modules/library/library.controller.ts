import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './library.service.js';

// ── Categories ─────────────────────────────────────────────────────────────

export async function listBookCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listBookCategories(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createBookCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const cat = await service.createBookCategory(req.user!, req.body);
    await audit(req, 'library.category.create', 'book_category', cat.id, null, cat);
    res.status(201).json({ data: cat });
  } catch (e) { next(e); }
}

export async function updateBookCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateBookCategory(req.user!, req.params.id, req.body);
    await audit(req, 'library.category.update', 'book_category', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteBookCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteBookCategory(req.user!, req.params.id);
    await audit(req, 'library.category.delete', 'book_category', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Books ──────────────────────────────────────────────────────────────────

export async function listBooks(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listBooks(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createBook(req: Request, res: Response, next: NextFunction) {
  try {
    const book = await service.createBook(req.user!, req.body);
    await audit(req, 'library.book.create', 'book', book.id, null, book);
    res.status(201).json({ data: book });
  } catch (e) { next(e); }
}

export async function getBook(req: Request, res: Response, next: NextFunction) {
  try {
    const book = await service.getBookById(req.user!, req.params.id);
    res.json({ data: book });
  } catch (e) { next(e); }
}

export async function updateBook(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateBook(req.user!, req.params.id, req.body);
    await audit(req, 'library.book.update', 'book', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteBook(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteBook(req.user!, req.params.id);
    await audit(req, 'library.book.delete', 'book', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Copies ─────────────────────────────────────────────────────────────────

export async function listBookCopies(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listBookCopies(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createBookCopy(req: Request, res: Response, next: NextFunction) {
  try {
    const copy = await service.createBookCopy(req.user!, req.body);
    await audit(req, 'library.copy.create', 'book_copy', copy.id, null, copy);
    res.status(201).json({ data: copy });
  } catch (e) { next(e); }
}

export async function updateBookCopy(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateBookCopy(req.user!, req.params.id, req.body);
    await audit(req, 'library.copy.update', 'book_copy', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteBookCopy(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteBookCopy(req.user!, req.params.id);
    await audit(req, 'library.copy.delete', 'book_copy', req.params.id, null, null);
    res.json({ data: result });
  } catch (e) { next(e); }
}

// ── Issues ─────────────────────────────────────────────────────────────────

export async function listBookIssues(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listBookIssues(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function issueBook(req: Request, res: Response, next: NextFunction) {
  try {
    const issue = await service.issueBook(req.user!, req.body);
    await audit(req, 'book.issue', 'book_issue', issue.id, null, issue);
    res.status(201).json({ data: issue });
  } catch (e) { next(e); }
}

export async function returnBook(req: Request, res: Response, next: NextFunction) {
  try {
    const issue = await service.returnBook(req.user!, req.params.id, req.body);
    await audit(req, 'book.return', 'book_issue', issue.id, null, issue);
    res.json({ data: issue });
  } catch (e) { next(e); }
}

export async function getOverdueBooks(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getOverdueBooks(req.user!);
    res.json(result);
  } catch (e) { next(e); }
}
