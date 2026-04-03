import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export async function POST(request) {
  try {
    const { logradouro, numero, bairro, cidade, uf, tipo, uso, area_m2, padrao } = await request.json();
    if (!GOOGLE_API_KEY) return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });

    const area = Number(area_m2) || 70;
    const addr = [logradouro, numero].filter(Boolean).join(' ');
    const bairroS = bairro || 'Centro';
    const cidadeS = cidade || 'São Paulo';
    const ufS = uf || 'SP';
    const tipoS = tipo || 'Apartamento';
    const padraoS = padrao || 'Médio';

    // Build padrão filter text
    let padraoFilter = '';
    if (padraoS === 'Alto' || padraoS === 'Luxo') {
      padraoFilter = 'SOMENTE alto padrão/luxo: prédios novos, acabamento premium, lazer completo. EXCLUA populares e econômicos.';
    } else if (padraoS === 'Econômico') {
      padraoFilter = 'SOMENTE padrão econômico/popular (MCMV, baixo custo). EXCLUA alto padrão.';
    } else {
      padraoFilter = 'Padrão médio/standard. Exclua alto padrão e econômicos.';
    }

    const prompt = `Você é um avaliador imobiliário. Pesquise preços REAIS e ATUAIS (2025-2026) de imóveis.

${addr ? `PASSO 1: Identifique o prédio/condomínio no endereço "${addr}, ${bairroS}, ${cidadeS}/${ufS}". Busque: "${addr} ${bairroS} condomínio prédio".` : ''}

${addr ? 'PASSO 2' : 'PASSO 1'}: Busque anúncios de ${tipoS} à VENDA em ${bairroS}, ${cidadeS}/${ufS}.
- Área: ${Math.round(area*0.7)}m² a ${Math.round(area*1.3)}m²
- ${padraoFilter}
${addr ? `- PRIORIZE anúncios no mesmo prédio/endereço "${addr}"` : ''}

SITES PARA BUSCAR (faça pelo menos 3 buscas diferentes):
- zapimoveis.com.br: "${tipoS} venda ${bairroS} ${cidadeS} ${Math.round(area*0.7)} a ${Math.round(area*1.3)} m2"
- vivareal.com.br: "${tipoS} venda ${bairroS} ${cidadeS}"
- imovelweb.com.br: "${tipoS} venda ${bairroS} ${cidadeS}"
- loft.com.br: "${bairroS} ${cidadeS} comprar"
- finderimoveis.com.br: "${tipoS} ${bairroS} ${cidadeS}"

Para cada anúncio encontrado, anote: preço e área. Calcule R$/m² de cada um.
MÍNIMO 3 anúncios. Se encontrar menos no bairro, amplie para bairros vizinhos.
IGNORE anúncios sem preço ou com preço claramente errado.

${addr ? 'PASSO 3' : 'PASSO 2'}: Busque também:
- Aluguel mensal médio para ${tipoS} ${area}m² em ${bairroS} (busque em zapimoveis ou quintoandar)
- Condomínio médio em prédios de ${bairroS} (busque "condomínio médio ${bairroS} ${cidadeS}")
- IPTU anual para ${tipoS} ${area}m² em ${cidadeS} (busque "IPTU ${cidadeS} ${tipoS} ${area}m2 valor")

RESPONDA SOMENTE ESTE JSON (sem texto, sem markdown, sem backticks, sem explicação):
{"m2_min":0,"m2_med":0,"m2_max":0,"aluguel":0,"condo":0,"iptu_anual":0,"amostras":0,"fonte":"ZAP, VivaReal","predio":"nome"}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!res.ok) return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });

    const data = await res.json();
    const texts = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean) || [];
    const fullText = texts.join('');

    // Parse JSON robustly
    let s = fullText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = s.match(/\{[\s\S]*\}/);
    if (jsonMatch) s = jsonMatch[0];
    // Fix truncated JSON
    const openB = (s.match(/\{/g) || []).length;
    const closeB = (s.match(/\}/g) || []).length;
    if (openB > closeB) {
      const lc = s.lastIndexOf(',');
      s = lc > 0 ? s.substring(0, lc) + '}' : s + '}';
    }

    let est;
    try { est = JSON.parse(s); } catch {
      // Regex fallback: extract R$/m² from text
      const m2Match = fullText.match(/R?\$?\s*([\d.]+(?:,\d+)?)\s*(?:\/\s*m²|por\s*m|\/m2)/i);
      if (m2Match) {
        const m2 = Number(m2Match[1].replace(/\./g, '').replace(',', '.'));
        est = { m2_med: m2, m2_min: Math.round(m2 * 0.85), m2_max: Math.round(m2 * 1.15), amostras: 1 };
      } else {
        return NextResponse.json({ error: 'Não conseguiu estimar. Tente novamente.', raw: fullText.substring(0, 300) }, { status: 500 });
      }
    }

    const m2Med = est.m2_med || 0;
    if (m2Med <= 0) return NextResponse.json({ error: 'Valor R$/m² inválido', raw: fullText.substring(0, 300) }, { status: 500 });

    // Apply 10% negotiation discount (asking price > transaction price)
    const vm = Math.round(m2Med * area * 0.90);
    const alug = Math.round(est.aluguel || 0);
    const iptu = Math.round(est.iptu_anual || vm * 0.008); // fallback 0.8% do valor
    const condo = Math.round(est.condo || 0);
    const yld = alug > 0 && vm > 0 ? Number((alug * 12 / vm * 100).toFixed(1)) : 0;
    const amostras = est.amostras || 0;

    return NextResponse.json({
      valor_mercado: vm,
      preco_m2_venda_medio: Math.round(m2Med),
      preco_m2_venda_min: Math.round(est.m2_min || m2Med * 0.85),
      preco_m2_venda_max: Math.round(est.m2_max || m2Med * 1.15),
      preco_m2_aluguel: alug > 0 ? Math.round(alug / area) : 0,
      aluguel_estimado: alug,
      iptu_estimado_anual: iptu,
      condominio_estimado: condo,
      yield_regiao: yld,
      amostras_venda: amostras,
      amostras_aluguel: 0,
      confianca: amostras >= 5 ? 'alta' : amostras >= 3 ? 'media' : 'baixa',
      fonte: est.fonte || 'Google Search',
      metodo: 'Comparativo (Google Search)',
      area_referencia: area,
      desconto_negociacao: '10%',
      predio: est.predio || '',
    });
  } catch (err) {
    console.error('Estimate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
