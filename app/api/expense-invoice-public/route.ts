import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const id = searchParams.get("id");

    if (!token && !id) {
      return NextResponse.json({ error: "Approval token or invoice ID is required" }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("expense_request_invoices")
      .select("*")
      .eq("is_deleted", false);

    if (token) {
      query = query.eq("approval_token", token);
    } else if (id) {
      query = query.eq("id", id);
    }

    const { data: invoice, error } = await query.single();

    if (error || !invoice) {
      return NextResponse.json(
        { error: "Expense invoice not found or link has expired." },
        { status: 404 }
      );
    }

    // Fetch linked expense_requests
    let expenseItems: any[] = [];
    if (Array.isArray(invoice.expense_request_ids) && invoice.expense_request_ids.length > 0) {
      const { data: linked } = await supabaseAdmin
        .from("expense_requests")
        .select("*")
        .in("id", invoice.expense_request_ids)
        .eq("is_deleted", false);
      if (linked) expenseItems = linked;
    } else {
      const { data: linked } = await supabaseAdmin
        .from("expense_requests")
        .select("*")
        .eq("expense_invoice_id", invoice.id)
        .eq("is_deleted", false);
      if (linked) expenseItems = linked;
    }

    return NextResponse.json({
      invoice,
      expenseItems,
    });
  } catch (error: any) {
    console.error("Error fetching public expense invoice:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load expense invoice" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      token,
      invoiceId,
      action = "approve", // "approve" | "reject"
      signatureData,
      approvalAttachments, // string[] — required when signedVia === "super_admin_attachment"
      approvedByName = "ANTHONY GERARD LEUTERIO",
      approvedByEmail = "mindworth@gmail.com",
      uploadedByName,
      uploadedByEmail,
      approvalRemarks,
      signedVia = "email_link", // "email_link" | "dashboard" | "super_admin_attachment"
      signedPdfUrl,
      rejectionReason,
    } = body;

    if (!token && !invoiceId) {
      return NextResponse.json({ error: "Token or Invoice ID is required" }, { status: 400 });
    }

    let query = supabaseAdmin
      .from("expense_request_invoices")
      .select("*")
      .eq("is_deleted", false);

    if (token) {
      query = query.eq("approval_token", token);
    } else {
      query = query.eq("id", invoiceId);
    }

    const { data: invoice, error: fetchError } = await query.single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Expense invoice not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (action === "reject") {
      const { data: updatedInvoice, error: updateError } = await supabaseAdmin
        .from("expense_request_invoices")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason || "Rejected by approver",
          approved_by_name: approvedByName,
          approved_by_email: approvedByEmail,
          signed_at: now,
          signed_via: signedVia,
          signed_ip: ipAddress,
          updated_at: now,
        })
        .eq("id", invoice.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      // Update linked expense_requests
      await supabaseAdmin
        .from("expense_requests")
        .update({
          status: "rejected",
          updated_at: now,
        })
        .eq("expense_invoice_id", invoice.id);

      if (Array.isArray(invoice.expense_request_ids) && invoice.expense_request_ids.length > 0) {
        await supabaseAdmin
          .from("expense_requests")
          .update({
            status: "rejected",
            updated_at: now,
          })
          .in("id", invoice.expense_request_ids);
      }

      // Log notification
      await supabaseAdmin.from("notifications").insert([
        {
          action: "expense_invoice_rejected",
          description: `Expense Invoice #${invoice.invoice_number} was rejected by ${approvedByName}`,
          user_name: approvedByName,
          user_email: approvedByEmail,
          meta: {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            signed_via: signedVia,
            reason: rejectionReason,
          },
        },
      ]);

      return NextResponse.json({
        success: true,
        invoice: updatedInvoice,
      });
    }

    const isManualAttachmentApproval = signedVia === "super_admin_attachment";
    const cleanedAttachments: string[] = Array.isArray(approvalAttachments)
      ? approvalAttachments.map((u: any) => String(u || "").trim()).filter(Boolean)
      : [];

    if (isManualAttachmentApproval) {
      if (cleanedAttachments.length === 0) {
        return NextResponse.json(
          { error: "Please upload at least one signed/proof attachment before approving the expense voucher." },
          { status: 400 }
        );
      }
    } else if (!signatureData) {
      // Standard executive online approval requires signatureData
      return NextResponse.json(
        { error: "Please provide your signature before approving the voucher." },
        { status: 400 }
      );
    }

    const serializedAttachments =
      cleanedAttachments.length === 1
        ? cleanedAttachments[0]
        : cleanedAttachments.length > 1
          ? JSON.stringify(cleanedAttachments)
          : null;

    const effectiveApprovedByName = isManualAttachmentApproval
      ? "ANTHONY GERARD LEUTERIO"
      : approvedByName;
    const effectiveApprovedByEmail = isManualAttachmentApproval
      ? "mindworth@gmail.com"
      : approvedByEmail;

    const manualMetaString = isManualAttachmentApproval
      ? `MANUAL_APPROVAL_META:${JSON.stringify({
          uploadedBy: String(uploadedByName || "Accounting / Super Admin").trim(),
          uploadedByEmail: String(uploadedByEmail || "").trim(),
          remarks: String(approvalRemarks || "").trim(),
        })}`
      : null;

    const updatePayload: any = {
      status: invoice.status === "converted" ? "converted" : "approved",
      signature_data: signatureData || invoice.signature_data || null,
      signed_at: now,
      signed_via: signedVia,
      signed_ip: ipAddress,
      approved_by_name: effectiveApprovedByName,
      approved_by_email: effectiveApprovedByEmail,
      ...(manualMetaString ? { rejection_reason: manualMetaString } : {}),
      updated_at: now,
    };

    if (isManualAttachmentApproval && serializedAttachments) {
      updatePayload.signed_pdf_url = serializedAttachments;
      updatePayload.approval_attachments = cleanedAttachments;
    } else if (signedPdfUrl) {
      updatePayload.signed_pdf_url = signedPdfUrl;
    }

    let { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from("expense_request_invoices")
      .update(updatePayload)
      .eq("id", invoice.id)
      .select("*")
      .single();

    if (updateError && /column .*approval_attachments.* does not exist/i.test(updateError.message || "")) {
      const { approval_attachments: _aa, ...fallbackPayload } = updatePayload;
      const retry = await supabaseAdmin
        .from("expense_request_invoices")
        .update(fallbackPayload)
        .eq("id", invoice.id)
        .select("*")
        .single();
      updatedInvoice = retry.data;
      updateError = retry.error;
    }

    if (updateError) throw updateError;

    // Update all linked itemized expense_requests to approved
    await supabaseAdmin
      .from("expense_requests")
      .update({
        status: "approved",
        approved_at: now,
        approved_by: effectiveApprovedByName,
        updated_at: now,
      })
      .eq("expense_invoice_id", invoice.id);

    if (Array.isArray(invoice.expense_request_ids) && invoice.expense_request_ids.length > 0) {
      await supabaseAdmin
        .from("expense_requests")
        .update({
          status: "approved",
          approved_at: now,
          approved_by: effectiveApprovedByName,
          updated_at: now,
        })
        .in("id", invoice.expense_request_ids);
    }

    // Log notification
    await supabaseAdmin.from("notifications").insert([
      {
        action: "expense_invoice_approved",
        description: isManualAttachmentApproval
          ? `Expense Voucher #${invoice.invoice_number} (PHP ${Number(invoice.total || 0).toLocaleString()}) was approved under ${effectiveApprovedByName} via Proof Attachment (${cleanedAttachments.length} file${cleanedAttachments.length === 1 ? "" : "s"}) recorded by ${uploadedByName || "Super Admin"}${approvalRemarks ? ` — Remarks: ${String(approvalRemarks).trim()}` : ""}`
          : `Expense Voucher #${invoice.invoice_number} (PHP ${Number(invoice.total || 0).toLocaleString()}) was approved by ${effectiveApprovedByName} via ${
              signedVia === "email_link" ? "Email Approval Link" : "Executive Dashboard"
            }`,
        user_name: isManualAttachmentApproval ? (uploadedByName || "Super Admin") : effectiveApprovedByName,
        user_email: isManualAttachmentApproval ? (uploadedByEmail || effectiveApprovedByEmail) : effectiveApprovedByEmail,
        meta: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          signed_at: now,
          signed_via: signedVia,
          approved_by_name: effectiveApprovedByName,
          uploaded_by_name: uploadedByName || null,
          approval_remarks: approvalRemarks || null,
          approval_attachments: cleanedAttachments,
          total: invoice.total,
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
    });
  } catch (error: any) {
    console.error("Error processing expense invoice signature:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process signature approval" },
      { status: 500 }
    );
  }
}
