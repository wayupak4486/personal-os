export const PAYMENT_CATEGORIES = [
  "rent",
  "electricity",
  "water",
  "internet",
  "other",
] as const;

export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];
export type PaymentStatus = "unpaid" | "partial" | "paid";

export type PaymentRecord = {
  id?: string;
  user_id?: string;
  billing_month?: string | null;
  category?: string | null;
  amount?: number | string | null;
  paid_amount?: number | string | null;
  status?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type PaymentItem = {
  id: string;
  billingMonth: string | null;
  category: PaymentCategory;
  amount: number | null;
  paidAmount: number;
  status: PaymentStatus;
  dueDate: string | null;
  paidAt: string | null;
  note: string;
};

export type PaymentSummary = {
  subtotal: number;
  carryOver: number;
  totalDue: number;
  paidAmount: number;
  remaining: number;
  status: PaymentStatus;
};

export const categoryLabels: Record<PaymentCategory, string> = {
  rent: "ค่าเช่า",
  electricity: "ค่าไฟ",
  water: "ค่าน้ำ",
  internet: "Internet",
  other: "อื่น ๆ",
};

export function toMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const numberValue =
    typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue)
    ? Math.max(0, numberValue)
    : null;
}

export function formatBaht(value: number | null): string {
  if (value === null) return "ยังไม่ทราบ";

  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(value);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);

  const date = new Date(
    year,
    monthNumber - 1 + offset,
    1,
  );

  return monthKey(date);
}

export function billingMonthOf(
  record: PaymentRecord,
): string | null {
  return typeof record.billing_month === "string"
    ? record.billing_month.slice(0, 7)
    : null;
}

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(
    new Date(year, monthNumber - 1, 1),
  );
}

export function normalizeCategory(
  value: unknown,
): PaymentCategory {
  return PAYMENT_CATEGORIES.includes(
    value as PaymentCategory,
  )
    ? (value as PaymentCategory)
    : "other";
}

export function derivePaymentStatus(
  amount: number | null,
  paidAmount: number,
): PaymentStatus {
  if (amount !== null && paidAmount >= amount) {
    return "paid";
  }

  if (paidAmount > 0) {
    return "partial";
  }

  return "unpaid";
}

export function mapPaymentRecord(
  record: PaymentRecord,
): PaymentItem {
  const amount = toMoney(record.amount);
  const paidAmount = toMoney(record.paid_amount) ?? 0;

  return {
    id: String(record.id ?? ""),

    // เพิ่มตัวนี้เพื่อให้ PaymentsClient
    // สามารถใช้ item.billingMonth ได้
    billingMonth: billingMonthOf(record),

    category: normalizeCategory(record.category),

    amount,

    paidAmount,

    status: derivePaymentStatus(
      amount,
      paidAmount,
    ),

    dueDate:
      typeof record.due_date === "string"
        ? record.due_date
        : null,

    paidAt:
      typeof record.paid_at === "string"
        ? record.paid_at
        : null,

    note:
      typeof record.note === "string"
        ? record.note
        : "",
  };
}

export function calculatePaymentSummary(
  items: PaymentItem[],
  carryOver = 0,
): PaymentSummary {
  const knownAmounts = items.flatMap((item) =>
    item.amount === null
      ? []
      : [item.amount],
  );

  const subtotal = knownAmounts.reduce(
    (total, amount) => total + amount,
    0,
  );

  const paidAmount = items.reduce(
    (total, item) => total + item.paidAmount,
    0,
  );

  const totalDue =
    subtotal + Math.max(0, carryOver);

  return {
    subtotal,

    carryOver: Math.max(
      0,
      carryOver,
    ),

    totalDue,

    paidAmount,

    remaining: Math.max(
      0,
      totalDue - paidAmount,
    ),

    status: derivePaymentStatus(
      totalDue,
      paidAmount,
    ),
  };
}

export function getOverdueItems(
  records: PaymentRecord[],
  selectedMonth: string,
): PaymentItem[] {
  return records
    .filter((record) => {
      const month = billingMonthOf(record);

      return (
        month !== null &&
        month < selectedMonth &&
        mapPaymentRecord(record).status !== "paid"
      );
    })
    .map(mapPaymentRecord);
}

export function statusLabel(
  status: PaymentStatus,
): string {
  return status === "paid"
    ? "จ่ายแล้ว"
    : status === "partial"
      ? "จ่ายบางส่วน"
      : "ยังไม่จ่าย";
}