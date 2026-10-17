-- Catatan kartu, dokumen terstruktur, warna, dan jenis milik akun.
-- Disertakan dalam pembaruan35.sql; data dan API lama tetap dipertahankan.
create table if not exists public.catatan_jenis35(
 id uuid primary key default gen_random_uuid(),pemilik uuid not null references public.profil_pengguna(id),
 nama text not null check(length(nama) between 1 and 60 and nama=btrim(nama)),
 nama_kunci text generated always as (lower(regexp_replace(btrim(nama),'\s+',' ','g'))) stored,
 aktif boolean not null default true,versi integer not null default 1,
 dibuat_pada timestamptz not null default clock_timestamp(),diubah_pada timestamptz not null default clock_timestamp(),
 unique(pemilik,nama_kunci)
);
alter table public.catatan_jenis35 enable row level security;
drop policy if exists catatan35_jenis_owner on public.catatan_jenis35;
create policy catatan35_jenis_owner on public.catatan_jenis35 for select to authenticated
 using(pemilik=auth.uid() and internal.catatan34_boleh(pemilik,null,'pribadi'));
revoke all on public.catatan_jenis35 from public,anon,authenticated;
grant select on public.catatan_jenis35 to authenticated;
alter table public.catatan_admin add column if not exists isi35 jsonb;
alter table public.catatan_admin add column if not exists isi_sumber35 text;
alter table public.catatan_admin add column if not exists warna35 text not null default 'netral';
alter table public.catatan_admin add column if not exists jenis_id35 uuid references public.catatan_jenis35(id);
alter table public.catatan_admin add column if not exists jenis_nama35 text not null default '';
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.catatan_admin'::regclass and conname='catatan35_warna') then
  alter table public.catatan_admin add constraint catatan35_warna check(warna35 in ('netral','kuning','mint','biru','ungu','peach'));
 end if;
end $$;
create index if not exists catatan35_jenis on public.catatan_admin(jenis_id35);
create table if not exists internal.catatan_requests35(
 pemilik uuid not null references public.profil_pengguna(id),kunci uuid not null,entitas text not null,
 payload jsonb,hasil jsonb,primary key(pemilik,kunci)
);
alter table internal.catatan_requests35 enable row level security;
revoke all on internal.catatan_requests35 from public,anon,authenticated;

-- Hanya teks serta penanda tebal yang disimpan; tidak ada HTML yang dijalankan.
create or replace function internal.catatan35_teks(p_doc jsonb) returns text language plpgsql immutable set search_path='' as $$
declare b jsonb;s jsonb;v_text text:='';v_line text;v_count integer:=0;begin
 if p_doc is null or jsonb_typeof(p_doc)<>'object' or (p_doc->>'v' is distinct from '1' or jsonb_typeof(p_doc->'v') is distinct from 'number') or jsonb_typeof(p_doc->'blocks') is distinct from 'array' or octet_length(p_doc::text)>60000 or jsonb_array_length(p_doc->'blocks') not between 1 and 100 then raise exception 'Format isi catatan tidak valid.';end if;
 for b in select value from jsonb_array_elements(p_doc->'blocks') loop
  if jsonb_typeof(b)<>'object' or coalesce(b->>'type','') not in ('paragraph','bullet','check') or jsonb_typeof(b->'spans') is distinct from 'array' or jsonb_array_length(b->'spans')>100 then raise exception 'Baris catatan tidak valid.';end if;
  if b->>'type'='check' and jsonb_typeof(b->'checked') is distinct from 'boolean' then raise exception 'Ceklis catatan tidak valid.';end if;
  v_line:='';
  for s in select value from jsonb_array_elements(b->'spans') loop
   if jsonb_typeof(s)<>'object' or jsonb_typeof(s->'text') is distinct from 'string' or (s ? 'bold' and jsonb_typeof(s->'bold') is distinct from 'boolean') or position(chr(13) in s->>'text')>0 or position(chr(10) in s->>'text')>0 then raise exception 'Teks catatan tidak valid.';end if;
   v_line:=v_line||(s->>'text');
  end loop;
  if v_count>0 then v_text:=v_text||E'\n';end if;
  v_text:=v_text||case b->>'type' when 'check' then case when (b->>'checked')::boolean then '☑ ' else '☐ ' end when 'bullet' then '• ' else '' end||v_line;
  v_count:=v_count+1;
  if length(v_text)>3000 then raise exception 'Isi catatan maksimal 3000 karakter.';end if;
 end loop;
 if nullif(btrim(regexp_replace(v_text,'[☑☐•[:space:]]','','g')),'') is null then raise exception 'Isi catatan terlebih dahulu.';end if;
 return v_text;
