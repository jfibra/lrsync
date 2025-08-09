"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Plus, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { logNotification } from "@/utils/logNotification";

interface AddSalesModalProps {
  onSalesAdded: () => void;
}

interface TaxMonthOption {
  label: string;
  value: string;
}

interface TaxpayerSuggestion {
  tin: string;
  registered_name: string;
  substreet_street_brgy: string;
  district_city_zip: string;
}

interface FileUpload {
  id: string;
  name: string;
  files: File[];
  required: boolean;
  uploading: boolean;
  uploadedUrls: string[];
}

// S3 Upload function via API route
const uploadToS3API = async (
  file: File,
  taxMonth: string,
  tin: string,
  fileType: string,
  existingFileCount: number
): Promise<string> => {
  const taxDate = new Date(taxMonth);
  const taxYear = taxDate.getFullYear().toString();
  const taxMonthNum = String(taxDate.getMonth() + 1).padStart(2, "0");
  const taxDay = String(taxDate.getDate()).padStart(2, "0");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("tax_month", taxMonthNum);
  formData.append("tax_year", taxYear);
  formData.append("tax_date", taxDay);

  // Generate filename with proper indexing
  const cleanTin = tin.replace(/-/g, "");
  const fileExtension = file.name.split(".").pop();
  const baseFileName = `${cleanTin}-${fileType}-${format(
    new Date(),
    "MMddyyyy"
  )}`;
  const fileName =
    existingFileCount > 0
      ? `${baseFileName}-${existingFileCount + 1}.${fileExtension}`
      : `${baseFileName}.${fileExtension}`;

  formData.append("file_name", fileName);

  const apiUrl = `${process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR}/upload-tax-file`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Upload error response:", errorText);
      throw new Error(
        `Upload failed: ${response.status} ${response.statusText}`
      );
    }

    const responseText = await response.text();

    if (!responseText.trim()) {
      throw new Error("Empty response from server");
    }

    const result = JSON.parse(responseText);

    if (result.success && result["0"] && result["0"].url) {
      return result["0"].url;
    } else {
      throw new Error("Invalid response structure: missing URL in response");
    }
  } catch (error) {
    console.error("Network error:", error);
    throw new Error(
      `Network error: ${error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

export function AddSalesModal({ onSalesAdded }: AddSalesModalProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taxMonth, setTaxMonth] = useState<string>("");
  const [pickupDate, setPickupDate] = useState<Date>();
  const [taxpayerSuggestions, setTaxpayerSuggestions] = useState<TaxpayerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Name search suggestions
  const [nameSuggestions, setNameSuggestions] = useState<TaxpayerSuggestion[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    tin: "",
    name: "",
    substreet_street_brgy: "",
    district_city_zip: "",
    tax_type: "",
    sale_type: "invoice",
    gross_taxable: "",
    total_actual_amount: "",
    invoice_number: "",
  });

  // File uploads state
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([
    {
      id: "voucher",
      name: "Voucher",
      files: [],
      required: false,
      uploading: false,
      uploadedUrls: [],
    },
    {
      id: "cheque",
      name: "Cheque",
      files: [],
      required: false,
      uploading: false,
      uploadedUrls: [],
    },
    {
      id: "invoice",
      name: "Invoice",
      files: [],
      required: false,
      uploading: false,
      uploadedUrls: [],
    },
    {
      id: "deposit_slip",
      name: "Deposit Slip",
      files: [],
      required: false,
      uploading: false,
      uploadedUrls: [],
    },
    {
      id: "doc_2307",
      name: "Doc 2307",
      files: [],
      required: false,
      uploading: false,
      uploadedUrls: [],
    },
  ]);

  // Generate tax month options
  const generateTaxMonthOptions = (): TaxMonthOption[] => {
    const options: TaxMonthOption[] = [];
    const currentDate = new Date();

    for (let i = 0; i < 36; i++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );
      const year = date.getFullYear();
      const month = date.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const monthName = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        lastDay
      ).padStart(2, "0")}`;

      options.push({
        label: monthName,
        value: value,
      });
    }

    return options;
  };

  const taxMonthOptions = generateTaxMonthOptions();

  // Format TIN with dashes
  const formatTinInput = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    return digits.replace(/(\d{3})(?=\d)/g, "$1-");
  };

  // Format TIN for display (used for suggestions)
  const formatTinDisplay = (tin: string): string => {
    const digits = tin.replace(/\D/g, "");
    return digits.replace(/(\d{3})(?=\d)/g, "$1-");
  };

  // Format number with commas and preserve decimals
  const formatNumberWithCommas = (value: string): string => {
    if (!value) return "";

    // Remove existing commas
    const numericValue = value.replace(/,/g, "");

    // Check if it's a valid number (including decimals)
    if (isNaN(Number(numericValue))) return value;

    // Split into integer and decimal parts
    const parts = numericValue.split(".");
    const integerPart = parts[0];
    const decimalPart = parts[1];

    // Format integer part with commas
    const formattedInteger = Number(integerPart).toLocaleString();

    // Combine with decimal part if it exists
    return decimalPart !== undefined
      ? `${formattedInteger}.${decimalPart}`
      : formattedInteger;
  };

  // Remove commas from formatted number
  const removeCommas = (value: string): string => {
    return value.replace(/,/g, "");
  };

  // Search taxpayers based on TIN prefix
  const searchTaxpayers = async (tinPrefix: string) => {
    if (tinPrefix.length < 3) {
      setTaxpayerSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("taxpayer_listings")
        .select("tin, registered_name, substreet_street_brgy, district_city_zip")
        .ilike("tin", `${tinPrefix}%`)
        .limit(5);
      if (error) throw error;
      setTaxpayerSuggestions(data || []);
      setShowSuggestions(data && data.length > 0);
    } catch (error) {
      console.error("Error searching taxpayers:", error);
      setTaxpayerSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Search taxpayers by name
  const searchTaxpayersByName = async (namePrefix: string) => {
    if (namePrefix.length < 3) {
      setNameSuggestions([]);
      setShowNameSuggestions(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("taxpayer_listings")
        .select("tin, registered_name, substreet_street_brgy, district_city_zip")
        .ilike("registered_name", `%${namePrefix}%`)
        .limit(5);
      if (error) throw error;
      setNameSuggestions(data || []);
      setShowNameSuggestions(data && data.length > 0);
    } catch (error) {
      console.error("Error searching taxpayers by name:", error);
      setNameSuggestions([]);
      setShowNameSuggestions(false);
    }
  };

  // Handle TIN input change
  const handleTinChange = (value: string) => {
    const formattedTin = formatTinInput(value);
    setFormData({ ...formData, tin: formattedTin });

    // Search for taxpayers when first 3 digits are entered
    const cleanTin = value.replace(/[^0-9]/g, "");
    if (cleanTin.length >= 3) {
      const prefix = cleanTin.substring(0, 3);
      searchTaxpayers(prefix);
    } else {
      setTaxpayerSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle taxpayer suggestion selection (TIN)
  const handleSuggestionSelect = (suggestion: TaxpayerSuggestion) => {
    setFormData({
      ...formData,
      tin: formatTinDisplay(suggestion.tin),
      name: suggestion.registered_name,
      substreet_street_brgy: suggestion.substreet_street_brgy,
      district_city_zip: suggestion.district_city_zip,
    });
    setShowSuggestions(false);
  };

  // Handle taxpayer suggestion selection (Name)
  const handleNameSuggestionSelect = (suggestion: TaxpayerSuggestion) => {
    setFormData({
      ...formData,
      tin: formatTinDisplay(suggestion.tin),
      name: suggestion.registered_name,
      substreet_street_brgy: suggestion.substreet_street_brgy,
      district_city_zip: suggestion.district_city_zip,
    });
    setShowNameSuggestions(false);
  };

  // Validate file type
  const isValidFile = (file: File): boolean => {
    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    return validTypes.includes(file.type);
  };

  // Handle file uploads to S3
  const handleFileUpload = async (uploadId: string, files: FileList | null) => {
    if (!files || !taxMonth || !formData.tin) return;

    const validFiles = Array.from(files).filter((file) => {
      if (!isValidFile(file)) {
        alert(
          `${file.name} is not a valid file type. Only JPEG, PNG, GIF, WebP, and PDF files are allowed.`
        );
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    if (!process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR) {
      alert(
        "API endpoint not configured. Please check NEXT_PUBLIC_NEXT_API_ROUTE_LR environment variable."
      );
      return;
    }

    setFileUploads((prev) =>
      prev.map((upload) =>
        upload.id === uploadId ? { ...upload, uploading: true } : upload
      )
    );

    try {
      const currentUpload = fileUploads.find((u) => u.id === uploadId);
      const existingFileCount = currentUpload?.uploadedUrls.length || 0;

      const uploadPromises = validFiles.map(async (file, index) => {
        return await uploadToS3API(
          file,
          taxMonth,
          formData.tin,
          uploadId,
          existingFileCount + index
        );
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      setFileUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId
            ? {
              ...upload,
              files: [...upload.files, ...validFiles],
              uploadedUrls: [...upload.uploadedUrls, ...uploadedUrls],
              uploading: false,
            }
            : upload
        )
      );
    } catch (error) {
      console.error("Error uploading files:", error);
      alert(
        `Error uploading files: ${error instanceof Error ? error.message : "Unknown error"
        }. Please try again.`
      );

      setFileUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId ? { ...upload, uploading: false } : upload
        )
      );
    }
  };

  // Remove uploaded file
  const removeFile = (uploadId: string, fileIndex: number) => {
    setFileUploads((prev) =>
      prev.map((upload) =>
        upload.id === uploadId
          ? {
            ...upload,
            files: upload.files.filter((_, index) => index !== fileIndex),
            uploadedUrls: upload.uploadedUrls.filter(
              (_, index) => index !== fileIndex
            ),
          }
          : upload
      )
    );
  };

  // Check if required files are uploaded (currently none are required)
  const areRequiredFilesUploaded = (): boolean => {
    return true;
  };

  // Function to handle taxpayer listing creation or retrieval
  const getOrCreateTaxpayerListing = async (tinData: {
    tin: string;
    name: string;
    substreet_street_brgy: string;
    district_city_zip: string;
  }) => {
    try {
      // First, check if taxpayer already exists
      const { data: existingTaxpayer, error: searchError } = await supabase
        .from("taxpayer_listings")
        .select("id")
        .eq("tin", tinData.tin.replace(/[^0-9]/g, "")) // Remove dashes for comparison
        .single();

      if (searchError && searchError.code !== "PGRST116") {
        // PGRST116 is "not found" error, which is expected if taxpayer doesn't exist
        throw searchError;
      }

      // If taxpayer exists, return the existing ID
      if (existingTaxpayer) {
        return existingTaxpayer.id;
      }

      // If taxpayer doesn't exist, create a new one
      const { data: newTaxpayer, error: insertError } = await supabase
        .from("taxpayer_listings")
        .insert([
          {
            tin: tinData.tin.replace(/[^0-9]/g, ""), // Store TIN without dashes
            registered_name: tinData.name,
            substreet_street_brgy: tinData.substreet_street_brgy,
            district_city_zip: tinData.district_city_zip,
            type: "sales", // Default type for sales records
            date_added: format(new Date(), "yyyy-MM-dd"),
            user_uuid: user?.id || null,
          },
        ])
        .select("id")
        .single();

      if (insertError) throw insertError;

      return newTaxpayer.id;
    } catch (error) {
      console.error("Error handling taxpayer listing:", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !taxMonth) {
      alert("Please select a Tax Month.");
      return;
    }

    if (!areRequiredFilesUploaded()) {
      alert("Please upload required files");
      return;
    }

    setLoading(true);
    // Gather all file attachment URLs
    const fileMeta: Record<string, string[]> = {};
    fileUploads.forEach((upload) => {
      if (upload.uploadedUrls.length > 0) {
        fileMeta[upload.id] = upload.uploadedUrls;
      }
    });
    // Log notification/audit entry for all roles after successful sales record creation
    try {
      await logNotification(supabase, {
        action: "add_sales_record",
        description: `Sales record added for TIN ${formData.tin} by ${user?.user_metadata?.role || "unknown role"}`,
        ip_address: null,
        location: null,
        meta: JSON.stringify({
          user_id: user.id,
          role: user?.user_metadata?.role || "unknown",
          tin: formData.tin,
          name: formData.name,
          tax_month: taxMonth,
          invoice_number: formData.invoice_number,
          sale_type: formData.sale_type,
          gross_taxable: formData.gross_taxable,
          total_actual_amount: formData.total_actual_amount,
          file_attachments: fileMeta,
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        user_email: profile.email,
        user_name: profile.full_name || profile.first_name || profile.id,
        user_uuid: profile.id,
      });
    } catch (logError) {
      console.error("Error logging notification:", logError);
      // Do not block user on logging failure
    }
    try {
      // Get or create taxpayer listing
      const taxpayerListingId = await getOrCreateTaxpayerListing({
        tin: formData.tin,
        name: formData.name,
        substreet_street_brgy: formData.substreet_street_brgy,
        district_city_zip: formData.district_city_zip,
      });

      // Prepare file URLs from uploads
      const fileArrays = {
        cheque: fileUploads.find((f) => f.id === "cheque")?.uploadedUrls || [],
        voucher:
          fileUploads.find((f) => f.id === "voucher")?.uploadedUrls || [],
        invoice:
          fileUploads.find((f) => f.id === "invoice")?.uploadedUrls || [],
        doc_2307:
          fileUploads.find((f) => f.id === "doc_2307")?.uploadedUrls || [],
        deposit_slip:
          fileUploads.find((f) => f.id === "deposit_slip")?.uploadedUrls || [],
      };

      const salesData = {
        user_uuid: user.id,
        tin_id: taxpayerListingId,
        tax_month: taxMonth,
        tin: formData.tin,
        name: formData.name,
        substreet_street_brgy: formData.substreet_street_brgy,
        district_city_zip: formData.district_city_zip,
        tax_type: formData.tax_type,
        sale_type: formData.sale_type,
        gross_taxable: formData.gross_taxable
          ? Number.parseFloat(removeCommas(formData.gross_taxable))
          : null,
        total_actual_amount: formData.total_actual_amount
          ? Number.parseFloat(removeCommas(formData.total_actual_amount))
          : null,
        invoice_number: formData.invoice_number || null,
        pickup_date: pickupDate ? format(pickupDate, "yyyy-MM-dd") : null,
        cheque: fileArrays.cheque.length > 0 ? fileArrays.cheque : null,
        voucher: fileArrays.voucher.length > 0 ? fileArrays.voucher : null,
        invoice: fileArrays.invoice.length > 0 ? fileArrays.invoice : null,
        doc_2307: fileArrays.doc_2307.length > 0 ? fileArrays.doc_2307 : null,
        deposit_slip:
          fileArrays.deposit_slip.length > 0 ? fileArrays.deposit_slip : null,
      };

      const { error } = await supabase.from("sales").insert([salesData]);

      if (error) throw error;

      // Reset form
      setFormData({
        tin: "",
        name: "",
        substreet_street_brgy: "",
        district_city_zip: "",
        tax_type: "",
        sale_type: "invoice",
        gross_taxable: "",
        total_actual_amount: "",
        invoice_number: "",
      });
      setTaxMonth("");
      setPickupDate(undefined);
      setTaxpayerSuggestions([]);
      setShowSuggestions(false);
      setFileUploads((prev) =>
        prev.map((upload) => ({
          ...upload,
          files: [],
          uploadedUrls: [],
        }))
      );
      setOpen(false);
      onSalesAdded();
    } catch (error) {
      console.error("Error adding sales record:", error);
      alert("Error adding sales record. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const FileUploadArea = ({ upload }: { upload: FileUpload }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-[#001f3f]">
        {upload.name} {upload.required && "*"}
      </Label>

      {/* Uploaded Files */}
      {upload.files.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-[#001f3f]/60">Uploaded Files:</div>
          {upload.files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-green-50 p-2 rounded text-xs"
            >
              <span className="truncate flex-1 text-[#001f3f]">
                {file.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(upload.id, index)}
                className="h-6 w-6 p-0 hover:bg-red-100"
                disabled={upload.uploading}
              >
                <X className="h-3 w-3 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div className="border-2 border-dashed border-[#001f3f] rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => handleFileUpload(upload.id, e.target.files)}
          className="hidden"
          id={`file-${upload.id}`}
          disabled={upload.uploading || !taxMonth || !formData.tin}
        />
        <label
          htmlFor={`file-${upload.id}`}
          className={`cursor-pointer ${upload.uploading || !taxMonth || !formData.tin
            ? "opacity-50 cursor-not-allowed"
            : ""
            }`}
        >
          {upload.uploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-sm text-blue-600">Uploading...</p>
            </>
          ) : (
            <>
              <Upload className="mx-auto h-8 w-8 text-[#001f3f] mb-2" />
              <p className="text-sm text-[#001f3f]/60">
                {!taxMonth || !formData.tin
                  ? "Select tax month & TIN first"
                  : "Click to upload files"}
                <br />
                <span className="block mt-1">
                  Accepted: <span className="font-semibold">Image</span> or{" "}
                  <span className="font-semibold">PDF</span> files
                </span>
              </p>
            </>
          )}
        </label>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Sales Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#001f3f]">
            Add Sales Record
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="tax_month"
                className="text-sm font-medium text-[#001f3f]"
              >
                Tax Month *
              </Label>
              <Select value={taxMonth} onValueChange={setTaxMonth} required>
                <SelectTrigger className="w-full bg-white text-[#001f3f] border-[#001f3f]">
                  <SelectValue placeholder="Select tax month..." />
                </SelectTrigger>
                <SelectContent>
                  {taxMonthOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-white"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="tax_type"
                className="text-sm font-medium text-[#001f3f]"
              >
                Tax Type *
              </Label>
              <Select
                value={formData.tax_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, tax_type: value })
                }
              >
                <SelectTrigger className="bg-white text-[#001f3f] border-[#001f3f]">
                  <SelectValue placeholder="Select tax type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat" className="text-white">
                    VAT
                  </SelectItem>
                  <SelectItem value="non-vat" className="text-white">
                    Non-VAT
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="sale_type"
                className="text-sm font-medium text-[#001f3f]"
              >
                Sale Type *
              </Label>
              <Select
                value={formData.sale_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, sale_type: value })
                }
              >
                <SelectTrigger className="bg-white text-[#001f3f] border-[#001f3f]">
                  <SelectValue placeholder="Select sale type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice" className="text-white">
                    Invoice
                  </SelectItem>
                  <SelectItem value="non-invoice" className="text-white">
                    Non-Invoice
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <hr />
          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label
                htmlFor="tin"
                className="text-sm font-medium text-[#001f3f]"
              >
                TIN # *
              </Label>
              <Input
                id="tin"
                name="tin_random_1"
                value={formData.tin}
                onChange={(e) => handleTinChange(e.target.value)}
                placeholder="000-000-000-000..."
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
                onFocus={() => {
                  if (taxpayerSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              {showSuggestions && taxpayerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#001f3f] rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {taxpayerSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-3 hover:bg-[#e6f0ff] cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => handleSuggestionSelect(suggestion)}
                    >
                      <div className="font-medium text-[#001f3f]">
                        {formatTinDisplay(suggestion.tin)}
                      </div>
                      <div className="text-sm text-[#001f3f]/80">
                        {suggestion.registered_name}
                      </div>
                      <div className="text-xs text-[#001f3f]/60">
                        {suggestion.substreet_street_brgy},{" "}
                        {suggestion.district_city_zip}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label
                htmlFor="name"
                className="text-sm font-medium text-[#001f3f]"
              >
                Name *
              </Label>
              <Input
                id="name"
                name="name_random_2"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  // Trigger name search
                  const value = e.target.value;
                  if (value.length >= 3) {
                    searchTaxpayersByName(value);
                  } else {
                    setNameSuggestions([]);
                    setShowNameSuggestions(false);
                  }
                }}
                placeholder="Company/Individual name"
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
                onFocus={() => {
                  if (nameSuggestions.length > 0) {
                    setShowNameSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowNameSuggestions(false), 200);
                }}
              />
              {showNameSuggestions && nameSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#001f3f] rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {nameSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-3 hover:bg-[#e6f0ff] cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => handleNameSuggestionSelect(suggestion)}
                    >
                      <div className="font-medium text-[#001f3f]">
                        {suggestion.registered_name}
                      </div>
                      <div className="text-sm text-[#001f3f]/80">
                        TIN: {formatTinDisplay(suggestion.tin)}
                      </div>
                      <div className="text-xs text-[#001f3f]/60">
                        {suggestion.substreet_street_brgy},{" "}
                        {suggestion.district_city_zip}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="substreet_street_brgy"
                className="text-sm font-medium text-[#001f3f]"
              >
                Substreet/Street/Barangay
              </Label>
              <Input
                id="substreet_street_brgy"
                name="substreet_random_3"
                value={formData.substreet_street_brgy}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    substreet_street_brgy: e.target.value,
                  })
                }
                placeholder="Address details"
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="district_city_zip"
                className="text-sm font-medium text-[#001f3f]"
              >
                District/City/ZIP
              </Label>
              <Input
                id="district_city_zip"
                name="district_random_4"
                value={formData.district_city_zip}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    district_city_zip: e.target.value,
                  })
                }
                placeholder="City and ZIP code"
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Third Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="gross_taxable"
                className="text-sm font-medium text-[#001f3f]"
              >
                Gross Taxable *
              </Label>
              <Input
                id="gross_taxable"
                name="gross_random_5"
                type="text"
                value={formatNumberWithCommas(formData.gross_taxable)}
                onChange={(e) => {
                  const rawValue = removeCommas(e.target.value);
                  // Allow empty string, integers, and decimals (including trailing decimal point)
                  if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
                    setFormData({ ...formData, gross_taxable: rawValue });
                  }
                }}
                placeholder="0"
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="total_actual_amount"
                className="text-sm font-medium text-[#001f3f]"
              >
                Total Actual Amount
              </Label>
              <Input
                id="total_actual_amount"
                name="total_random_6"
                type="text"
                value={formatNumberWithCommas(formData.total_actual_amount)}
                onChange={(e) => {
                  const rawValue = removeCommas(e.target.value);
                  // Allow empty string, integers, and decimals (including trailing decimal point)
                  if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
                    setFormData({ ...formData, total_actual_amount: rawValue });
                  }
                }}
                placeholder="0"
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="invoice_number"
                className="text-sm font-medium text-[#001f3f]"
              >
                Invoice Number
              </Label>
              <Input
                id="invoice_number"
                name="invoice_random_7"
                value={formData.invoice_number}
                onChange={(e) =>
                  setFormData({ ...formData, invoice_number: e.target.value })
                }
                placeholder="Invoice number"
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="pickup_date"
                className="text-sm font-medium text-[#001f3f]"
              >
                Pickup Date
              </Label>
              <Input
                type="date"
                name="pickup_random_8"
                id="pickup_date"
                value={pickupDate ? format(pickupDate, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  if (!isNaN(newDate.getTime())) {
                    setPickupDate(newDate);
                  }
                }}
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
                min="1900-01-01"
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>

          {/* File Uploads Section */}
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-[#001f3f] mb-4">
                File Uploads (Images and PDF Accepted)
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Required:</span> None |{" "}
                  <span className="font-medium">Optional:</span> Voucher,
                  Deposit Slip, Cheque, Invoice, Doc 2307
                </p>
              </div>
            </div>

            {/* File upload areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fileUploads.map((upload) => (
                <FileUploadArea key={upload.id} upload={upload} />
              ))}
            </div>
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="px-6 border-[#001f3f] text-white hover:bg-[#001f3f]/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || fileUploads.some((f) => f.uploading)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6"
            >
              {loading ? "Adding..." : "Add Sales Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
