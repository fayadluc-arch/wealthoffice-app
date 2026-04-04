import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ============================================================
// GEMINI HELPER
// ============================================================
async function callGemini(prompt, { temperature = 0.1, maxTokens = 8192, retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch(`${GEMINI_URL}?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
      });
      if (!res.ok) {
        if (attempt < retries && (res.status === 429 || res.status >= 500)) {
          console.log(`[estimate] Gemini ${res.status}, retrying in 2s...`);
          clearTimeout(timeout);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw new Error(`Gemini ${res.status}`);
      }
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean) || []).join('');
      if (!text && attempt < retries) {
        console.log('[estimate] Empty Gemini response, retrying...');
        clearTimeout(timeout);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return text;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt < retries && err.name === 'AbortError') {
        console.log('[estimate] Gemini timeout, retrying...');
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  return '';
}

// ============================================================
// JSON PARSING (robust)
// ============================================================
function parseJSON(text) {
  let s = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(s); } catch {}

  const arrMatch = s.match(/\[[\s\S]*\]/);
  if (arrMatch) try { return JSON.parse(arrMatch[0]); } catch {}

  const objMatch = s.match(/\{[\s\S]*\}/);
  if (objMatch) {
    let j = objMatch[0];
    const open = (j.match(/[\[{]/g) || []).length;
    const close = (j.match(/[\]}]/g) || []).length;
    if (open > close) {
      const lc = j.lastIndexOf(',');
      if (lc > 0) j = j.substring(0, lc);
      for (let i = 0; i < open - close; i++) j += j.includes('[') ? ']}' : '}';
    }
    try { return JSON.parse(j); } catch {}
  }
  return null;
}

// ============================================================
// LISTING VALIDATION
// ============================================================
function validateListing(l) {
  const preco = Number(l.preco || l.price || 0);
  const area = Number(l.area_m2 || l.area || 0);
  if (preco < 30000 || preco > 80000000) return null;
  if (area < 10 || area > 5000) return null;
  const m2 = preco / area;
  if (m2 < 500 || m2 > 150000) return null;
  return {
    preco, area_m2: area, preco_m2: Math.round(m2),
    url: l.url || '', bairro: l.bairro || '', endereco: l.endereco || '',
    fonte: l.fonte || l.portal || '',
  };
}

// ============================================================
// DEDUPLICATION
// ============================================================
function dedup(listings) {
  const seen = new Set();
  return listings.filter(l => {
    if (l.url && l.url.startsWith('http')) {
      const u = l.url.replace(/\/$/, '').toLowerCase();
      if (seen.has(u)) return false;
      seen.add(u);
    }
    const key = `${Math.round(l.preco / 1000)}_${Math.round(l.area_m2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================
// IQR OUTLIER REMOVAL
// ============================================================
function removeOutliers(listings) {
  if (listings.length < 4) return listings;
  const values = listings.map(l => l.preco_m2).sort((a, b) => a - b);
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const filtered = listings.filter(l => l.preco_m2 >= lo && l.preco_m2 <= hi);
  return filtered.length >= 3 ? filtered : listings;
}

// ============================================================
// WEIGHTED MEDIAN (by area proximity)
// ============================================================
function weightedMedian(listings, targetArea) {
  if (!listings.length) return { m2_med: 0, m2_min: 0, m2_max: 0, std: 0, cv: 0 };

  const weighted = listings.map(l => ({
    m2: l.preco_m2,
    w: 1 / (1 + Math.abs(l.area_m2 - targetArea) / targetArea),
  })).sort((a, b) => a.m2 - b.m2);

  const totalW = weighted.reduce((s, x) => s + x.w, 0);
  let cumW = 0;
  let median = weighted[0].m2;
  for (const x of weighted) {
    cumW += x.w;
    if (cumW >= totalW / 2) { median = x.m2; break; }
  }

  const values = listings.map(l => l.preco_m2);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  const cv = mean > 0 ? std / mean : 0;

  const sorted = [...values].sort((a, b) => a - b);
  const m2_min = sorted[Math.floor(sorted.length * 0.25)] || sorted[0];
  const m2_max = sorted[Math.ceil(sorted.length * 0.75) - 1] || sorted[sorted.length - 1];

  return { m2_med: Math.round(median), m2_min: Math.round(m2_min), m2_max: Math.round(m2_max), std: Math.round(std), cv: Number(cv.toFixed(3)) };
}

// ============================================================
// CONFIDENCE SCORE
// ============================================================
function computeConfidence(nSamples, nPasses, cv) {
  const nScore = Math.min(nSamples / 6, 1); // 6+ samples is good
  const cvScore = 1 - Math.min(cv / 0.5, 1); // CV < 15% excellent, > 50% terrible
  const passScore = nPasses >= 2 ? 0.9 : 0.6;
  const score = 0.4 * nScore + 0.35 * cvScore + 0.25 * passScore;
  const label = score >= 0.65 ? 'alta' : score >= 0.4 ? 'media' : 'baixa';
  return { score: Number(score.toFixed(2)), label, fatores: { amostras: Number(nScore.toFixed(2)), variacao: Number(cvScore.toFixed(2)), passes: Number(passScore.toFixed(2)) } };
}

// ============================================================
// PROMPTS
// ============================================================

// Pass 1: Identificar o prédio + comparáveis de venda no prédio e entorno
function buildPass1Prompt({ addr, numero, bairro, cidade, uf, tipo, area, padrao, padraoFilter }) {
  const end = [addr, numero].filter(Boolean).join(', ');
  const amin = Math.round(area * 0.8);
  const amax = Math.round(area * 1.2);
  return [
    `Avaliação imobiliária — método comparativo NBR 14653-2.`,
    ``,
    `IMÓVEL: ${end}, ${bairro}, ${cidade}/${uf} | ${tipo} ${padrao} ${area}m²`,
    ``,
    `1. IDENTIFIQUE O EMPREENDIMENTO neste endereço:`,
    `   Busque "${end} ${bairro} ${cidade} edifício condomínio" e "${end} ${cidade} prédio".`,
    `   Registre: nome, construtora, ano, andares, vagas, lazer.`,
    ``,
    `2. BUSQUE ANÚNCIOS DE VENDA (mínimo 5):`,
    `   Prioridade 1: mesmo prédio — "[nome do edifício] venda ${cidade}"`,
    `   Prioridade 2: entorno — "${tipo} venda ${bairro} ${cidade} ${amin} a ${amax} m2"`,
    `   Portais: zapimoveis.com.br, vivareal.com.br, imovelweb.com.br`,
    `   ${padraoFilter}`,
    ``,
    `RESPONDA SOMENTE JSON (sem markdown):`,
    `{"empreendimento":{"nome":"","ano_construcao":"","construtora":"","andares":"","unidades":"","lazer":"","vagas":""},"listings":[{"preco":0,"area_m2":0,"preco_m2":0,"url":"","bairro":"","endereco":"","fonte":""}],"analise_localizacao":""}`,
    ``,
    `NÃO invente dados. Se não achar, retorne listings: [].`,
  ].join('\n');
}

// Pass 2: Análise regional ampla + índice FipeZap
function buildPass2Prompt({ bairro, cidade, uf, tipo, area, padrao, padraoFilter }) {
  const amin = Math.round(area * 0.7);
  const amax = Math.round(area * 1.3);
  return [
    `Pesquisa de mercado — ${tipo} ${padrao} em ${bairro}, ${cidade}/${uf}.`,
    ``,
    `BUSQUE ANÚNCIOS DE VENDA em portais alternativos:`,
    `- imovelweb.com.br, loft.com.br, quintoandar.com.br, chavesnamao.com.br`,
    `- "${tipo} venda ${bairro} ${cidade} ${area}m2"`,
    `Filtro: ${amin}m² a ${amax}m² | ${padraoFilter}`,
    ``,
    `BUSQUE TAMBÉM o índice FipeZap para a região:`,
    `- "Índice FipeZap ${bairro} ${cidade} ${tipo} preço m2 2025 2026"`,
    `- "R$/m2 médio ${bairro} ${cidade} ${tipo}"`,
    ``,
    `RESPONDA SOMENTE JSON:`,
    `{"listings":[{"preco":0,"area_m2":0,"preco_m2":0,"url":"","bairro":"","endereco":"","fonte":""}],"indice_referencia":{"fipezap_m2":0,"fonte":"","periodo":""},"tendencia":"estável/alta/baixa"}`,
    ``,
    `NÃO invente dados. Se não achar, retorne listings: [].`,
  ].join('\n');
}

// Pass 3: Custos operacionais (aluguel só se não for Uso Próprio)
function buildPass3Prompt({ addr, numero, bairro, cidade, uf, tipo, area, padrao, status }) {
  const end = [addr, numero].filter(Boolean).join(', ');
  const isUsoProprio = status === 'Uso Próprio';
  const aluMin = Math.round(area * 0.8);
  const aluMax = Math.round(area * 1.2);

  const sections = [
    `Custos operacionais — ${tipo} ${padrao} ~${area}m², ${bairro}, ${cidade}/${uf}.`,
    addr ? `Endereço: ${end}` : '',
    ``,
  ];

  if (!isUsoProprio) {
    sections.push(
      `1. ALUGUEL MENSAL (mínimo 3 anúncios):`,
      `   - "${tipo} aluguel ${bairro} ${cidade} ${area}m2 zapimoveis"`,
      `   - "${tipo} aluguel ${bairro} ${cidade} quintoandar"`,
      `   - "${tipo} para alugar ${bairro} ${cidade} ${aluMin} a ${aluMax} m2"`,
      ``,
    );
  }

  sections.push(
    `${isUsoProprio ? '1' : '2'}. CONDOMÍNIO: "condomínio médio ${bairro} ${cidade} ${tipo}"`,
    `${isUsoProprio ? '2' : '3'}. IPTU: "IPTU ${cidade} ${tipo} ${area}m2 valor anual"`,
    `${isUsoProprio ? '3' : '4'}. SEGURO: seguro residencial/comercial médio na região`,
    ``,
    `RESPONDA SOMENTE JSON:`,
    `{"aluguel_med":0,"aluguel_min":0,"aluguel_max":0,"aluguel_amostras":0,"condo_med":0,"iptu_anual":0,"seguro_anual":0,"taxa_adm_pct":0,"yield_bruto_regiao":0,"fonte":""}`,
    ``,
    isUsoProprio ? `Imóvel de USO PRÓPRIO — coloque aluguel = 0. Busque apenas condomínio, IPTU e seguro.` : `NÃO invente valores. Se não encontrar, coloque 0.`,
  );

  return sections.filter(s => s !== undefined).join('\n');
}

// ============================================================
// MAIN HANDLER
// ============================================================
export async function POST(request) {
  try {
    const { logradouro, numero, bairro, cidade, uf, tipo, uso, area_m2, padrao, status } = await request.json();
    if (!GOOGLE_API_KEY) return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });

    const area = Number(area_m2) || 70;
    const addr = logradouro || '';
    const bairroS = bairro || 'Centro';
    const cidadeS = cidade || 'São Paulo';
    const ufS = uf || 'SP';
    const tipoS = tipo || 'Apartamento';
    const padraoS = padrao || 'Médio';

    let padraoFilter = '';
    if (padraoS === 'Alto' || padraoS === 'Luxo') {
      padraoFilter = 'SOMENTE alto padrão/luxo: acabamento premium, lazer completo. EXCLUA econômicos e populares.';
    } else if (padraoS === 'Econômico') {
      padraoFilter = 'SOMENTE padrão econômico/popular (MCMV, baixo custo). EXCLUA alto padrão.';
    } else {
      padraoFilter = 'Padrão médio/standard. Exclua alto padrão e econômicos.';
    }

    const params = { addr, numero, bairro: bairroS, cidade: cidadeS, uf: ufS, tipo: tipoS, area, padrao: padraoS, padraoFilter, status: status || '' };

    // Run Pass 1 (building-specific) + Pass 2 (regional) in parallel
    // Pass 3 (rental/costs) runs in parallel too
    console.log('[estimate] Starting 3 parallel passes...');
    const [r1, r2, r3] = await Promise.allSettled([
      callGemini(buildPass1Prompt(params)),
      callGemini(buildPass2Prompt(params)),
      callGemini(buildPass3Prompt(params)),
    ]);

    console.log('[estimate] Pass 1:', r1.status, r1.status === 'rejected' ? r1.reason?.message : `${(r1.value || '').length} chars`);
    console.log('[estimate] Pass 2:', r2.status, r2.status === 'rejected' ? r2.reason?.message : `${(r2.value || '').length} chars`);
    console.log('[estimate] Pass 3:', r3.status, r3.status === 'rejected' ? r3.reason?.message : `${(r3.value || '').length} chars`);

    // Parse results
    let allListings = [];
    let empreendimento = null;
    let analiseLocalizacao = '';
    let indiceReferencia = null;
    let tendencia = '';
    let nPasses = 0;

    // Pass 1: building-specific + location analysis
    if (r1.status === 'fulfilled') {
      const d = parseJSON(r1.value);
      console.log('[estimate] Pass 1 parsed:', d ? 'OK' : 'FAIL', d ? `listings: ${(d.listings || []).length}` : `raw: ${r1.value.substring(0, 200)}`);
      if (d) {
        if (d.empreendimento && d.empreendimento.nome) empreendimento = d.empreendimento;
        analiseLocalizacao = d.analise_localizacao || '';
        const raw = Array.isArray(d.listings) ? d.listings : (Array.isArray(d) ? d : []);
        const valid = raw.map(l => validateListing(l)).filter(Boolean);
        console.log('[estimate] Pass 1 valid listings:', valid.length, 'of', raw.length);
        if (valid.length > 0) nPasses++;
        allListings.push(...valid);
      }
    }

    // Pass 2: regional market + FipeZap reference
    if (r2.status === 'fulfilled') {
      const d = parseJSON(r2.value);
      console.log('[estimate] Pass 2 parsed:', d ? 'OK' : 'FAIL', d ? `listings: ${(d.listings || []).length}` : `raw: ${r2.value.substring(0, 200)}`);
      if (d) {
        if (d.indice_referencia && d.indice_referencia.fipezap_m2 > 0) indiceReferencia = d.indice_referencia;
        tendencia = d.tendencia || '';
        const raw = Array.isArray(d.listings) ? d.listings : (Array.isArray(d) ? d : []);
        const valid = raw.map(l => validateListing(l)).filter(Boolean);
        console.log('[estimate] Pass 2 valid listings:', valid.length, 'of', raw.length);
        if (valid.length > 0) nPasses++;
        allListings.push(...valid);
      }
    }

    // Pass 3: rental data
    let rentalData = { aluguel_med: 0, aluguel_min: 0, aluguel_max: 0, condo_med: 0, iptu_anual: 0, seguro_anual: 0, taxa_adm_pct: 0, yield_bruto: 0, amostras_aluguel: 0 };
    if (r3.status === 'fulfilled') {
      const d = parseJSON(r3.value);
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        rentalData = {
          aluguel_med: Number(d.aluguel_med || d.aluguel || 0),
          aluguel_min: Number(d.aluguel_min || 0),
          aluguel_max: Number(d.aluguel_max || 0),
          condo_med: Number(d.condo_med || d.condo || 0),
          iptu_anual: Number(d.iptu_anual || 0),
          seguro_anual: Number(d.seguro_anual || 0),
          taxa_adm_pct: Number(d.taxa_adm_pct || 0),
          yield_bruto: Number(d.yield_bruto_regiao || 0),
          amostras_aluguel: Number(d.aluguel_amostras || d.amostras_aluguel || 0),
        };
      }
    }

    // Deduplicate + filter outliers
    const unique = dedup(allListings);
    const totalBeforeFilter = unique.length;
    const filtered = removeOutliers(unique);
    const outliersRemoved = totalBeforeFilter - filtered.length;

    // Compute statistics
    const stats = weightedMedian(filtered, area);

    // Fallback: extract R$/m² from raw text if no structured listings
    if (filtered.length === 0) {
      const allText = [r1, r2].map(r => r.status === 'fulfilled' ? r.value : '').join(' ');
      // Try to find FipeZap or other m2 references
      const m2Matches = [...allText.matchAll(/R?\$?\s*([\d.]+(?:,\d+)?)\s*(?:\/\s*m²|por\s*m|\/m2|\/m²)/gi)];
      const m2Values = m2Matches
        .map(m => Number(m[1].replace(/\./g, '').replace(',', '.')))
        .filter(v => v > 500 && v < 150000);

      if (m2Values.length > 0) {
        const m2 = m2Values.reduce((s, v) => s + v, 0) / m2Values.length;
        const vm = Math.round(m2 * area);
        return NextResponse.json({
          valor_mercado: vm,
          preco_m2_venda_medio: Math.round(m2),
          preco_m2_venda_min: Math.round(m2 * 0.85),
          preco_m2_venda_max: Math.round(m2 * 1.15),
          preco_m2_aluguel: rentalData.aluguel_med > 0 ? Math.round(rentalData.aluguel_med / area) : 0,
          aluguel_estimado: rentalData.aluguel_med,
          iptu_estimado_anual: rentalData.iptu_anual || Math.round(vm * 0.008),
          condominio_estimado: rentalData.condo_med,
          yield_regiao: rentalData.yield_bruto || (rentalData.aluguel_med > 0 && vm > 0 ? Number((rentalData.aluguel_med * 12 / vm * 100).toFixed(1)) : 0),
          amostras_venda: m2Values.length,
          amostras_aluguel: rentalData.amostras_aluguel,
          confianca: 'baixa',
          confianca_score: 0.2,
          confianca_fatores: { amostras: 0.1, variacao: 0.3, passes: 0.2 },
          fonte: 'Análise regional (referências de texto)',
          metodo: 'Extração de índices regionais (sem comparáveis diretos)',
          area_referencia: area,
          empreendimento: empreendimento,
          predio: empreendimento?.nome || '',
          analise_localizacao: analiseLocalizacao,
          tendencia: tendencia,
          comparaveis: [],
          outliers_removidos: 0,
          cv: 0,
        });
      }
      return NextResponse.json({ error: 'Não encontrou dados comparáveis. Verifique o endereço e tente novamente.' }, { status: 500 });
    }

    // Final estimate
    const vm = Math.round(stats.m2_med * area);
    const alug = rentalData.aluguel_med;
    const iptu = rentalData.iptu_anual || Math.round(vm * 0.008);
    const condo = rentalData.condo_med;
    const yld = rentalData.yield_bruto || (alug > 0 && vm > 0 ? Number((alug * 12 / vm * 100).toFixed(1)) : 0);

    const confidence = computeConfidence(filtered.length, nPasses, stats.cv);

    // Cross-validate with FipeZap if available
    let fipezapDelta = null;
    if (indiceReferencia && indiceReferencia.fipezap_m2 > 0) {
      fipezapDelta = Number(((stats.m2_med - indiceReferencia.fipezap_m2) / indiceReferencia.fipezap_m2 * 100).toFixed(1));
    }

    return NextResponse.json({
      valor_mercado: vm,
      preco_m2_venda_medio: stats.m2_med,
      preco_m2_venda_min: stats.m2_min,
      preco_m2_venda_max: stats.m2_max,
      preco_m2_aluguel: alug > 0 ? Math.round(alug / area) : 0,
      aluguel_estimado: alug,
      aluguel_min: rentalData.aluguel_min,
      aluguel_max: rentalData.aluguel_max,
      iptu_estimado_anual: iptu,
      condominio_estimado: condo,
      seguro_estimado_anual: rentalData.seguro_anual,
      taxa_adm_pct: rentalData.taxa_adm_pct,
      yield_regiao: yld,
      amostras_venda: filtered.length,
      amostras_aluguel: rentalData.amostras_aluguel,
      confianca: confidence.label,
      confianca_score: confidence.score,
      confianca_fatores: confidence.fatores,
      fonte: 'Avaliação multi-pass (ZAP, VivaReal, imovelweb, loft, FipeZap)',
      metodo: `Comparativo direto NBR 14653 (${nPasses} passes, ${filtered.length} amostras, IQR filter)`,
      area_referencia: area,
      empreendimento: empreendimento,
      predio: empreendimento?.nome || '',
      analise_localizacao: analiseLocalizacao,
      tendencia: tendencia,
      indice_referencia: indiceReferencia,
      fipezap_delta_pct: fipezapDelta,
      comparaveis: filtered.slice(0, 20).map(l => ({
        preco: l.preco,
        area_m2: l.area_m2,
        preco_m2: l.preco_m2,
        url: l.url,
        bairro: l.bairro,
        endereco: l.endereco,
        fonte: l.fonte,
      })),
      outliers_removidos: outliersRemoved,
      cv: stats.cv,
    });
  } catch (err) {
    console.error('Estimate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
