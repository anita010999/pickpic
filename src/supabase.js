import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bmtrsorncvwwcfixqvcd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdHJzb3JuY3Z3d2NmaXhxdmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2ODA1NDUsImV4cCI6MjA3NDI1NjU0NX0.U59kJUCLVds-pWbXxD2q5vLxa_VwmacUmmDjcWUoUQY'

export const supabase = createClient(supabaseUrl, supabaseKey)
