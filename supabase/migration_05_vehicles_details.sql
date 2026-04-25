-- Add detailed vehicle info columns
alter table vehicles
  add column if not exists kilometrage       integer,
  add column if not exists etat_carrosserie  text,
  add column if not exists finition          text,
  add column if not exists carte_grise       text,
  add column if not exists type_moteur       text;
