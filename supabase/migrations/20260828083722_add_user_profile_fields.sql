alter table users
  add column if not exists phone text,
  add column if not exists role text,
  add column if not exists avatar_url text,
  add column if not exists cover_picture text;