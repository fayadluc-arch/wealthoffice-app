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
  'Homologação': '#3B82F6',
  'Transferência': '#22C55E',
  'Análise Procuradoria': '#F59E0B',
  'Fila de Pagamento': '#F97316',
  'Recebido': '#22C55E',
};
const PRAZO_COLORS = {
  'Recebido': '#22C55E',
  '0-6 meses': '#22C55E',
  '6-12 meses': '#F59E0B',
  '12-24 meses': '#F97316',
  '24-36 meses': '#EF4444',
  '+36 meses': '#8B5CF6',
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
  const pct = pctReceber || 0;
  const hon = honorariosAdv || 0;
  return creditoAtualizado * pct * (1 + hon);
}
function calcPrazoDecorrido(dataAquisicao) {
  if (!dataAquisicao) return 0;
  const d = new Date(dataAquisicao);
  const now = new Date();
  return Math.round(((now - d) / (1000 * 60 * 60 * 24 * 30.44)) * 10) / 10;
}
function calcTIR(desembolso, valorReceber, prazoMeses) {
  if (!desembolso || desembolso <= 0 || !valorReceber || !prazoMeses || prazoMeses <= 0) return 0;
  const years = prazoMeses / 12;
  return Math.pow(valorReceber / desembolso, 1 / years) - 1;
}
function prazoToMeses(prazo) {
  const map = { 'Recebido': 0, '0-6 meses': 3, '6-12 meses': 9, '12-24 meses': 18, '24-36 meses': 30, '+36 meses': 48 };
  return map[prazo] || 12;
}

// ============================================================
// ICONS (SVG inline)
// ============================================================
const Icons = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  book: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  activity: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  edit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  sort: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

