-- Input Excel: preferensi per akun, satu transaksi, dan kunci anti-duplikasi.
begin;
do $$
begin
 if to_regclass('public.profil_pengguna') is null or to_regclass('public.kantor') is null or to_regnamespace('internal') is null then
  raise exception 'Database dasar Portal GA belum lengkap.';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='simpan_dokumen' and 'p_data'=any(p.proargnames)) then
  raise exception 'Fungsi simpan_dokumen dasar belum tersedia.';
 end if;
end $$;

create table if not exists internal.tracking_input_preferences28 (
 user_id uuid primary key references public.profil_pengguna(id) on delete cascade,
 mode text not null check(mode in ('form','excel')),
 updated_at timestamptz not null default now()
);
create table if not exists internal.tracking_input_requests28 (
 user_id uuid not null references public.profil_pengguna(id) on delete cascade,
 request_id uuid not null,
 payload jsonb not null,
 result jsonb,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table internal.tracking_input_preferences28 enable row level security;
alter table internal.tracking_input_requests28 enable row level security;
revoke all on internal.tracking_input_preferences28,internal.tracking_input_requests28 from public,anon,authenticated;

create or replace function internal.tracking_input_user28()
returns public.profil_pengguna language plpgsql set search_path=pg_catalog,public,internal as $$
declare p public.profil_pengguna;
begin
 select * into p from public.profil_pengguna where id=auth.uid() for share;
 if p.id is null or p.aktif is distinct from true or (p.peran in ('administrator','super_admin') or (p.peran='admin' and p.akses_portal is true)) is distinct from true then
  raise exception using errcode='42501',message='Akun tidak memiliki akses mencatat dokumen.';
 end if;
 return p;
end $$;
revoke all on function internal.tracking_input_user28() from public,anon,authenticated;

create or replace function public.preferensi_input_dokumen28()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,internal as $$
declare p public.profil_pengguna; v_mode text;
begin
 p:=internal.tracking_input_user28();
 select mode into v_mode from internal.tracking_input_preferences28 where user_id=p.id;
 return jsonb_build_object('pemilik',p.id,'mode',coalesce(v_mode,'form'));
end $$;
create or replace function public.simpan_preferensi_input_dokumen28(p_mode text,p_pemilik uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,internal as $$
declare p public.profil_pengguna;
begin
 p:=internal.tracking_input_user28();
 if p.id is distinct from p_pemilik then raise exception using errcode='42501',message='Akun berubah. Buka kembali input dokumen.';end if;
 if p_mode is null or p_mode not in ('form','excel') then raise exception 'Pilih Form atau Excel.';end if;
 insert into internal.tracking_input_preferences28(user_id,mode) values(p.id,p_mode)
 on conflict(user_id) do update set mode=excluded.mode,updated_at=now();
 return jsonb_build_object('pemilik',p.id,'mode',p_mode);
end $$;

create or replace function public.simpan_dokumen_excel28(p_rows jsonb,p_kunci uuid,p_pemilik uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,internal as $$
declare p public.profil_pengguna; old internal.tracking_input_requests28; item jsonb; data jsonb; created jsonb; docs jsonb:='[]'::jsonb; receipt jsonb; number integer:=0; amount integer;
begin
 p:=internal.tracking_input_user28();
 if p.id is distinct from p_pemilik then raise exception using errcode='42501',message='Akun berubah. Buka kembali input dokumen.';end if;
 if p_kunci is null then raise exception 'Kunci penyimpanan belum tersedia.';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Data harus berupa daftar baris.';end if;
 amount:=jsonb_array_length(p_rows);
 if amount<1 or amount>100 then raise exception 'Isi 1 sampai 100 baris untuk satu penyimpanan.';end if;
 perform pg_advisory_xact_lock(hashtext('tracking_input28'),hashtext(p.id::text||':'||p_kunci::text));
 select * into old from internal.tracking_input_requests28 where user_id=p.id and request_id=p_kunci;
 if found then
  if old.payload is distinct from p_rows then raise exception using errcode='23514',message='Kunci penyimpanan ini sudah digunakan untuk data yang berbeda.';end if;
  return old.result;
 end if;
 if p.peran<>'administrator' and p.office_id is null then raise exception 'Office akun belum ditetapkan. Hubungi Administrator.';end if;
 insert into internal.tracking_input_requests28(user_id,request_id,payload) values(p.id,p_kunci,p_rows);
 for item in select value from jsonb_array_elements(p_rows) loop
  number:=number+1;
  begin
   if jsonb_typeof(item) is distinct from 'object' then raise exception 'Baris bukan data dokumen yang valid.';end if;
   data:=jsonb_build_object('nama_dokumen',item->'nama_dokumen','tanggal_masuk',item->'tanggal_masuk','bu',item->'bu','jenis_dokumen',item->'jenis_dokumen','jenis_lainnya',item->'jenis_lainnya','nomor_dokumen',item->'nomor_dokumen','catatan',item->'catatan','office_id',case when p.peran='administrator' then item->'office_id' else to_jsonb(p.office_id) end);
   select to_jsonb(v) into strict created from public.simpan_dokumen(p_data=>data) v;
   if created ? 'simpan_dokumen' then created:=created->'simpan_dokumen';end if;
   if jsonb_typeof(created) is distinct from 'object' or created->>'id' is null then raise exception 'Server belum mengonfirmasi dokumen yang dibuat.';end if;
   docs:=docs||jsonb_build_array(jsonb_build_object('id',created->>'id','kode',coalesce(created->>'kode','')));
  exception when others then
   raise exception using errcode=sqlstate,message=format('Baris %s: %s',number,sqlerrm);
  end;
 end loop;
 receipt:=jsonb_build_object('pemilik',p.id,'kunci',p_kunci,'jumlah',amount,'dokumen',docs);
 update internal.tracking_input_requests28 set result=receipt where user_id=p.id and request_id=p_kunci;
 return receipt;
end $$;

create or replace function public.status_input_dokumen28(p_kunci uuid,p_pemilik uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,internal as $$
declare p public.profil_pengguna; receipt jsonb;
begin
 p:=internal.tracking_input_user28();
 if p.id is distinct from p_pemilik then raise exception using errcode='42501',message='Akun berubah. Buka kembali input dokumen.';end if;
 if p_kunci is null then raise exception 'Kunci penyimpanan belum tersedia.';end if;
 perform pg_advisory_xact_lock(hashtext('tracking_input28'),hashtext(p.id::text||':'||p_kunci::text));
 select result into receipt from internal.tracking_input_requests28 where user_id=p.id and request_id=p_kunci;
 return receipt;
end $$;

revoke all on function public.preferensi_input_dokumen28(),public.simpan_preferensi_input_dokumen28(text,uuid),public.simpan_dokumen_excel28(jsonb,uuid,uuid),public.status_input_dokumen28(uuid,uuid) from public,anon;
grant execute on function public.preferensi_input_dokumen28(),public.simpan_preferensi_input_dokumen28(text,uuid),public.simpan_dokumen_excel28(jsonb,uuid,uuid),public.status_input_dokumen28(uuid,uuid) to authenticated;
commit;
