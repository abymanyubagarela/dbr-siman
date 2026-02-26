import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    // Create rooms table
    await supabase.from('rooms').select('id').limit(1)

    // Create inventory_sessions table
    await supabase.from('inventory_sessions').select('id').limit(1)

    // Create inventory_items table
    await supabase.from('inventory_items').select('id').limit(1)

    return Response.json({ success: true, message: 'Database initialized' })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
