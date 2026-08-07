export async function POST(req) {
  return Response.json({ error: "Activation is no longer required. Please login using your Mobile Number and Date of Birth." }, { status: 410 });
}
