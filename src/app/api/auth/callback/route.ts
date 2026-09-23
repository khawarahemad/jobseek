import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jobseek.khawarahemad.com";
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${appUrl}/api/auth/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    // In a production app with multiple users, you'd save this to the Database.
    // Since this is your personal CRM, we automatically inject the Refresh Token into your .env!
    if (tokens.refresh_token) {
      try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf8');
          if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
            envContent = envContent.replace(
              /GOOGLE_REFRESH_TOKEN=.*/g, 
              `GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`
            );
          } else {
            envContent += `\nGOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`;
          }
          fs.writeFileSync(envPath, envContent);
        }
      } catch (err) {
        console.warn('Could not write to local .env (container environment):', err);
      }
    }

    // Redirect back to settings page with success
    return NextResponse.redirect(`${appUrl}/dashboard/settings?oauth=success`);
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    const fallbackAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "https://jobseek.khawarahemad.com";
    return NextResponse.redirect(`${fallbackAppUrl}/dashboard/settings?oauth=error`);
  }
}
