/**
 * Accounting controller — double-entry bookkeeping, multi-tenant.
 *
 * Report handlers (trial-balance, P&L, balance-sheet, cash-book) check for an
 * optional `format` query param. When present (pdf|xlsx|csv) they stream a
 * file export; otherwise they return JSON. Reuses reports.export.ts so all
 * export formatting is in one place.
 */
import type { Request, Response, NextFunction } from 'express';
import { audit } from '../../utils/audit.js';
import * as service from './accounting.service.js';
import {
  exportCsv,
  exportExcel,
  exportPdf,
} from '../reports/reports.export.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert a minor-unit bigint money value to a human-readable decimal string
 *  for export cells (keeps the raw number for JSON responses). */
function fmtMoney(v: number): string {
  return (v / 100).toFixed(2);
}

type ExportFormat = 'pdf' | 'xlsx' | 'csv' | undefined;

/**
 * If `format` is set, stream the file; otherwise call `jsonFn` to send JSON.
 * `flatRows`   — flat object array passed to the export functions.
 * `summary`    — key/value pairs shown in the Excel summary sheet and PDF header.
 * `reportName` — slug used for the filename and PDF title.
 */
async function handleExport(
  res: Response,
  format: ExportFormat,
  flatRows: Record<string, unknown>[],
  summary: Record<string, unknown>,
  reportName: string,
  jsonFn: () => void,
) {
  if (!format) { jsonFn(); return; }
  // Format money fields in flat rows so export files show readable decimals.
  const displayRows = flatRows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = typeof v === 'number' && isMoneyKey(k) ? fmtMoney(v) : v;
    }
    return out;
  });
  const displaySummary: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(summary)) {
    displaySummary[k] = typeof v === 'number' && isMoneyKey(k) ? fmtMoney(v) : v;
  }
  const title = reportName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  if (format === 'csv')  { await exportCsv(res,  reportName, displayRows, displaySummary, title); return; }
  if (format === 'xlsx') { await exportExcel(res, reportName, displayRows, displaySummary, title); return; }
  if (format === 'pdf')  { await exportPdf(res,  reportName, displayRows, displaySummary, title); return; }
}

/** Fields whose value is a money amount (minor units → formatted as decimal). */
function isMoneyKey(k: string): boolean {
  const keys = ['debit','credit','totalDebit','totalCredit','balance','amount',
                 'openingBalance','closingBalance','runningBalance',
                 'totalRevenue','totalExpenses','netIncome',
                 'totalAssets','totalLiabilities','totalEquity'];
  return keys.includes(k);
}

// ── Accounts ──────────────────────────────────────────────────────────────

export async function listAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listAccounts(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await service.createAccount(req.user!, req.body);
    await audit(req, 'accounting.account.create', 'account', account.id, null, account);
    res.status(201).json({ data: account });
  } catch (e) { next(e); }
}

export async function updateAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.updateAccount(req.user!, req.params.id, req.body);
    await audit(req, 'accounting.account.update', 'account', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const deleted = await service.deleteAccount(req.user!, req.params.id);
    await audit(req, 'accounting.account.delete', 'account', deleted.id, deleted, null);
    res.json({ data: deleted });
  } catch (e) { next(e); }
}

// ── Journal Entries ───────────────────────────────────────────────────────

export async function listJournals(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listJournals(req.user!, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
}

export async function createJournal(req: Request, res: Response, next: NextFunction) {
  try {
    const journal = await service.createJournal(req.user!, req.body);
    await audit(req, 'accounting.journal.create', 'journal_entry', journal.id, null, journal);
    res.status(201).json({ data: journal });
  } catch (e) { next(e); }
}

export async function getJournal(req: Request, res: Response, next: NextFunction) {
  try {
    const journal = await service.getJournalById(req.user!, req.params.id);
    res.json({ data: journal });
  } catch (e) { next(e); }
}

export async function reverseJournal(req: Request, res: Response, next: NextFunction) {
  try {
    const { before, after } = await service.reverseJournal(req.user!, req.params.id);
    await audit(req, 'accounting.journal.reverse', 'journal_entry', after.id, before, after);
    res.json({ data: after });
  } catch (e) { next(e); }
}

// ── Reports ───────────────────────────────────────────────────────────────

export async function getTrialBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as { asOf?: string; format?: ExportFormat };
    const data = await service.getTrialBalance(req.user!, q as never);

    await handleExport(
      res,
      q.format,
      // Flat rows: one row per account with code, name, type, debit, credit.
      data.accounts.map((a) => ({
        code:        a.code,
        name:        a.name,
        type:        a.type,
        totalDebit:  a.totalDebit,
        totalCredit: a.totalCredit,
      })),
      {
        asOf:        data.asOf,
        totalDebit:  data.accounts.reduce((s, a) => s + a.totalDebit, 0),
        totalCredit: data.accounts.reduce((s, a) => s + a.totalCredit, 0),
      },
      'trial-balance',
      () => res.json({ data }),
    );
  } catch (e) { next(e); }
}

