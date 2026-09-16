import { NextResponse } from "next/server";
import { downloadTodaysDailyPerformanceReport } from "../../../lib/apdcl";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "apdcl-reports";
    const result = await downloadTodaysDailyPerformanceReport();
    const safeName = result.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `daily-performance/${result.reportDate}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(
      storagePath,
      result.fileBuffer,
      {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false
      }
    );
    if (uploadError) throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);

    const { data: row, error: dbError } = await supabase
      .from("report_downloads")
      .insert({
        report_name: "Daily Performance Report",
        report_date: result.reportDate,
        file_name: safeName,
        storage_path: storagePath,
        status: "downloaded"
      })
      .select()
      .single();

    if (dbError) throw new Error(`Database record failed: ${dbError.message}`);
    return NextResponse.json({ success: true, report: row });
  } catch (error) {
    console.error("APDCL REPORT ERROR:", error);
    return NextResponse.json({ success: false, error: error?.message || "Report download failed." }, { status: 500 });
  }
}
