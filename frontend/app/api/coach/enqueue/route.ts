export async function POST(req: Request) {
    const body = await req.json();
  
    const res = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/coach-workout-enqueue`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": process.env.COACH_INTERNAL_SECRET!, // секрет
        },
        body: JSON.stringify(body),
      }
    );
  
    const json = await res.json();
    return Response.json(json, { status: res.status });
  }