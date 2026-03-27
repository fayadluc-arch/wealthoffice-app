'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// SUPABASE CLIENT
// ============================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey && supabaseAnonKey !== 'PLACEHOLDER_WILL_UPDATE')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================
// CONSTANTS
// ============================================================
const ESFERAS = ['Estadual', 'Federal', 'Municipal'];
const STATUS_LIST = ['Homologação', 'Transferência', 'Análise Procuradoria', 'Fila de Pagamento', 'Recebido'];
const PRAZOS = ['Recebido', '0-6 meses', '6-12 meses', '12-24 meses', '24-36 meses', '+36 meses'];
const STATUS_COLORS = {
  'Homologação': '#60A5FA',
  'Transferência': '#34D399',
  'Análise Procuradoria': '#FBBF24',
  'Fila de Pagamento': '#F97316',
  'Recebido': '#34D399',
};
const PRAZO_COLORS = {
  'Recebido': '#34D399',
  '0-6 meses': '#34D399',
  '6-12 meses': '#FBBF24',
  '12-24 meses': '#F97316',
  '24-36 meses': '#F87171',
  '+36 meses': '#A78BFA',
};

// ============================================================
// HELPERS
// ============================================================
function fmtBRL(v) {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v) {
  if (v == null || isNaN(v)) return '0,0%';
  return (Number(v) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}
function calcRetorno(desembolso, valorReceber) {
  if (!desembolso || desembolso <= 0) return 0;
  return (valorReceber / desembolso) - 1;
}
function calcValorReceber(creditoAtualizado, pctReceber, honorariosAdv) {
  if (!creditoAtualizado) return 0;
  return creditoAtualizado * (pctReceber || 0) * (1 + (honorariosAdv || 0));
}
function calcPrazoDecorrido(dataAquisicao) {
  if (!dataAquisicao) return 0;
  return Math.round(((new Date() - new Date(dataAquisicao)) / (1000 * 60 * 60 * 24 * 30.44)) * 10) / 10;
}
function calcTIR(desembolso, valorReceber, prazoMeses) {
  if (!desembolso || desembolso <= 0 || !valorReceber || !prazoMeses || prazoMeses <= 0) return 0;
  return Math.pow(valorReceber / desembolso, 1 / (prazoMeses / 12)) - 1;
}
function prazoToMeses(prazo) {
  const map = { 'Recebido': 0, '0-6 meses': 3, '6-12 meses': 9, '12-24 meses': 18, '24-36 meses': 30, '+36 meses': 48 };
  return map[prazo] || 12;
}

// ============================================================
// ICONS (SVG inline)
// ============================================================
const Icons = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  book: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  activity: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  edit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  chevronDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  briefcase: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  trendUp: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  dollarSign: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
};

