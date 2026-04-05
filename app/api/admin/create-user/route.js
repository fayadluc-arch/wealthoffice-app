import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin endpoint to create new users
// Receives admin's auth token to authenticate the profile insert

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  try {
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ erro: 'Supabase não configurado' }, { status: 500 });
    }

    const { name, email, role, password, adminToken } = await request.json();

    if (!email || !name) {
      return NextResponse.json({ erro: 'Nome e email são obrigatórios' }, { status: 400 });
    }

    const tempPassword = password || `WO_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    if (serviceRoleKey) {
      // Best path: service role key — full admin control
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name },
      });

      if (authError) {
        return NextResponse.json({ erro: authError.message }, { status: 400 });
      }

      await supabase.from('profiles').upsert({
        id: authData.user.id, email, name, role: role || 'client',
      });

      return NextResponse.json({
        sucesso: true, userId: authData.user.id, email,
        senhaTemporaria: tempPassword,
      });
    } else {
      // Fallback: signUp + use admin's token for profile insert
      const anonSupabase = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Step 1: Create auth user via signUp
      const { data: signUpData, error: signUpError } = await anonSupabase.auth.signUp({
        email,
        password: tempPassword,
        options: { data: { name } },
      });

      if (signUpError) {
        return NextResponse.json({ erro: signUpError.message }, { status: 400 });
      }

      const userId = signUpData?.user?.id;

      // Step 2: Use admin's token to insert profile (bypasses RLS since admin is authenticated)
      if (userId && adminToken) {
        const adminSupabase = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${adminToken}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { error: profileError } = await adminSupabase.from('profiles').upsert({
          id: userId, email, name, role: role || 'client',
        });

        if (profileError) {
          console.error('[admin/create-user] profile insert error:', profileError.message);
          // Profile insert failed — try RPC or direct approach
          // The user was created in auth, just profile is missing
          return NextResponse.json({
            sucesso: true, userId, email, senhaTemporaria: tempPassword,
            aviso: 'Usuário criado no auth, mas perfil precisa ser atualizado manualmente. O usuário deve fazer login para aparecer na lista.',
          });
        }
      }

      return NextResponse.json({
        sucesso: true, userId, email, senhaTemporaria: tempPassword,
      });
    }
  } catch (err) {
    console.error('[admin/create-user] error:', err.message);
    return NextResponse.json({ erro: 'Erro ao criar usuário' }, { status: 500 });
  }
}
