
-- Update profile name
UPDATE public.profiles 
SET full_name = 'Leo Canega' 
WHERE id = '5b4d3f53-4063-4bd9-9d5a-b476259c3ea2';

-- Update role to admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '5b4d3f53-4063-4bd9-9d5a-b476259c3ea2';
