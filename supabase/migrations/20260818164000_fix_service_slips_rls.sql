-- Enable RLS on service_slips
ALTER TABLE service_slips ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can insert their own slips" ON service_slips;
DROP POLICY IF EXISTS "Users can view their own slips" ON service_slips;
DROP POLICY IF EXISTS "Users can update their own slips" ON service_slips;
DROP POLICY IF EXISTS "Users can delete their own slips" ON service_slips;

-- Create policies enforcing user_id = auth.uid()
CREATE POLICY "Users can insert their own slips" ON service_slips
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own slips" ON service_slips
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own slips" ON service_slips
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own slips" ON service_slips
  FOR DELETE USING (user_id = auth.uid());