// ============================================================
// STYLES (Premium)
// ============================================================
const S = {
  app: { display: 'flex', minHeight: '100vh' },
  sidebar: { width: 260, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100, backdropFilter: 'blur(20px)' },
  sidebarLogo: { padding: '28px 24px 24px', borderBottom: '1px solid var(--border)' },
  logoText: { fontSize: 24, fontWeight: 800, background: 'linear-gradient(135deg, #2E9E6E 0%, #3CC486 50%, #2E9E6E 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' },
  logoSub: { fontSize: 10, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500 },
  nav: { flex: 1, padding: '16px 12px' },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: active ? 'var(--gold)' : 'var(--text-secondary)', background: active ? 'var(--gold-dim)' : 'transparent', fontSize: 13.5, fontWeight: active ? 600 : 400, transition: 'all var(--transition)', border: 'none', width: '100%', textAlign: 'left', letterSpacing: '-0.01em', marginBottom: 2 }),
  sidebarFooter: { padding: '18px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  main: { flex: 1, marginLeft: 260, padding: '28px 36px 40px', minHeight: '100vh', maxWidth: 'calc(100vw - 260px)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  pageTitle: { fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' },
  pageSub: { fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 },
  card: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 24, marginBottom: 20, boxShadow: 'var(--shadow-sm)', transition: 'all var(--transition)' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 28 },
  kpiCard: (highlight) => ({ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: highlight ? '1px solid rgba(201,151,91,0.4)' : '1px solid var(--border)', padding: '20px 24px', boxShadow: highlight ? '0 0 30px rgba(201,151,91,0.06)' : 'var(--shadow-sm)', transition: 'all var(--transition)' }),
  kpiLabel: { fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 },
  kpiValue: (color) => ({ fontSize: 24, fontWeight: 700, color: color || 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }),
  kpiSub: { fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '-0.01em' },
  btn: (variant) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13, fontWeight: 600, border: 'none', transition: 'all var(--transition)', letterSpacing: '-0.01em',
    ...(variant === 'primary' ? { background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)', color: '#fff', boxShadow: '0 2px 8px rgba(201,151,91,0.25)' } :
       variant === 'danger' ? { background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.2)' } :
       { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' })
  }),
  input: { width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', transition: 'all var(--transition)' },
  select: { width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', transition: 'all var(--transition)' },
  label: { fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7, display: 'block', letterSpacing: '0.02em' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 },
  th: (sortable) => ({ textAlign: 'left', padding: '12px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)', cursor: sortable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }),
  td: { padding: '14px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', transition: 'background var(--transition)' },
  badge: (color) => ({ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: color, background: color + '15', border: `1px solid ${color}30`, letterSpacing: '-0.01em' }),
  filterBar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  filterBtn: (active) => ({ padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: active ? '1px solid var(--gold)' : '1px solid var(--border)', background: active ? 'var(--gold-dim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text-secondary)', transition: 'all var(--transition)', letterSpacing: '-0.01em' }),
  searchInput: { padding: '9px 14px 9px 38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: 300, transition: 'all var(--transition)' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  formSection: { fontSize: 15, fontWeight: 700, marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid var(--border)', letterSpacing: '-0.01em', color: 'var(--text-primary)' },
  row: (clickable) => ({ cursor: clickable ? 'pointer' : 'default', transition: 'background var(--transition)' }),
  totalsBar: { display: 'flex', gap: 32, padding: '14px 0', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, letterSpacing: '-0.01em' },
  emptyState: { textAlign: 'center', padding: '70px 20px', color: 'var(--text-muted)' },
  // Auth styles
  authContainer: { display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' },
  authCard: { width: 440, background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', padding: '48px 44px', boxShadow: 'var(--shadow-lg), 0 0 80px rgba(201,151,91,0.04)' },
  authTitle: { fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 8, letterSpacing: '-0.03em' },
  authSub: { fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 36, lineHeight: 1.5 },
};

// ============================================================
// AUTH SCREEN
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
      if (!supabase) {
        setError('Supabase não configurado');
        setLoading(false);
        return;
      }
      if (mode === 'login') {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onAuth(data.user);
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } }
        });
        if (err) throw err;
        if (data.user) onAuth(data.user);
      }
    } catch (err) {
      setError(err.message || 'Erro ao autenticar');
    }
    setLoading(false);
  }

  const features = [
    { icon: '⚖', title: 'Precatórios', desc: 'Controle completo do book com TIR, retorno e prazos automáticos' },
    { icon: '🏢', title: 'Real Estate', desc: 'Imóveis, FIIs e participações imobiliárias em um só lugar' },
    { icon: '📊', title: 'Private Equity & VC', desc: 'Acompanhe rodadas, valuations e documentos de investimento' },
    { icon: '📁', title: 'Cofre Digital', desc: 'Contratos, escrituras e documentos com criptografia AES-256' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* ===== NAVBAR ===== */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>W</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>WealthOffice</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Escritório Digital</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Sobre</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Recursos</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Contato</span>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <div style={{ position: 'relative', padding: '40px 48px 80px' }}>
        {/* Background decorations */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46,158,110,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -200, left: '30%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46,158,110,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 60, left: '15%', width: 1, height: 120, background: 'linear-gradient(to bottom, transparent, rgba(46,158,110,0.2), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 30, right: '25%', width: 1, height: 80, background: 'linear-gradient(to bottom, transparent, rgba(46,158,110,0.15), transparent)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', gap: 60, alignItems: 'center', maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          {/* LEFT: Content */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 20, background: 'var(--accent-dim)', border: '1px solid rgba(46,158,110,0.2)', fontSize: 12, fontWeight: 600, color: 'var(--accent-light)', marginBottom: 28, letterSpacing: '0.02em' }}>
              Plataforma para investidores qualificados
            </div>

            <h1 style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 24, fontFamily: "'Playfair Display', serif" }}>
              O escritório digital<br />dos seus{' '}
              <span style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ativos alternativos
              </span>
            </h1>

            <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 500, marginBottom: 36 }}>
              Gerencie precatórios, imóveis, private equity e crédito estruturado. Documentos, contratos e análises financeiras — tudo em um único lugar seguro.
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
              <button onClick={() => document.getElementById('auth-form')?.scrollIntoView({ behavior: 'smooth' })} style={{ ...S.btn('primary'), padding: '14px 32px', fontSize: 15, fontWeight: 700, borderRadius: 12 }}>
                Começar agora
              </button>
              <button style={{ ...S.btn('default'), padding: '14px 28px', fontSize: 14, borderRadius: 12 }}>
                Saiba mais
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 40 }}>
              {[
                { val: 'R$ 50M+', label: 'Em ativos gerenciados' },
                { val: 'AES-256', label: 'Criptografia' },
                { val: '99.9%', label: 'Uptime garantido' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: "'Playfair Display', serif" }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Auth Card */}
          <div id="auth-form" style={{ minWidth: 420 }}>
            <div style={{ ...S.authCard, background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%)', border: '1px solid var(--border-light)', position: 'relative', overflow: 'hidden' }} className="fade-in">
              {/* Card accent line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-light), var(--accent))' }} />

              <div style={{ ...S.authTitle, fontFamily: "'Playfair Display', serif", marginTop: 8 }}>{mode === 'login' ? 'Bem-vindo' : 'Criar conta'}</div>
              <div style={S.authSub}>{mode === 'login' ? 'Acesse seu escritório digital de ativos' : 'Comece a organizar seus ativos alternativos'}</div>
              <form onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <div style={{ marginBottom: 18 }}>
                    <label style={S.label}>Nome completo</label>
                    <input style={S.input} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required />
                  </div>
                )}
                <div style={{ marginBottom: 18 }}>
                  <label style={S.label}>E-mail</label>
                  <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={S.label}>Senha</label>
                  <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14, textAlign: 'center', padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
                <button type="submit" style={{ ...S.btn('primary'), width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 12 }} disabled={loading}>
                  {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
                {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
                  {mode === 'login' ? 'Criar conta grátis' : 'Entrar'}
                </span>
              </div>
              <div style={{ textAlign: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Seus dados são protegidos com criptografia<br />de ponta a ponta.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FEATURES SECTION ===== */}
      <div style={{ padding: '80px 48px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>Recursos</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'Playfair Display', serif" }}>
            Tudo que você precisa para gerenciar<br />seus investimentos alternativos
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: '28px 24px', transition: 'all 0.2s' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-dim)', border: '1px solid rgba(46,158,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 20 }}>{f.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.01em' }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div style={{ padding: '32px 48px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>2026 WealthOffice. Todos os direitos reservados.</div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ cursor: 'pointer' }}>Termos de Uso</span>
          <span style={{ cursor: 'pointer' }}>Privacidade</span>
          <span style={{ cursor: 'pointer' }}>Contato</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DONUT CHART (CSS)
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
    <div style={{ width: size, height: size, borderRadius: '50%', background: `conic-gradient(${gradParts.join(', ')})`, position: 'relative' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: size * 0.6, height: size * 0.6, borderRadius: '50%', background: 'var(--bg-card)' }} />
    </div>
  );
}

