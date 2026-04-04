export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08090C', color: '#E8E9ED', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
        <div style={{ fontSize: 72, fontWeight: 700, color: '#2E9E6E', fontFamily: 'Playfair Display, serif', marginBottom: 8 }}>404</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, fontFamily: 'Playfair Display, serif' }}>Página não encontrada</h2>
        <p style={{ fontSize: 14, color: '#8B8D97', lineHeight: 1.7, marginBottom: 32 }}>
          O endereço que você acessou não existe ou foi movido.
        </p>
        <a
          href="/"
          style={{ display: 'inline-block', padding: '12px 32px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#2E9E6E', border: 'none', borderRadius: 10, textDecoration: 'none' }}
        >
          Voltar ao início
        </a>
      </div>
    </div>
  );
}
