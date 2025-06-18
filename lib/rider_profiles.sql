-- Create rider_profiles table
create table public.rider_profiles (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    full_name text,
    avatar_url text,
    phone_number text,
    vehicle_type text not null,
    vehicle_plate text not null,
    is_available boolean default false,
    current_location text,
    rating numeric(3,2) default 5.00,
    total_trips integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint rider_profiles_user_id_key unique (user_id)
);

-- Create index on user_id for faster lookups
create index rider_profiles_user_id_idx on public.rider_profiles(user_id);

-- Create index on is_available for faster filtering of available riders
create index rider_profiles_is_available_idx on public.rider_profiles(is_available);

-- Enable Row Level Security
alter table public.rider_profiles enable row level security;

-- Create policies
create policy "Rider profiles are viewable by everyone"
    on public.rider_profiles for select
    using (true);

create policy "Users can insert their own rider profile"
    on public.rider_profiles for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own rider profile"
    on public.rider_profiles for update
    using (auth.uid() = user_id);

create policy "Users can delete their own rider profile"
    on public.rider_profiles for delete
    using (auth.uid() = user_id);

-- Create function to handle updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
create trigger handle_rider_profiles_updated_at
    before update on public.rider_profiles
    for each row
    execute function public.handle_updated_at(); 