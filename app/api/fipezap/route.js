import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// FipeZap — Índice de preços de imóveis por m²
// Fonte: FIPE / ZAP — downloads.fipe.org.br/indices/fipezap/
//
// Excel structure:
//   - "Resumo" sheet: all cities snapshot (row 6+)
//     Cols: [0]link, [1]cidade, [2]UF, [3]idx venda, [4]var mensal venda,
//           [5]var 12m venda, [6]preço/m² venda, [7]idx loc, [8]var mensal loc,
//           [9]var 12m loc, [10]preço/m² loc, [11]yield mensal, [12]yield anual
//   - Per-city sheets: time series
//     Row 3: headers ["", "Data", "Total", "1D", "2D", ...]
//     Row 4+: data with Excel serial dates in col[1], index in col[2]
//     Venda section starts at col 2, Locação section further right

const EXCEL_URL = 'https://downloads.fipe.org.br/indices/fipezap/fipezap-serieshistoricas.xlsx';
const SKIP_SHEETS = ['Resumo', 'Aux', 'Índice FipeZAP'];

let _cache = { wb: null, ts: 0 };
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

async function loadWorkbook() {
  const now = Date.now();
  if (_cache.wb && now - _cache.ts < CACHE_TTL) return _cache.wb;

  const res = await fetch(EXCEL_URL, {
    headers: { 'User-Agent': 'WealthOffice/1.0' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`FipeZap download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });

  _cache = { wb, ts: now };
  return wb;
}

function parseResumo(wb) {
  const sheet = wb.Sheets['Resumo'];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const result = [];
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1] || typeof r[1] !== 'string') continue;
    const cidade = r[1].trim();
    if (!cidade || cidade.length < 2) continue;

    const precoVenda = typeof r[6] === 'number' ? r[6] : 0;
    const varMensalVenda = typeof r[4] === 'number' ? r[4] * 100 : 0; // stored as decimal
    const var12mVenda = typeof r[5] === 'number' ? r[5] * 100 : 0;
    const precoLocacao = typeof r[10] === 'number' ? r[10] : 0;
    const varMensalLoc = typeof r[8] === 'number' ? r[8] * 100 : 0;
    const var12mLoc = typeof r[9] === 'number' ? r[9] * 100 : 0;
    const yieldAnual = typeof r[12] === 'number' ? r[12] * 100 : 0;

    if (precoVenda > 0) {
      result.push({
        cidade,
        uf: typeof r[2] === 'string' ? r[2] : '',
        precoM2Venda: Math.round(precoVenda * 100) / 100,
        varMensalVenda: Math.round(varMensalVenda * 100) / 100,
        var12mVenda: Math.round(var12mVenda * 100) / 100,
        precoM2Locacao: Math.round(precoLocacao * 100) / 100,
        varMensalLoc: Math.round(varMensalLoc * 100) / 100,
        var12mLoc: Math.round(var12mLoc * 100) / 100,
        yieldAnual: Math.round(yieldAnual * 100) / 100,
      });
    }
  }
  return result;
}

function parseCitySheet(wb, cityName) {
  const sheet = wb.Sheets[cityName];
  if (!sheet) return null;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (rows.length < 5) return null;

  // Find header row (has "Data" in col 1)
  let headerRow = 3;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (rows[i] && rows[i][1] && String(rows[i][1]).includes('Data')) {
      headerRow = i;
      break;
    }
  }

  // Find where Locação section starts by scanning the header row above
  let locStartCol = -1;
  for (let r = 0; r <= headerRow; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c] || '');
      if (v.includes('Locação') || v.includes('locação') || v.includes('locacao')) {
        // Find the first numeric column after this label
        locStartCol = c;
        break;
      }
    }
    if (locStartCol > 0) break;
  }

  // Parse price/m² column — it's typically col index with "Preço" or the last group before locação
  // Venda "Preço médio" is usually at a fixed position in the row headers
  // Let's find column positions dynamically
  const subHeaders = rows[headerRow];
  let vendaPriceCol = -1;
  let locPriceCol = -1;

  // Scan sub-headers for "Preço" columns or find the last data column before locação
  // Actually, the structure is: col[2]=index Total, with Preço médio further right
  // Let's try to find "Preço" in row 2 or similar
  for (let r = 0; r <= headerRow; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c] || '');
      if (v.includes('Preço') || v.includes('R$/m')) {
        if (vendaPriceCol < 0) vendaPriceCol = c;
        else if (c > vendaPriceCol) locPriceCol = c;
      }
    }
  }

  // Parse data rows
  const vendaSeries = [];
  const locacaoSeries = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row[1] == null) continue;

    // Parse date from col 1 (Excel serial number)
    let data = null;
    const raw = row[1];
    if (typeof raw === 'number' && raw > 30000) {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d) data = `${d.y}-${String(d.m).padStart(2, '0')}`;
    }
    if (!data) continue;

    // Venda index (col 2 = Total)
    const vendaIdx = typeof row[2] === 'number' ? row[2] : null;
    if (vendaIdx !== null) {
      vendaSeries.push({ data, indice: vendaIdx });
    }

    // Locação index if available
    if (locStartCol > 0) {
      const locIdx = typeof row[locStartCol] === 'number' ? row[locStartCol] : null;
      if (locIdx !== null) {
        locacaoSeries.push({ data, indice: locIdx });
      }
    }
  }

  return { vendaSeries, locacaoSeries, vendaPriceCol, locPriceCol };
}

function computeVariacaoFromResumo(resumoEntry, tipo) {
  if (tipo === 'locacao') {
    return {
      mes: resumoEntry.varMensalLoc,
      ano: resumoEntry.var12mLoc,
      trimestre: 0,
      acumulado5anos: 0,
    };
  }
  return {
    mes: resumoEntry.varMensalVenda,
    ano: resumoEntry.var12mVenda,
    trimestre: 0,
    acumulado5anos: 0,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'venda';
    const cidade = searchParams.get('cidade');

    const wb = await loadWorkbook();
    const resumo = parseResumo(wb);
    const cidadesDisponiveis = resumo.map(r => r.cidade);

    // Ranking mode
    if (tipo === 'ranking' || (!cidade && !searchParams.has('cidade'))) {
      const ranking = resumo
        .map(r => ({
          cidade: r.cidade,
          uf: r.uf,
          precoM2Venda: r.precoM2Venda,
          precoM2Aluguel: r.precoM2Locacao,
          yieldImplicito: r.yieldAnual,
          varAnoVenda: r.var12mVenda,
        }))
        .sort((a, b) => b.precoM2Venda - a.precoM2Venda);

      return NextResponse.json({ referencia: '', ranking, cidadesDisponiveis });
    }

    // City mode — find in resumo
    let entry = resumo.find(r => r.cidade === cidade);
    if (!entry) {
      entry = resumo.find(r => r.cidade.toLowerCase().includes(cidade.toLowerCase()));
    }
    if (!entry) {
      return NextResponse.json({ erro: `Cidade '${cidade}' não encontrada`, cidadesDisponiveis }, { status: 404 });
    }

    const precoM2 = tipo === 'locacao' ? entry.precoM2Locacao : entry.precoM2Venda;
    const variacao = computeVariacaoFromResumo(entry, tipo);

    // Try to get historical from city sheet
    let historico = [];
    const citySheet = parseCitySheet(wb, entry.cidade);
    if (citySheet) {
      const series = tipo === 'locacao' ? citySheet.locacaoSeries : citySheet.vendaSeries;
      // Convert index to approximate R$/m² using current price as anchor
      if (series.length > 0 && precoM2 > 0) {
        const lastIdx = series[series.length - 1].indice;
        const factor = precoM2 / lastIdx;
        historico = series.slice(-60).map(s => ({
          data: s.data,
          precoM2: Math.round(s.indice * factor * 100) / 100,
        }));
      }
    }

    // Compute 5-year accumulated from historical
    if (historico.length > 12) {
      const last = historico[historico.length - 1].precoM2;
      const prev60 = historico.length > 60 ? historico[historico.length - 61]?.precoM2 : historico[0].precoM2;
      const prev3 = historico.length > 3 ? historico[historico.length - 4].precoM2 : null;
      if (prev60 > 0) variacao.acumulado5anos = Math.round(((last / prev60) - 1) * 10000) / 100;
      if (prev3 > 0) variacao.trimestre = Math.round(((last / prev3) - 1) * 10000) / 100;
    }

    return NextResponse.json({
      cidade: entry.cidade,
      uf: entry.uf,
      tipo,
      ultimoValor: { data: historico.length ? historico[historico.length - 1].data : '', precoM2 },
      variacao,
      yieldAnual: entry.yieldAnual,
      historico,
      cidadesDisponiveis,
    });
  } catch (err) {
    console.error('[fipezap] error:', err.message);
    return NextResponse.json({ erro: 'Erro ao carregar dados FipeZap' }, { status: 500 });
  }
}
