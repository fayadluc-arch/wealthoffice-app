import { NextResponse } from 'next/server';
import JSZip from 'jszip';

// CVM FII Reports — Benchmark de Fundos Imobiliários
// Fonte: dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/
//
// ZIP contains 3 CSVs:
//   geral: Nome_Fundo_Classe, CNPJ_Fundo_Classe, Segmento_Atuacao, Mandato
//   complemento: Patrimonio_Liquido, Total_Numero_Cotistas, Percentual_Dividend_Yield_Mes
//   ativo_passivo: detailed asset breakdown

const BASE_URL = 'https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS';

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(';').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

async function fetchYear(year) {
  const url = `${BASE_URL}/inf_mensal_fii_${year}.zip`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    // Extract geral + complemento CSVs
    let geralFile = null, compFile = null;
    for (const name of Object.keys(zip.files)) {
      if (name.includes('geral') && name.endsWith('.csv')) geralFile = zip.files[name];
      if (name.includes('complemento') && name.endsWith('.csv')) compFile = zip.files[name];
    }
    if (!compFile) return null;

    const compRaw = await compFile.async('uint8array');
    const compText = new TextDecoder('latin1').decode(compRaw);
    const compRows = parseCSV(compText);

    let geralRows = [];
    if (geralFile) {
      const geralRaw = await geralFile.async('uint8array');
      const geralText = new TextDecoder('latin1').decode(geralRaw);
      geralRows = parseCSV(geralText);
    }

    return { compRows, geralRows };
  } catch (err) {
    console.error(`[cvm-fii] fetch ${year} error:`, err.message);
    return null;
  }
}

export async function GET() {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();

    const [curr, prev] = await Promise.allSettled([
      fetchYear(currentYear),
      fetchYear(currentYear - 1),
    ]);

    const currData = curr.status === 'fulfilled' ? curr.value : null;
    const prevData = prev.status === 'fulfilled' ? prev.value : null;

    if (!currData && !prevData) {
      return NextResponse.json({ erro: 'Nenhum dado FII encontrado', totalFundos: 0 });
    }

    // Build name/segment lookup from geral
    const infoMap = {};
    const allGeral = [...(currData?.geralRows || []), ...(prevData?.geralRows || [])];
    for (const r of allGeral) {
      const cnpj = r.CNPJ_Fundo_Classe || '';
      if (!infoMap[cnpj]) {
        infoMap[cnpj] = {
          nome: r.Nome_Fundo_Classe || '',
          segmento: r.Segmento_Atuacao || '',
          mandato: r.Mandato || '',
        };
      }
    }

    // Process complemento (has PL, DY, cotistas)
    const allComp = [...(currData?.compRows || []), ...(prevData?.compRows || [])];

    // Group by month
    const byMonth = {};
    for (const r of allComp) {
      const dt = r.Data_Referencia || '';
      const m = dt.substring(0, 7); // YYYY-MM
      if (!m || m.length < 7) continue;
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(r);
    }

    const sortedMonths = Object.keys(byMonth).sort().reverse();
    if (!sortedMonths.length) {
      return NextResponse.json({ erro: 'Sem meses disponíveis', totalFundos: 0 });
    }

    // Latest month analysis
    const latestMonth = sortedMonths[0];
    const latestRows = byMonth[latestMonth];

    // Deduplicate by CNPJ (take highest PL)
    const uniqueFunds = {};
    for (const r of latestRows) {
      const cnpj = r.CNPJ_Fundo_Classe || '';
      const pl = parseFloat(r.Patrimonio_Liquido || 0);
      if (!uniqueFunds[cnpj] || pl > (uniqueFunds[cnpj].pl || 0)) {
        const info = infoMap[cnpj] || {};
        const dy = parseFloat(r.Percentual_Dividend_Yield_Mes || 0);
        uniqueFunds[cnpj] = {
          cnpj,
          nome: info.nome || cnpj,
          pl,
          cotistas: parseInt(r.Total_Numero_Cotistas || 0),
          dyMes: dy * 100, // stored as decimal
          segmento: info.segmento || 'Outros',
        };
      }
    }

    const funds = Object.values(uniqueFunds).filter(f => f.pl > 0);
    const plTotal = funds.reduce((s, f) => s + f.pl, 0);
    const dySum = funds.reduce((s, f) => s + f.dyMes, 0);
    const dyMedio = funds.length > 0 ? (dySum / funds.length) * 12 : 0; // annualized

    // Segment breakdown
    const segMap = {};
    for (const f of funds) {
      const seg = f.segmento || 'Outros';
      if (!segMap[seg]) segMap[seg] = { nome: seg, fundos: 0, pl: 0, dySum: 0 };
      segMap[seg].fundos++;
      segMap[seg].pl += f.pl;
      segMap[seg].dySum += f.dyMes;
    }
    const segmentos = Object.values(segMap)
      .map(s => ({ ...s, yieldMed: s.fundos > 0 ? (s.dySum / s.fundos) * 12 : 0 }))
      .sort((a, b) => b.pl - a.pl);

    // Top funds by PL
    const topFundos = funds
      .map(f => ({
        cnpj: f.cnpj,
        nome: f.nome,
        pl: f.pl,
        cotistas: f.cotistas,
        yieldMes: f.dyMes,
        yieldAnual: f.dyMes * 12,
        segmento: f.segmento,
      }))
      .sort((a, b) => b.pl - a.pl)
      .slice(0, 15);

    // Historical (last 12 months)
    const historico = sortedMonths.slice(0, 12).map(m => {
      const rows = byMonth[m];
      const pl = rows.reduce((s, r) => s + parseFloat(r.Patrimonio_Liquido || 0), 0);
      const dys = rows.map(r => parseFloat(r.Percentual_Dividend_Yield_Mes || 0) * 100).filter(d => d > 0);
      const avgDy = dys.length > 0 ? (dys.reduce((s, d) => s + d, 0) / dys.length) * 12 : 0;
      return { mes: m, plTotal: pl, yieldMedio: avgDy, fundos: rows.length };
    }).reverse();

    return NextResponse.json({
      referencia: latestMonth,
      totalFundos: funds.length,
      plTotal,
      dividendYieldMedio: dyMedio,
      segmentos,
      topFundos,
      historico,
    });
  } catch (err) {
    console.error('[cvm-fii] error:', err.message);
    return NextResponse.json({ erro: 'Erro ao carregar dados CVM FII' }, { status: 500 });
  }
}
