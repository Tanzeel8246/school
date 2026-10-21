/**
 * LibraryPage — 4 tabs: Books | Issue Book | Overdue | Catalog
 */
import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Plus, Loader2, Search, RotateCcw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useApiList } from '@/hooks/useApiList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RowMenu } from '@/components/RowMenu';
import { Pagination } from '@/components/Pagination';
import { money, toMinor, date, statusVariant } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Book, BookCategory, BookCopy, BookIssue } from '@/lib/dto';

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'books' | 'issue' | 'overdue' | 'catalog';

const TABS: { id: Tab; label: string }[] = [
  { id: 'books', label: 'Books' },
  { id: 'issue', label: 'Issue Book' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'catalog', label: 'Catalog' },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 border-b border-border">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            active === t.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function LibraryPage() {
  const [tab, setTab] = useState<Tab>('books');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Library</h1>
          <p className="text-sm text-muted-foreground">Manage books, copies, issues and overdue tracking.</p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === 'books' && <BooksTab />}
      {tab === 'issue' && <IssueTab />}
      {tab === 'overdue' && <OverdueTab />}
      {tab === 'catalog' && <CatalogTab />}
    </div>
  );
}

// ─── Books tab ────────────────────────────────────────────────────────────────

function BooksTab() {
  const { can } = useAuth();
  const canWrite = can('library:write');

  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<BookCategory[]>([]);

  const { rows, meta, loading, error, query, page, setQuery, setPage, refetch } = useApiList<Book>({
    path: '/library/books',
    params: { categoryId: categoryId || undefined },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [copiesBook, setCopiesBook] = useState<Book | null>(null);

  useEffect(() => {
    api.get<BookCategory[]>('/library/categories?limit=100')
      .then((r) => setCategories(r.data ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, author…" className="pl-9 w-56" />
        </div>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-44">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="ml-auto">
          {canWrite && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              New Book
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Title</TH>
            <TH>Author</TH>
            <TH>ISBN</TH>
            <TH>Category</TH>
            <TH>Total</TH>
            <TH>Available</TH>
            <TH>Fine/Day</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={8} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={8} className="py-10 text-center text-muted-foreground">No books found. Add your first book.</TD>
            </TR>
          )}
          {!loading && rows.map((b) => (
            <TR key={b.id}>
              <TD className="font-medium text-foreground">{b.title}</TD>
              <TD>{b.author ?? '—'}</TD>
              <TD className="font-mono text-xs">{b.isbn ?? '—'}</TD>
              <TD>{b.categoryName ?? '—'}</TD>
              <TD>{b.totalCopies}</TD>
              <TD>
                <span className={cn('font-medium', b.availableCopies === 0 ? 'text-red-600' : 'text-emerald-600')}>
                  {b.availableCopies}
                </span>
              </TD>
              <TD className="font-mono">{money(b.finePerDay)}</TD>
              <TD className="text-right">
                <RowMenu items={[
                  { label: 'View Copies', onClick: () => setCopiesBook(b) },
                  { label: 'Edit', onClick: () => { setEditing(b); setFormOpen(true); }, hidden: !canWrite },
                  { label: 'Delete', onClick: () => setDeleteTarget(b), danger: true, hidden: !canWrite },
                ]} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="books" />

      <BookFormDialog open={formOpen} book={editing} categories={categories} onClose={() => setFormOpen(false)} onSaved={refetch} />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Book"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.del(`/library/books/${deleteTarget.id}`);
          setDeleteTarget(null);
          refetch();
        }}
      />

      {copiesBook && (
        <CopiesPanel book={copiesBook} canWrite={canWrite} onClose={() => setCopiesBook(null)} />
      )}
    </div>
  );
}

// Book form dialog

function BookFormDialog({ open, book, categories, onClose, onSaved }: {
  open: boolean; book: Book | null; categories: BookCategory[];
  onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [publisher, setPublisher] = useState('');
  const [edition, setEdition] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [totalCopies, setTotalCopies] = useState('1');
  const [finePerDay, setFinePerDay] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (book) {
      setTitle(book.title); setAuthor(book.author ?? ''); setIsbn(book.isbn ?? '');
      setPublisher(book.publisher ?? ''); setEdition(book.edition ?? '');
      setCategoryId(book.categoryId ?? ''); setTotalCopies(String(book.totalCopies));
      setFinePerDay(String(book.finePerDay / 100));
    } else {
      setTitle(''); setAuthor(''); setIsbn(''); setPublisher(''); setEdition('');
      setCategoryId(''); setTotalCopies('1'); setFinePerDay('');
    }
    setError(null);
  }, [book, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        title, author: author || undefined, isbn: isbn || undefined,
        publisher: publisher || undefined, edition: edition || undefined,
        categoryId: categoryId || undefined, totalCopies: Number(totalCopies),
        finePerDay: toMinor(finePerDay),
      };
      if (book) await api.patch(`/library/books/${book.id}`, payload);
      else await api.post('/library/books', payload);
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not save book.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title={book ? 'Edit Book' : 'New Book'} onClose={onClose} />
        <DialogBody className="space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <ErrorBox message={error} />}
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Book title" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Author"><Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" /></Field>
            <Field label="ISBN"><Input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978-..." /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publisher"><Input value={publisher} onChange={(e) => setPublisher(e.target.value)} /></Field>
            <Field label="Edition"><Input value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="e.g. 3rd" /></Field>
          </div>
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Copies"><Input type="number" min="1" value={totalCopies} onChange={(e) => setTotalCopies(e.target.value)} required /></Field>
            <Field label="Fine Per Day (PKR)"><Input type="number" min="0" step="0.01" value={finePerDay} onChange={(e) => setFinePerDay(e.target.value)} placeholder="e.g. 5" /></Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {book ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// Copies panel

function CopiesPanel({ book, canWrite, onClose }: { book: Book; canWrite: boolean; onClose: () => void }) {
  const [copies, setCopies] = useState<BookCopy[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [condition, setCondition] = useState<'good' | 'fair' | 'poor' | 'damaged'>('good');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<BookCopy[]>(`/library/copies?bookId=${book.id}&limit=100`)
      .then((r) => setCopies(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [book.id]);

  useEffect(() => { load(); }, [load]);

  async function addCopy(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api.post('/library/copies', { bookId: book.id, barcode: barcode || undefined, condition });
      setBarcode(''); setCondition('good'); setAddOpen(false); load();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not add copy.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader title={`Copies — ${book.title}`} description={`${copies.length} copies`} onClose={onClose} />
      <DialogBody className="space-y-4 overflow-y-auto max-h-[60vh]">
        {error && <ErrorBox message={error} />}
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Barcode</TH>
                <TH>Condition</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {copies.length === 0 && (
                <TR className="hover:bg-transparent">
                  <TD colSpan={3} className="py-6 text-center text-muted-foreground">No copies yet.</TD>
                </TR>
              )}
              {copies.map((c) => (
                <TR key={c.id}>
                  <TD className="font-mono text-xs">{c.barcode ?? '—'}</TD>
                  <TD><Badge variant={c.condition === 'good' ? 'success' : c.condition === 'damaged' ? 'destructive' : 'warning'}>{c.condition}</Badge></TD>
                  <TD><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {canWrite && (
          addOpen ? (
            <form onSubmit={addCopy} className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">Add Copy</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Barcode (optional)"><Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type" /></Field>
                <Field label="Condition">
                  <Select value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="damaged">Damaged</option>
                  </Select>
                </Field>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Add Copy
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Copy
            </Button>
          )
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}

// ─── Issue Book tab ───────────────────────────────────────────────────────────

function IssueTab() {
  const { can } = useAuth();
  const canWrite = can('library:write');

  const [bookId, setBookId] = useState('');
  const [borrowerId, setBorrowerId] = useState('');
  const [borrowerType, setBorrowerType] = useState<'student' | 'staff'>('student');
  const [dueDays, setDueDays] = useState('14');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ bookTitle: string; dueDate: string } | null>(null);

  const { rows, meta, loading: listLoading, page, setPage, refetch } = useApiList<BookIssue>({
    path: '/library/issues',
    params: { status: 'issued' },
  });

  const [returnTarget, setReturnTarget] = useState<BookIssue | null>(null);

  async function submitIssue(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await api.post<BookIssue>('/library/issues', {
        bookId: bookId || undefined,
        borrowerId, borrowerType,
        dueDays: Number(dueDays),
      });
      setSuccess({ bookTitle: res.data.bookTitle, dueDate: res.data.dueDate });
      setBookId(''); setBorrowerId('');
      refetch();
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not issue book.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {canWrite && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={submitIssue} className="space-y-4">
              <p className="text-sm font-semibold text-foreground">Issue a Book</p>
              {error && <ErrorBox message={error} />}
              {success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Issued <strong>{success.bookTitle}</strong> — due {date(success.dueDate)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Book ID / ISBN">
                  <Input value={bookId} onChange={(e) => setBookId(e.target.value)} required placeholder="Book UUID or ISBN" />
                </Field>
                <Field label="Borrower ID">
                  <Input value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} required placeholder="Student/Staff UUID" />
                </Field>
                <Field label="Borrower Type">
                  <Select value={borrowerType} onChange={(e) => setBorrowerType(e.target.value as 'student' | 'staff')}>
                    <option value="student">Student</option>
                    <option value="staff">Staff</option>
                  </Select>
                </Field>
                <Field label="Due Days">
                  <Input type="number" min="1" value={dueDays} onChange={(e) => setDueDays(e.target.value)} />
                </Field>
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Issue Book
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Currently Issued</p>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Book</TH>
              <TH>Borrower</TH>
              <TH>Issued</TH>
              <TH>Due</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {listLoading && (
              <TR className="hover:bg-transparent">
                <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TD>
              </TR>
            )}
            {!listLoading && rows.length === 0 && (
              <TR className="hover:bg-transparent">
                <TD colSpan={6} className="py-8 text-center text-muted-foreground">No books currently issued.</TD>
              </TR>
            )}
            {!listLoading && rows.map((issue) => (
              <TR key={issue.id}>
                <TD className="font-medium text-foreground">{issue.bookTitle}</TD>
                <TD>{issue.borrowerName}</TD>
                <TD>{date(issue.issuedAt)}</TD>
                <TD>{date(issue.dueDate)}</TD>
                <TD><Badge variant={statusVariant(issue.status)}>{issue.status}</Badge></TD>
                <TD className="text-right">
                  <RowMenu items={[
                    { label: 'Return', onClick: () => setReturnTarget(issue), hidden: !canWrite },
                  ]} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Pagination meta={meta} page={page} onPage={setPage} noun="issues" />
      </div>

      {returnTarget && (
        <ReturnDialog issue={returnTarget} onClose={() => setReturnTarget(null)} onDone={() => { setReturnTarget(null); refetch(); }} />
      )}
    </div>
  );
}

function ReturnDialog({ issue, onClose, onDone }: { issue: BookIssue; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookIssue | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await api.patch<BookIssue>(`/library/issues/${issue.id}/return`, { notes: notes || undefined });
      setResult(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? `Error ${err.status}` : 'Could not return book.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <form onSubmit={submit}>
        <DialogHeader title="Return Book" description={issue.bookTitle} onClose={onClose} />
        <DialogBody className="space-y-4">
          {error && <ErrorBox message={error} />}
          {result ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 space-y-1">
              <p>Book returned successfully.</p>
              {result.fineAmount > 0 && (
                <p>Fine charged: <strong>{money(result.fineAmount)}</strong></p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Return <strong>{issue.bookTitle}</strong> borrowed by <strong>{issue.borrowerName}</strong>?</p>
              <Field label="Notes (optional)">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any remarks…" />
              </Field>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {result ? (
            <Button onClick={onDone}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Return
              </Button>
            </>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// ─── Overdue tab ──────────────────────────────────────────────────────────────

function OverdueTab() {
  const [rows, setRows] = useState<BookIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    api.get<BookIssue[]>('/library/overdue')
      .then((r) => setRows(r.data ?? []))
      .catch(() => setError('Could not load overdue books.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RotateCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Book</TH>
            <TH>Borrower</TH>
            <TH>Due Date</TH>
            <TH>Days Overdue</TH>
            <TH>Estimated Fine</TH>
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={5} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={5} className="py-8 text-center text-muted-foreground">No overdue books. Great!</TD>
            </TR>
          )}
          {!loading && rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium text-foreground">{r.bookTitle}</TD>
              <TD>{r.borrowerName}</TD>
              <TD>{date(r.dueDate)}</TD>
              <TD>
                <Badge variant="destructive">{r.daysOverdue} days</Badge>
              </TD>
              <TD className="font-mono text-red-600">{money(r.fineAmount)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

// ─── Catalog tab ──────────────────────────────────────────────────────────────

function CatalogTab() {
  const [status, setStatus] = useState('');
  const [borrowerId, setBorrowerId] = useState('');

  const { rows, meta, loading, error, page, setPage } = useApiList<BookIssue>({
    path: '/library/issues',
    params: { status: status || undefined, borrowerId: borrowerId || undefined },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} placeholder="Borrower ID…" className="pl-9 w-48" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          <option value="issued">Issued</option>
          <option value="returned">Returned</option>
          <option value="overdue">Overdue</option>
          <option value="lost">Lost</option>
        </Select>
      </div>

      {error && <ErrorBox message={error} />}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Book</TH>
            <TH>Copy Barcode</TH>
            <TH>Borrower</TH>
            <TH>Type</TH>
            <TH>Issued</TH>
            <TH>Due</TH>
            <TH>Returned</TH>
            <TH>Fine</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR className="hover:bg-transparent">
              <TD colSpan={9} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={9} className="py-8 text-center text-muted-foreground">No issue records found.</TD>
            </TR>
          )}
          {!loading && rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium text-foreground">{r.bookTitle}</TD>
              <TD className="font-mono text-xs">{r.copyBarcode ?? '—'}</TD>
              <TD>{r.borrowerName}</TD>
              <TD><Badge>{r.borrowerType}</Badge></TD>
              <TD>{date(r.issuedAt)}</TD>
              <TD>{date(r.dueDate)}</TD>
              <TD>{date(r.returnedAt)}</TD>
              <TD className="font-mono">{money(r.fineAmount)}</TD>
              <TD><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} noun="records" />
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

function ConfirmDeleteDialog({ open, title, message, onClose, onConfirm }: {
  open: boolean; title: string; message: string;
  onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true); setError(null);
    try { await onConfirm(); } catch { setError('Operation failed.'); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={title} onClose={onClose} />
      <DialogBody>
        {error && <ErrorBox message={error} />}
        <p className="text-sm text-muted-foreground">{message}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" onClick={go} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Delete
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
