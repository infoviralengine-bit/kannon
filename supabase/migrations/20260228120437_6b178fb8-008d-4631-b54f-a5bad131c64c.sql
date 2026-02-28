
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'team', 'creator', 'client');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins and team can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles RLS policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  -- Default role: team
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'team');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  client_cpm NUMERIC(10,2) DEFAULT 2.00,
  client_fixed_per_creator NUMERIC(10,2) DEFAULT 200.00,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Clients can view own campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client'));

-- Creators table
CREATE TABLE public.creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  creator_cpm NUMERIC(10,2) DEFAULT 0.50,
  creator_fixed NUMERIC(10,2) DEFAULT 200.00,
  min_videos_per_day INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage creators" ON public.creators
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Creators can view own record" ON public.creators
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- TikTok accounts table
CREATE TABLE public.tiktok_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('creator', 'outreach')),
  creator_id UUID REFERENCES public.creators(id),
  campaign_id UUID REFERENCES public.campaigns(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tiktok_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage tiktok_accounts" ON public.tiktok_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

-- Videos table
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_account_id UUID REFERENCES public.tiktok_accounts(id) NOT NULL,
  tiktok_video_id TEXT NOT NULL UNIQUE,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL,
  last_scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage videos" ON public.videos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

-- Outreach stats table
CREATE TABLE public.outreach_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_account_id UUID REFERENCES public.tiktok_accounts(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  dm_sent INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tiktok_account_id, date)
);
ALTER TABLE public.outreach_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage outreach_stats" ON public.outreach_stats
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

-- Campaign creators junction table
CREATE TABLE public.campaign_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) NOT NULL,
  creator_id UUID REFERENCES public.creators(id) NOT NULL,
  joined_at DATE DEFAULT CURRENT_DATE,
  UNIQUE(campaign_id, creator_id)
);
ALTER TABLE public.campaign_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage campaign_creators" ON public.campaign_creators
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.creators(id) NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  fixed_amount NUMERIC(10,2) DEFAULT 0,
  fixed_earned BOOLEAN DEFAULT false,
  cpm_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, period_month, period_year)
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team'));

CREATE POLICY "Creators can view own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE profile_id = auth.uid()
    )
  );
