
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jvwmsitrnttanubumscd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d21zaXRybnR0YW51YnVtc2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzk0MzUsImV4cCI6MjA4OTI1NTQzNX0._E7yf8zvXaeM9cGRgSBgPjr6pAHhnMnChvjXHbrp-eo'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test_query(name, query) {
  try {
    const { data, error } = await query;
    if (error) {
      console.log(`[${name}] ERROR:`, error.message, error.code, error.details);
    } else {
      console.log(`[${name}] SUCCESS: Rows =`, data?.length);
    }
  } catch (err) {
    console.log(`[${name}] FAILED WITH EXCEPTION:`, err.message);
  }
}

async function run() {
  await test_query('leave_applications', 
    supabase.from('leave_applications')
      .select('*, staff:staff_id(id,name,avatar_url,email), approved_by_staff:approved_by_staff_id(id,name,avatar_url), leave_application_days(*)')
      .order('created_at', { ascending: false })
      .limit(1)
  );

  await test_query('tasks', 
    supabase.from('tasks')
      .select('*, task_assignees(*, staff(*)), task_leads(*)')
      .order('created_at', { ascending: false })
      .limit(1)
  );
  
  // Basic table check
  await test_query('staff_columns', supabase.from('staff').select('*').limit(1));
  await test_query('leave_apps_columns', supabase.from('leave_applications').select('*').limit(1));
}

run();
