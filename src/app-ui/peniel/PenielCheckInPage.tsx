"use client";

import React from "react";
import { QrCode } from "lucide-react";
import PenielCheckIn from "./PenielCheckIn";

export default function PenielCheckInPage() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
          <QrCode className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">Check-in Peniel</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Validação de ingressos na entrada do encontro
          </p>
        </div>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl px-4 py-3 text-xs text-emerald-800 dark:text-emerald-300">
        Aponte o leitor para o QR Code do participante (ou digite o código). A presença é registrada e o ingresso é "queimado" — não pode ser usado de novo.
      </div>

      <PenielCheckIn />
    </div>
  );
}
