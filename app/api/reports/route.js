import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("report_downloads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ reports: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not load reports." },
      { status: 500 }
    );
  }
}