end $$;
-- Edit dari API lama tidak boleh meninggalkan isi terstruktur yang kedaluwarsa.
create or replace function internal.catatan35_content_guard() returns trigger language plpgsql set search_path='' as $$begin
 if new.catatan is distinct from old.catatan and new.isi35 is not distinct from old.isi35 then new.isi35:=null;new.isi_sumber35:=null;end if;return new;
end $$;
drop trigger if exists catatan35_content_guard on public.catatan_admin;
create trigger catatan35_content_guard before update on public.catatan_admin for each row execute function internal.catatan35_content_guard();
create or replace function internal.catatan35_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(c)||jsonb_build_object('jenis_nama35',case when c.jangkauan34='pribadi' then 'Pengingat' else coalesce(j.nama,nullif(c.jenis_nama35,''),c.jenis) end)
 from public.catatan_admin c left join public.catatan_jenis35 j on j.id=c.jenis_id35
 where c.id=p_id and internal.catatan34_boleh(c.pemilik34,c.office_id34,c.jangkauan34)
$$;
create or replace function public.catatan35_satu(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;begin v:=internal.catatan35_json(p_id);if v is null then raise exception using errcode='42501',message='Catatan tidak tersedia untuk akun atau office Anda.';end if;return v;end $$;
create or replace function public.catatan35_halaman(p_tab text default 'admin',p_cari text default '',p_status text default 'aktif',p_jenis text default '',p_halaman integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_count integer;v_page integer;v_q text:=lower(btrim(coalesce(p_cari,'')));begin
 if not internal.catatan34_boleh(auth.uid(),null,'pribadi') then raise exception using errcode='42501',message='Akses Catatan tidak diizinkan.';end if;
 if p_tab is null or p_tab not in ('admin','pribadi') or p_status is null or p_status not in ('aktif','selesai','semua','arsip') or length(v_q)>200 or p_jenis is null or length(p_jenis)>100 then raise exception 'Filter catatan tidak valid.';end if;
 with cocok as materialized(
  select c.* from public.catatan_admin c left join public.catatan_jenis35 j on j.id=c.jenis_id35
  where internal.catatan34_boleh(c.pemilik34,c.office_id34,c.jangkauan34)
  and (p_tab='pribadi' and c.jangkauan34='pribadi' and c.pemilik34=auth.uid() or p_tab='admin' and c.jangkauan34='office')
  and case p_status when 'arsip' then c.disimpan when 'selesai' then c.status='Selesai' and not c.disimpan when 'semua' then not c.disimpan else c.status='Aktif' and not c.disimpan end
  and (p_jenis='' or p_tab='pribadi' or c.jenis_id35::text=p_jenis or p_jenis='umum' and c.jenis_id35 is null and coalesce(nullif(c.jenis_nama35,''),c.jenis)='Umum')
  and (v_q='' or strpos(lower(concat_ws(' ',c.judul34,c.catatan,c.nama_pembuat,j.nama,c.jenis_nama35)),v_q)>0)
 ),ukuran as(select count(*)::integer n from cocok),halaman as(select n,least(greatest(coalesce(p_halaman,1),1),greatest(1,(n+19)/20)) nomor from ukuran),
 bagian as(select c.* from cocok c order by c.disematkan34 desc,c.diubah_pada desc nulls last,c.dibuat_pada desc,c.id limit 20 offset(select (nomor-1)*20 from halaman))
 select (select coalesce(jsonb_agg(internal.catatan35_json(b.id) order by b.disematkan34 desc,b.diubah_pada desc nulls last,b.dibuat_pada desc,b.id),'[]') from bagian b),h.n,h.nomor into v_rows,v_count,v_page from halaman h;
 return jsonb_build_object('data',v_rows,'total',v_count,'halaman',v_page,'ukuran_halaman',20);
end $$;
create or replace function public.catatan35_jenis(p_semua boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not internal.catatan34_boleh(auth.uid(),null,'pribadi') then raise exception using errcode='42501',message='Akses Catatan tidak diizinkan.';end if;
 return coalesce((select jsonb_agg(to_jsonb(j)-'nama_kunci' order by j.aktif desc,lower(j.nama),j.id) from public.catatan_jenis35 j where j.pemilik=auth.uid() and (p_semua or j.aktif)),'[]');
end $$;
create or replace function public.catatan35_status(p_pemilik uuid,p_kunci uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r internal.catatan_requests35;begin
 if p_pemilik is distinct from auth.uid() or p_kunci is null or not internal.catatan34_boleh(auth.uid(),null,'pribadi') then raise exception using errcode='42501',message='Sesi pemeriksaan tidak valid.';end if;
 perform pg_advisory_xact_lock(hashtextextended('catatan35:'||p_pemilik::text||p_kunci::text,0));
 select * into r from internal.catatan_requests35 where pemilik=p_pemilik and kunci=p_kunci;
 if found then
  if r.entitas='catatan' and not internal.catatan34_id((r.hasil#>>'{catatan,id}')::uuid) then raise exception using errcode='42501',message='Akses catatan berubah.';end if;
  return r.hasil;
 end if;
 insert into internal.catatan_requests35(pemilik,kunci,entitas) values(p_pemilik,p_kunci,'ditutup');return null;
end $$;
create or replace function public.catatan35_jenis_tulis(p_pemilik uuid,p_kunci uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r internal.catatan_requests35;j public.catatan_jenis35;v_id uuid;v_nama text;v_action text;v_result jsonb;begin
 if p_pemilik is distinct from auth.uid() or p_kunci is null or jsonb_typeof(p_data) is distinct from 'object' or not internal.catatan34_boleh(auth.uid(),null,'pribadi') then raise exception using errcode='42501',message='Akses jenis catatan tidak diizinkan.';end if;
 perform 1 from public.profil_pengguna where id=auth.uid() for share;
 if not internal.catatan34_boleh(auth.uid(),null,'pribadi') then raise exception using errcode='42501',message='Akses Catatan tidak diizinkan.';end if;
 perform pg_advisory_xact_lock(hashtextextended('catatan35:'||p_pemilik::text||p_kunci::text,0));
 select * into r from internal.catatan_requests35 where pemilik=p_pemilik and kunci=p_kunci;
 if found then if r.payload is null then raise exception 'Kiriman sudah ditutup. Simpan kembali.';end if;if r.entitas<>'jenis' or r.payload is distinct from p_data then raise exception 'Kunci kiriman sudah digunakan untuk data lain.';end if;return r.hasil;end if;
 v_id:=nullif(p_data->>'id','')::uuid;v_action:=coalesce(p_data->>'tindakan','simpan');
 if v_id is not null then select * into j from public.catatan_jenis35 where id=v_id and pemilik=p_pemilik for update;if not found then raise exception using errcode='42501',message='Jenis ini bukan milik akun Anda.';end if;if j.versi is distinct from (p_data->>'versi')::integer then raise exception using errcode='PT409',message='Jenis berubah. Buka kembali daftarnya.';end if;end if;
 if v_action='simpan' then
  v_nama:=regexp_replace(btrim(coalesce(p_data->>'nama','')),'\s+',' ','g');
  if length(v_nama) not between 1 and 60 or lower(v_nama)='umum' then raise exception 'Isi nama jenis 1–60 karakter. Umum sudah tersedia.';end if;
  if exists(select 1 from public.catatan_jenis35 where pemilik=p_pemilik and nama_kunci=lower(v_nama) and id is distinct from v_id) then raise exception 'Jenis dengan nama ini sudah ada. Gunakan atau aktifkan kembali jenis tersebut.';end if;
  if v_id is null then insert into public.catatan_jenis35(pemilik,nama) values(p_pemilik,v_nama) returning * into j;
  else update public.catatan_jenis35 set nama=v_nama,versi=versi+1,diubah_pada=clock_timestamp() where id=v_id returning * into j;end if;
 elsif v_id is not null and v_action in ('nonaktif','aktif') then update public.catatan_jenis35 set aktif=(v_action='aktif'),versi=versi+1,diubah_pada=clock_timestamp() where id=v_id returning * into j;
 else raise exception 'Tindakan jenis tidak valid.';end if;
 v_result:=jsonb_build_object('pemilik',p_pemilik,'kunci',p_kunci,'jenis',to_jsonb(j)-'nama_kunci');
 insert into internal.catatan_requests35 values(p_pemilik,p_kunci,'jenis',p_data,v_result);return v_result;
end $$;
create or replace function public.catatan35_tulis(p_pemilik uuid,p_kunci uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r internal.catatan_requests35;c public.catatan_admin;j public.catatan_jenis35;v_id uuid;v_kind uuid;v_action text;v_scope text;v_color text;v_name text;v_actor text;v_plain text;v_date date;v_result jsonb;begin
 if p_pemilik is distinct from auth.uid() or p_kunci is null or jsonb_typeof(p_data) is distinct from 'object' or not internal.catatan34_boleh(auth.uid(),null,'pribadi') then raise exception using errcode='42501',message='Akses Catatan tidak diizinkan.';end if;
 select coalesce(nullif(btrim(p.nama),''),nullif(btrim(p.email),''),p.id::text) into v_actor from public.profil_pengguna p where p.id=auth.uid() for share;
 if not internal.catatan34_boleh(auth.uid(),null,'pribadi') then raise exception using errcode='42501',message='Akses Catatan tidak diizinkan.';end if;
 perform pg_advisory_xact_lock(hashtextextended('catatan35:'||p_pemilik::text||p_kunci::text,0));
 select * into r from internal.catatan_requests35 where pemilik=p_pemilik and kunci=p_kunci;
 if found then
  if r.payload is null then raise exception 'Kiriman sudah ditutup. Simpan kembali dengan kunci baru.';end if;
  if r.entitas<>'catatan' or r.payload is distinct from p_data then raise exception 'Kunci kiriman sudah digunakan untuk data lain.';end if;
  if not internal.catatan34_id((r.hasil#>>'{catatan,id}')::uuid) then raise exception using errcode='42501',message='Akses catatan berubah.';end if;return r.hasil;
 end if;
 v_id:=nullif(p_data->>'id','')::uuid;v_action:=coalesce(p_data->>'tindakan','simpan');
 if v_id is not null then
  select * into c from public.catatan_admin where id=v_id for update;
  if not found or not internal.catatan34_boleh(c.pemilik34,c.office_id34,c.jangkauan34) then raise exception using errcode='42501',message='Catatan tidak tersedia untuk akun atau office Anda.';end if;
  if c.versi is distinct from (p_data->>'versi')::integer then raise exception using errcode='PT409',message='Catatan berubah. Buka kembali sebelum menyimpan.';end if;
 end if;
 if v_action='simpan' then
  v_scope:=p_data->>'jangkauan';
  if v_id is not null and c.jangkauan34 is distinct from v_scope then raise exception 'Jangkauan catatan tidak dapat diubah dari formulir ini.';end if;
  v_color:=coalesce(p_data->>'warna','netral');if v_color not in ('netral','kuning','mint','biru','ungu','peach') then raise exception 'Warna catatan tidak valid.';end if;
  v_plain:=internal.catatan35_teks(p_data->'dokumen');
  v_kind:=nullif(p_data->>'jenis_id','')::uuid;v_name:='Umum';
  if v_scope='pribadi' then if v_kind is not null then raise exception 'Catatan Pribadi khusus pengingat.';end if;v_name:='Pengingat';
  elsif v_kind is not null then
   select * into j from public.catatan_jenis35 where id=v_kind;
   if not found or not coalesce(j.pemilik=p_pemilik and j.aktif or v_id is not null and c.jenis_id35=v_kind,false) then raise exception 'Pilih jenis aktif milik akun Anda.';end if;v_name:=j.nama;
  elsif v_id is not null and c.jenis_id35 is null and p_data->>'jenis_mode'='lama' then v_name:=coalesce(nullif(c.jenis_nama35,''),c.jenis);end if;
  if nullif(btrim(p_data->>'judul'),'') is null or length(p_data->>'judul')>160 then raise exception 'Isi judul catatan. Judul maksimal 160 karakter.';end if;
  if v_scope is null or v_scope not in ('pribadi','office') then raise exception 'Jangkauan catatan tidak valid.';end if;
  v_date:=nullif(p_data->>'tanggal','')::date;
  -- Satu perubahan baris: audit/versi dari trigger dasar tidak dipicu dua kali.
  if v_id is null then
   insert into public.catatan_admin(jenis,tanggal_pengingat,catatan,nama_pembuat,dibuat_oleh,judul34,jangkauan34,nama_pengubah,status,nama_penyelesai,diselesaikan_pada,disimpan,nama_penyimpan,disimpan_pada,isi35,isi_sumber35,warna35,jenis_id35,jenis_nama35)
   values('Pengingat',v_date,v_plain,v_actor,p_pemilik,btrim(p_data->>'judul'),v_scope,v_actor,'Aktif',null,null,false,null,null,p_data->'dokumen',v_plain,v_color,v_kind,v_name) returning id into v_id;
  else
   update public.catatan_admin set judul34=btrim(p_data->>'judul'),catatan=v_plain,tanggal_pengingat=v_date,
    jenis=case when v_scope='office' and c.jenis='Administrasi Karyawan' and c.karyawan_id is not null then c.jenis else 'Pengingat' end,
    karyawan_id=case when v_scope='office' and c.jenis='Administrasi Karyawan' then c.karyawan_id else null end,
    isi35=p_data->'dokumen',isi_sumber35=v_plain,warna35=v_color,jenis_id35=v_kind,jenis_nama35=v_name,
    diubah_pada=clock_timestamp(),nama_pengubah=v_actor,versi=versi+1 where id=v_id;
  end if;
 elsif v_id is not null and v_action='warna' then
  v_color:=p_data->>'warna';if v_color is null or v_color not in ('netral','kuning','mint','biru','ungu','peach') then raise exception 'Warna catatan tidak valid.';end if;
  update public.catatan_admin set warna35=v_color,diubah_pada=clock_timestamp(),nama_pengubah=v_actor,versi=versi+1 where id=v_id;
 elsif v_id is not null and v_action in ('sematkan','selesai','buka','arsip','pulihkan') then
  perform public.catatan34_tulis(p_pemilik,p_kunci,jsonb_build_object('id',v_id,'versi',c.versi,'tindakan',v_action));
 else raise exception 'Tindakan catatan tidak valid.';end if;
 v_result:=jsonb_build_object('pemilik',p_pemilik,'kunci',p_kunci,'catatan',internal.catatan35_json(v_id));
 insert into internal.catatan_requests35 values(p_pemilik,p_kunci,'catatan',p_data,v_result);return v_result;
end $$;
revoke all on function internal.catatan35_teks(jsonb),internal.catatan35_content_guard(),internal.catatan35_json(uuid) from public,anon,authenticated,service_role;
revoke all on function public.catatan35_satu(uuid),public.catatan35_halaman(text,text,text,text,integer),public.catatan35_jenis(boolean),public.catatan35_status(uuid,uuid),public.catatan35_jenis_tulis(uuid,uuid,jsonb),public.catatan35_tulis(uuid,uuid,jsonb) from public,anon;
grant execute on function public.catatan35_satu(uuid),public.catatan35_halaman(text,text,text,text,integer),public.catatan35_jenis(boolean),public.catatan35_status(uuid,uuid),public.catatan35_jenis_tulis(uuid,uuid,jsonb),public.catatan35_tulis(uuid,uuid,jsonb) to authenticated;
