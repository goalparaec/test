import { NextResponse } from "next/server";
import { downloadDailyPerformanceReport } from "../../../lib/apdcl";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request) {
  let reportDate;

  try {
    const body = await request.json();
    reportDate = body?.reportDate;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate || "")) {
      return NextResponse.json(
        { error: "reportDate must be in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "apdcl-reports";

    // Create bucket if it does not exist. This is safe to call repeatedly.
    // If your project disallows bucket creation through this key, create it
    // manually in Storage and remove this block.
    await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: "50MB"
    }).catch(() => {});

    const result = await downloadDailyPerformanceReport(reportDate);

    const safeName = result.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath =
      `daily-performance/${reportDate}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, result.fileBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: row, error: dbError } = await supabase
      .from("report_downloads")
      .insert({
        report_name: "Daily Performance Report",
        report_date: reportDate,
        file_name: safeName,
        storage_path: storagePath,
        status: "downloaded"
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      report: row
    });
  } catch (error) {
    console.error("REPORT DOWNLOAD ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Report download failed."
      },
      { status: 500 }
    );
  }
}
