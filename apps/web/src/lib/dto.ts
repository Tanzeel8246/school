/**
 * Shared DTO interfaces for the Students / Teachers / Staff modules.
 * Mirrors the /api/v1 contract (camelCase; money fields in integer minor units).
 */

export type Gender = 'male' | 'female' | 'other';

// ---------------------------------------------------------------- Students
export interface Student {
  id: string;
  userId?: string | null;
  admissionNo: string;
  rollNo: string | null;
  fullName: string;
  fatherName: string;
  motherName: string;
  cnicBform: string;
  dob: string;
  gender: Gender | string;
  bloodGroup: string;
  religion: string;
  address: string;
  mobile: string;
  emergencyContact: string;
  previousSchool: string;
  admissionDate: string;
  sectionId: string;
  sectionName?: string;
  className?: string;
  status: string;
  photoUrl: string;
}

/** Editable payload for create/update (id is server-assigned). */
export type StudentInput = Omit<Student, 'id'>;

export interface StudentHistory {
  id: string;
  eventType: string;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------- Teachers
export interface Subject {
  id: string;
  name: string;
  code: string;
}

export interface Teacher {
  id: string;
  userId?: string | null;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  cnic: string;
  gender: Gender | string;
  qualification: string;
  experienceYears: number;
  designation: string;
  baseSalary: number; // minor units
  joiningDate: string;
  status: string;
  subjects?: Subject[];
}

export type TeacherInput = Omit<Teacher, 'id' | 'subjects'>;

// ---------------------------------------------------------------- Staff
export type StaffType = 'admin' | 'accountant' | 'clerk' | 'support' | 'driver' | string;

export interface Staff {
  id: string;
  userId?: string | null;
  employeeId: string;
  staffType: StaffType;
  fullName: string;
  email: string;
  phone: string;
  cnic: string;
  gender: Gender | string;
  address: string;
  qualification: string;
  experienceYears: number;
  designation: string;
  baseSalary: number; // minor units
  joiningDate: string;
  leavingDate: string | null;
  status: string;
  subjectIds?: string[];
  inchargeSectionId?: string | null;
}

export type StaffInput = Omit<Staff, 'id'>;

export interface StaffAttendance {
  id: string;
  date: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
}

export interface Leave {
  id: string;
  staffId: string;
  staffName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface Payslip {
  id: string;
  staffId: string;
  staffName: string;
  periodMonth: string;
  baseSalary: number; // minor units
  allowances: number; // minor units
  deductions: number; // minor units
  netSalary: number; // minor units
  status: string;
}

// ---------------------------------------------------------------- Finance — Fees

export interface FeeHead {
  id: string;
  schoolId: string;
  name: string;
  amount: number; // minor units
  isRecurring: boolean;
  applicableTo: string; // 'all' | 'class' | 'section'
  displayOrder: number;
}

export interface InvoiceLine {
  feeHeadId: string;
  feeHeadName: string;
  amount: number; // minor units
}

export interface InvoicePayment {
  id: string;
  amount: number; // minor units
  method: string; // 'cash' | 'bank' | 'online'
  referenceNo: string | null;
  paidAt: string;
}

export interface Invoice {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  challanNo: string;
  billingMonth: string;
  lines: InvoiceLine[];
  subtotal: number; // minor units
  discount: number; // minor units
  fine: number; // minor units
  total: number; // minor units
  paid: number; // minor units
  outstanding: number; // minor units
  dueDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
  payments?: InvoicePayment[];
}

export interface Discount {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  appliedMonth: string | null;
  reason: string | null;
  createdAt: string;
}

export interface DefaulterRow {
  studentId: string;
  studentName: string;
  admissionNo: string;
  totalOutstanding: number; // minor units
  invoiceCount: number;
}

export interface CollectionRow {
  period: string;
  totalCollected: number; // minor units
  paymentCount: number;
}

// ---------------------------------------------------------------- Finance — Accounting

export interface Account {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parentId: string | null;
  balance: number; // minor units
  isSystem: boolean;
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountName: string;
  debit: number; // minor units
  credit: number; // minor units
  description: string | null;
}

export interface JournalEntry {
  id: string;
  schoolId: string;
  refNo: string;
  description: string;
  entryDate: string;
  status: string;
  createdBy: string;
  createdAt: string;
  lines?: JournalLine[];
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  totalDebit: number; // minor units
  totalCredit: number; // minor units
}

export interface PLReport {
  revenue: { accountId: string; name: string; amount: number }[];
  totalRevenue: number;
  expenses: { accountId: string; name: string; amount: number }[];
  totalExpenses: number;
  netIncome: number;
}

export interface BalanceSheet {
  assets: { accountId: string; name: string; balance: number }[];
  totalAssets: number;
  liabilities: { accountId: string; name: string; balance: number }[];
  totalLiabilities: number;
  equity: { accountId: string; name: string; balance: number }[];
  totalEquity: number;
}

// ---------------------------------------------------------------- Finance — Payroll

export interface SalaryComponent {
  id: string;
  name: string;
  componentType: 'allowance' | 'deduction';
  amount: number; // minor units
  isPercentage: boolean;
}

export interface SalaryStructure {
  id: string;
  schoolId: string;
  staffId: string;
  staffName: string;
  name: string;
  effectiveFrom: string;
  components: SalaryComponent[];
}

/** Full payslip DTO (extends the basic Payslip with finance-module fields). */
export interface FullPayslip {
  id: string;
  schoolId: string;
  staffId: string;
  staffName: string;
  periodMonth: string;
  baseSalary: number; // minor units
  allowances: number; // minor units
  deductions: number; // minor units
  bonus: number; // minor units
  netSalary: number; // minor units
  status: string;
  notes: string | null;
  components?: SalaryComponent[];
}

// ─── Phase 5: Examinations ───────────────────────────────────────────────────

export interface ExamSubjectConfig {
  id: string;
  subjectId: string;
  subjectName: string;
  totalMarks: number;
  passingMarks: number;
}

export interface Exam {
  id: string;
  schoolId: string;
  sessionId: string | null;
  classId: string | null;
  className: string | null;
  name: string;
  examType: 'monthly' | 'midterm' | 'final' | 'quarterly' | 'annual';
  startDate: string | null;
  endDate: string | null;
  isPublished: boolean;
  subjects: ExamSubjectConfig[];
  createdAt: string;
}

export interface MarksEntry {
  studentId: string;
  studentName: string;
  admissionNo: string;
  rollNo: string | null;
  marksObtained: number | null;
  isAbsent: boolean;
  grade: string | null;
}

export interface MarksRoster {
  examId: string;
  subjectId: string;
  sectionId: string;
  entries: MarksEntry[];
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  marksObtained: number;
  totalMarks: number;
  isAbsent: boolean;
  grade: string | null;
}

export interface StudentResult {
  studentId: string;
  studentName: string;
  admissionNo: string;
  rollNo: string | null;
  subjectResults: SubjectResult[];
  totalObtained: number;
  totalMarks: number;
  percentage: number;
  gpa: number;
  grade: string;
  position: number;
  isPassed: boolean;
}

export interface GradeConfig {
  gradeLetter: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number;
  displayOrder: number;
}

export interface ClassAnalysis {
  examId: string;
  examName: string;
  totalStudents: number;
  appeared: number;
  passed: number;
  failed: number;
  passPercent: number;
  classAverage: number;
  gradeDistribution: { grade: string; count: number }[];
  topStudents: {
    studentId: string;
    studentName: string;
    percentage: number;
    grade: string;
    position: number;
  }[];
}

export interface SubjectAnalysis {
  subjectId: string;
  subjectName: string;
  totalMarks: number;
  studentCount: number;
  appeared: number;
  passed: number;
  failed: number;
  highest: number;
  lowest: number;
  average: number;
  passPercent: number;
  gradeDistribution: { grade: string; count: number }[];
}

// ─── Phase 6: Operational Modules ───────────────

// Library
export interface BookCategory { id: string; schoolId: string; name: string; description: string | null; createdAt: string }
export interface Book { id: string; schoolId: string; categoryId: string | null; categoryName: string | null; title: string; author: string | null; isbn: string | null; publisher: string | null; edition: string | null; totalCopies: number; availableCopies: number; finePerDay: number; coverUrl: string | null; createdAt: string }
export interface BookCopy { id: string; schoolId: string; bookId: string; bookTitle: string; barcode: string | null; condition: 'good' | 'fair' | 'poor' | 'damaged'; status: 'available' | 'issued' | 'lost' | 'damaged'; createdAt: string }
export interface BookIssue { id: string; schoolId: string; bookCopyId: string; bookId: string; bookTitle: string; copyBarcode: string | null; borrowerId: string; borrowerName: string; borrowerType: 'student' | 'staff'; issuedAt: string; dueDate: string; returnedAt: string | null; daysOverdue: number; fineAmount: number; finePaid: boolean; status: 'issued' | 'returned' | 'overdue' | 'lost'; notes: string | null }

// Transport
export interface Vehicle { id: string; schoolId: string; regNo: string; vehicleType: 'bus' | 'van' | 'car' | 'minibus'; make: string | null; model: string | null; capacity: number; driverId: string | null; driverName: string | null; isActive: boolean; createdAt: string }
export interface RouteStop { id: string; routeId: string; name: string; stopOrder: number; pickupTime: string | null; dropTime: string | null }
export interface TransportRoute { id: string; schoolId: string; name: string; description: string | null; vehicleId: string | null; vehicleRegNo: string | null; monthlyFee: number; isActive: boolean; stopCount: number; studentCount: number; createdAt: string }
export interface StudentTransport { id: string; schoolId: string; studentId: string; studentName: string; admissionNo: string; routeId: string; routeName: string; stopId: string | null; stopName: string | null; monthlyFee: number; validFrom: string; validTo: string | null; isActive: boolean }

// Hostel
export interface Hostel { id: string; schoolId: string; name: string; hostelType: 'boys' | 'girls' | 'mixed'; address: string | null; wardenId: string | null; wardenName: string | null; totalCapacity: number; occupiedCount: number; createdAt: string }
export interface HostelRoom { id: string; schoolId: string; hostelId: string; hostelName: string; roomNo: string; roomType: 'single' | 'double' | 'triple' | 'dormitory'; floor: number; capacity: number; occupied: number; monthlyFee: number; isActive: boolean; createdAt: string }
export interface HostelAllocation { id: string; schoolId: string; studentId: string; studentName: string; admissionNo: string; hostelId: string; hostelName: string; roomId: string; roomNo: string; bedNo: string | null; allocatedFrom: string; allocatedTo: string | null; monthlyFee: number; status: 'active' | 'vacated' | 'expired'; notes: string | null; createdAt: string }
export interface MessMenu { hostelId: string; dayOfWeek: number; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; menuItems: string; updatedAt: string }

// Inventory
export interface InventoryCategory { id: string; schoolId: string; name: string; description: string | null; createdAt: string }
export interface Vendor { id: string; schoolId: string; name: string; contactPerson: string | null; phone: string | null; email: string | null; address: string | null; createdAt: string }
export interface InventoryItem { id: string; schoolId: string; categoryId: string | null; categoryName: string | null; name: string; sku: string | null; unit: string; quantityInStock: number; reorderLevel: number; unitCost: number; location: string | null; isLowStock: boolean; createdAt: string }
export interface PoLine { id: string; itemId: string; itemName: string; quantity: number; unitCost: number; total: number }
export interface PurchaseOrder { id: string; schoolId: string; vendorId: string; vendorName: string; poNo: string; orderDate: string; expectedDelivery: string | null; status: 'draft' | 'ordered' | 'received' | 'cancelled'; notes: string | null; totalAmount: number; lineCount: number; createdAt: string; lines?: PoLine[] }
export interface StockTransaction { id: string; schoolId: string; itemId: string; itemName: string; txnType: 'in' | 'out' | 'adjustment'; quantity: number; referenceType: string | null; notes: string | null; txnAt: string }

// ─── Phase 7: Communications ───────────────────

export type CommChannel = 'sms' | 'whatsapp' | 'email';
export type EventType = 'attendance_absent' | 'fee_due' | 'result_published' | 'announcement' | 'custom';
export type TargetType = 'all_students' | 'all_parents' | 'all_staff' | 'class' | 'section' | 'all_users';
export type AnnouncementStatus = 'pending' | 'sending' | 'sent' | 'failed';
export type MessageStatus = 'pending' | 'sent' | 'failed' | 'bounced';

export interface MessageTemplate {
  id: string;
  schoolId: string;
  name: string;
  eventType: EventType | string;
  channel: CommChannel;
  subject: string | null;
  body: string;
  isDefault: boolean;
  createdAt: string;
}

export interface NotificationSetting {
  eventType: EventType | string;
  channel: CommChannel;
  isEnabled: boolean;
}

export interface Announcement {
  id: string;
  schoolId: string;
  title: string;
  message: string;
  channels: CommChannel[];
  targetType: TargetType;
  targetId: string | null;
  status: AnnouncementStatus;
  sentCount: number;
  failedCount: number;
  createdBy: string | null;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
}

export interface MessageLog {
  id: string;
  schoolId: string;
  announcementId: string | null;
  channel: CommChannel;
  eventType: EventType | string;
  recipientId: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  subject: string | null;
  body: string;
  status: MessageStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

// ─── Phase 8: Reports ────────────────────────────────────────────────────────

export interface StudentReportRow {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  fullName: string;
  fatherName: string;
  gender: string;
  dob: string;
  mobile: string;
  status: string;
  admissionDate: string;
  sectionName: string;
  className: string;
}

export interface StudentReportSummary {
  total: number;
  active: number;
  suspended: number;
  transferred: number;
  left: number;
  alumni: number;
}

export interface AttendanceReportRow {
  id: string;
  fullName: string;
  admissionNo: string;
  sectionName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  leaveDays: number;
  totalMarked: number;
  attendancePct: number;
}

export interface AttendanceReportSummary {
  totalStudents: number;
  avgAttendancePct: number;
  totalPresent: number;
  totalAbsent: number;
}

export interface FeeReportRow {
  id: string;
  challanNo: string;
  billingMonth: string;
  total: number; // minor units
  paid: number; // minor units
  outstanding: number; // minor units
  dueDate: string;
  status: string;
  studentName: string;
  admissionNo: string;
}

export interface FeeReportSummary {
  totalInvoices: number;
  totalCharged: number; // minor units
  totalCollected: number; // minor units
  totalOutstanding: number; // minor units
  defaultersCount: number;
}

export interface PayrollReportRow {
  id: string;
  periodMonth: string;
  baseSalary: number; // minor units
  allowances: number; // minor units
  deductions: number; // minor units
  netSalary: number; // minor units
  status: string;
  staffName: string;
  employeeId: string;
  staffType: string;
  designation: string;
}

export interface PayrollReportSummary {
  totalStaff: number;
  totalNetSalary: number; // minor units
  totalAllowances: number; // minor units
  totalDeductions: number; // minor units
}

export interface AccountingRow {
  month: string;
  feeIncome: number; // minor units
  payrollExpense: number; // minor units
  net: number; // minor units
}

export interface AccountingSummary {
  totalIncome: number; // minor units
  totalExpense: number; // minor units
  netBalance: number; // minor units
}

// ─── Phase 9: Parent Portal DTOs ────────────────────────────────────────────

export interface ChildSummary {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  fullName: string;
  gender: string | null;
  dob: string | null;
  sectionName: string | null;
  className: string | null;
  status: string;
}

export interface ChildAttendanceRow {
  date: string;
  status: string;
  sectionName: string | null;
}

export interface ChildAttendanceSummary {
  totalMarked: number;
  present: number;
  absent: number;
  late: number;
  attendancePct: number;
}

export interface ChildFeeRow {
  id: string;
  challanNo: string;
  billingMonth: string | null;
  total: number;
  paid: number;
  outstanding: number;
  dueDate: string;
  status: string;
}

export interface ChildFeeSummary {
  totalCharged: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface ChildResultRow {
  examId: string;
  examName: string;
  subjectName: string;
  totalMarks: number;
  obtainedMarks: number;
  grade: string | null;
  percentage: number;
}

export interface TimetableSlotRow {
  weekday: number;
  period: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName: string;
}

// ─── Attendance DTOs ──────────────────────────────────────────────────────────

export interface AttendanceRosterRow {
  studentId: string;
  admissionNo: string;
  rollNo: string | null;
  fullName: string;
  attendanceId: string | null;
  status: string | null;
}

export interface AttendanceDaySummary {
  date: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  unmarked: number;
}

// ─── Academic DTOs ────────────────────────────────────────────────────────────

export interface AcademicSession {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface AcademicClass {
  id: string;
  sessionId: string;
  name: string;
  level: number;
}

export interface AcademicSection {
  id: string;
  classId: string;
  name: string;
  capacity: number;
  teacherId: string | null;
  teacherName?: string | null;
}

export interface AcademicSubject {
  id: string;
  classId: string;
  name: string;
  code: string | null;
  isElective: boolean;
}

export interface AcademicTimetableSlot {
  id: string;
  sectionId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  weekday: number;
  period: number;
  startTime: string;
  endTime: string;
}

// ─── Accounting — Cash Book ───────────────────────────────────────────────────

export interface CashBookLine {
  entryDate: string;
  refNo: string;
  description: string | null;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CashBook {
  from: string;
  to: string;
  accountId: string | null;
  openingBalance: number;
  lines: CashBookLine[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}
