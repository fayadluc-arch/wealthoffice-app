import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { cep } = await params;
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) {
    return NextResponse.json({ error: 'CEP inválido' }, { status: 400 });
  }

  // Try ViaCEP first
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`, { next: { revalidate: 86400 } });
    const data = await res.json();
    if (!data.erro) {
      return NextResponse.json({
        cep: data.cep,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        uf: data.uf || '',
        complemento: data.complemento || '',
      });
    }
  } catch (_) { /* fallback */ }

  // Fallback: BrasilAPI
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`, { next: { revalidate: 86400 } });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        cep: data.cep,
        logradouro: data.street || '',
        bairro: data.neighborhood || '',
        cidade: data.city || '',
        uf: data.state || '',
        complemento: '',
      });
    }
  } catch (_) { /* not found */ }

  return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 });
}
