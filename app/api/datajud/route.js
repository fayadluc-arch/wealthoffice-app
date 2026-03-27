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

export async function POST(request) {
  try {
    const { cnj, tribunal: tribunalHint } = await request.json();
    if (!cnj) return NextResponse.json({ error: 'CNJ é obrigatório' }, { status: 400 });

    const cleanCnj = cnj.replace(/[^\d.-]/g, '');
    const tribunal = tribunalHint || detectTribunal(cleanCnj);
    const endpoint = TRIBUNAL_ENDPOINTS[tribunal] || 'api_publica_tjsp';

    const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;

    const body = {
      query: {
        match: {
          numeroProcesso: cleanCnj.replace(/[^\d]/g, '')
        }
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Try without tribunal-specific endpoint
      const fallbackUrl = `https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search`;
      const res2 = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Authorization': `APIKey ${DATAJUD_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res2.ok) {
        return NextResponse.json({ error: `DataJud retornou ${res2.status}`, tribunal, endpoint }, { status: 502 });
      }
      const data2 = await res2.json();
      return NextResponse.json({ tribunal: 'TJSP', data: data2.hits?.hits || [], total: data2.hits?.total?.value || 0 });
    }

    const data = await res.json();
    return NextResponse.json({
      tribunal,
      data: data.hits?.hits || [],
      total: data.hits?.total?.value || 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
