import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export async function POST(request) {
  try {
    const { bairro, cidade, uf, tipo, uso, area_m2 } = await request.json();

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    const location = [bairro, cidade, uf].filter(Boolean).join(', ');
    const tipoDesc = tipo || 'imóvel';
    const areaDesc = area_m2 ? `${area_m2}m²` : '';

    const prompt = `Pesquise preços ATUAIS de mercado para ${tipoDesc} ${uso || ''} ${areaDesc} em ${location}, Brasil.

Busque em sites como QuintoAndar, ZAP Imóveis, Viva Real, Lopes, ImovelWeb para encontrar:
1. Preço médio de VENDA por m² na região
2. Preço médio de ALUGUEL por m² na região
3. Valor estimado de venda do imóvel ${areaDesc ? `de ${areaDesc}` : ''}
4. Valor estimado de aluguel mensal
5. IPTU anual estimado
6. Condomínio mensal estimado (se aplicável)
7. Yield médio da região (aluguel/valor venda anualizado)

IMPORTANTE: Responda SOMENTE em JSON válido, sem markdown, sem texto antes ou depois. Use este formato exato:
{
  "preco_m2_venda": 12000,
  "preco_m2_aluguel": 50,
  "valor_venda_estimado": 600000,
  "aluguel_estimado": 2500,
  "iptu_estimado_anual": 3600,
  "condominio_estimado": 800,
  "yield_regiao": 5.2,
  "confianca": "média",
  "fonte": "QuintoAndar, ZAP Imóveis",
  "observacao": "Valores baseados em anúncios ativos na região em abril/2026"
}

Se não encontrar dados suficientes, estime com base no que encontrar. O campo confianca pode ser "alta", "média" ou "baixa".`;

    // Gemini API with Google Search grounding
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      .filter(Boolean)
      .join('') || '';

    // Extract JSON from response (may have markdown wrapping)
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    try {
      const estimate = JSON.parse(jsonStr);
      return NextResponse.json(estimate);
    } catch {
      console.error('Failed to parse Gemini response:', text);
      return NextResponse.json({ error: 'Failed to parse estimate', raw: text.substring(0, 500) }, { status: 500 });
    }
  } catch (err) {
    console.error('Estimate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
