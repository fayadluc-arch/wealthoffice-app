import { NextResponse } from 'next/server';

const DATAJUD_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

// Map tribunal siglas to DataJud endpoints
const TRIBUNAL_ENDPOINTS = {
  'TJSP': 'api_publica_tjsp',
  'TJRJ': 'api_publica_tjrj',
  'TJMG': 'api_publica_tjmg',
  'TJRS': 'api_publica_tjrs',
  'TJPR': 'api_publica_tjpr',
  'TJSC': 'api_publica_tjsc',
  'TJBA': 'api_publica_tjba',
  'TJPE': 'api_publica_tjpe',
  'TJCE': 'api_publica_tjce',
  'TJGO': 'api_publica_tjgo',
  'TJDF': 'api_publica_tjdf',
  'TRF1': 'api_publica_trf1',
  'TRF2': 'api_publica_trf2',
  'TRF3': 'api_publica_trf3',
  'TRF4': 'api_publica_trf4',
  'TRF5': 'api_publica_trf5',
  'TRF6': 'api_publica_trf6',
  'STJ': 'api_publica_stj',
  'STF': 'api_publica_stf',
};

// Detect tribunal from CNJ number (format: NNNNNNN-DD.AAAA.J.TR.OOOO)
function detectTribunal(cnj) {
  if (!cnj) return null;
  const parts = cnj.replace(/[^\d.]/g, '').split('.');
  if (parts.length < 4) return null;
  const justica = parts[2]; // J = justice segment
  const tribunal = parts[3]; // TR = tribunal code

  // Justice 8 = Estadual
  if (justica === '8') {
    const map = { '26': 'TJSP', '19': 'TJRJ', '13': 'TJMG', '21': 'TJRS', '16': 'TJPR', '24': 'TJSC', '05': 'TJBA', '17': 'TJPE', '06': 'TJCE', '09': 'TJGO', '07': 'TJDF' };
    return map[tribunal] || 'TJSP';
  }
  // Justice 4 = Federal
  if (justica === '4') {
    const map = { '01': 'TRF1', '02': 'TRF2', '03': 'TRF3', '04': 'TRF4', '05': 'TRF5', '06': 'TRF6' };
    return map[tribunal] || 'TRF3';
  }
  // Justice 2 = STJ/STF
  if (justica === '2') return 'STJ';
  if (justica === '1') return 'STF';
  return 'TJSP';
}

// Query DataJud with a specific tribunal endpoint
async function queryDatajud(endpoint, numeroProcesso) {
  const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `APIKey ${DATAJUD_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { match: { numeroProcesso } } }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hits = data.hits?.hits || [];
  const total = data.hits?.total?.value || 0;
  return total > 0 ? { hits, total } : null;
}

export async function POST(request) {
  try {
    const { cnj, tribunal: tribunalHint } = await request.json();
    if (!cnj) return NextResponse.json({ error: 'CNJ é obrigatório' }, { status: 400 });

    // Strip suffix like /0005, /27, /0001 etc
    const baseCnj = cnj.split('/')[0].trim();
    const cleanCnj = baseCnj.replace(/[^\d.-]/g, '');
    const digits = cleanCnj.replace(/[^\d]/g, '');

    const tribunal = tribunalHint || detectTribunal(cleanCnj);
    const endpoint = TRIBUNAL_ENDPOINTS[tribunal] || 'api_publica_tjsp';

    // Try 1: detected tribunal with full digits
    let result = await queryDatajud(endpoint, digits);
    if (result) {
      return NextResponse.json({ tribunal, data: result.hits, total: result.total });
    }

    // Try 2: first 20 digits only (strip suffix noise)
    if (digits.length > 20) {
      result = await queryDatajud(endpoint, digits.substring(0, 20));
      if (result) return NextResponse.json({ tribunal, data: result.hits, total: result.total });
    }

    // Try 3: TJSP fallback (largest tribunal, many processes)
    if (endpoint !== 'api_publica_tjsp') {
      result = await queryDatajud('api_publica_tjsp', digits);
      if (result) return NextResponse.json({ tribunal: 'TJSP', data: result.hits, total: result.total });
      // Also try with 20 digits
      if (digits.length > 20) {
        result = await queryDatajud('api_publica_tjsp', digits.substring(0, 20));
        if (result) return NextResponse.json({ tribunal: 'TJSP', data: result.hits, total: result.total });
      }
    }

    // Try 4: TRF1 fallback (federal)
    if (endpoint !== 'api_publica_trf1') {
      result = await queryDatajud('api_publica_trf1', digits.substring(0, 20));
      if (result) return NextResponse.json({ tribunal: 'TRF1', data: result.hits, total: result.total });
    }

    return NextResponse.json({ tribunal, data: [], total: 0 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
