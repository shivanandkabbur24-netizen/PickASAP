import React, { useState, useId } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  AlertTriangle,
  Download,
  Check,
  RotateCcw,
  ShieldCheck,
  Layers,
  ArrowRight,
  Eye,
  Info
} from 'lucide-react';
import {
  UserProfile,
  Product,
  CsvValidationResponse,
  CsvValidationRow,
  HistoricalPriceObservation,
  CsvImportResult
} from '../types';
import { database as db } from '../lib/firebase';

interface HistoricalPriceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  products: Product[];
  preselectedProductId?: string;
  onImportComplete?: (result: CsvImportResult) => void;
}

export const HistoricalPriceImportModal: React.FC<HistoricalPriceImportModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <HistoricalPriceImportModalContent {...props} />;
};

const HistoricalPriceImportModalContent: React.FC<HistoricalPriceImportModalProps> = ({
  onClose,
  user,
  products,
  preselectedProductId,
  onImportComplete,
}) => {
  const fileInputId = useId();

  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<CsvValidationResponse | null>(null);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<CsvImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Admin access verification
  const isOwnerAdmin =
    user?.role === 'admin' ||
    user?.id === 'DTORVHWkRQRBLp1vS7JfdVIvVBr1' ||
    user?.email?.toLowerCase().trim() === 'shivanandkabbur24@gmail.com' ||
    user?.email?.toLowerCase().includes('admin');

  if (!isOwnerAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Admin Access Required</h3>
          <p className="text-xs text-neutral-500">
            Historical price observations import is restricted to authorized administrators.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Sample CSV generator
  const getSampleCsv = () => {
    const prodId = preselectedProductId || (products[0] ? products[0].id : 'prod_1789196748190_ji01p');
    return (
      `product_id,observation_date,price,currency,source_name,source_url,source_observed_at,verification_method,review_status\n` +
      `${prodId},2024-05-15,49990,INR,Official Launch,https://flipkart.com,2024-05-15T10:00:00Z,official_store_archive,approved\n` +
      `${prodId},2024-09-28,38990,INR,Flipkart Big Billion Days,https://flipkart.com,2024-09-28T04:00:00Z,retailer_invoice,approved\n` +
      `${prodId},2026-02-15,49990,INR,Post-Holiday Retail List,https://flipkart.com,2026-02-15T09:00:00Z,admin_audit,approved\n` +
      `prod_invalid_test_id,2025-01-01,999,INR,Test Invalid Product,,,manual_receipt,pending\n` +
      `${prodId},2030-01-01,15000,INR,Future Date Test,,,manual_receipt,pending\n` +
      `${prodId},2024-05-15,-500,INR,Negative Price Test,,,manual_receipt,pending\n`
    );
  };

  const handleLoadSample = () => {
    const sample = getSampleCsv();
    setCsvContent(sample);
    setInputMode('paste');
    handleValidateContent(sample);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setCsvContent(text);
      handleValidateContent(text);
    };
    reader.readAsText(file);
  };

  // Perform server-side validation
  const handleValidateContent = async (textToValidate: string) => {
    if (!textToValidate.trim()) {
      setErrorMessage('Please provide CSV content to validate.');
      return;
    }
    setIsValidating(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/price-history/validate-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': 'admin',
          'x-admin-user-id': user.id,
          'x-admin-email': user.email,
        },
        body: JSON.stringify({ csvContent: textToValidate }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Validation failed on server');
      }

      const valData: CsvValidationResponse = json.data;
      setValidationResult(valData);

      // By default, approve all valid rows that are not duplicates
      const initialSelected = new Set<number>();
      valData.rows.forEach((r, idx) => {
        if (r.isValid && !r.isDuplicate) {
          initialSelected.add(idx);
        }
      });
      setSelectedRowIndices(initialSelected);
    } catch (err: any) {
      console.error('CSV validation error:', err);
      setErrorMessage(err?.message || 'Server error during CSV validation');
    } finally {
      setIsValidating(false);
    }
  };

  // Toggle selection for individual row approval
  const toggleRowApproval = (idx: number) => {
    const next = new Set(selectedRowIndices);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedRowIndices(next);
  };

  const handleSelectAllValid = () => {
    if (!validationResult) return;
    const next = new Set<number>();
    validationResult.rows.forEach((r, idx) => {
      if (r.isValid) next.add(idx);
    });
    setSelectedRowIndices(next);
  };

  const handleDeselectAll = () => {
    setSelectedRowIndices(new Set());
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!validationResult) return;

    // Filter approved rows only
    const approvedObservations: HistoricalPriceObservation[] = [];
    validationResult.rows.forEach((r, idx) => {
      if (selectedRowIndices.has(idx) && r.isValid && r.parsedData) {
        approvedObservations.push(r.parsedData);
      }
    });

    if (approvedObservations.length === 0) {
      setErrorMessage('No approved rows selected for import.');
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);

    try {
      // 1. Server-side import with authentication
      const serverRes = await fetch('/api/price-history/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': 'admin',
          'x-admin-user-id': user.id,
          'x-admin-email': user.email,
        },
        body: JSON.stringify({ observations: approvedObservations }),
      });

      const serverJson = await serverRes.json();
      if (!serverRes.ok || !serverJson.success) {
        throw new Error(serverJson.error || 'Server rejected import');
      }

      // 2. Client-side database sync to ensure instant reactivity and local storage persistence
      const clientResult = await db.importHistoricalObservationsBatch(approvedObservations);

      const combinedReport: CsvImportResult = {
        totalSubmitted: approvedObservations.length,
        successful: clientResult.successful,
        skipped: (validationResult.totalRows - approvedObservations.length) + clientResult.skipped,
        rejected: clientResult.rejected,
        importedRecords: clientResult.importedRecords,
        errors: clientResult.errors,
        timestamp: new Date().toISOString(),
      };

      setImportReport(combinedReport);
      if (onImportComplete) {
        onImportComplete(combinedReport);
      }
    } catch (err: any) {
      console.error('Import execution error:', err);
      setErrorMessage(err?.message || 'Error executing price observations import');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setCsvContent('');
    setFileName('');
    setValidationResult(null);
    setSelectedRowIndices(new Set());
    setImportReport(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-3xl p-5 sm:p-7 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-5 my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#FF6E40]/10 flex items-center justify-center text-[#FF6E40]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-neutral-900 dark:text-white font-serif-editorial">
                  Historical Price Observations Import
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Admin Verified
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Import and calibrate authentic historical price milestones via CSV with server validation &amp; idempotent updates.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Upload or Paste CSV (If no report and not previewing) */}
        {!importReport && !validationResult && (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {/* Input Mode Selector & Sample loader */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    inputMode === 'upload'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  Upload CSV File
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    inputMode === 'paste'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  Paste CSV Text
                </button>
              </div>

              <button
                type="button"
                onClick={handleLoadSample}
                className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#FF6E40]" />
                <span>Load Sample Records</span>
              </button>
            </div>

            {inputMode === 'upload' ? (
              <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-3xl p-8 text-center space-y-3 bg-neutral-50/50 dark:bg-neutral-850/30 hover:border-[#FF6E40]/50 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6E40]/10 text-[#FF6E40] flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <label
                    htmlFor={fileInputId}
                    className="font-bold text-sm text-[#FF6E40] hover:underline cursor-pointer"
                  >
                    Click to choose a CSV file
                  </label>
                  <p className="text-xs text-neutral-400 mt-1">or drag and drop here (.csv format)</p>
                </div>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {fileName && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Selected: {fileName}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Paste Raw CSV Content
                </label>
                <textarea
                  rows={9}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder={`product_id,observation_date,price,currency,source_name,source_url,source_observed_at,verification_method,review_status\nprod_123,2024-05-15,49990,INR,Official Launch,https://flipkart.com,2024-05-15T10:00:00Z,official_store_archive,approved`}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono text-xs leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-[#FF6E40]"
                />
              </div>
            )}

            {/* Expected CSV Fields Guide */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-neutral-800 dark:text-neutral-200">
                <Info className="w-4 h-4 text-[#FF6E40]" />
                <span>Expected CSV Columns:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 font-mono">
                <div>&bull; product_id (Required)</div>
                <div>&bull; observation_date (Required)</div>
                <div>&bull; price (Required, &gt; 0)</div>
                <div>&bull; currency (INR default)</div>
                <div>&bull; source_name (Required)</div>
                <div>&bull; verification_method</div>
                <div>&bull; review_status</div>
                <div>&bull; source_url (Optional)</div>
                <div>&bull; source_observed_at</div>
              </div>
            </div>

            {/* Validate Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleValidateContent(csvContent)}
                disabled={isValidating || !csvContent.trim()}
                className="px-5 py-2 rounded-xl bg-[#FF6E40] hover:bg-[#ff5722] text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span>{isValidating ? 'Validating on Server...' : 'Validate & Preview'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Preview & Approval Table */}
        {!importReport && validationResult && (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {/* Stats Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Total Rows</div>
                <div className="text-xl font-bold font-mono text-neutral-900 dark:text-white mt-0.5">
                  {validationResult.totalRows}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-semibold">Valid Rows</div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {validationResult.validCount}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800">
                <div className="text-[10px] text-rose-700 dark:text-rose-400 uppercase tracking-wider font-semibold">Invalid Rows</div>
                <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                  {validationResult.invalidCount}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800">
                <div className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wider font-semibold">Approved to Import</div>
                <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                  {selectedRowIndices.size}
                </div>
              </div>
            </div>

            {/* Filter Pills & Select Controls */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                {(['all', 'valid', 'invalid'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewFilter(mode)}
                    className={`px-3 py-1 rounded-xl font-semibold transition-colors cursor-pointer ${
                      previewFilter === mode
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                    }`}
                  >
                    {mode === 'all' ? 'All Rows' : mode === 'valid' ? 'Valid Only' : 'Invalid Only'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllValid}
                  className="text-xs font-semibold text-[#FF6E40] hover:underline cursor-pointer"
                >
                  Approve All Valid
                </button>
                <span className="text-neutral-300">&bull;</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-xs font-semibold text-neutral-500 hover:underline cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Table of Parsed Observations */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-850 sticky top-0 border-b border-neutral-200 dark:border-neutral-800">
                  <tr className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                    <th className="py-2.5 px-3 w-10">Approve</th>
                    <th className="py-2.5 px-3">Row</th>
                    <th className="py-2.5 px-3">Product ID</th>
                    <th className="py-2.5 px-3">Obs. Date</th>
                    <th className="py-2.5 px-3">Price</th>
                    <th className="py-2.5 px-3">Source &amp; Method</th>
                    <th className="py-2.5 px-3">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-[11px]">
                  {validationResult.rows
                    .filter((r) => {
                      if (previewFilter === 'valid') return r.isValid;
                      if (previewFilter === 'invalid') return !r.isValid;
                      return true;
                    })
                    .map((row) => {
                      const rowIndex = row.rowNumber - 1;
                      const isSelected = selectedRowIndices.has(rowIndex);

                      return (
                        <tr
                          key={row.rowNumber}
                          className={`hover:bg-neutral-50 dark:hover:bg-neutral-850/50 ${
                            !row.isValid ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                          }`}
                        >
                          {/* Approval Checkbox */}
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              disabled={!row.isValid}
                              checked={isSelected}
                              onChange={() => toggleRowApproval(rowIndex)}
                              className="rounded border-neutral-300 text-[#FF6E40] focus:ring-[#FF6E40] cursor-pointer disabled:opacity-30"
                            />
                          </td>

                          {/* Row number */}
                          <td className="py-2 px-3 font-mono text-neutral-400">{row.rowNumber}</td>

                          {/* Product */}
                          <td className="py-2 px-3 max-w-[140px]">
                            <div className="font-mono text-neutral-900 dark:text-white truncate">
                              {row.rawData.product_id}
                            </div>
                            {row.matchedProduct && (
                              <div className="text-[10px] text-neutral-500 truncate" title={row.matchedProduct.title}>
                                {row.matchedProduct.title}
                              </div>
                            )}
                          </td>

                          {/* Observation Date */}
                          <td className="py-2 px-3 font-mono whitespace-nowrap">
                            {row.rawData.observation_date || 'Missing'}
                          </td>

                          {/* Price */}
                          <td className="py-2 px-3 font-mono font-bold text-neutral-900 dark:text-white">
                            {row.parsedData?.price
                              ? `₹${row.parsedData.price.toLocaleString('en-IN')}`
                              : row.rawData.price || '—'}
                          </td>

                          {/* Source & Method */}
                          <td className="py-2 px-3 max-w-[160px]">
                            <div className="truncate text-neutral-800 dark:text-neutral-200">
                              {row.rawData.source_name || '—'}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              {row.rawData.verification_method || 'manual_receipt'}
                            </div>
                          </td>

                          {/* Validation Badges */}
                          <td className="py-2 px-3">
                            {row.isValid ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <Check className="w-3 h-3" />
                                  <span>Valid</span>
                                </span>
                                {row.isDuplicate && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    Duplicate
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                {row.errors.map((err, i) => (
                                  <div key={i} className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                                    &bull; {err}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Upload Different File</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isImporting || selectedRowIndices.size === 0}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {isImporting
                      ? 'Importing...'
                      : `Import ${selectedRowIndices.size} Approved Observation${
                          selectedRowIndices.size === 1 ? '' : 's'
                        }`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Import Report Report Dialog */}
        {importReport && (
          <div className="space-y-5 overflow-y-auto flex-1 pr-1 animate-fade-in">
            <div className="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-lg font-bold text-neutral-900 dark:text-white">
                Price Observations Import Completed
              </h4>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 max-w-md mx-auto">
                Historical records were validated and idempotently saved to the price history collection.
              </p>
            </div>

            {/* Report Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center">
                <div className="text-[11px] text-emerald-600 uppercase font-bold tracking-wider">
                  Successful Imports
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                  {importReport.successful}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center">
                <div className="text-[11px] text-neutral-500 uppercase font-bold tracking-wider">
                  Skipped / Unselected
                </div>
                <div className="text-2xl font-bold font-mono text-neutral-700 dark:text-neutral-300 mt-1">
                  {importReport.skipped}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center">
                <div className="text-[11px] text-rose-500 uppercase font-bold tracking-wider">
                  Rejected Errors
                </div>
                <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
                  {importReport.rejected}
                </div>
              </div>
            </div>

            {/* Error logs if any */}
            {importReport.errors.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-bold">Errors encountered during import:</div>
                {importReport.errors.map((e, idx) => (
                  <div key={idx}>&bull; {e}</div>
                ))}
              </div>
            )}

            {/* Finish Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Import More Records
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-bold cursor-pointer"
              >
                Done &bull; View Charts
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
