/** Compatibility for saved preview links; /home owns the complete homepage. */
export function GET(request: Request) {
  const destination = new URL(request.url);
  destination.pathname = '/home';
  return Response.redirect(destination, 308);
}
