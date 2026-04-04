import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const checks = { status: 'ok', timestamp: new Date().toISOString(), services: {} };

  // Supabase connectivity
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const supabase = createClient(url, key);
      const start = Date.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      checks.services.supabase = { status: error ? 'degraded' : 'ok', latency: Date.now() - start + 'ms' };
    } else {
      checks.services.supabase = { status: 'not_configured' };
    }
  } catch {
    checks.services.supabase = { status: 'down' };
    checks.status = 'degraded';
  }

  // Gemini API key present
  checks.services.gemini = { status: process.env.GOOGLE_API_KEY ? 'configured' : 'not_configured' };

  const httpStatus = checks.status === 'ok' ? 200 : 503;
  return NextResponse.json(checks, { status: httpStatus });
}
