import { NextResponse } from "next/server";
import {
  EngagementError,
  readEngagementBody,
  saveInquiry,
  validateInquiry,
} from "@/lib/engagement";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await readEngagementBody(request);
    saveInquiry(validateInquiry(body));
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof EngagementError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "We couldn't save your message. Please try again shortly." },
      { status: 503 },
    );
  }
}
