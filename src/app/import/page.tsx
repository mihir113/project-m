"use client";

export default function ImportPage() {
  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Import</h1>
        <p className="text-secondary text-sm mt-1">Bulk import requirements from CSV or Excel</p>
      </div>
      <div className="card p-12 text-center">
        <p className="text-muted text-sm">Bulk requirement import will be built here next.</p>
        <p className="text-muted text-xs mt-1">Upload CSV/Excel → preview with validation → confirm insert.</p>
      </div>
    </div>
  );
}
