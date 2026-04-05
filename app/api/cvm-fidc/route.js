import { NextResponse } from 'next/server';
import JSZip from 'jszip';

// CVM FIDC Reports — Benchmark de FIDCs (crédito judicial / precatórios)
// Fonte: dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/
//
// CSV tab_I columns: TP_FUNDO_CLASSE, CNPJ_FUNDO_CLASSE, DENOM_SOCIAL,
//   DT_COMPTC, TAB_I_VL_ATIVO, etc.
// CSV tab_X columns: quota info (VL_COTA, NR_COTST, PL)

const BASE_URL = 'https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS';

// Broader keywords: many precatório FIDCs use "judicial", "crédito público", etc.
const KEYWORDS = [
  'PRECATORIO', 'PRECATÓRIO', 'PRECATORIOS', 'PRECATÓRIOS',
  'CREDITO JUDICIAL', 'CRÉDITO JUDICIAL',
  'JUDICIAL', 'JUDICIARIO', 'JUDICIÁRIO',
  'CREDITO PUBLICO', 'CRÉDITO PÚBLICO',
  'RECEITA PUBLICA', 'ACAO JUDICIAL', 'AÇÃO JUDICIAL',
];

function monthStr(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
}

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

function isPrecatorio(row) {
  const nome = (row.DENOM_SOCIAL || '').toUpperCase();
  return KEYWORDS.some(kw => nome.includes(kw));
}

async function fetchMonth(yyyymm) {
  const url = `${BASE_URL}/inf_mensal_fidc_${yyyymm}.zip`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    // Get tab_I (general) and tab_X (quota info)
    let tabIFile = null, tabXFile = null;
    for (const name of Object.keys(zip.files)) {
      const lower = name.toLowerCase();
      if (lower.includes('tab_i_') && lower.endsWith('.csv')) tabIFile = zip.files[name];
      if (lower.includes('tab_x_') && !lower.includes('tab_x_1') && !lower.includes('tab_x_2') && !lower.includes('tab_x_3') && !lower.includes('tab_x_4') && !lower.includes('tab_x_5') && !lower.includes('tab_x_6') && !lower.includes('tab_x_7') && lower.endsWith('.csv')) {
        tabXFile = zip.files[name];
      }
    }

    const result = { tabI: [], tabX: [] };

    if (tabIFile) {
      const raw = await tabIFile.async('uint8array');
      const text = new TextDecoder('latin1').decode(raw);
      result.tabI = parseCSV(text);
    }

    if (tabXFile) {
      const raw = await tabXFile.async('uint8array');
      const text = new TextDecoder('latin1').decode(raw);
      result.tabX = parseCSV(text);
    }

    return result;
  } catch (err) {
    console.error(`[cvm-fidc] fetch ${yyyymm} error:`, err.message);
    return null;
  }
}

export async function GET() {
  try {
    const now = new Date();
    const months = [];
    for (let i = 1; i <= 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthStr(d));
    }

    const results = await Promise.allSettled(months.map(m => fetchMonth(m)));

    const monthlyData = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status !== 'fulfilled' || !results[i].value) continue;
      const { tabI, tabX } = results[i].value;
      if (!tabI.length) continue;

      // Filter for precatório-related FIDCs from tab_I
      const precRows = tabI.filter(isPrecatorio);

      // Build PL lookup from tab_X (has NR_COTST, VL_COTA, PL per class)
      const plMap = {};
      for (const x of tabX) {
        const cnpj = x.CNPJ_FUNDO_CLASSE || x.CNPJ_CLASSE || '';
        const pl = parseFloat(x.TAB_X_VL_TOTAL || x.PL || 0);
        const cotistas = parseInt(x.TAB_X_NR_COTST || x.NR_COTST || 0);
        const cota = parseFloat(x.TAB_X_VL_COTA || x.VL_COTA || 0);
        if (cnpj && (pl > 0 || cotistas > 0)) {
          if (!plMap[cnpj] || pl > (plMap[cnpj].pl || 0)) {
            plMap[cnpj] = { pl, cotistas, cota };
          }
        }
      }

      if (precRows.length > 0) {
        const detalhes = precRows.map(r => {
          const cnpj = r.CNPJ_FUNDO_CLASSE || '';
          const xData = plMap[cnpj] || {};
          const ativo = parseFloat(r.TAB_I_VL_ATIVO || 0);
          return {
            cnpj,
            nome: r.DENOM_SOCIAL || '',
            ativo,
            pl: xData.pl || ativo,
            cotistas: xData.cotistas || 0,
            cota: xData.cota || 0,
          };
        }).sort((a, b) => b.pl - a.pl);

        const plTotal = detalhes.reduce((s, d) => s + d.pl, 0);
        const cotistasTotal = detalhes.reduce((s, d) => s + d.cotistas, 0);

        monthlyData.push({
          mes: months[i],
          fundos: detalhes.length,
          plTotal,
          cotistasTotal,
          detalhes,
        });
      }
    }

    if (!monthlyData.length) {
      // Return info about total FIDCs found (even if none matched precatório keywords)
      const allFound = results.filter(r => r.status === 'fulfilled' && r.value?.tabI?.length > 0);
      const totalFIDCs = allFound.length > 0 ? allFound[0].value.tabI.length : 0;
      return NextResponse.json({
        erro: null,
        info: `${totalFIDCs} FIDCs encontrados, nenhum com keywords de precatórios no nome`,
        referencia: months[0],
        totalFundos: 0,
        plTotal: 0,
        plMedio: 0,
        cotistasTotal: 0,
        fundos: [],
        historico: [],
      });
    }

    const latest = monthlyData[0];
    const plMedio = latest.fundos > 0 ? latest.plTotal / latest.fundos : 0;

    return NextResponse.json({
      referencia: latest.mes,
      totalFundos: latest.fundos,
      plTotal: latest.plTotal,
      plMedio,
      cotistasTotal: latest.cotistasTotal,
      fundos: latest.detalhes.slice(0, 20),
      historico: monthlyData.slice(0, 6).map(m => ({
        mes: m.mes,
        fundos: m.fundos,
        plTotal: m.plTotal,
      })).reverse(),
    });
  } catch (err) {
    console.error('[cvm-fidc] error:', err.message);
    return NextResponse.json({ erro: 'Erro ao carregar dados CVM FIDC' }, { status: 500 });
  }
}
