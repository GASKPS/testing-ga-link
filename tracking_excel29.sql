-- Jalankan seluruh skrip ini pada SQL Editor proyek Portal GA.
-- Menyertakan dependensi Pembaruan28 dan kompatibilitas kiriman lama.
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
 if not found then
  insert into internal.tracking_input_requests28(user_id,request_id,payload) values(p.id,p_kunci,'null'::jsonb);
 end if;
 return receipt;
end $$;

revoke all on function public.preferensi_input_dokumen28(),public.simpan_preferensi_input_dokumen28(text,uuid),public.simpan_dokumen_excel28(jsonb,uuid,uuid),public.status_input_dokumen28(uuid,uuid) from public,anon;
grant execute on function public.preferensi_input_dokumen28(),public.simpan_preferensi_input_dokumen28(text,uuid),public.simpan_dokumen_excel28(jsonb,uuid,uuid),public.status_input_dokumen28(uuid,uuid) to authenticated;
-- Pembaruan29: kondisi awal dan perpindahan banyak dokumen.
do $$
begin
 if to_regclass('public.dokumen') is null then raise exception 'Tabel dokumen dasar belum tersedia.';end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='catat_perpindahan_dokumen' and array['p_id','p_versi','p_data']::text[] <@ p.proargnames) then
  raise exception 'Fungsi catat_perpindahan_dokumen dasar belum tersedia.';
 end if;
end $$;

