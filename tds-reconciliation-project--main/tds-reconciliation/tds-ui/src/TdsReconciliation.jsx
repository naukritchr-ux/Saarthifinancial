"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  FileText,
  Check,
  Edit2,
  X,
  AlertCircle,
  Database
} from "lucide-react";
import { API_URL } from "./config/constants";

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || amount === "") return "₹0.00";
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const TdsReconciliation = () => {
  // Data grids and filters
  const [reconciliationRows, setReconciliationRows] = useState([]);
  const [batches, setBatches] = useState([]);
  const [tallyBatches, setTallyBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedTallyBatchId, setSelectedTallyBatchId] = useState("");
  
  const [statusFilter, setStatusFilter] = useState("All");
  const [focusFilter, setFocusFilter] = useState("books"); // 'books' (26AS vs Books) or 'tally' (26AS vs Tally)
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  const [tempManualStatus, setTempManualStatus] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState("tan_no");
  const [sortOrder, setSortOrder] = useState("asc");

  // Upload 26AS Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadYear, setUploadYear] = useState("2024-25");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Upload Tally Modal states
  const [showTallyUploadModal, setShowTallyUploadModal] = useState(false);
  const [uploadTallyFile, setUploadTallyFile] = useState(null);
  const [uploadTallyYear, setUploadTallyYear] = useState("2024-25");
  const [uploadingTally, setUploadingTally] = useState(false);
  const [uploadTallyError, setUploadTallyError] = useState("");
  const [uploadTallySuccess, setUploadTallySuccess] = useState("");

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch upload batches for 26AS
  const fetchBatches = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("tm_token") || sessionStorage.getItem("token") || sessionStorage.getItem("tm_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/api/tds-26as/batches`, { headers });
      const result = await response.json();
      if (result.success) {
        setBatches(result.data || []);
        if (result.data && result.data.length > 0 && !selectedBatchId) {
          // Select the latest batch by default
          setSelectedBatchId(result.data[0].metadata ? JSON.parse(result.data[0].metadata).upload_batch_id : "");
        }
      }
    } catch (error) {
      console.error("Error fetching 26AS batches:", error);
    }
  }, [selectedBatchId]);

  // Fetch upload batches for Tally
  const fetchTallyBatches = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("tm_token") || sessionStorage.getItem("token") || sessionStorage.getItem("tm_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/api/tds-tally/batches`, { headers });
      const result = await response.json();
      if (result.success) {
        setTallyBatches(result.data || []);
        if (result.data && result.data.length > 0 && !selectedTallyBatchId) {
          // Select the latest batch by default
          setSelectedTallyBatchId(result.data[0].metadata ? JSON.parse(result.data[0].metadata).upload_batch_id : "");
        }
      }
    } catch (error) {
      console.error("Error fetching Tally batches:", error);
    }
  }, [selectedTallyBatchId]);

  // Fetch reconciliation report
  const fetchReconciliationReport = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("tm_token") || sessionStorage.getItem("token") || sessionStorage.getItem("tm_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortOrder,
        search: debouncedSearch,
        status: statusFilter,
        focus: focusFilter
      });

      if (selectedBatchId) {
        params.append("uploadBatchId", selectedBatchId);
      }
      if (selectedTallyBatchId) {
        params.append("tallyBatchId", selectedTallyBatchId);
      }

      const response = await fetch(`${API_URL}/api/tds-reconciliation/reconciliation?${params.toString()}`, { headers });
      const result = await response.json();

      if (result.success) {
        setReconciliationRows(result.data || []);
        setTotalItems(result.total || 0);
      }
    } catch (error) {
      console.error("Error fetching reconciliation report:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, sortBy, sortOrder, debouncedSearch, statusFilter, focusFilter, selectedBatchId, selectedTallyBatchId]);

  useEffect(() => {
    fetchBatches();
    fetchTallyBatches();
  }, [fetchBatches, fetchTallyBatches]);

  useEffect(() => {
    fetchReconciliationReport();
  }, [fetchReconciliationReport]);

  // Handle status override PUT
  const handleOverrideStatus = async (id, newStatus) => {
    if (!window.confirm(`Are you sure you want to change the status of this entry to "${newStatus}"?`)) {
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("tm_token") || sessionStorage.getItem("token") || sessionStorage.getItem("tm_token");
      const response = await fetch(`${API_URL}/api/tds-reconciliation/override`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ id, manualStatus: newStatus })
      });

      const result = await response.json();
      if (result.success) {
        setEditingRowId(null);
        fetchReconciliationReport();
      } else {
        alert(`Failed to update status: ${result.error}`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("An error occurred while updating the status.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Form 26AS upload submission
  const handleFileUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("financialYear", uploadYear);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("tm_token") || sessionStorage.getItem("token") || sessionStorage.getItem("tm_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_URL}/api/tds-26as/upload`, {
        method: "POST",
        headers,
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        setUploadSuccess(result.message);
        setUploadFile(null);
        // Refresh batches list and select new batch
        setSelectedBatchId(result.uploadBatchId);
        fetchBatches();
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadSuccess("");
        }, 1500);
      } else {
        setUploadError(result.error || "File parsing failed.");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadError("An error occurred during file upload.");
    } finally {
      setUploading(false);
    }
  };

  // Handle Tally upload submission
  const handleTallyFileUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadTallyFile) {
      setUploadTallyError("Please select a Tally file to upload.");
      return;
    }

    setUploadingTally(true);
    setUploadTallyError("");
    setUploadTallySuccess("");

    const formData = new FormData();
    formData.append("file", uploadTallyFile);
    formData.append("financialYear", uploadTallyYear);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("tm_token") || sessionStorage.getItem("token") || sessionStorage.getItem("tm_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_URL}/api/tds-tally/upload`, {
        method: "POST",
        headers,
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        setUploadTallySuccess(result.message);
        setUploadTallyFile(null);
        setSelectedTallyBatchId(result.uploadBatchId);
        fetchTallyBatches();
        setTimeout(() => {
          setShowTallyUploadModal(false);
          setUploadTallySuccess("");
        }, 1500);
      } else {
        setUploadTallyError(result.error || "File parsing failed.");
      }
    } catch (error) {
      console.error("Error uploading Tally file:", error);
      setUploadTallyError("An error occurred during Tally file upload.");
    } finally {
      setUploadingTally(false);
    }
  };

  // CSV Export for the current view (enriched with Tally and contacts)
  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("tm_token") || sessionStorage.getItem("token") || sessionStorage.getItem("tm_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const params = new URLSearchParams({
        limit: 10000,
        search: debouncedSearch,
        status: statusFilter,
        focus: focusFilter
      });

      if (selectedBatchId) {
        params.append("uploadBatchId", selectedBatchId);
      }
      if (selectedTallyBatchId) {
        params.append("tallyBatchId", selectedTallyBatchId);
      }

      const response = await fetch(`${API_URL}/api/tds-reconciliation/reconciliation?${params.toString()}`, { headers });
      const result = await response.json();

      if (!result.success || !result.data || result.data.length === 0) {
        alert("No data available to export.");
        return;
      }

      const csvHeaders = [
        "Deductor TAN", 
        "Company Name", 
        "Books TDS (Books)", 
        "26AS TDS (Govt)", 
        "Tally TDS (Tally)",
        "Books Status", 
        "Tally Status",
        "Manual Override Status", 
        "Contact Name", 
        "Contact Number", 
        "Updated By", 
        "Updated At"
      ];
      
      const csvRows = result.data.map(row => {
        const books = parseFloat(row.booksTds) || 0;
        const as26 = parseFloat(row.as26Tds) || 0;
        const tally = row.tallyTds !== null ? parseFloat(row.tallyTds) : null;

        return [
          row.tanNo,
          row.companyName || "—",
          books.toFixed(2),
          as26.toFixed(2),
          tally !== null ? tally.toFixed(2) : "—",
          row.systemStatus,
          row.tallyStatus || "—",
          row.manualStatus || "—",
          row.contactName || "—",
          row.contactNumber || "—",
          row.updatedBy || "—",
          row.updatedAt ? formatDate(row.updatedAt) : "—"
        ];
      });

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `tds_reconciliation_${statusFilter}_focus_${focusFilter}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Failed to export reconciliation report.");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans">
      
      {/* Title & Action Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-purple-900">TDS 26AS Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">Reconcile client-deducted TDS credits from Form 26AS against Books and Tally ledger entries.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg transition-all duration-150 shadow-sm text-sm cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Upload Form 26AS
          </button>
          <button
            onClick={() => setShowTallyUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg transition-all duration-150 shadow-sm text-sm cursor-pointer"
          >
            <Database className="w-4 h-4" /> Upload Tally Data
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-purple-200 hover:bg-purple-50 text-purple-700 font-bold rounded-lg transition-all duration-150 shadow-sm text-sm bg-white cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export Report CSV
          </button>
        </div>
      </div>

      {/* Top Filter and Batch Selection Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          {/* 26AS Batch select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase">26AS Batch:</span>
            <select
              value={selectedBatchId}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-purple-600 bg-gray-50 font-semibold"
            >
              <option value="">— Show All 26AS Uploads —</option>
              {batches.map((batch) => {
                const meta = batch.metadata ? JSON.parse(batch.metadata) : {};
                const label = `${batch.fileName} (${meta.financialYear || "FY"})`;
                return (
                  <option key={batch.id} value={meta.upload_batch_id || ""}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tally Batch select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Tally Batch:</span>
            <select
              value={selectedTallyBatchId}
              onChange={(e) => {
                setSelectedTallyBatchId(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-gray-50 font-semibold"
            >
              <option value="">— No Tally Comparison —</option>
              {tallyBatches.map((batch) => {
                const meta = batch.metadata ? JSON.parse(batch.metadata) : {};
                const label = `${batch.fileName} (${meta.financialYear || "FY"})`;
                return (
                  <option key={batch.id} value={meta.upload_batch_id || ""}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Search & Reset */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search TAN or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-600 bg-white w-full sm:w-56 font-medium"
            />
          </div>
          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("All");
              setSelectedTallyBatchId("");
              fetchReconciliationReport();
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 hover:bg-gray-100 border border-gray-250 text-gray-700 rounded-lg transition-colors font-medium text-sm bg-white cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>
      </div>

      {/* Comparison Focus Toggle Tabs */}
      <div className="flex items-center gap-2 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => {
            setFocusFilter("books");
            setCurrentPage(1);
          }}
          className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
            focusFilter === "books"
              ? "bg-white text-purple-800 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          26AS vs Saarth360 Books
        </button>
        <button
          onClick={() => {
            setFocusFilter("tally");
            setCurrentPage(1);
          }}
          className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
            focusFilter === "tally"
              ? "bg-white text-blue-800 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          26AS vs Tally Ledger
        </button>
      </div>

      {/* Reconciliation Status Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto min-w-max sm:min-w-0">
        {["All", "Matched", "Excess", "Less", "Not Paid"].map((status) => (
          <button
            key={status}
            onClick={() => {
              setStatusFilter(status);
              setCurrentPage(1);
            }}
            className={`py-3 px-5 font-bold text-sm transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              statusFilter === status
                ? focusFilter === "tally"
                  ? "border-blue-700 text-blue-700 bg-blue-50/40"
                  : "border-purple-700 text-purple-700 bg-purple-50/40"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Reconciliation Data Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-xs">
                <th className="px-5 py-3">Deductor TAN</th>
                <th className="px-5 py-3">Company Name</th>
                <th className="px-5 py-3 text-right">Books TDS (A)</th>
                <th className="px-5 py-3 text-right">26AS TDS (B)</th>
                <th className="px-5 py-3 text-right">Tally TDS (C)</th>
                <th className="px-5 py-3 text-center">Books Status (B-A)</th>
                <th className="px-5 py-3 text-center">Tally Status (B-C)</th>
                <th className="px-5 py-3 text-center">Audit Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-gray-400">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                      <span>Loading reconciliation report...</span>
                    </div>
                  </td>
                </tr>
              ) : reconciliationRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-12 text-center text-gray-500 font-bold">
                    No reconciliation items found matching your filters.
                  </td>
                </tr>
              ) : (
                reconciliationRows.map((row) => {
                  const books = parseFloat(row.booksTds) || 0;
                  const as26 = parseFloat(row.as26Tds) || 0;
                  const tally = row.tallyTds !== null ? parseFloat(row.tallyTds) : null;
                  const effectiveStatus = row.manualStatus || row.systemStatus;

                  // Determine if contact chase info should be displayed
                  const isLessInFocus = 
                    (focusFilter === "books" && effectiveStatus === "Less") || 
                    (focusFilter === "tally" && row.tallyStatus === "Less");

                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-purple-800 font-bold">{row.tanNo}</td>
                      <td className="px-5 py-3.5 text-gray-800 max-w-xs">
                        <div className="font-semibold truncate">{row.companyName || "—"}</div>
                        {isLessInFocus && (row.contactName || row.contactNumber) && (
                          <div className="text-[11px] text-purple-700 mt-1 flex flex-wrap gap-1.5 items-center bg-purple-50 p-1.5 rounded border border-purple-100">
                            <span className="font-bold uppercase text-[9px] bg-purple-200 text-purple-800 px-1 rounded">Chase client</span>
                            <span>{row.contactName || "—"}</span>
                            <span>•</span>
                            <span>{row.contactNumber || "—"}</span>
                            <span className="text-[9px] text-gray-400 italic font-normal">(Email unavailable in DB)</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-700">{formatCurrency(books)}</td>
                      <td className="px-5 py-3.5 text-right text-gray-700">{formatCurrency(as26)}</td>
                      <td className="px-5 py-3.5 text-right text-gray-700">{tally !== null ? formatCurrency(tally) : "—"}</td>
                      
                      {/* Books status badge */}
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            row.systemStatus === "Matched"
                              ? "bg-green-100 text-green-800"
                              : row.systemStatus === "Excess"
                              ? "bg-blue-100 text-blue-800"
                              : row.systemStatus === "Less"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {row.systemStatus}
                        </span>
                      </td>

                      {/* Tally status badge */}
                      <td className="px-5 py-3.5 text-center">
                        {row.tallyStatus ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              row.tallyStatus === "Matched"
                                ? "bg-green-100 text-green-800"
                                : row.tallyStatus === "Excess"
                                ? "bg-blue-100 text-blue-800"
                                : row.tallyStatus === "Less"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {row.tallyStatus}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-xs font-normal">Not compared</span>
                        )}
                      </td>

                      {/* Manual Override control */}
                      <td className="px-5 py-3.5 text-center">
                        {editingRowId === row.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <select
                              value={tempManualStatus}
                              onChange={(e) => setTempManualStatus(e.target.value)}
                              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-purple-600 font-semibold"
                            >
                              <option value="Matched">Matched</option>
                              <option value="Excess">Excess</option>
                              <option value="Less">Less</option>
                              <option value="Not Paid">Not Paid</option>
                            </select>
                            <button
                              onClick={() => handleOverrideStatus(row.id, tempManualStatus)}
                              className="p-1 hover:bg-green-100 rounded text-green-600 cursor-pointer"
                              disabled={saving}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingRowId(null)}
                              className="p-1 hover:bg-gray-200 rounded text-gray-500 cursor-pointer"
                              disabled={saving}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingRowId(row.id);
                              setTempManualStatus(effectiveStatus);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 text-purple-700 border border-purple-200 hover:bg-purple-50 rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" /> Override
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalItems > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-xs font-semibold text-gray-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of{" "}
              {totalItems} records
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded font-semibold text-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: Math.ceil(totalItems / itemsPerPage) }, (_, idx) => {
                const p = idx + 1;
                if (p === 1 || p === Math.ceil(totalItems / itemsPerPage) || Math.abs(currentPage - p) <= 2) {
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-3 py-1 rounded border font-semibold text-xs transition-colors cursor-pointer ${
                        currentPage === p
                          ? "bg-purple-700 text-white border-purple-700"
                          : "bg-white hover:bg-gray-100 border-gray-300 text-gray-700"
                      }`}
                    >
                      {p}
                    </button>
                  );
                }
                if (p === 2 || p === Math.ceil(totalItems / itemsPerPage) - 1) {
                  return <span key={p} className="px-1 text-gray-400 self-center text-xs font-bold">...</span>;
                }
                return null;
              })}
              <button
                disabled={currentPage === Math.ceil(totalItems / itemsPerPage) || loading}
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalItems / itemsPerPage), p + 1))}
                className="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded font-semibold text-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload 26AS Modal */}
      {showUploadModal && (
        <div
          onClick={() => setShowUploadModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scale-up"
          >
            <div className="flex-none bg-purple-900 text-white px-6 py-4 flex justify-between items-center border-b border-purple-950">
              <h3 className="font-extrabold text-base">Upload Form 26AS (Excel/CSV)</h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-purple-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFileUploadSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                {uploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl flex gap-2 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl flex gap-2 text-xs font-semibold">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {/* Drag/Drop Zone */}
                <div className="border-2 border-dashed border-slate-300 hover:border-purple-600 rounded-xl p-6 transition-all flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50">
                  <input
                    type="file"
                    id="26as-file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="hidden"
                  />
                  <label htmlFor="26as-file" className="cursor-pointer w-full flex flex-col items-center justify-center">
                    <FileText className="w-10 h-10 text-purple-600 mb-2" />
                    {uploadFile ? (
                      <div>
                        <p className="font-bold text-gray-800 text-xs">{uploadFile.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-gray-700 text-xs">Click to select or drag Form 26AS file</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Supported formats: Excel (.xlsx, .xls) and CSV</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Metadata selection */}
                <div className="w-full">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Financial Year (Optional Override)</label>
                  <select
                    value={uploadYear}
                    onChange={(e) => setUploadYear(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-slate-50"
                  >
                    <option value="2024-25">2024-25</option>
                    <option value="2025-26">2025-26</option>
                    <option value="2026-27">2026-27</option>
                  </select>
                </div>
              </div>

              <div className="flex-none px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 justify-end items-center">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition shadow-sm text-xs cursor-pointer disabled:opacity-50"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    "Process & Reconcile"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Tally Modal */}
      {showTallyUploadModal && (
        <div
          onClick={() => setShowTallyUploadModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scale-up"
          >
            <div className="flex-none bg-blue-900 text-white px-6 py-4 flex justify-between items-center border-b border-blue-950">
              <h3 className="font-extrabold text-base">Upload Tally Ledger Data</h3>
              <button
                type="button"
                onClick={() => setShowTallyUploadModal(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-blue-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTallyFileUploadSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                {uploadTallyError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl flex gap-2 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{uploadTallyError}</span>
                  </div>
                )}

                {uploadTallySuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl flex gap-2 text-xs font-semibold">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{uploadTallySuccess}</span>
                  </div>
                )}

                {/* Drag/Drop Zone */}
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-600 rounded-xl p-6 transition-all flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50">
                  <input
                    type="file"
                    id="tally-file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setUploadTallyFile(e.target.files[0])}
                    className="hidden"
                  />
                  <label htmlFor="tally-file" className="cursor-pointer w-full flex flex-col items-center justify-center">
                    <Database className="w-10 h-10 text-blue-600 mb-2" />
                    {uploadTallyFile ? (
                      <div>
                        <p className="font-bold text-gray-800 text-xs">{uploadTallyFile.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{(uploadTallyFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-gray-700 text-xs">Click to select or drag Tally data file</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Supported formats: Excel (.xlsx, .xls) and CSV</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Metadata selection */}
                <div className="w-full">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Financial Year (Optional Override)</label>
                  <select
                    value={uploadTallyYear}
                    onChange={(e) => setUploadTallyYear(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50"
                  >
                    <option value="2024-25">2024-25</option>
                    <option value="2025-26">2025-26</option>
                    <option value="2026-27">2026-27</option>
                  </select>
                </div>
              </div>

              <div className="flex-none px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 justify-end items-center">
                <button
                  type="button"
                  onClick={() => setShowTallyUploadModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer"
                  disabled={uploadingTally}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition shadow-sm text-xs cursor-pointer disabled:opacity-50"
                  disabled={uploadingTally}
                >
                  {uploadingTally ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    "Process & Reconcile"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TdsReconciliation;
