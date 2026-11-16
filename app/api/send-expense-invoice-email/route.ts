import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Exclusive recipient for now as requested
const EXCLUSIVE_BOSS_EMAIL = "johnryfibra2@gmail.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceId, pdfBase64, baseUrl } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    // Fetch invoice from database
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from("expense_request_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json(
        { error: fetchError?.message || "Expense invoice not found" },
        { status: 404 }
      );
    }

    // Ensure approval_token exists
    let approvalToken = invoice.approval_token;
    if (!approvalToken) {
      approvalToken = uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, "");
      await supabaseAdmin
        .from("expense_request_invoices")
        .update({ approval_token: approvalToken })
        .eq("id", invoiceId);
    }

    // Determine origin URL for the no-login approval link
    const origin =
      baseUrl ||
      request.headers.get("origin") ||
      (request.headers.get("host")
        ? `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`
        : "http://localhost:3000");

    const approvalUrl = `${origin.replace(/\/$/, "")}/expense-approval/${approvalToken}`;

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const currency = invoice.currency || "PHP";
    const formatAmount = (num: number) =>
      new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: currency === "AED" ? "AED" : "PHP",
      }).format(Number(num) || 0);

    const itemsHtml = items
      .map(
        (item: any, idx: number) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 14px; font-size: 14px; color: #334155;">${idx + 1}</td>
          <td style="padding: 12px 14px; font-size: 14px; color: #0f172a; font-weight: 600;">
            ${item.item_name || item.description || "Expense Item"}
            ${
              item.supplier_name || item.name
                ? `<div style="font-size: 12px; color: #64748b; font-weight: 400; margin-top: 2px;">Payee/Supplier: ${item.supplier_name || item.name}${item.tin ? ` (TIN: ${item.tin})` : ""}</div>`
                : ""
            }
          </td>
          <td style="padding: 12px 14px; font-size: 13px; color: #475569; text-align: center;">
            ${item.category_name || item.tax_type?.toUpperCase() || "-"}
          </td>
          <td style="padding: 12px 14px; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right;">
            ${formatAmount(item.amount ?? item.total_actual_amount ?? item.gross_taxable ?? 0)}
          </td>
        </tr>
      `
      )
      .join("");

    const formattedDate = invoice.invoice_date
      ? new Date(invoice.invoice_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Expense Request Invoice #${invoice.invoice_number}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 680px; margin: 32px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, #001f3f 0%, #0f3460 100%); padding: 28px 32px; color: #ffffff;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #93c5fd; font-weight: 700; margin-bottom: 6px;">
                    ${invoice.company_name || "LEUTERIO REALTY & BROKERAGE"}
                  </div>
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.3px;">
                    EXPENSE REQUEST INVOICE
                  </h1>
                  <p style="margin: 6px 0 0 0; font-size: 14px; color: #cbd5e1;">
                    Invoice #<strong>${invoice.invoice_number}</strong> &bull; ${formattedDate}
                  </p>
                </div>
              </div>
            </div>

            <!-- Main Body -->
            <div style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                Dear <strong>Sir Anthony Gerard Leuterio</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                An itemized <strong>Expense Request Invoice</strong> has been submitted for your review and signature approval. You may review the itemized breakdown below and sign directly using the secure one-click approval button (no login required), or from your exclusive dashboard page.
              </p>

              <!-- Summary Metadata Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 4px 0; font-size: 13px; color: #64748b; width: 40%;">Invoice Number:</td>
                    <td style="padding: 4px 0; font-size: 14px; color: #0f172a; font-weight: 700;">#${invoice.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Requested By:</td>
                    <td style="padding: 4px 0; font-size: 14px; color: #0f172a; font-weight: 600;">
                      ${invoice.requested_by_name || "Accounting / Secretary"} ${invoice.assigned_area ? `(${invoice.assigned_area})` : ""}
                    </td>
                  </tr>
                  ${
                    invoice.payee_name
                      ? `<tr>
                          <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Payee / Vendor:</td>
                          <td style="padding: 4px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${invoice.payee_name}</td>
                        </tr>`
                      : ""
                  }
                  ${
                    invoice.purpose
                      ? `<tr>
                          <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Purpose / Remarks:</td>
                          <td style="padding: 4px 0; font-size: 14px; color: #334155;">${invoice.purpose}</td>
                        </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding: 8px 0 4px 0; font-size: 14px; color: #0f172a; font-weight: 700;">Total Expense Amount:</td>
                    <td style="padding: 8px 0 4px 0; font-size: 18px; color: #0284c7; font-weight: 800;">
                      ${formatAmount(invoice.total || 0)}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Itemized Table -->
              <div style="margin-bottom: 28px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; color: #475569;">
                  Itemized Expense Breakdown (${items.length} ${items.length === 1 ? "Item" : "Items"})
                </h3>
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #001f3f; color: #ffffff;">
                      <th style="padding: 10px 14px; font-size: 12px; text-align: left; text-transform: uppercase;">#</th>
                      <th style="padding: 10px 14px; font-size: 12px; text-align: left; text-transform: uppercase;">Item / Particulars</th>
                      <th style="padding: 10px 14px; font-size: 12px; text-align: center; text-transform: uppercase;">Category / Tax</th>
                      <th style="padding: 10px 14px; font-size: 12px; text-align: right; text-transform: uppercase;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                  <tfoot>
                    <tr style="background-color: #f8fafc; border-top: 2px solid #cbd5e1;">
                      <td colspan="3" style="padding: 14px; font-size: 15px; font-weight: 700; color: #0f172a; text-align: right;">
                        TOTAL AMOUNT:
                      </td>
                      <td style="padding: 14px; font-size: 16px; font-weight: 800; color: #001f3f; text-align: right;">
                        ${formatAmount(invoice.total || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Call to Action Button -->
              <div style="text-align: center; margin: 32px 0 24px 0;">
                <a
                  href="${approvalUrl}"
                  target="_blank"
                  style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 8px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);"
                >
                  Review &amp; Sign Expense Invoice &rarr;
                </a>
                <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b;">
                  No login required &bull; Click above to open the invoice and sign directly
                </p>
              </div>

              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #64748b; line-height: 1.5;">
                <div>If the button above does not work, copy and paste this link into your browser:</div>
                <a href="${approvalUrl}" style="color: #0284c7; word-break: break-all;">${approvalUrl}</a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8;">
              Sent via ${process.env.MAIL_FROM_NAME || "LR Accounting Software"} &bull; Automated Expense Approval System
            </div>
          </div>
        </body>
      </html>
    `;

    // Configure SMTP transporter from .env
    const port = Number(process.env.MAIL_PORT) || 465;
    const secure = process.env.MAIL_ENCRYPTION === "ssl" || port === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || "smtp.hostinger.com",
      port,
      secure,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    const attachments: any[] = [];
    if (pdfBase64 && typeof pdfBase64 === "string") {
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      attachments.push({
        filename: `Expense-Invoice-${invoice.invoice_number}.pdf`,
        content: Buffer.from(cleanBase64, "base64"),
        contentType: "application/pdf",
      });
    }

    const fromName = (process.env.MAIL_FROM_NAME || "LR Accounting Software").replace(/^"|"$/g, "");
    const fromAddress = process.env.MAIL_USERNAME || process.env.MAIL_FROM || "info@filipinohomes.com";

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: EXCLUSIVE_BOSS_EMAIL,
      subject: `[Expense Approval Required] Invoice #${invoice.invoice_number} - ${formatAmount(invoice.total || 0)} (${invoice.requested_by_name || "LR Accounting"})`,
      html: htmlContent,
      attachments,
    });

    const sentAt = new Date().toISOString();

    await supabaseAdmin
      .from("expense_request_invoices")
      .update({
        sent_to_email: EXCLUSIVE_BOSS_EMAIL,
        email_sent_at: sentAt,
        updated_at: sentAt,
      })
      .eq("id", invoiceId);

    return NextResponse.json({
      success: true,
      sentTo: EXCLUSIVE_BOSS_EMAIL,
      sentAt,
      approvalUrl,
    });
  } catch (error: any) {
    console.error("Error sending expense invoice email:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send expense invoice email" },
      { status: 500 }
    );
  }
}