export async function getPLReport(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as { from?: string; to?: string; format?: ExportFormat };
    const data = await service.getPLReport(req.user!, q as never);

    await handleExport(
      res,
      q.format,
      // Flatten revenue + expenses into a single array with a 'category' column.
      [
        ...data.revenue.map((r)  => ({ category: 'Revenue',  name: r.name, amount: r.amount })),
        ...data.expenses.map((e) => ({ category: 'Expense',  name: e.name, amount: e.amount })),
      ],
      {
        from:          data.from,
        to:            data.to,
        totalRevenue:  data.totalRevenue,
        totalExpenses: data.totalExpenses,
        netIncome:     data.netIncome,
      },
      'profit-and-loss',
      () => res.json({ data }),
    );
  } catch (e) { next(e); }
}

export async function getBalanceSheet(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as { asOf?: string; format?: ExportFormat };
    const data = await service.getBalanceSheet(req.user!, q as never);

    await handleExport(
      res,
      q.format,
      // Flatten assets, liabilities, equity with a 'section' discriminator.
      [
        ...data.assets.map((a)      => ({ section: 'Assets',      name: a.name, balance: a.balance })),
        ...data.liabilities.map((l) => ({ section: 'Liabilities', name: l.name, balance: l.balance })),
        ...data.equity.map((e)      => ({ section: 'Equity',       name: e.name, balance: e.balance })),
      ],
      {
        asOf:             data.asOf,
        totalAssets:      data.totalAssets,
        totalLiabilities: data.totalLiabilities,
        totalEquity:      data.totalEquity,
      },
      'balance-sheet',
      () => res.json({ data }),
    );
  } catch (e) { next(e); }
}

export async function getCashBook(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as {
      accountId?: string;
      from?: string;
      to?: string;
      format?: ExportFormat;
    };
    const data = await service.getCashBook(req.user!, q as never);

    await handleExport(
      res,
      q.format,
      // Flat rows: each transaction line with a running balance.
      data.lines.map((l) => ({
        date:           l.entryDate,
        refNo:          l.refNo,
        description:    l.description ?? '',
        accountCode:    l.accountCode,
        accountName:    l.accountName,
        debit:          l.debit,
        credit:         l.credit,
        runningBalance: l.runningBalance,
      })),
      {
        from:           data.from,
        to:             data.to,
        openingBalance: data.openingBalance,
        totalDebit:     data.totalDebit,
        totalCredit:    data.totalCredit,
        closingBalance: data.closingBalance,
      },
      'cash-book',
      () => res.json({ data }),
    );
  } catch (e) { next(e); }
}

export async function getGeneralLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as {
      accountId: string;
      from?: string;
      to?: string;
      format?: ExportFormat;
    };
    const data = await service.getGeneralLedger(req.user!, q as never);

    await handleExport(
      res,
      q.format,
      data.lines.map((l) => ({
        date:           l.entryDate,
        refNo:          l.refNo,
        description:    l.description ?? '',
        debit:          l.debit,
        credit:         l.credit,
        runningBalance: l.runningBalance,
      })),
      {
        accountName:    data.accountName,
        accountCode:    data.accountCode,
        accountType:    data.accountType.toUpperCase(),
        from:           data.from,
        to:             data.to,
        openingBalance: data.openingBalance,
        totalDebit:     data.totalDebit,
        totalCredit:    data.totalCredit,
        closingBalance: data.closingBalance,
      },
      'general-ledger',
      () => res.json({ data }),
    );
  } catch (e) { next(e); }
}
