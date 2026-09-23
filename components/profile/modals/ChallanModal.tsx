"use client";

import React, { useState, useEffect } from "react";
import { X, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChallanDetails } from "@/lib/types";

interface ChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ChallanDetails | null;
  onSave: (data: ChallanDetails) => void;
}

export function ChallanModal({
  isOpen,
  onClose,
  initialData,
  onSave,
}: ChallanModalProps) {
  const [challanNumber, setChallanNumber] = useState(initialData?.challanNumber || "");
  const [date, setDate] = useState(initialData?.date || "");
  const [amount, setAmount] = useState(String(initialData?.amount || ""));
  const [status, setStatus] = useState<"Pending" | "Paid">(initialData?.status || "Paid");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setChallanNumber(initialData.challanNumber);
      setDate(initialData.date);
      setAmount(String(initialData.amount));
      setStatus(initialData.status);
    }
  }, [initialData]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!challanNumber.trim()) errs.challanNumber = "Challan/Notice number is required (or enter 'NIL' if none).";
    if (!date.trim()) errs.date = "Date is required.";
    if (!amount.trim() || isNaN(Number(amount))) errs.amount = "Valid amount in ₹ is required (enter 0 if none).";

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    const data: ChallanDetails = {
      challanNumber: challanNumber.trim().toUpperCase(),
      date,
      amount: parseFloat(amount) || 0,
      status,
    };

    setSuccess(true);
    onSave(data);

    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="challan-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0B1515] p-6 shadow-xl border border-[#203131] space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#203131] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="challan-modal-title" className="text-xl font-bold text-[#F5F7F6]">
                Traffic Challan Records
              </h2>
              <p className="text-xs text-[#81918E] mt-0.5">
                Track and record e-challans or verify clean records status.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-xl p-1.5 text-[#81918E] hover:bg-[#132020] hover:text-[#F5F7F6] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback */}
        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-[#101C1C] p-3 text-sm text-[#66C56A] border border-[#2E7D32]/40">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#66C56A]" />
            <span>Challan information updated successfully!</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-950/40 p-3 text-sm text-rose-300 border border-rose-900">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Challan Number */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Challan / Reference ID *
            </label>
            <input
              type="text"
              value={challanNumber}
              onChange={(e) => setChallanNumber(e.target.value)}
              placeholder="e.g. DL-CH-2026-8812 or 'NIL / NO PENDING'"
              className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm font-mono text-[#F5F7F6] uppercase outline-none focus:bg-[#132020] ${
                validationErrors.challanNumber ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
              }`}
            />
            {validationErrors.challanNumber && (
              <p className="text-xs text-rose-400 mt-1">{validationErrors.challanNumber}</p>
            )}
          </div>

          {/* Date & Amount */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Notice / Verification Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.date ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.date && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.date}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Amount (₹) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.amount ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.amount && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.amount}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Payment Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "Pending" | "Paid")}
              className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] focus:border-[#66C56A]"
            >
              <option value="Paid">Paid / No Dues Pending</option>
              <option value="Pending">Pending Payment</option>
            </select>
          </div>

          <p className="text-[11px] text-[#81918E] italic">
            * Frontend Demo: Stored in active session state for profile completion tracking.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#203131]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-[#203131] bg-[#132020] text-[#F5F7F6] hover:bg-[#132020]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={success}
              className="rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs min-w-[120px]"
            >
              Save Challan Status
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
