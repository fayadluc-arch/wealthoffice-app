import { NextResponse } from 'next/server';

// BCB SGS Series for INCC
// 192 = INCC-DI (mensal)
// 7447 = INCC-M (mensal)
const SGS_INCC_DI = 192;
const SGS_INCC_M = 7447;

export async function GET() {
  try {
    // Fetch last 24 months of INCC-DI from BCB SGS
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 24);

    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const [resDI, resM] = await Promise.all([
      fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SGS_INCC_DI}/dados?formato=json&dataInicial=${fmt(startDate)}&dataFinal=${fmt(endDate)}`, {
        next: { revalidate: 86400 }, // 24h cache
      }),
      fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SGS_INCC_M}/dados?formato=json&dataInicial=${fmt(startDate)}&dataFinal=${fmt(endDate)}`, {
        next: { revalidate: 86400 },
      }),
    ]);

    let inccDI = [];
    let inccM = [];

    if (resDI.ok) {
      const data = await resDI.json();
      inccDI = data.map(d => ({ data: d.data, valor: Number(d.valor) }));
    }

    if (resM.ok) {
      const data = await resM.json();
      inccM = data.map(d => ({ data: d.data, valor: Number(d.valor) }));
    }

    // Calculate accumulated INCC 12 months
    const last12DI = inccDI.slice(-12);
    const acumulado12m = last12DI.reduce((acc, m) => acc * (1 + m.valor / 100), 1) - 1;

    // Calculate accumulated INCC from arbitrary start date
    const acumuladoTotal = inccDI.reduce((acc, m) => acc * (1 + m.valor / 100), 1) - 1;

    // Current month
    const atual = inccDI.length > 0 ? inccDI[inccDI.length - 1] : null;

    return NextResponse.json({
      atual: atual ? { mes: atual.data, valor: atual.valor } : null,
      acumulado_12m: Number((acumulado12m * 100).toFixed(2)),
      acumulado_24m: Number((acumuladoTotal * 100).toFixed(2)),
      historico_di: inccDI.slice(-24),
      historico_m: inccM.slice(-24),
      // Pre-calculated multipliers for common periods
      fator_6m: Number(inccDI.slice(-6).reduce((acc, m) => acc * (1 + m.valor / 100), 1).toFixed(6)),
      fator_12m: Number(last12DI.reduce((acc, m) => acc * (1 + m.valor / 100), 1).toFixed(6)),
      fator_24m: Number(inccDI.reduce((acc, m) => acc * (1 + m.valor / 100), 1).toFixed(6)),
    });
  } catch (err) {
    console.error('INCC API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
