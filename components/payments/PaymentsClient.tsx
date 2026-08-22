"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  serializeSupabaseError,
  supabaseDiagnosticContext,
} from "@/lib/supabase/diagnostics";
import {
  calculatePaymentSummary,
  categoryLabels,
  formatBaht,
  mapPaymentRecord,
  monthKey,
  monthLabel,
  PAYMENT_CATEGORIES,
  shiftMonth,
  getOverdueItems,
  statusLabel,
  type PaymentCategory,
  type PaymentItem,
  type PaymentRecord,
} from "@/lib/payments";

type Props = {
  initialRecords: PaymentRecord[];
  initialError: string | null;
};

type FormState = {
  category: PaymentCategory;
  amount: string;
  date: string;
  note: string;
};

type PaymentForm = {
  amount: string;
  date: string;
  note: string;
};

const categoryIcons: Record<PaymentCategory, string> = {
  rent: "🏠",
  electricity: "⚡",
  water: "💧",
  internet: "🌐",
  other: "＋",
};

const emptyForm: FormState = {
  category: "rent",
  amount: "",
  date: "",
  note: "",
};

const statusClasses = {
  unpaid: "bg-slate-100 text-slate-600",
  partial: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
};

export default function PaymentsClient({
  initialRecords,
  initialError,
}: Props) {
  const [supabase] = useState(() => createClient());

  const [records, setRecords] =
    useState<PaymentRecord[]>(initialRecords);

  const [selectedMonth, setSelectedMonth] = useState(
    monthKey(new Date()),
  );

  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    date: `${monthKey(new Date())}-01`,
  });

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const [editing, setEditing] = useState<PaymentItem | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * รายการที่ผู้ใช้เลือกเพื่อชำระเงิน
   */
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>(
    [],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        logSupabaseError(
          "browser auth",
          authError ?? new Error("No authenticated user"),
        );

        throw new Error(
          "กรุณาเข้าสู่ระบบก่อนใช้งาน Payments",
        );
      }

      const diagnosticContext = supabaseDiagnosticContext(
        "SELECT",
        getSupabaseConfig().projectRef,
        user.id,
        user.email ?? null,
      );

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Payments browser query before ${diagnosticContext} table=payment_occurrences`,
        );
      }

      const result = await supabase
        .from("payment_occurrences")
        .select("*")
        .eq("user_id", user.id)
        .order("billing_month", { ascending: false })
        .order("created_at", { ascending: false });

      if (result.error) {
        logSupabaseError("load payments", result.error);
        throw result.error;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Payments browser query after ${diagnosticContext} count=${
            result.data?.length ?? 0
          } error=${serializeSupabaseError(null)}`,
        );
      }

      setRecords((result.data ?? []) as PaymentRecord[]);
    } catch (caught) {
      logSupabaseError("load payments", caught);

      setError(
        "ไม่สามารถโหลดข้อมูลค่าใช้จ่ายได้ กรุณาลองอีกครั้ง",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadRecords]);

  const allItems = useMemo(
    () => records.map(mapPaymentRecord),
    [records],
  );

  const currentRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          record.billing_month?.slice(0, 7) === selectedMonth,
      ),
    [records, selectedMonth],
  );

  const currentItems = useMemo(
    () => currentRecords.map(mapPaymentRecord),
    [currentRecords],
  );

  const overdueItems = useMemo(
    () => getOverdueItems(records, selectedMonth),
    [records, selectedMonth],
  );

  const carryOver = calculatePaymentSummary(
    overdueItems,
  ).remaining;

  const summary = calculatePaymentSummary(
    currentItems,
    carryOver,
  );

  /**
   * รายการทั้งหมดที่สามารถเลือกจ่ายได้
   *
   * รวม:
   * - ยอดค้างจากเดือนก่อน
   * - รายการของเดือนปัจจุบัน
   *
   * และเอารายการที่จ่ายครบแล้วออก
   */
  const payableItems = useMemo(() => {
    const merged = [...overdueItems, ...currentItems];

    return merged.filter((item) => {
      const remaining = Math.max(
        0,
        (item.amount ?? 0) - item.paidAmount,
      );

      return remaining > 0;
    });
  }, [overdueItems, currentItems]);

  /**
   * รายการที่ผู้ใช้เลือก
   */
  const selectedPaymentItems = useMemo(() => {
    return payableItems.filter((item) =>
      selectedPaymentIds.includes(item.id),
    );
  }, [payableItems, selectedPaymentIds]);

  /**
   * ยอดเต็มของรายการที่เลือก
   */
  const selectedPaymentTotal = useMemo(() => {
    return selectedPaymentItems.reduce((total, item) => {
      const remaining = Math.max(
        0,
        (item.amount ?? 0) - item.paidAmount,
      );

      return total + remaining;
    }, 0);
  }, [selectedPaymentItems]);

  function openAdd() {
    setEditing(null);

    setForm({
      ...emptyForm,
      date: `${selectedMonth}-01`,
    });

    setShowAdd(true);
    setError(null);
    setSuccess(null);
  }

  /**
   * เปิดหน้าจอเลือกว่าจะจ่ายรายการไหน
   */
  function openPayment() {
    if (payableItems.length === 0) {
      setError(
        "ไม่มีรายการที่ค้างชำระสำหรับบันทึกการจ่ายเงิน",
      );
      return;
    }

    setSelectedPaymentIds([]);

    setPaymentForm({
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
    });

    setShowPayment(true);
    setError(null);
    setSuccess(null);
  }

  /**
   * เลือก / ยกเลิกรายการ
   */
  function togglePaymentSelection(item: PaymentItem) {
    const alreadySelected = selectedPaymentIds.includes(item.id);

    const nextIds = alreadySelected
      ? selectedPaymentIds.filter((id) => id !== item.id)
      : [...selectedPaymentIds, item.id];

    setSelectedPaymentIds(nextIds);

    const nextItems = payableItems.filter((paymentItem) =>
      nextIds.includes(paymentItem.id),
    );

    const nextTotal = nextItems.reduce((total, paymentItem) => {
      const remaining = Math.max(
        0,
        (paymentItem.amount ?? 0) - paymentItem.paidAmount,
      );

      return total + remaining;
    }, 0);

    /**
     * เมื่อเลือก / ยกเลิก ให้ยอดกลับไปเป็นยอดเต็ม
     * ของรายการที่เลือก
     */
    setPaymentForm((current) => ({
      ...current,
      amount: nextTotal > 0 ? String(nextTotal) : "",
    }));
  }

  /**
   * เลือกทั้งหมด
   */
  function selectAllPayments() {
    const ids = payableItems.map((item) => item.id);

    setSelectedPaymentIds(ids);

    setPaymentForm((current) => ({
      ...current,
      amount:
        payableItems.length > 0
          ? String(
              payableItems.reduce((total, item) => {
                const remaining = Math.max(
                  0,
                  (item.amount ?? 0) - item.paidAmount,
                );

                return total + remaining;
              }, 0),
            )
          : "",
    }));
  }

  /**
   * ยกเลิกการเลือกทั้งหมด
   */
  function clearPaymentSelection() {
    setSelectedPaymentIds([]);

    setPaymentForm((current) => ({
      ...current,
      amount: "",
    }));
  }

  async function saveExpense(event: React.FormEvent) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      !isIsoDate(form.date) ||
      !PAYMENT_CATEGORIES.includes(form.category)
    ) {
      setError(
        "กรุณาตรวจสอบประเภท จำนวนเงิน และวันที่",
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("auth");
      }

      const existing = currentRecords.find(
        (record) =>
          record.id === editing?.id ||
          record.category === form.category,
      );

      const paidAmount = editing?.paidAmount ?? 0;

      const payload = {
        user_id: user.id,
        billing_month: `${selectedMonth}-01`,
        category: form.category,
        amount,
        paid_amount: paidAmount,
        status:
          amount > 0 && paidAmount >= amount
            ? "paid"
            : paidAmount > 0
              ? "partial"
              : "unpaid",
        due_date: form.date,
        paid_at: editing?.paidAt ?? null,
        note: form.note.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const operation = existing?.id
        ? "UPDATE"
        : "INSERT";

      const diagnosticContext =
        supabaseDiagnosticContext(
          operation,
          getSupabaseConfig().projectRef,
          user.id,
          user.email ?? null,
        );

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Payments browser mutation before ${diagnosticContext} table=payment_occurrences recordId=${
            existing?.id ?? "new"
          } payload=${JSON.stringify({
            user_id: user.id,
            category: form.category,
            amount,
            billing_month: `${selectedMonth}-01`,
            due_date: form.date,
          })}`,
        );
      }

      const request = existing?.id
        ? supabase
            .from("payment_occurrences")
            .update(payload)
            .eq("id", existing.id)
            .eq("user_id", user.id)
        : supabase
            .from("payment_occurrences")
            .insert(payload);

      const { error: mutationError } = await request;

      if (mutationError) {
        logSupabaseError(
          "save expense",
          mutationError,
        );

        throw mutationError;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Payments browser mutation after ${diagnosticContext} recordId=${
            existing?.id ?? "new"
          } error=${serializeSupabaseError(null)}`,
        );
      }

      setShowAdd(false);
      setEditing(null);

      setSuccess("บันทึกค่าใช้จ่ายแล้ว");

      await loadRecords();
    } catch (caught) {
      logSupabaseError("save expense", caught);

      setError(
        "ไม่สามารถบันทึกค่าใช้จ่ายได้ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSaving(false);
    }
  }

  /**
   * บันทึกการจ่ายเงินเฉพาะรายการที่เลือก
   *
   * ตัวอย่าง:
   * Internet = 260
   * ค่าเช่า = 4,500
   *
   * ถ้าเลือกเฉพาะ Internet
   * จะอัปเดตเฉพาะ Internet
   */
  async function savePayment(event: React.FormEvent) {
    event.preventDefault();

    if (selectedPaymentIds.length === 0) {
      setError("กรุณาเลือกรายการที่ต้องการจ่ายก่อน");
      return;
    }

    const payment = Number(paymentForm.amount);

    if (
      !Number.isFinite(payment) ||
      payment <= 0 ||
      !isIsoDate(paymentForm.date)
    ) {
      setError(
        "กรุณาระบุจำนวนเงินที่จ่ายและวันที่ให้ถูกต้อง",
      );
      return;
    }

    if (selectedPaymentItems.length === 0) {
      setError(
        "รายการที่เลือกไม่มีจำนวนเงินค้างชำระแล้ว",
      );
      return;
    }

    if (payment > selectedPaymentTotal) {
      setError(
        `จำนวนเงินที่จ่ายเกินยอดรายการที่เลือก (${formatBaht(
          selectedPaymentTotal,
        )})`,
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("auth");
      }

      let remainingPayment = payment;

      /**
       * ใช้เฉพาะรายการที่ผู้ใช้เลือกเท่านั้น
       *
       * เรียงตาม:
       * 1. รายการค้างก่อน
       * 2. รายการเดือนปัจจุบัน
       */
      const selectedItems = selectedPaymentItems;

      for (const item of selectedItems) {
        if (remainingPayment <= 0) {
          break;
        }

        const unpaid = Math.max(
          0,
          (item.amount ?? 0) - item.paidAmount,
        );

        const applied = Math.min(
          unpaid,
          remainingPayment,
        );

        if (applied <= 0) {
          continue;
        }

        const paidAmount =
          item.paidAmount + applied;

        const newStatus =
          paidAmount >= (item.amount ?? 0)
            ? "paid"
            : "partial";

        const diagnosticContext =
          supabaseDiagnosticContext(
            "UPDATE",
            getSupabaseConfig().projectRef,
            user.id,
            user.email ?? null,
          );

        if (process.env.NODE_ENV !== "production") {
          console.log(
            `Payments browser mutation before ${diagnosticContext} table=payment_occurrences recordId=${item.id} userId=${user.id} applied=${applied}`,
          );
        }

        const updatePayload: Record<string, unknown> = {
          paid_amount: paidAmount,
          status: newStatus,
          paid_at: paymentForm.date,
          updated_at: new Date().toISOString(),
        };

        if (paymentForm.note.trim()) {
          updatePayload.note =
            paymentForm.note.trim();
        }

        const { error: updateError } =
          await supabase
            .from("payment_occurrences")
            .update(updatePayload)
            .eq("id", item.id)
            .eq("user_id", user.id);

        if (updateError) {
          logSupabaseError(
            "save payment",
            updateError,
          );

          throw updateError;
        }

        if (process.env.NODE_ENV !== "production") {
          console.log(
            `Payments browser mutation after ${diagnosticContext} recordId=${item.id} applied=${applied} error=${serializeSupabaseError(null)}`,
          );
        }

        remainingPayment -= applied;
      }

      /**
       * ปิด modal และ reset selection
       */
      setShowPayment(false);

      setSelectedPaymentIds([]);

      setPaymentForm({
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        note: "",
      });

      setSuccess("บันทึกการจ่ายเงินแล้ว");

      await loadRecords();
    } catch (caught) {
      logSupabaseError("save payment", caught);

      setError(
        "ไม่สามารถบันทึกการจ่ายเงินได้ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {overdueItems.length > 0 && (
          <OverduePanel
            items={overdueItems}
            total={carryOver}
          />
        )}

        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                Personal OS
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Payments
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                จัดการค่าใช้จ่ายหอพัก
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            กลับหน้า Today
          </Link>
        </header>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <Check size={16} />
            {success}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() =>
              setSelectedMonth(
                shiftMonth(selectedMonth, -1),
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="เดือนก่อน"
          >
            <ArrowLeft size={17} />
          </button>

          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              รอบบิล
            </p>

            <p className="mt-1 text-lg font-bold">
              {monthLabel(selectedMonth)}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setSelectedMonth(
                shiftMonth(selectedMonth, 1),
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="เดือนถัดไป"
          >
            <ArrowRight size={17} />
          </button>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryTile
            label="ยอดที่ต้องจ่าย"
            value={formatBaht(summary.totalDue)}
            icon={<Receipt size={18} />}
          />

          <SummaryTile
            label="จ่ายแล้ว"
            value={formatBaht(summary.paidAmount)}
            icon={<Wallet size={18} />}
          />

          <SummaryTile
            label="คงเหลือ"
            value={formatBaht(summary.remaining)}
            icon={<CreditCard size={18} />}
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Monthly expenses
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  ค่าใช้จ่ายเดือนนี้
                </h2>
              </div>

              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Plus size={15} />
                เพิ่มรายการ
              </button>
            </div>

            {loading ? (
              <LoadingState />
            ) : currentItems.length === 0 ? (
              <EmptyState onAdd={openAdd} />
            ) : (
              <div className="mt-5 space-y-3">
                {currentItems.map((item) => (
                  <ExpenseRow
                    key={item.id}
                    item={item}
                    onEdit={() => {
                      setEditing(item);

                      setForm({
                        category: item.category,
                        amount:
                          item.amount?.toString() ?? "",
                        date:
                          item.dueDate ??
                          `${selectedMonth}-01`,
                        note: item.note,
                      });

                      setShowAdd(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Calculation
            </p>

            <h2 className="mt-1 text-lg font-semibold">
              สรุปยอด
            </h2>

            <div className="mt-5 space-y-3 text-sm">
              {currentItems.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-3"
                >
                  <span className="text-slate-500">
                    {categoryLabels[item.category]}
                  </span>

                  <span className="font-medium">
                    {formatBaht(item.amount)}
                  </span>
                </div>
              ))}

              <div className="flex justify-between border-t border-slate-100 pt-3">
                <span>รวมเดือนนี้</span>

                <strong>
                  {formatBaht(summary.subtotal)}
                </strong>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">
                  ยอดค้างเดิม
                </span>

                <span>
                  {formatBaht(summary.carryOver)}
                </span>
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
                <strong>ยอดที่ต้องจ่าย</strong>

                <strong>
                  {formatBaht(summary.totalDue)}
                </strong>
              </div>
            </div>

            <div
              className={`mt-5 rounded-2xl px-4 py-3 text-sm font-medium ${statusClasses[summary.status]}`}
            >
              สถานะ: {statusLabel(summary.status)}
            </div>

            <button
              type="button"
              onClick={openPayment}
              disabled={
                saving ||
                payableItems.length === 0 ||
                summary.remaining <= 0
              }
              className="mt-4 w-full rounded-2xl bg-[#2452c5] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#1d45ac] disabled:cursor-not-allowed disabled:opacity-50"
            >
              บันทึกการจ่ายเงิน
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            History
          </p>

          <h2 className="mt-1 text-lg font-semibold">
            ประวัติย้อนหลัง
          </h2>

          <div className="mt-4 divide-y divide-slate-100">
            {Array.from(
              new Set(
                records
                  .map((record) =>
                    record.billing_month?.slice(0, 7),
                  )
                  .filter(
                    (month): month is string =>
                      Boolean(month),
                  ),
              ),
            )
              .sort()
              .reverse()
              .slice(0, 12)
              .map((month) => {
                const items = records
                  .filter(
                    (record) =>
                      record.billing_month?.slice(
                        0,
                        7,
                      ) === month,
                  )
                  .map(mapPaymentRecord);

                const itemSummary =
                  calculatePaymentSummary(
                    items,
                    calculatePaymentSummary(
                      records
                        .filter(
                          (record) =>
                            record.billing_month?.slice(
                              0,
                              7,
                            ) ===
                            shiftMonth(month, -1),
                        )
                        .map(mapPaymentRecord),
                    ).remaining,
                  );

                return (
                  <div
                    key={month}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">
                      {monthLabel(month)}
                    </span>

                    <span className="text-sm text-slate-500">
                      ยอดรวม{" "}
                      {formatBaht(itemSummary.totalDue)}
                      {" · "}
                      จ่ายแล้ว{" "}
                      {formatBaht(
                        itemSummary.paidAmount,
                      )}
                      {" · "}
                      <span
                        className={
                          itemSummary.remaining === 0
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }
                      >
                        {formatBaht(
                          itemSummary.remaining,
                        )}
                      </span>
                    </span>
                  </div>
                );
              })}
          </div>

          {allItems.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              ยังไม่มีประวัติค่าใช้จ่าย
            </p>
          )}
        </section>

        {(showAdd || showPayment) && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/30 p-4 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {showPayment
                    ? "บันทึกการจ่ายเงิน"
                    : editing
                      ? "แก้ไขค่าใช้จ่าย"
                      : "เพิ่มค่าใช้จ่าย"}
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setShowPayment(false);
                    setSelectedPaymentIds([]);
                  }}
                  className="text-sm text-slate-500"
                >
                  ปิด
                </button>
              </div>

              {showPayment ? (
                <form
                  className="mt-5 space-y-4"
                  onSubmit={savePayment}
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">
                          เลือกรายการที่จะจ่าย
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          เลือกเฉพาะรายการที่ต้องการจ่ายได้
                        </p>
                      </div>

                      {payableItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              selectedPaymentIds.length ===
                              payableItems.length
                            ) {
                              clearPaymentSelection();
                            } else {
                              selectAllPayments();
                            }
                          }}
                          className="text-xs font-semibold text-blue-600"
                        >
                          {selectedPaymentIds.length ===
                          payableItems.length
                            ? "ยกเลิกทั้งหมด"
                            : "เลือกทั้งหมด"}
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {payableItems.map((item) => {
                        const remaining = Math.max(
                          0,
                          (item.amount ?? 0) -
                            item.paidAmount,
                        );

                        const selected =
                          selectedPaymentIds.includes(
                            item.id,
                          );

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              togglePaymentSelection(
                                item,
                              )
                            }
                            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                              selected
                                ? "border-blue-300 bg-blue-50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                                selected
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              {selected && (
                                <Check
                                  size={14}
                                  strokeWidth={3}
                                />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-lg">
                                  {
                                    categoryIcons[
                                      item.category
                                    ]
                                  }
                                </span>

                                <span className="font-semibold text-slate-800">
                                  {
                                    categoryLabels[
                                      item.category
                                    ]
                                  }
                                </span>
                              </span>

                              <span className="mt-1 block text-xs text-slate-400">
                                {item.billingMonth
                                  ? monthLabel(
                                      item.billingMonth,
                                    )
                                  : "รายการปัจจุบัน"}
                              </span>
                            </span>

                            <span className="text-right">
                              <span className="block font-semibold text-slate-900">
                                {formatBaht(remaining)}
                              </span>

                              {item.paidAmount > 0 && (
                                <span className="mt-1 block text-[11px] text-amber-600">
                                  จ่ายแล้ว{" "}
                                  {formatBaht(
                                    item.paidAmount,
                                  )}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        ยอดรายการที่เลือก
                      </span>

                      <strong className="text-lg text-slate-950">
                        {formatBaht(
                          selectedPaymentTotal,
                        )}
                      </strong>
                    </div>

                    {selectedPaymentIds.length === 0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        กรุณาเลือกรายการอย่างน้อย 1 รายการ
                      </p>
                    )}
                  </div>

                  <Field label="จำนวนเงินที่จ่าย">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={
                        selectedPaymentTotal > 0
                          ? selectedPaymentTotal
                          : undefined
                      }
                      value={paymentForm.amount}
                      onChange={(event) =>
                        setPaymentForm({
                          ...paymentForm,
                          amount: event.target.value,
                        })
                      }
                      className="input"
                      disabled={
                        selectedPaymentIds.length === 0
                      }
                    />

                    {selectedPaymentTotal > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentForm({
                            ...paymentForm,
                            amount:
                              String(
                                selectedPaymentTotal,
                              ),
                          })
                        }
                        className="mt-2 text-sm font-medium text-blue-600 underline"
                      >
                        จ่ายเต็มจำนวน{" "}
                        {formatBaht(
                          selectedPaymentTotal,
                        )}
                      </button>
                    )}
                  </Field>

                  <Field label="วันที่จ่าย">
                    <input
                      required
                      type="date"
                      value={paymentForm.date}
                      onChange={(event) =>
                        setPaymentForm({
                          ...paymentForm,
                          date: event.target.value,
                        })
                      }
                      className="input"
                    />
                  </Field>

                  <Field label="หมายเหตุ">
                    <input
                      value={paymentForm.note}
                      onChange={(event) =>
                        setPaymentForm({
                          ...paymentForm,
                          note: event.target.value,
                        })
                      }
                      className="input"
                    />
                  </Field>

                  <SubmitButton
                    saving={saving}
                    disabled={
                      selectedPaymentIds.length === 0 ||
                      Number(paymentForm.amount) <= 0
                    }
                  >
                    บันทึกการจ่ายเงิน
                  </SubmitButton>
                </form>
              ) : (
                <form
                  className="mt-5 space-y-4"
                  onSubmit={saveExpense}
                >
                  <Field label="ประเภท">
                    <select
                      value={form.category}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          category:
                            event.target
                              .value as PaymentCategory,
                        })
                      }
                      className="input"
                    >
                      {PAYMENT_CATEGORIES.map(
                        (category) => (
                          <option
                            key={category}
                            value={category}
                          >
                            {categoryLabels[category]}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  <Field label="จำนวนเงิน">
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          amount: event.target.value,
                        })
                      }
                      className="input"
                    />
                  </Field>

                  <Field label="วันที่">
                    <input
                      required
                      type="date"
                      value={form.date}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          date: event.target.value,
                        })
                      }
                      className="input"
                    />
                  </Field>

                  <Field label="หมายเหตุ">
                    <input
                      value={form.note}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          note: event.target.value,
                        })
                      }
                      className="input"
                    />
                  </Field>

                  <SubmitButton saving={saving}>
                    {editing
                      ? "บันทึกการแก้ไข"
                      : "เพิ่มรายการ"}
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">
          {label}
        </span>
      </div>

      <p className="mt-3 text-xl font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function ExpenseRow({
  item,
  onEdit,
}: {
  item: PaymentItem;
  onEdit: () => void;
}) {
  const remaining =
    item.amount === null
      ? null
      : Math.max(
          0,
          item.amount - item.paidAmount,
        );

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <span className="text-xl">
        {categoryIcons[item.category]}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {categoryLabels[item.category]}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {item.amount === null
            ? "ยังไม่ทราบยอด"
            : formatBaht(item.amount)}

          {item.note
            ? ` · ${item.note}`
            : ""}
        </p>

        {item.paidAmount > 0 &&
          item.status !== "paid" && (
            <p className="mt-1 text-xs text-amber-600">
              จ่ายแล้ว{" "}
              {formatBaht(item.paidAmount)}
              {" · เหลือ "}
              {formatBaht(remaining)}
            </p>
          )}
      </div>

      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[item.status]}`}
      >
        {statusLabel(item.status)}
      </span>

      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg p-2 text-slate-500 hover:bg-white"
        aria-label={`แก้ไข${categoryLabels[item.category]}`}
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">
        {label}
      </span>

      {children}
    </label>
  );
}

function SubmitButton({
  saving,
  disabled = false,
  children,
}: {
  saving: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saving && (
        <Loader2
          size={16}
          className="animate-spin"
        />
      )}

      {children}
    </button>
  );
}

function EmptyState({
  onAdd,
}: {
  onAdd: () => void;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <p className="font-semibold text-slate-700">
        ยังไม่มีค่าใช้จ่ายสำหรับเดือนนี้
      </p>

      <p className="mt-1 text-sm text-slate-500">
        เพิ่มรายการจริงจากค่าใช้จ่ายของคุณ
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
      >
        เพิ่มค่าใช้จ่าย
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-5 space-y-3">
      <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

function OverduePanel({
  items,
  total,
}: {
  items: PaymentItem[];
  total: number;
}) {
  return (
    <section className="mb-6 rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
            Overdue
          </p>

          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            ยอดค้างจากเดือนก่อน
          </h2>
        </div>

        <span className="text-base font-bold text-amber-800">
          {formatBaht(total)}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-white/70 p-3 text-sm"
          >
            <span className="font-medium text-slate-700">
              {categoryLabels[item.category]}
            </span>

            <span className="text-slate-600">
              {formatBaht(
                item.amount === null
                  ? null
                  : Math.max(
                      0,
                      item.amount -
                        item.paidAmount,
                    ),
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
  );

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function logSupabaseError(
  operation: string,
  error: unknown,
): void {
  console.log(
    `Payments ${operation} failed error=${serializeSupabaseError(
      error,
    )}`,
  );
}