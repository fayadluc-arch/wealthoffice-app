import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin endpoint to create new users
// Uses service_role key if available, otherwise anon key with signUp

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  try {
    const { name, email, role, password } = await request.json();

    if (!email || !name) {
      return NextResponse.json({ erro: 'Nome e email são obrigatórios' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey || anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate a temporary password if not provided
    const tempPassword = password || `WO_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    if (serviceRoleKey) {
      // Admin API — create user directly (no confirmation email needed)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // auto-confirm
        user_metadata: { name },
      });

      if (authError) {
        console.error('[admin/create-user] auth error:', authError.message);
        return NextResponse.json({ erro: authError.message }, { status: 400 });
      }

      // Update profile with role
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        email,
        name,
        role: role || 'client',
      });

      if (profileError) {
        console.error('[admin/create-user] profile error:', profileError.message);
      }

      return NextResponse.json({
        sucesso: true,
        userId: authData.user.id,
        email,
        senhaTemporaria: tempPassword,
        mensagem: `Usuário criado. Senha temporária: ${tempPassword}`,
      });
    } else {
      // Fallback: use signUp (sends confirmation email)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: { data: { name } },
      });

      if (signUpError) {
        console.error('[admin/create-user] signup error:', signUpError.message);
        return NextResponse.json({ erro: signUpError.message }, { status: 400 });
      }

      // Try to update profile role
      if (signUpData?.user?.id) {
        await supabase.from('profiles').upsert({
          id: signUpData.user.id,
          email,
          name,
          role: role || 'client',
        });
      }

      return NextResponse.json({
        sucesso: true,
        userId: signUpData?.user?.id,
        email,
        senhaTemporaria: tempPassword,
        mensagem: `Conta criada. O usuário receberá email de confirmação. Senha temporária: ${tempPassword}`,
      });
    }
  } catch (err) {
    console.error('[admin/create-user] error:', err.message);
    return NextResponse.json({ erro: 'Erro ao criar usuário' }, { status: 500 });
  }
}