// ============================================================
// STYLES (Premium Redesign)
// ============================================================
const S = {
  app: { display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' },

  // Sidebar
  sidebar: {
    width: 260, background: 'linear-gradient(180deg, #0D1017 0%, #0A0D12 100%)',
    borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
  },
  sidebarLogo: { padding: '32px 28px 28px', borderBottom: '1px solid var(--border)' },
  logoMark: {
    display: 'flex', alignItems: 'center', gap: 14,
  },
  logoIcon: {
    width: 40, height: 40, borderRadius: 12,
    background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '-0.03em',
    boxShadow: '0 2px 12px rgba(46,158,110,0.3)',
  },
  logoText: {
    fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
    letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)',
  },
  logoSub: {
    fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2,
    letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500,
  },
  nav: { flex: 1, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
    borderRadius: 10, cursor: 'pointer',
    color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
    background: active ? 'var(--accent-dim)' : 'transparent',
    fontSize: 13.5, fontWeight: active ? 600 : 400,
    transition: 'all var(--transition)', border: 'none', width: '100%', textAlign: 'left',
    letterSpacing: '-0.01em', position: 'relative',
    borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
  }),
  sidebarFooter: {
    padding: '20px 24px', borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },

  // Main content
  main: {
    flex: 1, marginLeft: 260, padding: '32px 40px 48px', minHeight: '100vh',
    maxWidth: 'calc(100vw - 260px)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32,
  },
  pageTitle: {
    fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em',
    fontFamily: 'var(--font-serif)', color: 'var(--text-primary)',
  },
  pageSub: {
    fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5,
    letterSpacing: '-0.01em',
  },

  // Cards
  card: {
    background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)',
    padding: 28, marginBottom: 20, transition: 'all var(--transition)',
  },
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16, marginBottom: 28,
  },
  kpiCard: (accent) => ({
    background: accent
      ? 'linear-gradient(135deg, rgba(46,158,110,0.08) 0%, rgba(46,158,110,0.02) 100%)'
      : 'var(--bg-card)',
    borderRadius: 16, border: accent ? '1px solid rgba(46,158,110,0.2)' : '1px solid var(--border)',
    padding: '22px 24px', transition: 'all var(--transition)',
    position: 'relative', overflow: 'hidden',
  }),
  kpiLabel: {
    fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '1.2px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
  },
  kpiValue: (color) => ({
    fontSize: 26, fontWeight: 700, color: color || 'var(--text-primary)',
    letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
  }),
  kpiSub: {
    fontSize: 12, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '-0.01em',
  },

  // Buttons
  btn: (variant) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
    fontSize: 13, fontWeight: 600, border: 'none',
    transition: 'all var(--transition)', letterSpacing: '-0.01em',
    ...(variant === 'primary' ? {
      background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)',
      color: '#fff', boxShadow: '0 2px 12px rgba(46,158,110,0.25)',
    } : variant === 'danger' ? {
      background: 'var(--red-dim)', color: 'var(--red)',
      border: '1px solid rgba(248,113,113,0.15)',
    } : {
      background: 'var(--bg-elevated)', color: 'var(--text-primary)',
      border: '1px solid var(--border-light)',
    })
  }),

  // Forms
  input: {
    width: '100%', padding: '11px 16px', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
    transition: 'all var(--transition)',
  },
  select: {
    width: '100%', padding: '11px 16px', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
    transition: 'all var(--transition)',
  },
  label: {
    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8,
    display: 'block', letterSpacing: '0.04em', textTransform: 'uppercase',
  },

  // Tables
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 },
  th: (sortable) => ({
    textAlign: 'left', padding: '14px 16px', fontSize: 10,
    fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.8px', borderBottom: '1px solid var(--border)',
    cursor: sortable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap',
    background: 'var(--bg-surface)',
  }),
  td: {
    padding: '16px 16px', fontSize: 13.5, borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', transition: 'background var(--transition)',
  },
  badge: (color) => ({
    display: 'inline-flex', alignItems: 'center', padding: '5px 14px',
    borderRadius: 20, fontSize: 11, fontWeight: 600, color: color,
    background: color + '12', letterSpacing: '-0.01em',
  }),

  // Filters
  filterBar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  filterBtn: (active) => ({
    padding: '8px 18px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
    transition: 'all var(--transition)', letterSpacing: '-0.01em',
  }),
  searchInput: {
    padding: '10px 16px 10px 40px', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: 320,
    transition: 'all var(--transition)',
  },

  // Layout
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 },
  formSection: {
    fontSize: 16, fontWeight: 700, marginBottom: 24, paddingBottom: 12,
    borderBottom: '1px solid var(--border)', letterSpacing: '-0.02em',
    color: 'var(--text-primary)', fontFamily: 'var(--font-serif)',
  },
  row: (clickable) => ({ cursor: clickable ? 'pointer' : 'default', transition: 'background var(--transition)' }),
  totalsBar: {
    display: 'flex', gap: 32, padding: '16px 0', fontSize: 13,
    color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '-0.01em',
  },
  emptyState: { textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' },

  // Auth
  authContainer: { display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' },
  authCard: {
    width: 440, background: 'var(--bg-card)', borderRadius: 20,
    border: '1px solid var(--border)', padding: '48px 44px',
    boxShadow: 'var(--shadow-lg), 0 0 80px rgba(46,158,110,0.03)',
  },
  authTitle: {
    fontSize: 30, fontWeight: 700, textAlign: 'center', marginBottom: 8,
    letterSpacing: '-0.03em', fontFamily: 'var(--font-serif)',
  },
  authSub: {
    fontSize: 14, color: 'var(--text-muted)', textAlign: 'center',
    marginBottom: 36, lineHeight: 1.6,
  },
};

// ============================================================
// AUTH SCREEN (Landing Page Premium)
// ============================================================
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!supabase) { setError('Supabase não configurado'); setLoading(false); return; }
      if (mode === 'login') {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onAuth(data.user);
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (err) throw err;
        if (data.user) onAuth(data.user);
      }
    } catch (err) { setError(err.message || 'Erro ao autenticar'); }
    setLoading(false);
  }

  const features = [
    { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>, title: 'Precatórios', desc: 'Controle completo do book com TIR, retorno e prazos automáticos' },
    { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>, title: 'Real Estate', desc: 'Imóveis, FIIs e participações imobiliárias em um só lugar' },
    { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title: 'Private Equity', desc: 'Acompanhe rodadas, valuations e documentos de investimento' },
    { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, title: 'Cofre Digital', desc: 'Contratos, escrituras e documentos com criptografia AES-256' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflow: 'hidden', position: 'relative' }}>
      {/* Ambient light effects */}
      <div style={{ position: 'absolute', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46,158,110,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -300, left: '20%', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46,158,110,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Navbar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 56px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={S.logoIcon}>W</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)' }}>WealthOffice</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase' }}>Escritório Digital</div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ position: 'relative', padding: '60px 56px 100px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
          {/* Left: Content */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 24, background: 'var(--accent-dim)', border: '1px solid rgba(46,158,110,0.15)', fontSize: 12, fontWeight: 600, color: 'var(--accent-light)', marginBottom: 32 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              Plataforma para investidores qualificados
            </div>

            <h1 style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.04em', marginBottom: 28, fontFamily: 'var(--font-serif)' }}>
              O escritório digital<br />dos seus{' '}
              <span style={{ color: 'var(--accent-light)' }}>ativos alternativos</span>
            </h1>

            <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: 480, marginBottom: 40 }}>
              Gerencie precatórios, imóveis, private equity e crédito estruturado. Documentos, contratos e análises — tudo em um único lugar seguro.
            </p>

            <div style={{ display: 'flex', gap: 14, marginBottom: 56 }}>
              <button onClick={() => document.getElementById('auth-form')?.scrollIntoView({ behavior: 'smooth' })} style={{ ...S.btn('primary'), padding: '16px 36px', fontSize: 15, fontWeight: 700, borderRadius: 12 }}>
                Começar agora
              </button>
              <button style={{ ...S.btn('default'), padding: '16px 32px', fontSize: 14, borderRadius: 12 }}>
                Saiba mais
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 48 }}>
              {[
                { val: 'R$ 50M+', label: 'Em ativos gerenciados' },
                { val: 'AES-256', label: 'Criptografia militar' },
                { val: '99.9%', label: 'Disponibilidade' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Auth Card */}
          <div id="auth-form" style={{ minWidth: 420 }}>
            <div style={{ ...S.authCard, background: 'linear-gradient(160deg, var(--bg-card) 0%, var(--bg-secondary) 100%)', border: '1px solid var(--border-light)', position: 'relative', overflow: 'hidden' }} className="fade-in">
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--accent), var(--accent-light), transparent)' }} />
              <div style={{ ...S.authTitle, marginTop: 8 }}>{mode === 'login' ? 'Bem-vindo' : 'Criar conta'}</div>
              <div style={S.authSub}>{mode === 'login' ? 'Acesse seu escritório digital' : 'Comece a organizar seus ativos'}</div>
              <form onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={S.label}>Nome completo</label>
                    <input style={S.input} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required />
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <label style={S.label}>E-mail</label>
                  <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
                </div>
                <div style={{ marginBottom: 28 }}>
                  <label style={S.label}>Senha</label>
                  <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16, textAlign: 'center', padding: '10px 14px', background: 'var(--red-dim)', borderRadius: 10 }}>{error}</div>}
                <button type="submit" style={{ ...S.btn('primary'), width: '100%', justifyContent: 'center', padding: '15px', fontSize: 15, fontWeight: 700, borderRadius: 12 }} disabled={loading}>
                  {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
                {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
                  {mode === 'login' ? 'Criar conta grátis' : 'Entrar'}
                </span>
              </div>
              <div style={{ textAlign: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                Dados protegidos com criptografia ponta a ponta
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '80px 56px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 16 }}>Recursos</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'var(--font-serif)', lineHeight: 1.2 }}>
            Tudo para gerenciar seus<br />investimentos alternativos
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: '32px 28px', transition: 'all 0.3s', cursor: 'default' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-dim)', border: '1px solid rgba(46,158,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>{f.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)' }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '32px 56px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>2026 WealthOffice. Todos os direitos reservados.</div>
        <div style={{ display: 'flex', gap: 28, fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ cursor: 'pointer' }}>Termos</span>
          <span style={{ cursor: 'pointer' }}>Privacidade</span>
          <span style={{ cursor: 'pointer' }}>Contato</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DONUT CHART
// ============================================================
function DonutChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--border)' }} />;
  let cumPct = 0;
  const gradParts = data.filter(d => d.value > 0).map(d => {
    const start = cumPct;
    cumPct += (d.value / total) * 100;
    return `${d.color} ${start}% ${cumPct}%`;
  });
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `conic-gradient(${gradParts.join(', ')})`, position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: size * 0.58, height: size * 0.58, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{total}</div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
      </div>
    </div>
  );
}

// ============================================================
// BAR CHART
// ============================================================
function BarChart({ data, height = 200 }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.v1 || 0, d.v2 || 0)), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height, paddingTop: 20 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
            <div style={{ width: '38%', height: Math.max(4, (d.v1 / maxVal) * (height - 40)), background: 'linear-gradient(to top, var(--blue), rgba(96,165,250,0.6))', borderRadius: '6px 6px 0 0', transition: 'height 0.4s ease' }} />
            <div style={{ width: '38%', height: Math.max(4, (d.v2 / maxVal) * (height - 40)), background: 'linear-gradient(to top, var(--accent), rgba(52,211,153,0.6))', borderRadius: '6px 6px 0 0', transition: 'height 0.4s ease' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
// ============================================================
// MODULE HUB (after login, before entering any module)
// ============================================================
function ModuleHub({ profileName, isAdmin, onSelectModule, onLogout }) {
  const modules = [
    {
      id: 'precatorios', title: 'Precatórios', status: 'active',
      desc: 'Book completo com TIR, retorno, prazos e tracking judicial via DataJud',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
      color: 'var(--accent)',
      stats: 'Ativo',
    },
    {
      id: 'realestate', title: 'Real Estate', status: 'coming',
      desc: 'Imóveis, FIIs, participações imobiliárias e contratos de locação',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
      color: 'var(--blue)',
      stats: 'Em breve',
    },
    {
      id: 'privateequity', title: 'Private Equity & VC', status: 'coming',
      desc: 'Rodadas, valuations, cap tables e documentos de investimento',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
      color: 'var(--purple)',
      stats: 'Em breve',
    },
    {
      id: 'credito', title: 'Crédito Estruturado', status: 'coming',
      desc: 'Debêntures, CRI, CRA, FIDC e operações de crédito privado',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
      color: 'var(--orange)',
      stats: 'Em breve',
    },
    {
      id: 'cofre', title: 'Cofre Digital', status: 'coming',
      desc: 'Contratos, escrituras e documentos com criptografia AES-256',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
      color: 'var(--green)',
      stats: 'Em breve',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      {/* Ambient */}
      <div style={{ position: 'absolute', top: -150, right: -150, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46,158,110,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={S.logoIcon}>W</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>WealthOffice</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase' }}>Escritório Digital</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{profileName}</div>
            {isAdmin && <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px' }}>ADMIN</div>}
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
            {profileName.charAt(0).toUpperCase()}
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6 }} onClick={onLogout} title="Sair">
            {Icons.logout}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 48px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 12 }}>Seu Escritório</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: '-0.03em', marginBottom: 12 }}>
            Módulos de Investimento
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Selecione uma classe de ativos para gerenciar
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {modules.map(m => (
            <div
              key={m.id}
              onClick={() => m.status === 'active' && onSelectModule(m.id)}
              style={{
                background: m.status === 'active'
                  ? 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-surface) 100%)'
                  : 'var(--bg-card)',
                borderRadius: 20, border: m.status === 'active' ? '1px solid var(--border-light)' : '1px solid var(--border)',
                padding: '32px 28px', transition: 'all 0.3s', position: 'relative', overflow: 'hidden',
                cursor: m.status === 'active' ? 'pointer' : 'default',
                opacity: m.status === 'coming' ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (m.status === 'active') { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = m.status === 'active' ? 'var(--border-light)' : 'var(--border)'; }}
            >
              {m.status === 'active' && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${m.color}, transparent)` }} />
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: m.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>
                  {m.icon}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                  padding: '5px 12px', borderRadius: 20,
                  color: m.status === 'active' ? 'var(--accent)' : 'var(--text-muted)',
                  background: m.status === 'active' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                }}>
                  {m.stats}
                </span>
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>{m.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{m.desc}</div>
              {m.status === 'active' && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Acessar módulo</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WealthOfficeApp() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeModule, setActiveModule] = useState(null); // null = hub, 'precatorios' = precatórios module
  const [tab, setTab] = useState('dashboard');
  const [precatorios, setPrecatorios] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
      setIsAdmin(data?.role === 'admin');
    });
  }, [user]);

  useEffect(() => {
    if (!supabase || !user || !isAdmin) return;
    supabase.from('profiles').select('*').eq('role', 'client').order('name').then(({ data }) => {
      setClients(data || []);
    });
  }, [user, isAdmin]);

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    let pQuery = supabase.from('precatorios').select('*').order('created_at', { ascending: false });
    let aQuery = supabase.from('atividades').select('*').order('created_at', { ascending: false }).limit(100);
    if (isAdmin && selectedClient) {
      pQuery = pQuery.eq('user_id', selectedClient);
      aQuery = aQuery.eq('user_id', selectedClient);
    }
    const [{ data: p }, { data: a }] = await Promise.all([pQuery, aQuery]);
    setPrecatorios(p || []);
    setAtividades(a || []);
    setLoading(false);
  }, [user, isAdmin, selectedClient]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  async function createPrecatorio(data) {
    if (!supabase || !user) return;
    const { data: created, error } = await supabase.from('precatorios').insert({ ...data, user_id: user.id }).select().single();
    if (error) { alert('Erro: ' + error.message); return; }
    await supabase.from('atividades').insert({ user_id: user.id, precatorio_id: created.id, tipo: 'criacao', descricao: `Precatório criado: ${data.cedente} vs ${data.devedor}` });
    await loadData();
    setTab('book');
  }

  async function updatePrecatorio(id, data, changes) {
    if (!supabase || !user) return;
    const { error } = await supabase.from('precatorios').update(data).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    if (changes && changes.length > 0) {
      const logs = changes.map(c => ({ user_id: user.id, precatorio_id: id, tipo: 'edicao', descricao: `Campo "${c.campo}" alterado`, campo: c.campo, valor_anterior: String(c.de || ''), valor_novo: String(c.para || '') }));
      await supabase.from('atividades').insert(logs);
    }
    await loadData();
  }

  async function deletePrecatorio(id) {
    if (!supabase || !user) return;
    const prec = precatorios.find(p => p.id === id);
    await supabase.from('atividades').insert({ user_id: user.id, precatorio_id: id, tipo: 'exclusao', descricao: `Precatório excluído: ${prec?.cedente || 'N/A'}` });
    await supabase.from('precatorios').delete().eq('id', id);
    setDeleteConfirm(null);
    setSelectedId(null);
    await loadData();
  }

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setPrecatorios([]);
    setAtividades([]);
  }

  function exportCSV() {
    if (!precatorios.length) return;
    const headers = ['Cedente', 'Devedor', 'Esfera', 'CNJ', 'Tribunal', 'Status', 'Prazo', 'Desembolso', 'Valor Nominal', 'Crédito Atual.', 'Valor a Receber', 'Retorno', 'TIR'];
    const rows = precatorios.map(p => [p.cedente, p.devedor, p.esfera, p.cnj, p.tribunal, p.status, p.prazo_estimado, p.desembolso, p.valor_nominal, p.credito_atualizado, p.valor_receber, p.retorno, p.tir]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `wealthoffice_precatorios_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // Admin: Batch update from report 24032026
  async function batchUpdateReport24032026() {
    if (!supabase || !isAdmin) return;
    const UPDATES = [
      { cnj_part: '0423510', cedente_part: 'Maria de Lourdes', status: 'Recebido', credito_atualizado: 66396.43, valor_receber: 66396.43, retorno: 0.542563, prazo_decorrido: 15.03, tir: 0.413385, data_recebimento: '2025-09-25', prazo_estimado: 'Recebido', ordem_cronologica: 'Depositado' },
      { cnj_part: '1050219', cedente_part: 'Yara Pereira', status: 'Recebido', credito_atualizado: 179115.58, valor_receber: 102095.88, retorno: 0.398392, prazo_decorrido: 8.53, tir: 0.602473, data_recebimento: '2025-05-19', prazo_estimado: 'Recebido', ordem_cronologica: '2025' },
      { cnj_part: '0956450', cedente_part: 'Sebastião de Paula', status: 'Transferência', credito_atualizado: 292867.02, valor_receber: 292867.02, retorno: 0.43096, prazo_decorrido: 22.67, prazo_estimado: '0-6 meses', ordem_cronologica: 'Depositado' },
      { cnj_part: '0018308', cedente_part: 'Luiz Fernando', status: 'Transferência', credito_atualizado: 286241.83, valor_receber: 271929.74, retorno: 0.461641, prazo_decorrido: 20.4, prazo_estimado: '0-6 meses', ordem_cronologica: '2026' },
      { cnj_part: '0416823', cedente_part: 'Rosangela de Oliveira', status: 'Transferência', credito_atualizado: 105629.27, valor_receber: 75260.86, retorno: 0.553639, prazo_decorrido: 19.23, prazo_estimado: '0-6 meses', ordem_cronologica: '2012' },
      { cnj_part: '0602624', cedente_part: 'Iara Aparecida', status: 'Transferência', credito_atualizado: 82157.54, valor_receber: 46829.80, retorno: 0.421156, prazo_decorrido: 18.2, prazo_estimado: '0-6 meses', ordem_cronologica: '2025' },
      { cnj_part: '0602624', cedente_part: 'Jussara Christina', status: 'Transferência', credito_atualizado: 70987.10, valor_receber: 40462.65, retorno: 0.421156, prazo_decorrido: 18.2, prazo_estimado: '0-6 meses', ordem_cronologica: '2025' },
      { cnj_part: '1048618', cedente_part: 'Maria Regina Darin', status: 'Transferência', credito_atualizado: 363074.81, valor_receber: 206952.64, retorno: 0.553581, prazo_decorrido: 18.2, prazo_estimado: '0-6 meses', ordem_cronologica: '2024' },
      { cnj_part: '0410229', cedente_part: 'Saverio', status: 'Transferência', credito_atualizado: 230388.59, valor_receber: 172791.44, retorno: 0.984333, prazo_decorrido: 18.2, prazo_estimado: '0-6 meses', ordem_cronologica: '2011' },
      { cnj_part: '0404044', cedente_part: 'Jane Rosa', status: 'Transferência', credito_atualizado: 127356.66, valor_receber: 120988.83, retorno: 0.969427, prazo_decorrido: 15.23, prazo_estimado: '0-6 meses', ordem_cronologica: 'Depositado' },
      { cnj_part: '1048618', cedente_part: 'Rosangela Domingues', status: 'Transferência', credito_atualizado: 81742.21, valor_receber: 47819.19, retorno: 0.615753, prazo_decorrido: 3.27, prazo_estimado: '12-24 meses', ordem_cronologica: '2024' },
      { cnj_part: '0410229', cedente_part: 'Saverio', status: 'Transferência', credito_atualizado: 100158.86, valor_receber: 97654.88, retorno: 0.740207, prazo_decorrido: 3.27, prazo_estimado: '12-24 meses', ordem_cronologica: '2011' },
      { cnj_part: '0027207', cedente_part: 'Sonia Maria', status: 'Transferência', credito_atualizado: 26371.06, valor_receber: 15427.07, retorno: 0.441885, prazo_decorrido: 3.27, prazo_estimado: '12-24 meses', ordem_cronologica: '2025' },
      { cnj_part: '0014169', cedente_part: 'Jose Roberto', status: 'Transferência', credito_atualizado: 243668.82, valor_receber: 138891.23, retorno: 0.753971, prazo_decorrido: 19.87, prazo_estimado: '0-6 meses', ordem_cronologica: '2026' },
      { cnj_part: '0602624', cedente_part: 'Eunice Reis', status: 'Transferência', credito_atualizado: 459745.97, valor_receber: 262055.20, retorno: 0.421156, prazo_decorrido: 18.2, prazo_estimado: '0-6 meses', ordem_cronologica: '2025' },
      { cnj_part: '0021843', cedente_part: 'Antonio Sidonio', status: 'Análise Procuradoria', credito_atualizado: 163506.60, valor_receber: 93198.76, retorno: 1.459445, prazo_decorrido: 15.23, prazo_estimado: '12-24 meses', ordem_cronologica: '2008' },
      { cnj_part: '0021843', cedente_part: 'Francisco Jose', status: 'Análise Procuradoria', credito_atualizado: 327109.43, valor_receber: 186452.38, retorno: 1.459444, prazo_decorrido: 15.23, prazo_estimado: '12-24 meses', ordem_cronologica: '2008' },
      { cnj_part: '0421581', cedente_part: 'Amelia Etsuko', status: 'Fila de Pagamento', credito_atualizado: 306104.78, valor_receber: 290799.54, retorno: 0.639971, prazo_decorrido: 19.87, prazo_estimado: '6-12 meses', ordem_cronologica: '2010' },
      { cnj_part: '0417462', cedente_part: 'Elisabeth Andrade', status: 'Fila de Pagamento', credito_atualizado: 259463.10, valor_receber: 246489.94, retorno: 0.726265, prazo_decorrido: 19.23, prazo_estimado: '6-12 meses', ordem_cronologica: '2010' },
      { cnj_part: '0017892', cedente_part: 'Usina Nossa', status: 'Homologação', credito_atualizado: 4286100, valor_receber: 4071795, retorno: 6.7558, prazo_decorrido: 21.5, prazo_estimado: '+36 meses', ordem_cronologica: 'DC' },
      { cnj_part: '0007417', cedente_part: 'Elisabeth Regina', status: 'Homologação', credito_atualizado: 477007.55, valor_receber: 279049.41, retorno: 0.720534, prazo_decorrido: 5.93, prazo_estimado: '12-24 meses', ordem_cronologica: '2027' },
      { cnj_part: '061080002', cedente_part: 'Luiz Carlos Tomaz', status: 'Homologação', credito_atualizado: 1300120.71, valor_receber: 1235114.68, retorno: 0.645369, prazo_decorrido: 4.73, prazo_estimado: '6-12 meses', ordem_cronologica: '2009' },
      { cnj_part: '1006153', cedente_part: 'Rent Equipo', status: 'Homologação', credito_atualizado: 788057.85, valor_receber: 768356.41, retorno: 1.227187, prazo_decorrido: 3.6, prazo_estimado: '24-36 meses', ordem_cronologica: 'DC' },
      { cnj_part: '0034343', cedente_part: 'Ludmila', status: 'Homologação', credito_atualizado: 138379.17, valor_receber: 134919.69, retorno: 0.771127, prazo_decorrido: 3.27, prazo_estimado: '6-12 meses', ordem_cronologica: '2023' },
      { cnj_part: '0032749', cedente_part: 'Leonor Claro', status: 'Homologação', credito_atualizado: 889188.63, valor_receber: 520175.35, retorno: 0.579455, prazo_decorrido: 0.2, prazo_estimado: '12-24 meses', ordem_cronologica: '2028' },
      { cnj_part: '0416046', cedente_part: 'Maria Aparecida Ribeiro', status: 'Homologação', credito_atualizado: 699335.10, valor_receber: 409111.03, retorno: 0.989527, prazo_decorrido: 0.2, prazo_estimado: '24-36 meses', ordem_cronologica: '2028' },
    ];

    let updated = 0, notFound = 0;
    for (const upd of UPDATES) {
      // Find matching precatorio by CNJ partial + cedente partial
      const match = precatorios.find(p =>
        (p.cnj || '').includes(upd.cnj_part) &&
        (p.cedente || '').toLowerCase().includes(upd.cedente_part.toLowerCase())
      );

      if (match) {
        const updateData = {
          status: upd.status, credito_atualizado: upd.credito_atualizado,
          valor_receber: upd.valor_receber, retorno: upd.retorno,
          prazo_decorrido: upd.prazo_decorrido, prazo_estimado: upd.prazo_estimado,
          ordem_cronologica: upd.ordem_cronologica,
        };
        if (upd.tir) updateData.tir = upd.tir;
        if (upd.data_recebimento) updateData.data_recebimento = upd.data_recebimento;

        const { error } = await supabase.from('precatorios').update(updateData).eq('id', match.id);
        if (!error) updated++;
      } else {
        notFound++;
        console.log('Not found:', upd.cedente_part, upd.cnj_part);
      }
    }

    alert(`Atualização concluída: ${updated} atualizados, ${notFound} não encontrados`);
    await loadData();
  }

  if (!authChecked) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...S.logoIcon, width: 48, height: 48, fontSize: 18, margin: '0 auto 16px' }}>W</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
      </div>
    </div>
  );
  if (!user) return <AuthScreen onAuth={setUser} />;

  const profileName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';

  // Module Hub — show before entering any module
  if (!activeModule) {
    return <ModuleHub profileName={profileName} isAdmin={isAdmin} onSelectModule={setActiveModule} onLogout={handleLogout} />;
  }

  function openDetail(id) { setSelectedId(id); setTab('detalhe'); }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
    { id: 'book', label: 'Book de Precatórios', icon: Icons.book },
    { id: 'buscar', label: 'Buscar Processo', icon: Icons.search },
    { id: 'novo', label: 'Novo Precatório', icon: Icons.plus },
    { id: 'atividades', label: 'Atividades', icon: Icons.activity },
  ];

  return (
    <div style={S.app}>
      {/* SIDEBAR */}
      <aside style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={S.logoMark}>
              <div style={S.logoIcon}>W</div>
              <div>
                <div style={S.logoText}>WealthOffice</div>
                <div style={S.logoSub}>Precatórios</div>
              </div>
            </div>
          </div>
          <button onClick={() => { setActiveModule(null); setTab('dashboard'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '6px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}>
            {Icons.back} Voltar aos módulos
          </button>
        </div>

        {/* Admin client selector */}
        {isAdmin && clients.length > 0 && (
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              {Icons.users} Clientes
            </div>
            <div style={{ position: 'relative' }}>
              <select
                style={{ ...S.select, padding: '9px 12px', fontSize: 12.5, background: 'var(--bg-surface)', borderRadius: 8, fontWeight: 500 }}
                value={selectedClient || ''}
                onChange={e => setSelectedClient(e.target.value || null)}
              >
                <option value="">Todos os Clientes</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.email}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <nav style={S.nav}>
          {navItems.map(n => (
            <button key={n.id} style={S.navItem(tab === n.id || (n.id === 'book' && tab === 'detalhe'))} onClick={() => { setTab(n.id); if (n.id !== 'detalhe') setSelectedId(null); }}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>

        <div style={S.sidebarFooter}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
              {profileName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{profileName}</div>
              {isAdmin && <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Admin</div>}
            </div>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, borderRadius: 6, transition: 'all 0.2s' }} onClick={handleLogout} title="Sair">
            {Icons.logout}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={S.main} className="bg-pattern">
        {tab === 'dashboard' && <DashboardTab precatorios={precatorios} onNavigate={setTab} isAdmin={isAdmin} onBatchUpdate={batchUpdateReport24032026} />}
        {tab === 'book' && <BookTab precatorios={precatorios} onDetail={openDetail} onExport={exportCSV} onNavigate={setTab} onDelete={id => setDeleteConfirm(id)} />}
        {tab === 'detalhe' && <DetalheTab precatorio={precatorios.find(p => p.id === selectedId)} onBack={() => setTab('book')} onSave={updatePrecatorio} onDelete={id => setDeleteConfirm(id)} atividades={atividades.filter(a => a.precatorio_id === selectedId)} />}
        {tab === 'buscar' && <BuscarTab precatorios={precatorios} onDetail={openDetail} />}
        {tab === 'novo' && <NovoTab onCreate={createPrecatorio} />}
        {tab === 'atividades' && <AtividadesTab atividades={atividades} precatorios={precatorios} />}
      </main>

      {/* DELETE MODAL */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ ...S.card, width: 420, textAlign: 'center', border: '1px solid rgba(248,113,113,0.2)', marginBottom: 0 }} onClick={e => e.stopPropagation()} className="fade-in">
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--red-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--red)' }}>
              {Icons.trash}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, fontFamily: 'var(--font-serif)' }}>Excluir Precatório?</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>Esta ação não pode ser desfeita. O precatório e todo seu histórico serão removidos permanentemente.</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={{ ...S.btn('default'), padding: '11px 28px' }} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button style={{ ...S.btn('danger'), padding: '11px 28px' }} onClick={() => deletePrecatorio(deleteConfirm)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DASHBOARD TAB
// ============================================================
function DashboardTab({ precatorios, onNavigate, isAdmin, onBatchUpdate }) {
  const totalDesembolso = precatorios.reduce((s, p) => s + Number(p.desembolso || 0), 0);
  const totalNominal = precatorios.reduce((s, p) => s + Number(p.valor_nominal || 0), 0);
  const totalReceber = precatorios.reduce((s, p) => s + Number(p.valor_receber || 0), 0);
  const totalLucro = totalReceber - totalDesembolso;
  // Weighted average return (by desembolso)
  const avgRetorno = totalDesembolso > 0
    ? precatorios.reduce((s, p) => s + Number(p.retorno || 0) * Number(p.desembolso || 0), 0) / totalDesembolso
    : 0;
  // TIR esperada: calculada com base no prazo estimado para todo o book
  const ativos = precatorios.filter(p => p.status !== 'Recebido');
  const ativosDesembolso = ativos.reduce((s, p) => s + Number(p.desembolso || 0), 0);
  const avgTIR = ativosDesembolso > 0
    ? ativos.reduce((s, p) => {
        const d = Number(p.desembolso || 0);
        const vr = Number(p.valor_receber || 0);
        const meses = prazoToMeses(p.prazo_estimado);
        const tir = (d > 0 && vr > 0 && meses > 0) ? (Math.pow(vr / d, 1 / (meses / 12)) - 1) : 0;
        return s + tir * d;
      }, 0) / ativosDesembolso
    : 0;
  // TIR realizada (precatórios já recebidos)
  const recebidos = precatorios.filter(p => p.status === 'Recebido' && Number(p.tir) > 0);
  const tirRealizada = recebidos.length > 0
    ? recebidos.reduce((s, p) => s + Number(p.tir) * Number(p.desembolso || 0), 0) / recebidos.reduce((s, p) => s + Number(p.desembolso || 0), 0)
    : 0;

  const statusData = STATUS_LIST.map(st => ({ label: st, value: precatorios.filter(p => p.status === st).length, color: STATUS_COLORS[st] }));
  const esferaData = ESFERAS.map(e => ({ label: e, count: precatorios.filter(p => p.esfera === e).length, total: precatorios.filter(p => p.esfera === e).reduce((s, p) => s + Number(p.desembolso || 0), 0) }));
  const prazoBarData = PRAZOS.map(pr => ({
    label: pr.replace(' meses', 'm').replace('meses', 'm'),
    v1: precatorios.filter(p => p.prazo_estimado === pr).reduce((s, p) => s + Number(p.desembolso || 0), 0),
    v2: precatorios.filter(p => p.prazo_estimado === pr).reduce((s, p) => s + Number(p.valor_receber || 0), 0),
  }));
  const prazoResumo = PRAZOS.map(pr => ({
    prazo: pr, qtd: precatorios.filter(p => p.prazo_estimado === pr).length,
    desembolso: precatorios.filter(p => p.prazo_estimado === pr).reduce((s, p) => s + Number(p.desembolso || 0), 0),
    receber: precatorios.filter(p => p.prazo_estimado === pr).reduce((s, p) => s + Number(p.valor_receber || 0), 0),
  }));

  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      {/* Report-style header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 10 }}>Relatório Consolidado</div>
            <div style={{ ...S.pageTitle, fontSize: 32 }}>Dashboard</div>
            <div style={S.pageSub}>{today}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {isAdmin && onBatchUpdate && (
              <button style={{ ...S.btn('default'), fontSize: 11, padding: '8px 14px' }} onClick={onBatchUpdate}>
                Atualizar Relatório 24/03
              </button>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Book ativo</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>{precatorios.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>precatórios</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={S.kpiGrid}>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}><span style={{ color: 'var(--blue)' }}>{Icons.dollarSign}</span> Desembolso Total</div>
          <div style={S.kpiValue()}>{fmtBRL(totalDesembolso)}</div>
          <div style={S.kpiSub}>Capital investido</div>
        </div>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}><span style={{ color: 'var(--purple)' }}>{Icons.briefcase}</span> Valor de Face</div>
          <div style={S.kpiValue()}>{fmtBRL(totalNominal)}</div>
          <div style={S.kpiSub}>Valor nominal total</div>
        </div>
        <div style={S.kpiCard(true)}>
          <div style={S.kpiLabel}><span style={{ color: 'var(--accent)' }}>{Icons.trendUp}</span> A Receber</div>
          <div style={S.kpiValue('var(--accent-light)')}>{fmtBRL(totalReceber)}</div>
          <div style={S.kpiSub}>Valor atualizado</div>
        </div>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}><span style={{ color: 'var(--green)' }}>{Icons.trendUp}</span> Lucro Estimado</div>
          <div style={S.kpiValue('var(--green)')}>{fmtBRL(totalLucro)}</div>
          <div style={S.kpiSub}>{fmtPct(totalDesembolso > 0 ? totalLucro / totalDesembolso : 0)} sobre desembolso</div>
        </div>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}><span style={{ color: 'var(--orange)' }}>{Icons.trendUp}</span> Retorno Ponderado</div>
          <div style={S.kpiValue()}>{fmtPct(avgRetorno)}</div>
          <div style={S.kpiSub}>Ponderado por desembolso</div>
        </div>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}><span style={{ color: 'var(--blue)' }}>{Icons.clock}</span> TIR Esperada</div>
          <div style={S.kpiValue()}>{fmtPct(avgTIR)}</div>
          <div style={S.kpiSub}>{recebidos.length > 0 ? `Realizada: ${fmtPct(tirRealizada)}` : `${ativos.length} ativos no book`}</div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-serif)' }}>Distribuição por Prazo</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Desembolso vs. Valor a Receber</div>
            </div>
          </div>
          <BarChart data={prazoBarData} height={180} />
          <div style={{ display: 'flex', gap: 20, marginTop: 16, justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--blue)', display: 'inline-block' }} /> Desembolso
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)', display: 'inline-block' }} /> A Receber
            </span>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, fontFamily: 'var(--font-serif)' }}>Status do Book</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <DonutChart data={statusData} size={150} />
            <div style={{ flex: 1 }}>
              {statusData.map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.label}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM TABLES */}
      <div style={{ ...S.grid2, marginTop: 0 }}>
        <div style={S.card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: 'var(--font-serif)' }}>Por Esfera</div>
          {esferaData.map(e => (
            <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={S.badge(e.label === 'Estadual' ? 'var(--blue)' : e.label === 'Federal' ? 'var(--green)' : 'var(--accent)')}>{e.label}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.count} prec.</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(e.total)}</span>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: 'var(--font-serif)' }}>Resumo por Prazo</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th()}>Prazo</th>
                <th style={S.th()}>Qtd</th>
                <th style={S.th()}>Desembolso</th>
                <th style={S.th()}>A Receber</th>
              </tr>
            </thead>
            <tbody>
              {prazoResumo.map(r => (
                <tr key={r.prazo}>
                  <td style={S.td}><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: PRAZO_COLORS[r.prazo] }} />{r.prazo}</span></td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{r.qtd}</td>
                  <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(r.desembolso)}</td>
                  <td style={{ ...S.td, color: 'var(--accent-light)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(r.receber)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ============================================================
// BOOK TAB
// ============================================================
function BookTab({ precatorios, onDetail, onExport, onNavigate, onDelete }) {
  const [filterEsfera, setFilterEsfera] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [searchQ, setSearchQ] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    let list = [...precatorios];
    if (filterEsfera !== 'Todos') list = list.filter(p => p.esfera === filterEsfera);
    if (filterStatus !== 'Todos') list = list.filter(p => p.status === filterStatus);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(p => (p.cedente || '').toLowerCase().includes(q) || (p.devedor || '').toLowerCase().includes(q) || (p.cnj || '').toLowerCase().includes(q));
    }
    if (sortCol) {
      list.sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
        else { va = Number(va || 0); vb = Number(vb || 0); }
        return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
    }
    return list;
  }, [precatorios, filterEsfera, filterStatus, searchQ, sortCol, sortDir]);

  const totals = useMemo(() => ({
    desembolso: filtered.reduce((s, p) => s + Number(p.desembolso || 0), 0),
    receber: filtered.reduce((s, p) => s + Number(p.valor_receber || 0), 0),
  }), [filtered]);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  return (
    <>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 8 }}>Book de Investimentos</div>
          <div style={S.pageTitle}>Precatórios</div>
          <div style={S.pageSub}>{filtered.length} de {precatorios.length} precatórios</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btn('default')} onClick={onExport}>{Icons.download} Exportar</button>
          <button style={S.btn('primary')} onClick={() => onNavigate('novo')}>{Icons.plus} Novo</button>
        </div>
      </div>

      {/* Filters */}
      <div style={S.filterBar}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', opacity: 0.6 }}>{Icons.search}</span>
          <input style={S.searchInput} placeholder="Buscar processo, cedente, devedor..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>
        {['Todos', ...ESFERAS].map(e => (
          <button key={e} style={S.filterBtn(filterEsfera === e)} onClick={() => setFilterEsfera(e)}>{e}</button>
        ))}
        <select style={{ ...S.select, width: 'auto', padding: '8px 14px', fontSize: 12, borderRadius: 20 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="Todos">Todos os status</option>
          {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        {[
          { label: 'Desembolso', value: fmtBRL(totals.desembolso), color: 'var(--text-primary)' },
          { label: 'A Receber', value: fmtBRL(totals.receber), color: 'var(--accent-light)' },
          { label: 'Spread', value: fmtBRL(totals.receber - totals.desembolso), color: 'var(--green)' },
        ].map(t => (
          <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            {t.label}: <span style={{ fontWeight: 700, color: t.color, fontVariantNumeric: 'tabular-nums' }}>{t.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...S.card, padding: 0, overflow: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th()}>#</th>
              <th style={S.th(true)} onClick={() => handleSort('esfera')}>Esfera {sortCol === 'esfera' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th(true)} onClick={() => handleSort('devedor')}>Devedor {sortCol === 'devedor' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th(true)} onClick={() => handleSort('cedente')}>Cedente {sortCol === 'cedente' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th()}>Processo</th>
              <th style={S.th(true)} onClick={() => handleSort('status')}>Status {sortCol === 'status' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th()}>Prazo</th>
              <th style={S.th(true)} onClick={() => handleSort('desembolso')}>Desembolso {sortCol === 'desembolso' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th()}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} style={S.row(true)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''} onClick={() => onDetail(p.id)}>
                <td style={{ ...S.td, color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>{i + 1}</td>
                <td style={S.td}><span style={S.badge(p.esfera === 'Estadual' ? 'var(--blue)' : p.esfera === 'Federal' ? 'var(--green)' : 'var(--accent)')}>{p.esfera}</span></td>
                <td style={{ ...S.td, fontWeight: 500 }}>{p.devedor}</td>
                <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>{p.cedente}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text-muted)' }}>{p.cnj || '—'}</td>
                <td style={S.td}><span style={S.badge(STATUS_COLORS[p.status] || 'var(--text-muted)')}>{p.status}</span></td>
                <td style={S.td}><span style={S.badge(PRAZO_COLORS[p.prazo_estimado] || 'var(--text-muted)')}>{p.prazo_estimado}</span></td>
                <td style={{ ...S.td, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(p.desembolso)}</td>
                <td style={S.td} onClick={e => { e.stopPropagation(); onDelete(p.id); }}>
                  <span style={{ color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>{Icons.trash}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={S.emptyState}>
            <div style={{ marginBottom: 16, opacity: 0.3 }}>{Icons.book}</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, fontFamily: 'var(--font-serif)' }}>Nenhum precatório encontrado</div>
            <div style={{ fontSize: 13 }}>Ajuste os filtros ou adicione um novo precatório</div>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// DETALHE TAB (2-column layout)
// ============================================================
function DetalheTab({ precatorio, onBack, onSave, onDelete, atividades }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const originalRef = useRef({});
  const [datajud, setDatajud] = useState(null);
  const [datajudLoading, setDatajudLoading] = useState(false);

  useEffect(() => {
    if (precatorio) {
      const data = { ...precatorio };
      setForm(data);
      originalRef.current = { ...data };
      // Auto-fetch DataJud if has CNJ
      if (precatorio.cnj) fetchDatajud(precatorio.cnj);
    }
  }, [precatorio]);

  async function fetchDatajud(cnj) {
    setDatajudLoading(true);
    try {
      const res = await fetch('/api/datajud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnj }) });
      if (res.ok) { const json = await res.json(); setDatajud(json); }
    } catch {}
    setDatajudLoading(false);
  }

  if (!precatorio) return <div style={S.emptyState}>Precatório não encontrado</div>;

  function handleChange(field, value) {
    const updated = { ...form, [field]: value };
    if (['credito_atualizado', 'pct_receber', 'honorarios_adv'].includes(field)) {
      updated.valor_receber = calcValorReceber(Number(updated.credito_atualizado || 0), Number(updated.pct_receber || 0), Number(updated.honorarios_adv || 0));
    }
    if (['desembolso', 'valor_receber', 'credito_atualizado', 'pct_receber', 'honorarios_adv'].includes(field)) {
      const vr = updated.valor_receber || calcValorReceber(Number(updated.credito_atualizado || 0), Number(updated.pct_receber || 0), Number(updated.honorarios_adv || 0));
      updated.valor_receber = vr;
      updated.retorno = calcRetorno(Number(updated.desembolso || 0), Number(vr));
      updated.tir = calcTIR(Number(updated.desembolso || 0), Number(vr), prazoToMeses(updated.prazo_estimado));
    }
    if (field === 'data_aquisicao') updated.prazo_decorrido = calcPrazoDecorrido(value);
    if (field === 'prazo_estimado') updated.tir = calcTIR(Number(updated.desembolso || 0), Number(updated.valor_receber || 0), prazoToMeses(value));
    setForm(updated);
  }

  async function handleSave() {
    setSaving(true);
    const orig = originalRef.current;
    const fields = ['cedente', 'devedor', 'esfera', 'cnj', 'tribunal', 'advogado', 'status', 'prazo_estimado', 'desembolso', 'valor_nominal', 'preco', 'credito_atualizado', 'pct_receber', 'honorarios_adv', 'valor_receber', 'retorno', 'tir', 'data_aquisicao', 'data_recebimento', 'prazo_decorrido', 'observacoes', 'ordem_cronologica'];
    const changes = fields.filter(f => String(form[f] || '') !== String(orig[f] || '')).map(f => ({ campo: f, de: orig[f], para: form[f] }));
    const updateData = {};
    fields.forEach(f => { updateData[f] = form[f]; });
    await onSave(precatorio.id, updateData, changes);
    originalRef.current = { ...form };
    setSaving(false);
  }

  const retorno = Number(form.retorno || 0);
  const tir = Number(form.tir || 0);

  return (
    <>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button style={{ ...S.btn('default'), padding: '8px 12px', borderRadius: 10 }} onClick={onBack}>{Icons.back}</button>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>Detalhe do Precatório</div>
            <div style={S.pageTitle}>{form.cedente || 'Sem nome'}</div>
            <div style={S.pageSub}>{form.cnj || 'Sem CNJ'} — {form.esfera} — {form.devedor}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btn('danger')} onClick={() => onDelete(precatorio.id)}>{Icons.trash} Excluir</button>
          <button style={S.btn('primary')} onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>

      {/* Financial summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Desembolso', value: fmtBRL(form.desembolso), color: 'var(--text-primary)' },
          { label: 'A Receber', value: fmtBRL(form.valor_receber), color: 'var(--accent-light)' },
          { label: 'Retorno', value: fmtPct(retorno), color: retorno > 0 ? 'var(--green)' : 'var(--red)' },
          { label: 'TIR (a.a.)', value: fmtPct(tir), color: tir > 0 ? 'var(--green)' : 'var(--red)' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
        {/* Left: Forms */}
        <div>
          <div style={S.card}>
            <div style={S.formSection}>Identificação</div>
            <div style={S.grid3}>
              <div><label style={S.label}>Cedente *</label><input style={S.input} value={form.cedente || ''} onChange={e => handleChange('cedente', e.target.value)} /></div>
              <div><label style={S.label}>Devedor *</label><input style={S.input} value={form.devedor || ''} onChange={e => handleChange('devedor', e.target.value)} /></div>
              <div><label style={S.label}>Esfera</label><select style={S.select} value={form.esfera || ''} onChange={e => handleChange('esfera', e.target.value)}>{ESFERAS.map(e => <option key={e}>{e}</option>)}</select></div>
              <div><label style={S.label}>Processo (CNJ)</label><input style={S.input} value={form.cnj || ''} onChange={e => handleChange('cnj', e.target.value)} /></div>
              <div><label style={S.label}>Tribunal</label><input style={S.input} value={form.tribunal || ''} onChange={e => handleChange('tribunal', e.target.value)} /></div>
              <div><label style={S.label}>Advogado</label><input style={S.input} value={form.advogado || ''} onChange={e => handleChange('advogado', e.target.value)} /></div>
              <div><label style={S.label}>Ordem Cronológica</label><input style={S.input} value={form.ordem_cronologica || ''} onChange={e => handleChange('ordem_cronologica', e.target.value)} /></div>
              <div><label style={S.label}>Status</label><select style={S.select} value={form.status || ''} onChange={e => handleChange('status', e.target.value)}>{STATUS_LIST.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label style={S.label}>Prazo Estimado</label><select style={S.select} value={form.prazo_estimado || ''} onChange={e => handleChange('prazo_estimado', e.target.value)}>{PRAZOS.map(p => <option key={p}>{p}</option>)}</select></div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.formSection}>Dados Financeiros</div>
            <div style={S.grid3}>
              <div><label style={S.label}>Data Aquisição</label><input style={S.input} type="date" value={form.data_aquisicao || ''} onChange={e => handleChange('data_aquisicao', e.target.value)} /></div>
              <div><label style={S.label}>Desembolso (R$)</label><input style={S.input} type="number" step="0.01" value={form.desembolso || ''} onChange={e => handleChange('desembolso', e.target.value)} /></div>
              <div><label style={S.label}>Valor Nominal (R$)</label><input style={S.input} type="number" step="0.01" value={form.valor_nominal || ''} onChange={e => handleChange('valor_nominal', e.target.value)} /></div>
              <div><label style={S.label}>Preço (0 a 1)</label><input style={S.input} type="number" step="0.0001" value={form.preco || ''} onChange={e => handleChange('preco', e.target.value)} /></div>
              <div><label style={S.label}>Crédito Atualizado (R$)</label><input style={S.input} type="number" step="0.01" value={form.credito_atualizado || ''} onChange={e => handleChange('credito_atualizado', e.target.value)} /></div>
              <div><label style={S.label}>% a Receber (0 a 1)</label><input style={S.input} type="number" step="0.0001" value={form.pct_receber || ''} onChange={e => handleChange('pct_receber', e.target.value)} /></div>
              <div><label style={S.label}>Honorários Adv.</label><input style={S.input} type="number" step="0.0001" value={form.honorarios_adv || ''} onChange={e => handleChange('honorarios_adv', e.target.value)} /></div>
              <div><label style={S.label}>Valor a Receber — auto</label><input style={{ ...S.input, background: 'var(--bg-elevated)', fontWeight: 600, color: 'var(--accent-light)' }} readOnly value={Number(form.valor_receber || 0).toFixed(2)} /></div>
              <div><label style={S.label}>Retorno — auto</label><input style={{ ...S.input, background: 'var(--bg-elevated)', fontWeight: 600 }} readOnly value={fmtPct(form.retorno)} /></div>
              <div><label style={S.label}>Data Recebimento</label><input style={S.input} type="date" value={form.data_recebimento || ''} onChange={e => handleChange('data_recebimento', e.target.value)} /></div>
              <div><label style={S.label}>Prazo Decorrido (meses)</label><input style={{ ...S.input, background: 'var(--bg-elevated)' }} readOnly value={Number(form.prazo_decorrido || 0).toFixed(1)} /></div>
              <div><label style={S.label}>TIR (% a.a.) — auto</label><input style={{ ...S.input, background: 'var(--bg-elevated)', fontWeight: 600 }} readOnly value={fmtPct(form.tir)} /></div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.formSection}>Observações</div>
            <textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} value={form.observacoes || ''} onChange={e => handleChange('observacoes', e.target.value)} placeholder="Anotações sobre este precatório..." />
          </div>
        </div>

        {/* Right: Timeline + Info */}
        <div>
          {/* Status card */}
          <div style={{ ...S.card, background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-surface) 100%)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, fontFamily: 'var(--font-serif)' }}>Status Atual</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[form.status] || 'var(--text-muted)' }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: STATUS_COLORS[form.status] }}>{form.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Prazo</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: PRAZO_COLORS[form.prazo_estimado] }}>{form.prazo_estimado}</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Decorrido</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{Number(form.prazo_decorrido || 0).toFixed(1)} meses</div>
              </div>
            </div>
          </div>

          {/* DataJud - Status Judicial */}
          {form.cnj && (
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-serif)' }}>Status Judicial</div>
                <span style={S.badge('var(--accent)')}>DataJud</span>
              </div>
              {datajudLoading && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Consultando tribunal...</div>}
              {datajud && datajud.data && datajud.data.length > 0 && (() => {
                const proc = datajud.data[0]._source || {};
                const movs = (proc.movimentos || []).slice(0, 8);
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Tribunal</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{proc.tribunal || datajud.tribunal}</div>
                      </div>
                      <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Classe</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{proc.classe?.nome || '—'}</div>
                      </div>
                      <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Ajuizamento</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{proc.dataAjuizamento ? new Date(proc.dataAjuizamento).toLocaleDateString('pt-BR') : '—'}</div>
                      </div>
                      <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Atualização</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{proc.dataHoraUltimaAtualizacao ? new Date(proc.dataHoraUltimaAtualizacao).toLocaleDateString('pt-BR') : '—'}</div>
                      </div>
                    </div>
                    {proc.orgaoJulgador?.nome && (
                      <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 16 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Órgão Julgador</div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{proc.orgaoJulgador.nome}</div>
                      </div>
                    )}
                    {movs.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Movimentações Recentes</div>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: 11, top: 6, bottom: 6, width: 1, background: 'var(--border)' }} />
                          {movs.map((m, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i < movs.length - 1 ? 12 : 0, position: 'relative' }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? 'var(--accent-dim)' : 'var(--bg-elevated)', border: i === 0 ? '2px solid var(--accent)' : '2px solid var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: i === 0 ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, zIndex: 1 }}>
                                {i + 1}
                              </div>
                              <div style={{ flex: 1, paddingTop: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>{m.nome || 'Movimentação'}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
              {datajud && (!datajud.data || datajud.data.length === 0) && !datajudLoading && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Não encontrado no DataJud</div>
              )}
            </div>
          )}

          {/* Activity Timeline */}
          {atividades && atividades.length > 0 && (
            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, fontFamily: 'var(--font-serif)' }}>Histórico</div>
              <div style={{ position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />
                {atividades.slice(0, 15).map((a, i) => {
                  const colors = { criacao: 'var(--green)', edicao: 'var(--blue)', exclusao: 'var(--red)', status: 'var(--accent)' };
                  const icons = { criacao: '+', edicao: '~', exclusao: '×', status: '↻' };
                  return (
                    <div key={a.id} style={{ display: 'flex', gap: 14, paddingBottom: i < atividades.length - 1 ? 16 : 0, position: 'relative' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: (colors[a.tipo] || 'var(--text-muted)') + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: colors[a.tipo], flexShrink: 0, zIndex: 1, border: '2px solid var(--bg-card)' }}>
                        {icons[a.tipo] || '•'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{a.descricao}</div>
                        {a.campo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.campo}: {a.valor_anterior} → {a.valor_novo}</div>}
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(a.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// BUSCAR TAB
// ============================================================
function BuscarTab({ precatorios, onDetail }) {
  const [cnj, setCnj] = useState('');
  const [results, setResults] = useState(null);
  const [datajudData, setDatajudData] = useState(null);
  const [datajudLoading, setDatajudLoading] = useState(false);
  const [datajudError, setDatajudError] = useState('');

  function handleBuscar() {
    if (!cnj.trim()) return;
    const q = cnj.trim().toLowerCase();
    setResults(precatorios.filter(p => (p.cnj || '').toLowerCase().includes(q)));
    setDatajudData(null);
    setDatajudError('');
    // Auto-query DataJud
    handleDatajud(cnj.trim());
  }

  async function handleDatajud(cnjNum) {
    if (!cnjNum) return;
    setDatajudLoading(true);
    setDatajudError('');
    try {
      const res = await fetch('/api/datajud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnj: cnjNum }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao consultar DataJud');
      setDatajudData(json);
    } catch (err) {
      setDatajudError(err.message);
    }
    setDatajudLoading(false);
  }

  // Parse DataJud movimentacoes into timeline
  function renderMovimentacoes(hits) {
    if (!hits || hits.length === 0) return null;
    const processo = hits[0]._source || {};
    const movs = (processo.movimentos || []).slice(0, 20);
    const assuntos = processo.assuntos || [];
    const classe = processo.classe || {};

    return (
      <div>
        {/* Process info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Classe', value: classe.nome || '—' },
            { label: 'Tribunal', value: processo.tribunal || '—' },
            { label: 'Grau', value: processo.grau || '—' },
            { label: 'Órgão Julgador', value: processo.orgaoJulgador?.nome || '—' },
            { label: 'Data Ajuizamento', value: processo.dataAjuizamento ? new Date(processo.dataAjuizamento).toLocaleDateString('pt-BR') : '—' },
            { label: 'Última Atualização', value: processo.dataHoraUltimaAtualizacao ? new Date(processo.dataHoraUltimaAtualizacao).toLocaleDateString('pt-BR') : '—' },
          ].map(item => (
            <div key={item.label} style={{ padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Assuntos */}
        {assuntos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Assuntos</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {assuntos.map((a, i) => (
                <span key={i} style={S.badge('var(--blue)')}>{a.nome || a.codigo}</span>
              ))}
            </div>
          </div>
        )}

        {/* Movimentações timeline */}
        {movs.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Últimas Movimentações</div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />
              {movs.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: i < movs.length - 1 ? 16 : 0, position: 'relative' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: i === 0 ? 'var(--accent-dim)' : 'var(--bg-elevated)', border: i === 0 ? '2px solid var(--accent)' : '2px solid var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: i === 0 ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, zIndex: 1 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{m.nome || m.descricao || 'Movimentação'}</div>
                    {m.complementosTabelados && m.complementosTabelados.length > 0 && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {m.complementosTabelados.map(c => c.nome || c.descricao).join(', ')}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 8 }}>Consulta</div>
          <div style={S.pageTitle}>Buscar Processo</div>
          <div style={S.pageSub}>Consulte pelo CNJ — busca no book e no DataJud (CNJ) automaticamente</div>
        </div>
      </div>

      <div style={S.card}>
        <label style={S.label}>Número do Processo (CNJ)</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input style={{ ...S.input, flex: 1 }} value={cnj} onChange={e => setCnj(e.target.value)} placeholder="Ex: 0423510-23.1997.8.26.0053" onKeyDown={e => e.key === 'Enter' && handleBuscar()} />
          <button style={S.btn('primary')} onClick={handleBuscar} disabled={datajudLoading}>
            {datajudLoading ? 'Consultando...' : <>{Icons.search} Buscar</>}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>Formato CNJ unificado: 0000000-00.0000.0.00.0000</div>
      </div>

      {/* Book results */}
      {results !== null && results.length > 0 && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 16, fontFamily: 'var(--font-serif)', fontSize: 15 }}>
            <span style={{ color: 'var(--accent)' }}>No seu Book</span> — {results.length} encontrado{results.length > 1 ? 's' : ''}
          </div>
          {results.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => onDetail(p.id)} onMouseEnter={e => e.currentTarget.style.paddingLeft = '8px'} onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.cedente} vs {p.devedor}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>{p.cnj}</div>
              </div>
              <span style={S.badge(STATUS_COLORS[p.status])}>{p.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* DataJud results */}
      {datajudLoading && (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Consultando DataJud (CNJ)...</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Buscando movimentações do processo nos tribunais</div>
        </div>
      )}

      {datajudError && (
        <div style={{ ...S.card, border: '1px solid rgba(248,113,113,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--red)', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>DataJud:</span> {datajudError}
          </div>
        </div>
      )}

      {datajudData && datajudData.data && datajudData.data.length > 0 && (
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontWeight: 700, fontFamily: 'var(--font-serif)', fontSize: 15 }}>
                <span style={{ color: 'var(--accent)' }}>DataJud</span> — Dados do Tribunal
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Fonte: {datajudData.tribunal} — {datajudData.total} resultado{datajudData.total > 1 ? 's' : ''}
              </div>
            </div>
            <span style={S.badge('var(--accent)')}>CNJ Oficial</span>
          </div>
          {renderMovimentacoes(datajudData.data)}
        </div>
      )}

      {datajudData && (!datajudData.data || datajudData.data.length === 0) && !datajudError && (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Processo não encontrado no DataJud</div>
        </div>
      )}

      {/* Initial empty state */}
      {results === null && !datajudLoading && (
        <div style={{ ...S.card, ...S.emptyState }}>
          <div style={{ marginBottom: 16, opacity: 0.2 }}>{Icons.search}</div>
          <div style={{ fontSize: 14 }}>Digite o número do processo acima para buscar</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>A consulta busca simultaneamente no seu book e no DataJud (CNJ)</div>
        </div>
      )}
    </>
  );
}

// ============================================================
// NOVO PRECATORIO TAB
// ============================================================
function NovoTab({ onCreate }) {
  const emptyForm = { cedente: '', devedor: '', esfera: 'Estadual', cnj: '', ordem_cronologica: '', tribunal: '', advogado: '', status: 'Homologação', prazo_estimado: '12-24 meses', data_aquisicao: '', desembolso: 0, valor_nominal: 0, preco: 0, credito_atualizado: 0, pct_receber: 0, honorarios_adv: 0, valor_receber: 0, retorno: 0, tir: 0, data_recebimento: '', prazo_decorrido: 0, observacoes: '' };
  const [form, setForm] = useState(emptyForm);

  function handleChange(field, value) {
    const updated = { ...form, [field]: value };
    if (['credito_atualizado', 'pct_receber', 'honorarios_adv'].includes(field)) {
      updated.valor_receber = calcValorReceber(Number(updated.credito_atualizado || 0), Number(updated.pct_receber || 0), Number(updated.honorarios_adv || 0));
    }
    if (['desembolso', 'valor_receber', 'credito_atualizado', 'pct_receber', 'honorarios_adv'].includes(field)) {
      const vr = updated.valor_receber || calcValorReceber(Number(updated.credito_atualizado || 0), Number(updated.pct_receber || 0), Number(updated.honorarios_adv || 0));
      updated.valor_receber = vr;
      updated.retorno = calcRetorno(Number(updated.desembolso || 0), Number(vr));
      updated.tir = calcTIR(Number(updated.desembolso || 0), Number(vr), prazoToMeses(updated.prazo_estimado));
    }
    if (field === 'data_aquisicao') updated.prazo_decorrido = calcPrazoDecorrido(value);
    if (field === 'prazo_estimado') updated.tir = calcTIR(Number(updated.desembolso || 0), Number(updated.valor_receber || 0), prazoToMeses(value));
    setForm(updated);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.cedente || !form.devedor) { alert('Cedente e Devedor são obrigatórios'); return; }
    onCreate(form);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 8 }}>Cadastro</div>
          <div style={S.pageTitle}>Novo Precatório</div>
          <div style={S.pageSub}>Preencha os dados para cadastrar no book</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" style={S.btn('default')} onClick={() => setForm(emptyForm)}>Limpar</button>
          <button type="submit" style={S.btn('primary')}>Cadastrar</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.formSection}>Identificação</div>
        <div style={S.grid3}>
          <div><label style={S.label}>Cedente *</label><input style={S.input} value={form.cedente} onChange={e => handleChange('cedente', e.target.value)} placeholder="Nome do cedente" required /></div>
          <div><label style={S.label}>Devedor *</label><input style={S.input} value={form.devedor} onChange={e => handleChange('devedor', e.target.value)} placeholder="Ex: São Paulo" required /></div>
          <div><label style={S.label}>Esfera *</label><select style={S.select} value={form.esfera} onChange={e => handleChange('esfera', e.target.value)}>{ESFERAS.map(e => <option key={e}>{e}</option>)}</select></div>
          <div><label style={S.label}>Processo (CNJ)</label><input style={S.input} value={form.cnj} onChange={e => handleChange('cnj', e.target.value)} placeholder="0000000-00.0000.0.00.0000" /></div>
          <div><label style={S.label}>Tribunal</label><input style={S.input} value={form.tribunal} onChange={e => handleChange('tribunal', e.target.value)} placeholder="TJSP, TRF1..." /></div>
          <div><label style={S.label}>Advogado</label><input style={S.input} value={form.advogado} onChange={e => handleChange('advogado', e.target.value)} placeholder="Nome" /></div>
          <div><label style={S.label}>Ordem Cronológica</label><input style={S.input} value={form.ordem_cronologica} onChange={e => handleChange('ordem_cronologica', e.target.value)} placeholder="2026, DC..." /></div>
          <div><label style={S.label}>Status</label><select style={S.select} value={form.status} onChange={e => handleChange('status', e.target.value)}>{STATUS_LIST.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label style={S.label}>Prazo Estimado</label><select style={S.select} value={form.prazo_estimado} onChange={e => handleChange('prazo_estimado', e.target.value)}>{PRAZOS.map(p => <option key={p}>{p}</option>)}</select></div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.formSection}>Dados Financeiros</div>
        <div style={S.grid3}>
          <div><label style={S.label}>Data Aquisição</label><input style={S.input} type="date" value={form.data_aquisicao} onChange={e => handleChange('data_aquisicao', e.target.value)} /></div>
          <div><label style={S.label}>Desembolso (R$)</label><input style={S.input} type="number" step="0.01" value={form.desembolso || ''} onChange={e => handleChange('desembolso', e.target.value)} /></div>
          <div><label style={S.label}>Valor Nominal (R$)</label><input style={S.input} type="number" step="0.01" value={form.valor_nominal || ''} onChange={e => handleChange('valor_nominal', e.target.value)} /></div>
          <div><label style={S.label}>Preço (0 a 1)</label><input style={S.input} type="number" step="0.0001" value={form.preco || ''} onChange={e => handleChange('preco', e.target.value)} placeholder="0.43" /></div>
          <div><label style={S.label}>Crédito Atualizado (R$)</label><input style={S.input} type="number" step="0.01" value={form.credito_atualizado || ''} onChange={e => handleChange('credito_atualizado', e.target.value)} /></div>
          <div><label style={S.label}>% a Receber (0 a 1)</label><input style={S.input} type="number" step="0.0001" value={form.pct_receber || ''} onChange={e => handleChange('pct_receber', e.target.value)} placeholder="0.60" /></div>
          <div><label style={S.label}>Honorários Adv.</label><input style={S.input} type="number" step="0.0001" value={form.honorarios_adv || ''} onChange={e => handleChange('honorarios_adv', e.target.value)} /></div>
          <div><label style={S.label}>Valor a Receber — auto</label><input style={{ ...S.input, background: 'var(--bg-elevated)', fontWeight: 600 }} readOnly value={Number(form.valor_receber || 0).toFixed(2)} /></div>
          <div><label style={S.label}>Retorno — auto</label><input style={{ ...S.input, background: 'var(--bg-elevated)', fontWeight: 600 }} readOnly value={fmtPct(form.retorno)} /></div>
          <div><label style={S.label}>Data Recebimento</label><input style={S.input} type="date" value={form.data_recebimento} onChange={e => handleChange('data_recebimento', e.target.value)} /></div>
          <div><label style={S.label}>Prazo Decorrido — auto</label><input style={{ ...S.input, background: 'var(--bg-elevated)' }} readOnly value={Number(form.prazo_decorrido || 0).toFixed(1)} /></div>
          <div><label style={S.label}>TIR (% a.a.) — auto</label><input style={{ ...S.input, background: 'var(--bg-elevated)', fontWeight: 600 }} readOnly value={fmtPct(form.tir)} /></div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.formSection}>Observações</div>
        <textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} value={form.observacoes} onChange={e => handleChange('observacoes', e.target.value)} placeholder="Anotações sobre este precatório..." />
      </div>
    </form>
  );
}

// ============================================================
// ATIVIDADES TAB
// ============================================================
function AtividadesTab({ atividades, precatorios }) {
  const colors = { criacao: 'var(--green)', edicao: 'var(--blue)', exclusao: 'var(--red)', status: 'var(--accent)' };
  const icons = { criacao: '+', edicao: '~', exclusao: '×', status: '↻' };
  const labels = { criacao: 'Criação', edicao: 'Edição', exclusao: 'Exclusão', status: 'Status' };

  return (
    <>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 8 }}>Auditoria</div>
          <div style={S.pageTitle}>Atividades</div>
          <div style={S.pageSub}>Registro automático de todas as alterações no book</div>
        </div>
        <span style={S.badge('var(--green)')}>Ao vivo</span>
      </div>

      {atividades.length === 0 ? (
        <div style={{ ...S.card, ...S.emptyState }}>
          <div style={{ marginBottom: 16, opacity: 0.3 }}>{Icons.activity}</div>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 16, fontFamily: 'var(--font-serif)' }}>Nenhuma atividade registrada</div>
          <div style={{ fontSize: 13 }}>Alterações serão registradas automaticamente aqui</div>
        </div>
      ) : (
        <div style={S.card}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 17, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />
            {atividades.map((a, i) => {
              const prec = precatorios.find(p => p.id === a.precatorio_id);
              return (
                <div key={a.id} style={{ display: 'flex', gap: 16, paddingBottom: i < atividades.length - 1 ? 20 : 0, position: 'relative' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: (colors[a.tipo] || 'var(--text-muted)') + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: colors[a.tipo], flexShrink: 0, zIndex: 1, border: '3px solid var(--bg-card)' }}>
                    {icons[a.tipo] || '•'}
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: colors[a.tipo], textTransform: 'uppercase', letterSpacing: '0.5px' }}>{labels[a.tipo] || a.tipo}</span>
                      {prec && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{prec.cedente}</span>}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{a.descricao}</div>
                    {a.campo && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{a.campo}: <span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{a.valor_anterior}</span> → <span style={{ color: 'var(--green)' }}>{a.valor_novo}</span></div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      {new Date(a.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
