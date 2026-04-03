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
    const altoP = padraoS === 'Alto' || padraoS === 'Luxo';

    const prompt = `${addr ? `Endereço: ${addr}, ${bairroS}, ${cidadeS}/${ufS}. Primeiro identifique o nome do prédio/condomínio neste endereço.` : ''}

Busque preço por m² de ${tipoS} ${altoP ? 'ALTO PADRÃO' : padraoS} à venda em ${bairroS}, ${cidadeS}/${ufS}, área ${Math.round(area*0.7)}-${Math.round(area*1.3)}m².
${addr ? `Priorize anúncios do mesmo prédio em ${addr}.` : ''}
${altoP ? 'SOMENTE prédios novos/alto padrão. IGNORE econômicos.' : ''}

Busque em zapimoveis.com.br, vivareal.com.br, loft.com.br, finderimoveis.com.br, imovelweb.com.br.

Também busque aluguel médio, condomínio médio e IPTU para ${tipoS} ${area}m² em ${bairroS}.

RESPONDA SOMENTE ESTE JSON (sem texto, sem markdown, sem backticks):
{"m2_min":0,"m2_med":0,"m2_max":0,"aluguel":0,"condo":0,"iptu_anual":0,"amostras":0,"fonte":"sites","predio":"nome ou vazio"}`;

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

    // Parse JSON from response
    let s = fullText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const m = s.match(/\{[\s\S]*\}/);
    if (m) s = m[0];
    // Fix truncated JSON
    const o = (s.match(/\{/g) || []).length;
    const c = (s.match(/\}/g) || []).length;
    if (o > c) { const lc = s.lastIndexOf(','); s = lc > 0 ? s.substring(0, lc) + '}' : s + '}'; }

    let est;
    try { est = JSON.parse(s); } catch {
      // Last resort: extract numbers from text
      const m2Match = fullText.match(/R?\$?\s*([\d.]+)\s*(?:\/m²|por\s*m)/i);
      if (m2Match) {
        const m2 = Number(m2Match[1].replace(/\./g, ''));
        est = { m2_med: m2, m2_min: Math.round(m2*0.85), m2_max: Math.round(m2*1.15), amostras: 1 };
      } else {
        return NextResponse.json({ error: 'Não conseguiu estimar', raw: fullText.substring(0, 300) }, { status: 500 });
      }
    }

    const m2Med = est.m2_med || 0;
    if (m2Med <= 0) return NextResponse.json({ error: 'Valor m2 inválido', raw: fullText.substring(0, 300) }, { status: 500 });

    const vm = Math.round(m2Med * area * 0.90);
    const alug = est.aluguel || 0;
    const iptu = est.iptu_anual || Math.round(vm * 0.008);
    const yld = alug > 0 && vm > 0 ? Number((alug * 12 / vm * 100).toFixed(1)) : 0;

    return NextResponse.json({
      valor_mercado: vm,
      preco_m2_venda_medio: Math.round(m2Med),
      preco_m2_venda_min: Math.round(est.m2_min || m2Med * 0.85),
      preco_m2_venda_max: Math.round(est.m2_max || m2Med * 1.15),
      preco_m2_aluguel: alug > 0 ? Math.round(alug / area) : 0,
      aluguel_estimado: Math.round(alug),
      iptu_estimado_anual: iptu,
      condominio_estimado: Math.round(est.condo || 0),
      yield_regiao: yld,
      amostras_venda: est.amostras || 0,
      amostras_aluguel: 0,
      confianca: (est.amostras || 0) >= 5 ? 'alta' : (est.amostras || 0) >= 3 ? 'media' : 'baixa',
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
