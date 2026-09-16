import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "apdcl-reports";

    const { data: report, error: reportError } = await supabase
      .from("report_downloads")
      .select("*")
      .eq("id", id)
      .single();

    if (reportError) throw reportError;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(report.storage_path, 60 * 10);

    if (error) throw error;

    return NextResponse.json({
      url: data.signedUrl,
      fileName: report.file_name
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not create file URL." },
      { status: 500 }
    );
  }
}