create table if not exists internal.tracking_requests29 (
 user_id uuid not null references public.profil_pengguna(id) on delete cascade,
 request_id uuid not null,
 kind text not null check(kind in ('buat','pindah')),
 payload jsonb not null,
 result jsonb,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table internal.tracking_requests29 enable row level security;
revoke all on internal.tracking_requests29 from public,anon,authenticated;

create or replace function internal.tracking_receipt29(p_doc public.dokumen)
returns jsonb language sql stable set search_path=pg_catalog,public,internal as $$
 select jsonb_build_object('id',(p_doc).id,'kode',(p_doc).kode,'versi',(p_doc).versi,'status_terakhir',(p_doc).status_terakhir,'posisi_sekarang',(p_doc).posisi_sekarang,'perpindahan_terakhir',(p_doc).perpindahan_terakhir);
$$;
revoke all on function internal.tracking_receipt29(public.dokumen) from public,anon,authenticated;

create or replace function public.simpan_dokumen_excel29(p_rows jsonb,p_kunci uuid,p_pemilik uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,internal as $$
declare p public.profil_pengguna; prior internal.tracking_requests29; item jsonb; data jsonb; created jsonb; doc public.dokumen; docs jsonb:='[]'::jsonb; receipt jsonb; number integer:=0; amount integer; position text; state text; since date; has_initial boolean;
begin
 p:=internal.tracking_input_user28();
 if p.id is distinct from p_pemilik then raise exception using errcode='42501',message='Akun berubah. Buka kembali input dokumen.';end if;
 if p_kunci is null then raise exception 'Kunci penyimpanan belum tersedia.';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Data harus berupa daftar baris.';end if;
 amount:=jsonb_array_length(p_rows);if amount<1 or amount>100 then raise exception 'Isi 1 sampai 100 baris untuk satu penyimpanan.';end if;
 perform pg_advisory_xact_lock(hashtext('tracking29'),hashtext(p.id::text||':'||p_kunci::text));
 select * into prior from internal.tracking_requests29 where user_id=p.id and request_id=p_kunci;
 if found then
  if prior.kind<>'buat' or prior.payload is distinct from p_rows then raise exception using errcode='23514',message='Kunci ini sudah digunakan untuk kiriman yang berbeda.';end if;
  return prior.result;
 end if;
 if p.peran<>'administrator' and p.office_id is null then raise exception 'Office akun belum ditetapkan. Hubungi Administrator.';end if;
 insert into internal.tracking_requests29(user_id,request_id,kind,payload) values(p.id,p_kunci,'buat',p_rows);
 for item in select value from jsonb_array_elements(p_rows) loop
  number:=number+1;
  begin
   if jsonb_typeof(item) is distinct from 'object' then raise exception 'Baris bukan dokumen yang valid.';end if;
   position:=btrim(coalesce(item->>'posisi_awal',''));state:=btrim(coalesce(item->>'status_awal',''));
   has_initial:=position<>'' or state<>'' or btrim(coalesce(item->>'tanggal_posisi_awal',''))<>'';
   if has_initial then
    if position='' or char_length(position)>140 then raise exception 'Isi posisi saat ini, maksimal 140 karakter.';end if;
    if state not in ('Dititipkan','Menunggu Approval','Sedang Diproses','Perlu Revisi','Siap Diambil','Sudah Diambil','Selesai','Dibatalkan') then raise exception 'Status kondisi awal tidak tersedia.';end if;
    if coalesce(item->>'tanggal_posisi_awal','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Isi tanggal posisi saat ini dengan format YYYY-MM-DD.';end if;
    since:=(item->>'tanggal_posisi_awal')::date;
    if since>(now() at time zone 'Asia/Jayapura')::date then raise exception 'Tanggal posisi tidak boleh setelah hari ini.';end if;
   end if;
   data:=jsonb_build_object('nama_dokumen',item->'nama_dokumen','tanggal_masuk',item->'tanggal_masuk','bu',item->'bu','jenis_dokumen',item->'jenis_dokumen','jenis_lainnya',item->'jenis_lainnya','nomor_dokumen',item->'nomor_dokumen','catatan',item->'catatan','office_id',case when p.peran='administrator' then item->'office_id' else to_jsonb(p.office_id) end);
   select to_jsonb(v) into strict created from public.simpan_dokumen(p_data=>data) v;
   if created ? 'simpan_dokumen' then created:=created->'simpan_dokumen';end if;
   if jsonb_typeof(created) is distinct from 'object' or created->>'id' is null then raise exception 'Server belum mengonfirmasi dokumen yang dibuat.';end if;
   select * into strict doc from public.dokumen where id=(created->>'id')::uuid for update;
   if has_initial then
    if since<doc.tanggal_masuk then raise exception 'Tanggal posisi tidak boleh sebelum tanggal masuk.';end if;
    perform public.catat_perpindahan_dokumen(p_id=>doc.id,p_versi=>doc.versi,p_data=>jsonb_build_object('tanggal_perpindahan',since,'tujuan',position,'status',state,'catatan','Posisi saat mulai dicatat.'));
    select * into strict doc from public.dokumen d where d.id=(created->>'id')::uuid;
   end if;
   docs:=docs||jsonb_build_array(internal.tracking_receipt29(doc));
  exception when others then
   raise exception using errcode=sqlstate,message=format('Baris %s: %s',number,sqlerrm);
  end;
 end loop;
 receipt:=jsonb_build_object('pemilik',p.id,'kunci',p_kunci,'jenis','buat','jumlah',amount,'dokumen',docs);
 update internal.tracking_requests29 set result=receipt where user_id=p.id and request_id=p_kunci;
 return receipt;
end $$;

create or replace function public.simpan_perpindahan_excel29(p_rows jsonb,p_kunci uuid,p_pemilik uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,internal as $$
declare p public.profil_pengguna; prior internal.tracking_requests29; item jsonb; doc public.dokumen; ids uuid[]; docs jsonb:='[]'::jsonb; receipt jsonb; number integer:=0; amount integer; distinct_count integer; move_date date; target text; state text; note text;
begin
 p:=internal.tracking_input_user28();
 if p.id is distinct from p_pemilik then raise exception using errcode='42501',message='Akun berubah. Muat kembali daftar dokumen.';end if;
 if p_kunci is null then raise exception 'Kunci penyimpanan belum tersedia.';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Data harus berupa daftar baris.';end if;
 amount:=jsonb_array_length(p_rows);if amount<1 or amount>500 then raise exception 'Isi 1 sampai 500 perpindahan untuk satu penyimpanan.';end if;
 perform pg_advisory_xact_lock(hashtext('tracking29'),hashtext(p.id::text||':'||p_kunci::text));
 select * into prior from internal.tracking_requests29 where user_id=p.id and request_id=p_kunci;
 if found then
  if prior.kind<>'pindah' or prior.payload is distinct from p_rows then raise exception using errcode='23514',message='Kunci ini sudah digunakan untuk kiriman yang berbeda.';end if;
  return prior.result;
 end if;
 if p.peran<>'administrator' and p.office_id is null then raise exception 'Office akun belum ditetapkan. Hubungi Administrator.';end if;
 select array_agg((value->>'id')::uuid),count(distinct value->>'id') into ids,distinct_count from jsonb_array_elements(p_rows);
 if distinct_count<>amount then raise exception 'Isi ID yang valid. Satu dokumen hanya boleh muncul sekali dalam kiriman.';end if;
 -- Lock all authorized documents in a fixed order before checking revisions.
 perform d.id from public.dokumen d where d.id=any(ids) and (p.peran='administrator' or d.office_id=p.office_id) order by d.id for update;
 insert into internal.tracking_requests29(user_id,request_id,kind,payload) values(p.id,p_kunci,'pindah',p_rows);
 for item in select value from jsonb_array_elements(p_rows) loop
  number:=number+1;
  begin
   if jsonb_typeof(item) is distinct from 'object' then raise exception 'Baris bukan perpindahan yang valid.';end if;
   select * into doc from public.dokumen d where d.id=(item->>'id')::uuid and (p.peran='administrator' or d.office_id=p.office_id);
   if not found then raise exception using errcode='42501',message='Dokumen tidak tersedia atau di luar office akun.';end if;
   if doc.versi is distinct from (item->>'versi')::bigint then raise exception using errcode='40001',message='Data dokumen berubah. Periksa posisi terbaru sebelum menyimpan.';end if;
   if doc.status_terakhir in ('Sudah Diambil','Selesai','Dibatalkan') then raise exception using errcode='40001',message='Dokumen sudah selesai. Batalkan isian baris ini.';end if;
   target:=btrim(coalesce(item->>'tujuan',''));state:=btrim(coalesce(item->>'status',''));note:=btrim(coalesce(item->>'catatan',''));
   if target='' or char_length(target)>140 then raise exception 'Isi tujuan, maksimal 140 karakter.';end if;
   if state not in ('Dititipkan','Menunggu Approval','Sedang Diproses','Perlu Revisi','Siap Diambil','Sudah Diambil','Selesai','Dibatalkan') then raise exception 'Pilih status dokumen yang tersedia.';end if;
   if char_length(note)>3000 then raise exception 'Catatan maksimal 3000 karakter.';end if;
   if coalesce(item->>'tanggal_perpindahan','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Isi tanggal perpindahan dengan format YYYY-MM-DD.';end if;
   move_date:=(item->>'tanggal_perpindahan')::date;
   if move_date<coalesce(doc.perpindahan_terakhir,doc.tanggal_masuk) then raise exception 'Tanggal tidak boleh sebelum posisi terakhir.';end if;
   if move_date>(now() at time zone 'Asia/Jayapura')::date then raise exception 'Tanggal tidak boleh setelah hari ini.';end if;
   perform public.catat_perpindahan_dokumen(p_id=>doc.id,p_versi=>doc.versi,p_data=>jsonb_build_object('tanggal_perpindahan',move_date,'tujuan',target,'status',state,'catatan',note));
   select * into strict doc from public.dokumen d where d.id=(item->>'id')::uuid;
   docs:=docs||jsonb_build_array(internal.tracking_receipt29(doc));
  exception when others then
   raise exception using errcode=sqlstate,message=format('Baris %s: %s',number,sqlerrm);
  end;
 end loop;
 receipt:=jsonb_build_object('pemilik',p.id,'kunci',p_kunci,'jenis','pindah','jumlah',amount,'dokumen',docs);
 update internal.tracking_requests29 set result=receipt where user_id=p.id and request_id=p_kunci;
 return receipt;
end $$;

create or replace function public.status_input_tracking29(p_jenis text,p_kunci uuid,p_pemilik uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,internal as $$
declare p public.profil_pengguna; prior internal.tracking_requests29;
begin
 p:=internal.tracking_input_user28();
 if p.id is distinct from p_pemilik then raise exception using errcode='42501',message='Akun berubah. Buka kembali Tracking Dokumen.';end if;
 if p_kunci is null or p_jenis is null or p_jenis not in ('buat','pindah') then raise exception 'Kunci atau jenis kiriman tidak valid.';end if;
 perform pg_advisory_xact_lock(hashtext('tracking29'),hashtext(p.id::text||':'||p_kunci::text));
 select * into prior from internal.tracking_requests29 where user_id=p.id and request_id=p_kunci;
 if not found then
  -- Seal an unseen request: a delayed save using this key must be rejected.
  insert into internal.tracking_requests29(user_id,request_id,kind,payload) values(p.id,p_kunci,p_jenis,'null'::jsonb);
  return null;
 end if;
 if prior.kind<>p_jenis then raise exception 'Jenis kiriman berbeda. Periksa melalui menu asal kiriman.';end if;
 return prior.result;
end $$;

revoke all on function public.simpan_dokumen_excel29(jsonb,uuid,uuid),public.simpan_perpindahan_excel29(jsonb,uuid,uuid),public.status_input_tracking29(text,uuid,uuid) from public,anon;
grant execute on function public.simpan_dokumen_excel29(jsonb,uuid,uuid),public.simpan_perpindahan_excel29(jsonb,uuid,uuid),public.status_input_tracking29(text,uuid,uuid) to authenticated;

commit;