// ============================================================
// BAR CHART (CSS)
// ============================================================
function BarChart({ data, height = 200 }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.v1 || 0, d.v2 || 0)), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, paddingTop: 20 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
            <div style={{ width: '40%', height: Math.max(4, (d.v1 / maxVal) * (height - 40)), background: 'var(--blue)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
            <div style={{ width: '40%', height: Math.max(4, (d.v2 / maxVal) * (height - 40)), background: 'var(--green)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
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
export default function WealthOfficeApp() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // App state
  const [tab, setTab] = useState('dashboard');
  const [precatorios, setPrecatorios] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  // Detail/Edit
  const [selectedId, setSelectedId] = useState(null);
  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Check session
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

  // Load data
  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('precatorios').select('*').order('created_at', { ascending: false }),
      supabase.from('atividades').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setPrecatorios(p || []);
    setAtividades(a || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  // CRUD helpers
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

  // Auth guard
  if (!authChecked) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>Carregando...</div>;
  if (!user) return <AuthScreen onAuth={setUser} />;

  const profileName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';

  // Navigate to detail
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
          <div style={S.logoText}>W.O</div>
          <div style={S.logoSub}>WEALTHOFFICE</div>
        </div>
        <nav style={S.nav}>
          {navItems.map(n => (
            <button key={n.id} style={S.navItem(tab === n.id || (n.id === 'book' && tab === 'detalhe'))} onClick={() => { setTab(n.id); if (n.id !== 'detalhe') setSelectedId(null); }}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
        <div style={S.sidebarFooter}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{profileName}</span>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} onClick={handleLogout} title="Sair">
            {Icons.settings}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={S.main}>
        {tab === 'dashboard' && <DashboardTab precatorios={precatorios} onNavigate={setTab} />}
        {tab === 'book' && <BookTab precatorios={precatorios} onDetail={openDetail} onExport={exportCSV} onNavigate={setTab} onDelete={id => setDeleteConfirm(id)} />}
        {tab === 'detalhe' && <DetalheTab precatorio={precatorios.find(p => p.id === selectedId)} onBack={() => setTab('book')} onSave={updatePrecatorio} onDelete={id => setDeleteConfirm(id)} atividades={atividades.filter(a => a.precatorio_id === selectedId)} />}
        {tab === 'buscar' && <BuscarTab precatorios={precatorios} onDetail={openDetail} />}
        {tab === 'novo' && <NovoTab onCreate={createPrecatorio} />}
        {tab === 'atividades' && <AtividadesTab atividades={atividades} precatorios={precatorios} />}
      </main>

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ ...S.card, width: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Excluir Precatório?</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>Esta ação não pode ser desfeita. O precatório e todo seu histórico serão removidos.</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={S.btn('default')} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button style={S.btn('danger')} onClick={() => deletePrecatorio(deleteConfirm)}>Excluir</button>
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
function DashboardTab({ precatorios, onNavigate }) {
  const ativos = precatorios.filter(p => p.status !== 'Recebido');
  const totalDesembolso = precatorios.reduce((s, p) => s + Number(p.desembolso || 0), 0);
  const totalNominal = precatorios.reduce((s, p) => s + Number(p.valor_nominal || 0), 0);
  const totalReceber = precatorios.reduce((s, p) => s + Number(p.valor_receber || 0), 0);
  const totalLucro = totalReceber - totalDesembolso;
  const avgRetorno = precatorios.length > 0 ? precatorios.reduce((s, p) => s + Number(p.retorno || 0), 0) / precatorios.length : 0;
  const avgTIR = precatorios.length > 0 ? precatorios.reduce((s, p) => s + Number(p.tir || 0), 0) / precatorios.length : 0;

  // Status distribution
  const statusData = STATUS_LIST.map(st => ({ label: st, value: precatorios.filter(p => p.status === st).length, color: STATUS_COLORS[st] }));
  // Esfera distribution
  const esferaData = ESFERAS.map(e => ({ label: e, count: precatorios.filter(p => p.esfera === e).length, total: precatorios.filter(p => p.esfera === e).reduce((s, p) => s + Number(p.desembolso || 0), 0) }));
  // Prazo distribution
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
      <div style={S.header}>
        <div>
          <div style={S.pageTitle}>Dashboard</div>
          <div style={S.pageSub}>Visão consolidada do book — {today}</div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={S.kpiGrid}>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}>Precatórios</div>
          <div style={S.kpiValue()}>{precatorios.length}</div>
          <div style={S.kpiSub}>ativos no book</div>
        </div>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}>Desembolso Total</div>
          <div style={S.kpiValue()}>{fmtBRL(totalDesembolso)}</div>
          <div style={S.kpiSub}>capital investido</div>
        </div>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}>Valor de Face</div>
          <div style={S.kpiValue()}>{fmtBRL(totalNominal)}</div>
          <div style={S.kpiSub}>valor nominal</div>
        </div>
        <div style={S.kpiCard(true)}>
          <div style={S.kpiLabel}>A Receber</div>
          <div style={S.kpiValue('var(--gold)')}>{fmtBRL(totalReceber)}</div>
          <div style={S.kpiSub}>valor atualizado</div>
        </div>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}>Lucro Estimado</div>
          <div style={S.kpiValue('var(--green)')}>{fmtBRL(totalLucro)}</div>
          <div style={S.kpiSub}>{fmtPct(totalDesembolso > 0 ? totalLucro / totalDesembolso : 0)} sobre desembolso</div>
        </div>
        <div style={S.kpiCard(false)}>
          <div style={S.kpiLabel}>Retorno Médio</div>
          <div style={S.kpiValue()}>{fmtPct(avgRetorno)}</div>
          <div style={S.kpiSub}>TIR: {fmtPct(avgTIR)}</div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ color: 'var(--text-muted)' }}>&#9201;</span>
            <span style={{ fontWeight: 600 }}>Distribuição por Prazo Estimado</span>
          </div>
          <BarChart data={prazoBarData} height={180} />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--blue)', display: 'inline-block' }} /> Desembolso
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> A Receber
            </span>
          </div>
        </div>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ color: 'var(--text-muted)' }}>&#9776;</span>
            <span style={{ fontWeight: 600 }}>Status do Book</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <DonutChart data={statusData} size={140} />
            <div style={{ flex: 1 }}>
              {statusData.map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.label}
                  </span>
                  <span style={{ fontWeight: 600 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ESFERA + PRAZO TABLES */}
      <div style={{ ...S.grid2, marginTop: 0 }}>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Por Esfera</div>
          {esferaData.map(e => (
            <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ ...S.badge(e.label === 'Estadual' ? 'var(--blue)' : e.label === 'Federal' ? 'var(--green)' : 'var(--gold)'), fontSize: 12 }}>{e.label}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.count} prec.</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{fmtBRL(e.total)}</span>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Resumo por Prazo</div>
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
                  <td style={S.td}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: PRAZO_COLORS[r.prazo] }} />{r.prazo}</span></td>
                  <td style={S.td}>{r.qtd}</td>
                  <td style={S.td}>{fmtBRL(r.desembolso)}</td>
                  <td style={{ ...S.td, color: 'var(--gold)' }}>{fmtBRL(r.receber)}</td>
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
          <div style={S.pageTitle}>Book de Precatórios</div>
          <div style={S.pageSub}>{filtered.length} de {precatorios.length} precatórios</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn('default')} onClick={onExport}>{Icons.download} Exportar CSV</button>
          <button style={S.btn('primary')} onClick={() => onNavigate('novo')}>{Icons.plus} Novo Precatório</button>
        </div>
      </div>

      {/* FILTERS */}
      <div style={S.filterBar}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{Icons.search}</span>
          <input style={S.searchInput} placeholder="Buscar por processo, cedente, devedor..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>
        {['Todos', ...ESFERAS].map(e => (
          <button key={e} style={S.filterBtn(filterEsfera === e)} onClick={() => setFilterEsfera(e)}>{e}</button>
        ))}
        <select style={{ ...S.select, width: 'auto', padding: '6px 12px', fontSize: 12 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="Todos">Todos os status</option>
          {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* TOTALS */}
      <div style={S.totalsBar}>
        <span>Desembolso filtrado: <strong style={{ color: 'var(--text-primary)' }}>{fmtBRL(totals.desembolso)}</strong></span>
        <span>A Receber: <strong style={{ color: 'var(--gold)' }}>{fmtBRL(totals.receber)}</strong></span>
        <span>Spread: <strong style={{ color: 'var(--green)' }}>{fmtBRL(totals.receber - totals.desembolso)}</strong></span>
      </div>

      {/* TABLE */}
      <div style={{ ...S.card, padding: 0, overflow: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th()}>#</th>
              <th style={S.th(true)} onClick={() => handleSort('esfera')}>Esfera {sortCol === 'esfera' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th(true)} onClick={() => handleSort('devedor')}>Devedor {sortCol === 'devedor' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th(true)} onClick={() => handleSort('cedente')}>Cedente {sortCol === 'cedente' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th()}>Nº Processo</th>
              <th style={S.th(true)} onClick={() => handleSort('status')}>Status {sortCol === 'status' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th()}>Prazo</th>
              <th style={S.th(true)} onClick={() => handleSort('desembolso')}>Desembolso {sortCol === 'desembolso' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th style={S.th()}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} style={S.row(true)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''} onClick={() => onDetail(p.id)}>
                <td style={S.td}>{i + 1}</td>
                <td style={S.td}><span style={S.badge(p.esfera === 'Estadual' ? 'var(--blue)' : p.esfera === 'Federal' ? 'var(--green)' : 'var(--gold)')}>{p.esfera}</span></td>
                <td style={S.td}>{p.devedor}</td>
                <td style={{ ...S.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.cedente}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{p.cnj || '—'}</td>
                <td style={S.td}><span style={S.badge(STATUS_COLORS[p.status] || 'var(--text-muted)')}>{p.status}</span></td>
                <td style={S.td}><span style={S.badge(PRAZO_COLORS[p.prazo_estimado] || 'var(--text-muted)')}>{p.prazo_estimado}</span></td>
                <td style={{ ...S.td, fontWeight: 500 }}>{fmtBRL(p.desembolso)}</td>
                <td style={S.td} onClick={e => { e.stopPropagation(); onDelete(p.id); }}>
                  <span style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>{Icons.trash}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={S.emptyState}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#128209;</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Nenhum precatório encontrado</div>
            <div style={{ fontSize: 13 }}>Ajuste os filtros ou adicione um novo precatório</div>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// DETALHE TAB
// ============================================================
function DetalheTab({ precatorio, onBack, onSave, onDelete, atividades }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const originalRef = useRef({});

  useEffect(() => {
    if (precatorio) {
      const data = { ...precatorio };
      setForm(data);
      originalRef.current = { ...data };
    }
  }, [precatorio]);

  if (!precatorio) return <div style={S.emptyState}>Precatório não encontrado</div>;

  function handleChange(field, value) {
    const updated = { ...form, [field]: value };
    // Auto-calculations
    if (['credito_atualizado', 'pct_receber', 'honorarios_adv'].includes(field)) {
      updated.valor_receber = calcValorReceber(Number(updated.credito_atualizado || 0), Number(updated.pct_receber || 0), Number(updated.honorarios_adv || 0));
    }
    if (['desembolso', 'valor_receber'].includes(field) || ['credito_atualizado', 'pct_receber', 'honorarios_adv'].includes(field)) {
      const vr = updated.valor_receber || calcValorReceber(Number(updated.credito_atualizado || 0), Number(updated.pct_receber || 0), Number(updated.honorarios_adv || 0));
      updated.valor_receber = vr;
      updated.retorno = calcRetorno(Number(updated.desembolso || 0), Number(vr));
      updated.tir = calcTIR(Number(updated.desembolso || 0), Number(vr), prazoToMeses(updated.prazo_estimado));
    }
    if (field === 'data_aquisicao') {
      updated.prazo_decorrido = calcPrazoDecorrido(value);
    }
    if (field === 'prazo_estimado') {
      updated.tir = calcTIR(Number(updated.desembolso || 0), Number(updated.valor_receber || 0), prazoToMeses(value));
    }
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

  return (
    <>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...S.btn('default'), padding: '6px 10px' }} onClick={onBack}>{Icons.back}</button>
          <div>
            <div style={S.pageTitle}>{form.cedente || 'Detalhe'}</div>
            <div style={S.pageSub}>{form.cnj || 'Sem CNJ'} — {form.esfera} — {form.devedor}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn('danger')} onClick={() => onDelete(precatorio.id)}>{Icons.trash} Excluir</button>
          <button style={S.btn('primary')} onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Alterações'}</button>
        </div>
      </div>

      {/* FORM */}
      <div style={S.card}>
        <div style={S.formSection}>Identificação</div>
        <div style={S.grid3}>
          <div><label style={S.label}>Cedente (Credor Original) *</label><input style={S.input} value={form.cedente || ''} onChange={e => handleChange('cedente', e.target.value)} /></div>
          <div><label style={S.label}>Devedor (Ente Público) *</label><input style={S.input} value={form.devedor || ''} onChange={e => handleChange('devedor', e.target.value)} /></div>
          <div><label style={S.label}>Esfera *</label><select style={S.select} value={form.esfera || ''} onChange={e => handleChange('esfera', e.target.value)}>{ESFERAS.map(e => <option key={e}>{e}</option>)}</select></div>
          <div><label style={S.label}>Nº Processo (CNJ)</label><input style={S.input} value={form.cnj || ''} onChange={e => handleChange('cnj', e.target.value)} /></div>
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
          <div><label style={S.label}>Data de Aquisição</label><input style={S.input} type="date" value={form.data_aquisicao || ''} onChange={e => handleChange('data_aquisicao', e.target.value)} /></div>
          <div><label style={S.label}>Desembolso (R$)</label><input style={S.input} type="number" step="0.01" value={form.desembolso || ''} onChange={e => handleChange('desembolso', e.target.value)} /></div>
          <div><label style={S.label}>Valor Nominal Crédito (R$)</label><input style={S.input} type="number" step="0.01" value={form.valor_nominal || ''} onChange={e => handleChange('valor_nominal', e.target.value)} /></div>
          <div><label style={S.label}>Preço (0 a 1)</label><input style={S.input} type="number" step="0.0001" value={form.preco || ''} onChange={e => handleChange('preco', e.target.value)} /></div>
          <div><label style={S.label}>Crédito Atualizado (R$)</label><input style={S.input} type="number" step="0.01" value={form.credito_atualizado || ''} onChange={e => handleChange('credito_atualizado', e.target.value)} /></div>
          <div><label style={S.label}>% a Receber (0 a 1)</label><input style={S.input} type="number" step="0.0001" value={form.pct_receber || ''} onChange={e => handleChange('pct_receber', e.target.value)} /></div>
          <div><label style={S.label}>Honorários Adv. (ex: -0.03)</label><input style={S.input} type="number" step="0.0001" value={form.honorarios_adv || ''} onChange={e => handleChange('honorarios_adv', e.target.value)} /></div>
          <div><label style={S.label}>Valor a Receber (R$)</label><input style={{ ...S.input, background: 'var(--bg-hover)', fontWeight: 600 }} type="number" readOnly value={Number(form.valor_receber || 0).toFixed(2)} /></div>
          <div><label style={S.label}>Retorno</label><input style={{ ...S.input, background: 'var(--bg-hover)', fontWeight: 600 }} readOnly value={fmtPct(form.retorno)} /></div>
          <div><label style={S.label}>Data de Recebimento</label><input style={S.input} type="date" value={form.data_recebimento || ''} onChange={e => handleChange('data_recebimento', e.target.value)} /></div>
          <div><label style={S.label}>Prazo Decorrido (meses)</label><input style={{ ...S.input, background: 'var(--bg-hover)' }} readOnly value={Number(form.prazo_decorrido || 0).toFixed(1)} /></div>
          <div><label style={S.label}>TIR (% a.a.)</label><input style={{ ...S.input, background: 'var(--bg-hover)', fontWeight: 600 }} readOnly value={fmtPct(form.tir)} /></div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.formSection}>Observações</div>
        <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} value={form.observacoes || ''} onChange={e => handleChange('observacoes', e.target.value)} placeholder="Anotações sobre este precatório..." />
      </div>

      {/* ACTIVITY LOG */}
      {atividades && atividades.length > 0 && (
        <div style={S.card}>
          <div style={S.formSection}>Histórico de Alterações</div>
          {atividades.map(a => (
            <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(a.created_at).toLocaleString('pt-BR')}</span>
              <span style={{ marginLeft: 12 }}>{a.descricao}</span>
              {a.campo && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>({a.valor_anterior} → {a.valor_novo})</span>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================
// BUSCAR TAB
// ============================================================
function BuscarTab({ precatorios, onDetail }) {
  const [cnj, setCnj] = useState('');
  const [results, setResults] = useState(null);

  function handleBuscar() {
    if (!cnj.trim()) return;
    const q = cnj.trim().toLowerCase();
    const found = precatorios.filter(p => (p.cnj || '').toLowerCase().includes(q));
    setResults(found);
  }

  return (
    <>
      <div style={S.header}>
        <div>
          <div style={S.pageTitle}>Buscar Processo</div>
          <div style={S.pageSub}>Consulte pelo número CNJ e veja o status no seu book ou acesse diretamente nos tribunais.</div>
        </div>
      </div>

      <div style={S.card}>
        <label style={S.label}>Número do Processo (CNJ)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...S.input, flex: 1 }} value={cnj} onChange={e => setCnj(e.target.value)} placeholder="Ex: 0423510-23.1997.8.26.0053" onKeyDown={e => e.key === 'Enter' && handleBuscar()} />
          <button style={S.btn('primary')} onClick={handleBuscar}>{Icons.search} Buscar</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Formatos aceitos: 0000000-00.0000.0.00.0000 (CNJ unificado)</div>
      </div>

      {results !== null && (
        results.length > 0 ? (
          <div style={S.card}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Encontrados no seu Book ({results.length})</div>
            {results.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => onDetail(p.id)}>
                <div>
                  <div style={{ fontWeight: 500 }}>{p.cedente} vs {p.devedor}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.cnj}</div>
                </div>
                <span style={S.badge(STATUS_COLORS[p.status])}>{p.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={S.card}>
            <div style={S.emptyState}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{Icons.search}</div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>Processo não encontrado no seu book</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>Consulte diretamente nos tribunais:</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {['TJSP', 'TRF1', 'TRF2', 'TRF3', 'TRF4', 'TRF5'].map(t => (
                  <a key={t} href={t.startsWith('TRF') ? `https://www.${t.toLowerCase()}.jus.br` : `https://esaj.tjsp.jus.br`} target="_blank" rel="noopener noreferrer" style={{ ...S.btn('default'), textDecoration: 'none', fontSize: 12 }}>{t}</a>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {results === null && (
        <div style={{ ...S.card, ...S.emptyState }}>
          <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--text-muted)' }}>{Icons.search}</div>
          <div>Digite o número do processo acima para buscar</div>
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
          <div style={S.pageTitle}>Novo Precatório</div>
          <div style={S.pageSub}>Preencha os dados para cadastrar um novo precatório no book</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={S.btn('default')} onClick={() => setForm(emptyForm)}>Limpar</button>
          <button type="submit" style={S.btn('primary')}>Cadastrar Precatório</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.formSection}>Identificação</div>
        <div style={S.grid3}>
          <div><label style={S.label}>Cedente (Credor Original) *</label><input style={S.input} value={form.cedente} onChange={e => handleChange('cedente', e.target.value)} placeholder="Nome do cedente" required /></div>
          <div><label style={S.label}>Devedor (Ente Público) *</label><input style={S.input} value={form.devedor} onChange={e => handleChange('devedor', e.target.value)} placeholder="Ex: São Paulo, Brasil" required /></div>
          <div><label style={S.label}>Esfera *</label><select style={S.select} value={form.esfera} onChange={e => handleChange('esfera', e.target.value)}>{ESFERAS.map(e => <option key={e}>{e}</option>)}</select></div>
          <div><label style={S.label}>Nº Processo (CNJ)</label><input style={S.input} value={form.cnj} onChange={e => handleChange('cnj', e.target.value)} placeholder="0000000-00.0000.0.00.0000" /></div>
          <div><label style={S.label}>Tribunal</label><input style={S.input} value={form.tribunal} onChange={e => handleChange('tribunal', e.target.value)} placeholder="Ex: TJSP, TRF1" /></div>
          <div><label style={S.label}>Advogado</label><input style={S.input} value={form.advogado} onChange={e => handleChange('advogado', e.target.value)} placeholder="Nome do advogado" /></div>
          <div><label style={S.label}>Ordem Cronológica</label><input style={S.input} value={form.ordem_cronologica} onChange={e => handleChange('ordem_cronologica', e.target.value)} placeholder="Ex: 2026, DC, Depositado" /></div>
          <div><label style={S.label}>Status</label><select style={S.select} value={form.status} onChange={e => handleChange('status', e.target.value)}>{STATUS_LIST.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label style={S.label}>Prazo Estimado</label><select style={S.select} value={form.prazo_estimado} onChange={e => handleChange('prazo_estimado', e.target.value)}>{PRAZOS.map(p => <option key={p}>{p}</option>)}</select></div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.formSection}>Dados Financeiros</div>
        <div style={S.grid3}>
          <div><label style={S.label}>Data de Aquisição</label><input style={S.input} type="date" value={form.data_aquisicao} onChange={e => handleChange('data_aquisicao', e.target.value)} /></div>
          <div><label style={S.label}>Desembolso (R$)</label><input style={S.input} type="number" step="0.01" value={form.desembolso || ''} onChange={e => handleChange('desembolso', e.target.value)} /></div>
          <div><label style={S.label}>Valor Nominal Crédito (R$)</label><input style={S.input} type="number" step="0.01" value={form.valor_nominal || ''} onChange={e => handleChange('valor_nominal', e.target.value)} /></div>
          <div><label style={S.label}>Preço (0 a 1)</label><input style={S.input} type="number" step="0.0001" value={form.preco || ''} onChange={e => handleChange('preco', e.target.value)} placeholder="Ex: 0.43" /></div>
          <div><label style={S.label}>Crédito Atualizado (R$)</label><input style={S.input} type="number" step="0.01" value={form.credito_atualizado || ''} onChange={e => handleChange('credito_atualizado', e.target.value)} /></div>
          <div><label style={S.label}>% a Receber (0 a 1)</label><input style={S.input} type="number" step="0.0001" value={form.pct_receber || ''} onChange={e => handleChange('pct_receber', e.target.value)} placeholder="Ex: 0.60" /></div>
          <div><label style={S.label}>Honorários Adv. (ex: -0.03)</label><input style={S.input} type="number" step="0.0001" value={form.honorarios_adv || ''} onChange={e => handleChange('honorarios_adv', e.target.value)} /></div>
          <div><label style={S.label}>Valor a Receber (R$) — auto</label><input style={{ ...S.input, background: 'var(--bg-hover)', fontWeight: 600 }} readOnly value={Number(form.valor_receber || 0).toFixed(2)} /></div>
          <div><label style={S.label}>Retorno — auto</label><input style={{ ...S.input, background: 'var(--bg-hover)', fontWeight: 600 }} readOnly value={fmtPct(form.retorno)} /></div>
          <div><label style={S.label}>Data de Recebimento</label><input style={S.input} type="date" value={form.data_recebimento} onChange={e => handleChange('data_recebimento', e.target.value)} /></div>
          <div><label style={S.label}>Prazo Decorrido (meses) — auto</label><input style={{ ...S.input, background: 'var(--bg-hover)' }} readOnly value={Number(form.prazo_decorrido || 0).toFixed(1)} /></div>
          <div><label style={S.label}>TIR (% a.a.) — auto</label><input style={{ ...S.input, background: 'var(--bg-hover)', fontWeight: 600 }} readOnly value={fmtPct(form.tir)} /></div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.formSection}>Observações</div>
        <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} value={form.observacoes} onChange={e => handleChange('observacoes', e.target.value)} placeholder="Anotações sobre este precatório..." />
      </div>
    </form>
  );
}

// ============================================================
// ATIVIDADES TAB
// ============================================================
function AtividadesTab({ atividades, precatorios }) {
  const tipoIcon = { criacao: '✚', edicao: '✏', exclusao: '✕', status: '↻' };
  const tipoColor = { criacao: 'var(--green)', edicao: 'var(--blue)', exclusao: 'var(--red)', status: 'var(--gold)' };

  return (
    <>
      <div style={S.header}>
        <div>
          <div style={S.pageTitle}>Histórico de Atividades</div>
          <div style={S.pageSub}>Registro automático de todas as mudanças no book</div>
        </div>
        <span style={S.badge('var(--green)')}>● Ao vivo</span>
      </div>

      {atividades.length === 0 ? (
        <div style={{ ...S.card, ...S.emptyState }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{Icons.activity}</div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Nenhuma atividade registrada ainda.</div>
          <div style={{ fontSize: 13 }}>As mudanças de status, prazo e outros campos serão registradas automaticamente aqui.</div>
        </div>
      ) : (
        <div style={S.card}>
          {atividades.map(a => {
            const prec = precatorios.find(p => p.id === a.precatorio_id);
            return (
              <div key={a.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: (tipoColor[a.tipo] || 'var(--text-muted)') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: tipoColor[a.tipo], flexShrink: 0 }}>
                  {tipoIcon[a.tipo] || '•'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{a.descricao}</div>
                  {a.campo && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{a.campo}: {a.valor_anterior} → {a.valor_novo}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(a.created_at).toLocaleString('pt-BR')}
                    {prec && <span> · {prec.cedente}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
