import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (data.session) {
        const { provider_token, provider_refresh_token, user } = data.session
        if (provider_token && user) {
          // Store the tokens so we can use them for Gmail sync
          await supabase.from('profiles').update({
            google_access_token: provider_token,
            google_refresh_token: provider_refresh_token,
            gmail_connected: true,
          }).eq('id', user.id)
        }
      }
      return response
    }
  }

  // Something went wrong — redirect to auth with error
  return NextResponse.redirect(`${origin}/auth?error=oauth_callback_failed`)
}
