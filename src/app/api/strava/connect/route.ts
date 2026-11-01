import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;

  if (!clientId || clientId === 'tu_strava_client_id') {
    return NextResponse.redirect(`${origin}/?stravaSetup=pending`);
  }

  const redirectUri = `${origin}/api/strava/callback`;
  const scope = 'read,activity:read_all';
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(
    clientId
  )}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&approval_prompt=auto&scope=${encodeURIComponent(scope)}`;

  return NextResponse.redirect(authUrl);
}
