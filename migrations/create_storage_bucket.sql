-- Create the storage bucket 'logos' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS (Row Level Security) on objects table if not already enabled
-- (Supabase usually does this by default, but it's good practice)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Allow Public Access to view files (SELECT)
CREATE POLICY "Public Access to Logos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'logos' );

-- 2. Allow Public Uploads (INSERT)
-- Since the app uses custom authentication (not Supabase Auth), 
-- we allow the 'anon' role to upload logos.
-- Security is handled by the application interface (only Admins can see the upload button).
CREATE POLICY "Allow Public Uploads to Logos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'logos' );

-- 3. Allow Public Updates/Deletes (Optional, for "Quitar Logo")
CREATE POLICY "Allow Public Delete/Update Logos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'logos' );

CREATE POLICY "Allow Public Update Logos"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'logos' );
