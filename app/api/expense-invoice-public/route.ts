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
      approvedByName = "ANTHONY GERARD LEUTERIO",
      approvedByEmail = "mindworth@gmail.com",
      signedVia = "email_link", // "email_link" | "dashboard"
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

    // Approve action requires signatureData
    if (!signatureData) {
      return NextResponse.json(
        { error: "Please provide your signature before approving the invoice." },
        { status: 400 }
      );
    }

    const updatePayload: any = {
      status: invoice.status === "converted" ? "converted" : "approved",
      signature_data: signatureData,
      signed_at: now,
      signed_via: signedVia,
      signed_ip: ipAddress,
      approved_by_name: approvedByName,
      approved_by_email: approvedByEmail,
      updated_at: now,
    };

    if (signedPdfUrl) {
      updatePayload.signed_pdf_url = signedPdfUrl;
    }

    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from("expense_request_invoices")
      .update(updatePayload)
      .eq("id", invoice.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    // Update all linked itemized expense_requests to approved
    await supabaseAdmin
      .from("expense_requests")
      .update({
        status: "approved",
        approved_at: now,
        approved_by: approvedByName,
        updated_at: now,
      })
      .eq("expense_invoice_id", invoice.id);

    if (Array.isArray(invoice.expense_request_ids) && invoice.expense_request_ids.length > 0) {
      await supabaseAdmin
        .from("expense_requests")
        .update({
          status: "approved",
          approved_at: now,
          approved_by: approvedByName,
          updated_at: now,
        })
        .in("id", invoice.expense_request_ids);
    }

    // Log notification
    await supabaseAdmin.from("notifications").insert([
      {
        action: "expense_invoice_approved",
        description: `Expense Invoice #${invoice.invoice_number} (PHP ${Number(invoice.total || 0).toLocaleString()}) was signed & approved by ${approvedByName} via ${signedVia === "email_link" ? "Email Approval Link" : "Executive Dashboard"}`,
        user_name: approvedByName,
        user_email: approvedByEmail,
        meta: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          signed_at: now,
          signed_via: signedVia,
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
