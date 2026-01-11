create table if not exists public.support_escalations (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references auth.users(id) on delete set null,
    tags text[] not null default '{}',
    conversation jsonb not null default '[]'::jsonb,
    status text not null default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.support_escalations enable row level security;

create policy "Users can insert their own escalations"
    on public.support_escalations for insert
    with check (auth.uid() = student_id);

create policy "Users can view their own escalations"
    on public.support_escalations for select
    using (auth.uid() = student_id);
