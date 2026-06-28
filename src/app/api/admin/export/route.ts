import { NextResponse } from "next/server";
import { getExportData } from "@/lib/admin-data";
import { requireCounsellor } from "@/lib/auth";

// GET /api/admin/export
// Protected by middleware (Supabase session) + requireCounsellor (is_active check).
// Returns a UTF-8 CSV file with one row per lead.
export async function GET() {
  const [, denied] = await requireCounsellor();
  if (denied) return denied;

  const rows = await getExportData();

  if (!rows.length) {
    return new NextResponse("No data", { status: 204 });
  }

  const csv = toCsv(rows);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="coyot-pathfinder-students-${date}.csv"`,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  // Wrap in quotes if the value contains a comma, double-quote, or newline.
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Record<string, string | number | null | undefined>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ];
  return "﻿" + lines.join("\r\n"); // BOM for Excel UTF-8 compatibility
}
