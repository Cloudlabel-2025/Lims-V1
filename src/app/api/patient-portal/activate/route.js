export async function POST() {
  return Response.json({ error: "Activation is no longer required. Please login using your Mobile Number and Date of Birth." }, { status: 410 });
}
