import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Seed demo client with realistic São Paulo real estate portfolio

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEMO_IMOVEIS = [
  // 1. Apartamento alto padrão — Vila Nova Conceição (alugado)
  {
    nome: 'Edifício Fasano Itaim', tipo: 'Apartamento', uso: 'Residencial', estagio: 'Pronto',
    cep: '04533-000', logradouro: 'Rua Bandeira Paulista', numero: '726', bairro: 'Itaim Bibi', cidade: 'São Paulo', uf: 'SP',
    area_m2: 280, quartos: 4, padrao: 'Luxo', titular: 'PF', titular_nome: 'Demo Portfolio',
    custo_aquisicao: 6500000, data_aquisicao: '2019-03-15', valor_mercado: 8200000,
    status: 'Alugado', inquilino: 'João Carlos Mendonça', inquilino_contato: '(11) 99999-1234',
    aluguel: 28000, contrato_inicio: '2024-01-01', contrato_fim: '2027-01-01',
    indice_reajuste: 'IGPM', data_proximo_reajuste: '2026-01-01', garantia: 'Seguro Fiança',
    imobiliaria: 'Lopes Consultoria', taxa_adm: 8, inadimplente: false,
    iptu_anual: 18000, condominio_mensal: 4200, seguro_anual: 3500, capex_pendente: 0,
    divida: 0, parcela_mensal: 0,
  },
  // 2. Laje corporativa — Faria Lima (alugado)
  {
    nome: 'Torre Faria Lima', tipo: 'Laje Corporativa', uso: 'Comercial', estagio: 'Pronto',
    cep: '04538-133', logradouro: 'Avenida Brigadeiro Faria Lima', numero: '3477', bairro: 'Itaim Bibi', cidade: 'São Paulo', uf: 'SP',
    area_m2: 450, quartos: 0, padrao: 'Alto', titular: 'Holding', titular_nome: 'WO Participações Ltda',
    cnpj: '12.345.678/0001-90',
    custo_aquisicao: 11000000, data_aquisicao: '2020-06-10', valor_mercado: 14500000,
    status: 'Alugado', inquilino: 'Tech Solutions SA', inquilino_contato: '(11) 3333-4444',
    aluguel: 95000, contrato_inicio: '2023-06-01', contrato_fim: '2028-06-01',
    indice_reajuste: 'IPCA', data_proximo_reajuste: '2026-06-01', garantia: 'Caução',
    imobiliaria: 'JLL Brasil', taxa_adm: 5, inadimplente: false,
    iptu_anual: 85000, condominio_mensal: 12000, seguro_anual: 8000, capex_pendente: 0,
    divida: 3200000, parcela_mensal: 42000,
    banco_financiamento: 'Itaú BBA', valor_financiado: 5500000, taxa_financiamento: 11.5, prazo_financiamento: 180, sistema_amortizacao: 'SAC',
  },
  // 3. Apartamento compacto — Vila Mariana (alugado)
  {
    nome: 'You, Now Vila Mariana', tipo: 'Apartamento', uso: 'Residencial', estagio: 'Pronto',
    cep: '04101-000', logradouro: 'Rua Domingos de Morais', numero: '2100', bairro: 'Vila Mariana', cidade: 'São Paulo', uf: 'SP',
    area_m2: 42, quartos: 1, padrao: 'Médio', titular: 'PF', titular_nome: 'Demo Portfolio',
    custo_aquisicao: 480000, data_aquisicao: '2022-04-20', valor_mercado: 560000,
    status: 'Alugado', inquilino: 'Marina Silva Rocha', inquilino_contato: '(11) 98765-4321',
    aluguel: 3200, contrato_inicio: '2025-05-01', contrato_fim: '2028-05-01',
    indice_reajuste: 'IGPM', data_proximo_reajuste: '2026-05-01', garantia: 'Fiador',
    imobiliaria: 'QuintoAndar', taxa_adm: 6.9, inadimplente: false,
    iptu_anual: 2800, condominio_mensal: 850, seguro_anual: 600, capex_pendente: 0,
    divida: 0, parcela_mensal: 0,
  },
  // 4. Casa — Alphaville (uso próprio)
  {
    nome: 'Casa Alphaville Tamboré', tipo: 'Casa', uso: 'Residencial', estagio: 'Pronto',
    cep: '06460-000', logradouro: 'Alameda Itapecuru', numero: '320', bairro: 'Alphaville', cidade: 'Barueri', uf: 'SP',
    area_m2: 350, quartos: 5, padrao: 'Alto', titular: 'PF', titular_nome: 'Demo Portfolio',
    custo_aquisicao: 3200000, data_aquisicao: '2017-08-01', valor_mercado: 4800000,
    status: 'Uso Próprio',
    iptu_anual: 12000, condominio_mensal: 2800, seguro_anual: 4500, capex_pendente: 45000,
    divida: 0, parcela_mensal: 0,
    observacoes: 'Piscina aquecida, 3 vagas, home theater. CAPEX: reforma do deck da piscina prevista para 2026.',
  },
  // 5. Galpão logístico — Guarulhos (alugado)
  {
    nome: 'Galpão GRU Log Center', tipo: 'Galpão', uso: 'Industrial', estagio: 'Pronto',
    cep: '07190-000', logradouro: 'Rodovia Presidente Dutra', numero: 'km 225', bairro: 'Cumbica', cidade: 'Guarulhos', uf: 'SP',
    area_m2: 2800, quartos: 0, padrao: 'Médio', titular: 'Holding', titular_nome: 'WO Participações Ltda',
    cnpj: '12.345.678/0001-90',
    custo_aquisicao: 5600000, data_aquisicao: '2021-02-15', valor_mercado: 7200000,
    status: 'Alugado', inquilino: 'LogExpress Transportes Ltda', inquilino_contato: '(11) 2222-5555',
    aluguel: 56000, contrato_inicio: '2024-03-01', contrato_fim: '2029-03-01',
    indice_reajuste: 'IPCA', data_proximo_reajuste: '2026-03-01', garantia: 'Seguro Fiança',
    imobiliaria: 'Cushman & Wakefield', taxa_adm: 4, inadimplente: false,
    iptu_anual: 28000, condominio_mensal: 0, seguro_anual: 12000, capex_pendente: 0,
    divida: 1800000, parcela_mensal: 28000,
    banco_financiamento: 'Bradesco', valor_financiado: 3500000, taxa_financiamento: 12.0, prazo_financiamento: 240, sistema_amortizacao: 'SAC',
  },
  // 6. Terreno — Pinheiros (desenvolvimento futuro)
  {
    nome: 'Terreno Pinheiros R. Mourato', tipo: 'Terreno', uso: 'Misto', estagio: 'Pronto',
    cep: '05417-010', logradouro: 'Rua Mourato Coelho', numero: '900', bairro: 'Pinheiros', cidade: 'São Paulo', uf: 'SP',
    area_m2: 600, quartos: 0, padrao: 'Alto', titular: 'SPE', titular_nome: 'SPE Pinheiros Dev Ltda',
    cnpj: '34.567.890/0001-12',
    custo_aquisicao: 4200000, data_aquisicao: '2023-11-01', valor_mercado: 5500000,
    status: 'Vago',
    iptu_anual: 8500, condominio_mensal: 0, seguro_anual: 2000, capex_pendente: 0,
    divida: 0, parcela_mensal: 0,
    observacoes: 'Zoneamento ZM-2, CA básico 2.0. Projeto de incorporação de prédio residencial de 15 andares em estudo. Potencial VGV: R$ 45M.',
  },
  // 7. Studio — Consolação (vago)
  {
    nome: 'VN Nova Paulista', tipo: 'Studio', uso: 'Residencial', estagio: 'Pronto',
    cep: '01311-000', logradouro: 'Rua Augusta', numero: '1580', bairro: 'Consolação', cidade: 'São Paulo', uf: 'SP',
    area_m2: 28, quartos: 1, padrao: 'Médio', titular: 'PF', titular_nome: 'Demo Portfolio',
    custo_aquisicao: 350000, data_aquisicao: '2023-08-15', valor_mercado: 380000,
    status: 'Vago',
    iptu_anual: 1800, condominio_mensal: 680, seguro_anual: 400, capex_pendente: 0,
    divida: 0, parcela_mensal: 0,
    observacoes: 'Perto do metrô Consolação. Ideal para Airbnb ou aluguel universitário. Estimativa de aluguel: R$ 2.200-2.800/mês.',
  },
  // 8. Apartamento em construção — Moema
  {
    nome: 'Cyrela Heritage Moema', tipo: 'Apartamento', uso: 'Residencial', estagio: 'Em Construção',
    cep: '04077-000', logradouro: 'Alameda dos Arapanés', numero: '450', bairro: 'Moema', cidade: 'São Paulo', uf: 'SP',
    area_m2: 180, quartos: 3, padrao: 'Alto', titular: 'PF', titular_nome: 'Demo Portfolio',
    custo_aquisicao: 0, valor_mercado: 0,
    status: 'Em Reforma',
    iptu_anual: 0, condominio_mensal: 0, seguro_anual: 0, capex_pendente: 0,
    divida: 0, parcela_mensal: 0,
    construtora: 'Cyrela Brazil Realty', data_entrega: '2027-06-01', pct_obra: 35,
    valor_contrato: 3800000, entrada_paga: 1140000, parcela_obra: 19000, indice_correcao: 'INCC-DI',
    observacoes: 'Entrega prevista T2/2027. 35% das obras concluídas. Unidade de 180m² no 12º andar, vista para o Ibirapuera.',
  },
  // 9. Sala comercial — Brooklin (alugado)
  {
    nome: 'Edifício Berrini One', tipo: 'Varejo', uso: 'Comercial', estagio: 'Pronto',
    cep: '04571-000', logradouro: 'Rua Samuel Morse', numero: '120', bairro: 'Brooklin', cidade: 'São Paulo', uf: 'SP',
    area_m2: 85, quartos: 0, padrao: 'Alto', titular: 'PF', titular_nome: 'Demo Portfolio',
    custo_aquisicao: 950000, data_aquisicao: '2018-10-01', valor_mercado: 1200000,
    status: 'Alugado', inquilino: 'Escritório Advocacia Silva & Associados', inquilino_contato: '(11) 3456-7890',
    aluguel: 8500, contrato_inicio: '2025-01-01', contrato_fim: '2028-01-01',
    indice_reajuste: 'IGPM', data_proximo_reajuste: '2026-01-01', garantia: 'Caução',
    imobiliaria: 'CBRE', taxa_adm: 6, inadimplente: false,
    iptu_anual: 5200, condominio_mensal: 1800, seguro_anual: 1200, capex_pendente: 0,
    divida: 0, parcela_mensal: 0,
  },
  // 10. Apartamento — Rio de Janeiro (alugado, diversificação geográfica)
  {
    nome: 'Posto 6 Copacabana', tipo: 'Apartamento', uso: 'Residencial', estagio: 'Pronto',
    cep: '22070-001', logradouro: 'Avenida Atlântica', numero: '3456', bairro: 'Copacabana', cidade: 'Rio de Janeiro', uf: 'RJ',
    area_m2: 120, quartos: 3, padrao: 'Alto', titular: 'PF', titular_nome: 'Demo Portfolio',
    custo_aquisicao: 2800000, data_aquisicao: '2016-05-20', valor_mercado: 3200000,
    status: 'Alugado', inquilino: 'Thomas Weber (expatriado)', inquilino_contato: '(21) 98888-7777',
    aluguel: 12000, contrato_inicio: '2025-03-01', contrato_fim: '2027-03-01',
    indice_reajuste: 'IPCA', data_proximo_reajuste: '2026-03-01', garantia: 'Seguro Fiança',
    imobiliaria: 'Bossa Nova Sothebys', taxa_adm: 8, inadimplente: false,
    iptu_anual: 9500, condominio_mensal: 3200, seguro_anual: 2800, capex_pendente: 15000,
    divida: 0, parcela_mensal: 0,
    observacoes: 'Vista mar, andar alto. CAPEX: pintura externa do prédio (cota rateio R$ 15k).',
  },
];

export async function POST(request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ erro: 'userId é obrigatório' }, { status: 400 });
    }

    // Insert all demo properties
    const toInsert = DEMO_IMOVEIS.map(im => ({ ...im, user_id: userId }));
    const { data, error } = await supabase.from('imoveis').insert(toInsert).select('id');

    if (error) {
      console.error('[seed-demo] error:', error.message);
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sucesso: true,
      inseridos: data?.length || 0,
      mensagem: `${data?.length} imóveis demo inseridos com sucesso`,
    });
  } catch (err) {
    console.error('[seed-demo] error:', err.message);
    return NextResponse.json({ erro: 'Erro ao popular dados demo' }, { status: 500 });
  }
}
