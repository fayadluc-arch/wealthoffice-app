import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export async function POST(request) {
  try {
    const { logradouro, numero, bairro, cidade, uf, tipo, uso, area_m2, padrao } = await request.json();

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    const area = Number(area_m2) || 70;
    const enderecoCompleto = [logradouro, numero].filter(Boolean).join(' ');
    const bairroStr = bairro || '';
    const cidadeStr = cidade || 'São Paulo';
    const ufStr = uf || 'SP';
    const tipoStr = tipo || 'Apartamento';
    const padraoStr = padrao || 'Médio';

    // Step 1: Search for SALE comparables
    const salePrompt = `Busque no Google anúncios REAIS de ${tipoStr} à VENDA no bairro ${bairroStr}, ${cidadeStr}/${ufStr}.

BUSQUE EXATAMENTE ESTES SITES (abra cada um):
1. zapimoveis.com.br — busque "${tipoStr} venda ${bairroStr} ${cidadeStr}"
2. vivareal.com.br — busque "${tipoStr} venda ${bairroStr} ${cidadeStr}"
3. imovelweb.com.br — busque "${tipoStr} venda ${bairroStr} ${cidadeStr}"
4. quintoandar.com.br — busque "${tipoStr} comprar ${bairroStr}"
5. loft.com.br — busque "${bairroStr} ${cidadeStr}"

FILTROS: área entre ${Math.round(area*0.7)}m² e ${Math.round(area*1.3)}m², ${tipoStr}, padrão ${padraoStr}
${logradouro ? `PRIORIZE resultados na rua: ${logradouro}` : ''}

Para CADA anúncio encontrado, extraia: preço, área, R$/m²

Depois calcule:
- R$/m² MÍNIMO entre todos anúncios
- R$/m² MÉDIO
- R$/m² MÁXIMO
- Quantos anúncios encontrou no total

Responda SOMENTE JSON puro sem markdown:
{"m2_min":0,"m2_med":0,"m2_max":0,"amostras":0,"fonte":"ZAP, VivaReal"}`;

    // Step 2: Search for RENTAL comparables
    const rentalPrompt = `Busque no Google anúncios REAIS de ${tipoStr} para ALUGAR no bairro ${bairroStr}, ${cidadeStr}/${ufStr}.

BUSQUE NESTES SITES:
1. zapimoveis.com.br — "${tipoStr} aluguel ${bairroStr} ${cidadeStr}"
2. quintoandar.com.br — "${tipoStr} alugar ${bairroStr}"
3. vivareal.com.br — "${tipoStr} aluguel ${bairroStr} ${cidadeStr}"

FILTROS: área entre ${Math.round(area*0.7)}m² e ${Math.round(area*1.3)}m²

Calcule o aluguel médio encontrado. Também busque valor médio de condomínio e IPTU mensal.

Responda SOMENTE JSON puro sem markdown:
{"aluguel_medio":0,"condo_medio":0,"iptu_mensal":0,"amostras":0}`;

    // Execute both searches in parallel
    const [saleRes, rentalRes] = await Promise.all([
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: salePrompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 1024 },
        }),
      }),
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: rentalPrompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 1024 },
        }),
      }),
    ]);

    // Parse sale data
    let saleData = { m2_min: 0, m2_med: 0, m2_max: 0, amostras: 0, fonte: '' };
    if (saleRes.ok) {
      const d = await saleRes.json();
      const t = d.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
      const parsed = parseJSON(t);
      if (parsed) saleData = parsed;
    }

    // Parse rental data
    let rentalData = { aluguel_medio: 0, condo_medio: 0, iptu_mensal: 0, amostras: 0 };
    if (rentalRes.ok) {
      const d = await rentalRes.json();
      const t = d.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
      const parsed = parseJSON(t);
      if (parsed) rentalData = parsed;
    }

    // Calculate final values
    const m2Med = saleData.m2_med || 0;
    if (m2Med <= 0) {
      return NextResponse.json({ error: 'Não encontrou anúncios suficientes', detail: `Bairro: ${bairroStr}` }, { status: 404 });
    }

    const valorMercado = Math.round(m2Med * area * 0.90); // 10% discount
    const aluguel = rentalData.aluguel_medio || 0;
    const iptuAnual = rentalData.iptu_mensal ? Math.round(rentalData.iptu_mensal * 12) : Math.round(valorMercado * 0.008);
    const yieldCalc = aluguel > 0 && valorMercado > 0 ? Number((aluguel * 12 / valorMercado * 100).toFixed(1)) : 0;

    return NextResponse.json({
      valor_mercado: valorMercado,
      preco_m2_venda_medio: Math.round(m2Med),
      preco_m2_venda_min: Math.round(saleData.m2_min || m2Med * 0.85),
      preco_m2_venda_max: Math.round(saleData.m2_max || m2Med * 1.15),
      preco_m2_aluguel: aluguel > 0 ? Math.round(aluguel / area) : 0,
      aluguel_estimado: Math.round(aluguel),
      iptu_estimado_anual: iptuAnual,
      condominio_estimado: Math.round(rentalData.condo_medio || 0),
      yield_regiao: yieldCalc,
      amostras_venda: saleData.amostras || 0,
      amostras_aluguel: rentalData.amostras || 0,
      confianca: (saleData.amostras || 0) >= 5 ? 'alta' : (saleData.amostras || 0) >= 3 ? 'media' : 'baixa',
      fonte: saleData.fonte || 'Google Search',
      metodo: 'Comparativo direto (Google Search)',
      area_referencia: area,
      desconto_negociacao: '10%',
    });
  } catch (err) {
    console.error('Estimate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function parseJSON(text) {
  let s = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const m = s.match(/\{[\s\S]*\}/);
  if (m) s = m[0];
  const o = (s.match(/\{/g) || []).length;
  const c = (s.match(/\}/g) || []).length;
  if (o > c) { const lc = s.lastIndexOf(','); s = lc > 0 ? s.substring(0, lc) + '}' : s + '}'; }
  try { return JSON.parse(s); } catch { return null; }
}
