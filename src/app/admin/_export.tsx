"use client";

export default function AdminExport({ className }: { className?: string }) {
  function handleExport() {
    const ok = window.confirm(
      "This will download all lead data as a CSV file. Continue?"
    );
    if (ok) window.location.href = "/api/admin/export";
  }

  return (
    <button onClick={handleExport} className={className}>
      Export CSV
    </button>
  );
}
