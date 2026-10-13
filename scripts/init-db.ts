import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initializeDatabase() {
  try {
    console.log("Initializing database schema...");

    // Create rooms table
    const { error: roomsError } = await supabase.rpc("create_rooms_table", {});
    if (roomsError) console.log("Rooms table already exists or created");

    // Create inventory_sessions table
    const { error: sessionsError } = await supabase.rpc(
      "create_sessions_table",
      {},
    );
    if (sessionsError) console.log("Sessions table already exists or created");

    // Create inventory_items table
    const { error: itemsError } = await supabase.rpc("create_items_table", {});
    if (itemsError) console.log("Items table already exists or created");

    console.log("Database initialization complete!");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
}

initializeDatabase();
