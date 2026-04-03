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

    // Step 0: If we have address, identify the building/condo first
    const buildingContext = logradouro && numero
      ? `\nIMPORTANTE: O imóvel fica em "${enderecoCompleto}, ${bairroStr}". Busque o nome do condomínio/prédio nesse endereço. Use esse nome para filtrar anúncios do MESMO prédio.`
      : '';

    // Step 1: Search for SALE comparables
    const salePrompt = `Busque AGORA no Google anúncios REAIS de ${tipoStr} de ALTO PADRÃO à VENDA no bairro ${bairroStr}, ${cidadeStr}/${ufStr}.

IMPORTANTE — PADRÃO DO IMÓVEL: ${padraoStr}
${padraoStr === 'Alto' || padraoStr === 'Luxo' ? 'BUSQUE SOMENTE apartamentos de alto padrão, lançamentos recentes, prédios novos com acabamento premium, lazer completo. IGNORE apartamentos antigos ou econômicos.' : ''}
${padraoStr === 'Econômico' ? 'Busque apartamentos populares, MCMV, econômicos.' : ''}

${buildingContext}

FAÇA ESTAS BUSCAS NO GOOGLE:
${logradouro && numero ? `0. "${logradouro} ${numero}" ${cidadeStr} condominio prédio — IDENTIFIQUE O NOME DO PRÉDIO` : ''}
1. ${logradouro ? `"${logradouro}" ${numero || ''} ${bairroStr} venda ${tipoStr}` : `site:zapimoveis.com.br ${tipoStr} venda ${bairroStr} ${cidadeStr} ${area}m2`}
2. site:zapimoveis.com.br ${tipoStr} venda ${bairroStr} ${cidadeStr} ${area}m2 ${padraoStr === 'Alto' || padraoStr === 'Luxo' ? 'alto padrão' : ''}
3. site:vivareal.com.br ${tipoStr} venda ${bairroStr} ${cidadeStr} ${area}m2
4. site:loft.com.br ${bairroStr} ${cidadeStr} venda
5. site:finderimoveis.com.br ${tipoStr} ${bairroStr} ${cidadeStr}
6. site:imovelweb.com.br ${tipoStr} venda ${bairroStr} ${cidadeStr}

FILTROS OBRIGATÓRIOS:
- Área entre ${Math.round(area*0.7)}m² e ${Math.round(area*1.3)}m²
- Tipo: ${tipoStr}
- Padrão: ${padraoStr} (NÃO misture com padrões diferentes)
${logradouro ? `- Priorize rua: ${logradouro}` : ''}

PARA CADA ANÚNCIO extraia: preço de venda e área. Calcule R$/m².
Liste pelo menos 5 anúncios reais encontrados.

Responda SOMENTE JSON puro sem markdown:
{"m2_min":0,"m2_med":0,"m2_max":0,"amostras":0,"fonte":"ZAP, Loft, Finder"}`;

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
