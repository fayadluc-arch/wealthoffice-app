import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export async function POST(request) {
  try {
    const { logradouro, numero, bairro, cidade, uf, tipo, uso, area_m2, complemento } = await request.json();

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    // Build the most specific address possible
    const enderecoCompleto = [logradouro, numero, complemento].filter(Boolean).join(', ');
    const bairroStr = bairro || '';
    const cidadeStr = [cidade, uf].filter(Boolean).join('/');
    const tipoDesc = tipo || 'imóvel';
    const areaDesc = area_m2 ? `${area_m2}m²` : '';

    const prompt = `Pesquise preços ATUAIS e ESPECÍFICOS de mercado para ${tipoDesc} ${uso || ''} ${areaDesc} no seguinte endereço EXATO:

ENDEREÇO: ${enderecoCompleto}
BAIRRO: ${bairroStr}
CIDADE: ${cidadeStr}

INSTRUÇÕES:
1. Busque anúncios ATIVOS em QuintoAndar, ZAP Imóveis, Viva Real, Lopes, ImovelWeb para essa RUA ESPECÍFICA (${logradouro || 'região'})
2. Se não encontrar nessa rua exata, busque nas ruas adjacentes do mesmo bairro (${bairroStr})
3. Priorize imóveis do mesmo tipo (${tipoDesc}) e área similar (${areaDesc || 'qualquer'})
4. Compare com pelo menos 3-5 anúncios reais encontrados

Retorne:
- Preço médio de VENDA por m² nessa rua/quadra específica
- Preço médio de ALUGUEL por m² nessa rua/quadra
- Valor estimado de venda para um ${tipoDesc} de ${areaDesc || '70m²'} nesse endereço
- Aluguel mensal estimado para esse endereço específico
- IPTU anual estimado para esse endereço
- Condomínio mensal estimado (baseado em prédios na região)
- Yield da micro-região (aluguel anual / valor venda)

IMPORTANTE: Responda SOMENTE em JSON válido, sem markdown, sem texto antes ou depois:
{
  "preco_m2_venda": 12000,
  "preco_m2_aluguel": 50,
  "valor_venda_estimado": 600000,
  "aluguel_estimado": 2500,
  "iptu_estimado_anual": 3600,
  "condominio_estimado": 800,
  "yield_regiao": 5.2,
  "confianca": "alta",
  "fonte": "QuintoAndar (3 anúncios), ZAP (2 anúncios)",
  "endereco_referencia": "${enderecoCompleto}, ${bairroStr}",
  "anuncios_encontrados": 5,
  "observacao": "Baseado em 5 anúncios ativos na ${logradouro || 'região'} e ruas adjacentes"
}

O campo confianca: "alta" se encontrou anúncios nessa rua, "média" se usou ruas adjacentes, "baixa" se estimou pelo bairro.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
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

    // Extract JSON from response (may have markdown wrapping or be truncated)
    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    // If JSON is truncated (missing closing brace), try to fix it
    const openBraces = (jsonStr.match(/\{/g) || []).length;
    const closeBraces = (jsonStr.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      // Truncate at last complete key-value pair and close
      const lastComma = jsonStr.lastIndexOf(',');
      const lastColon = jsonStr.lastIndexOf(':');
      if (lastComma > lastColon) {
        jsonStr = jsonStr.substring(0, lastComma) + '}';
      } else {
        // Remove incomplete value and close
        const lastQuote = jsonStr.lastIndexOf('"');
        const secondLastQuote = jsonStr.lastIndexOf('"', lastQuote - 1);
        if (secondLastQuote > 0) {
          jsonStr = jsonStr.substring(0, secondLastQuote) + '"truncado"}';
        } else {
          jsonStr += '"}';
        }
      }
    }

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
