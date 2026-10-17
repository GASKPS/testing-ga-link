-- Catatan pribadi dan catatan office. Jalankan lewat paket pembaruan34.sql.
alter table public.catatan_admin add column if not exists judul34 text not null default '';
alter table public.catatan_admin add column if not exists jangkauan34 text not null default 'pribadi';
alter table public.catatan_admin add column if not exists office_id34 uuid references public.kantor(id);
alter table public.catatan_admin add column if not exists pemilik34 uuid references public.profil_pengguna(id);
alter table public.catatan_admin add column if not exists disematkan34 boolean not null default false;
drop trigger if exists catatan34_scope_guard on public.catatan_admin;
-- Migrasi hanya sekali; catatan lama mengikuti office pembuat, tidak menjadi global.
update public.catatan_admin c set pemilik34=p.id,office_id34=p.office_id,
 judul34=left(split_part(coalesce(c.catatan,''),E'\n',1),150),jangkauan34='office'
 from public.profil_pengguna p where c.pemilik34 is null
 and p.id::text=coalesce(to_jsonb(c)->>'dibuat_oleh',to_jsonb(c)->>'pembuat_id');
create index if not exists catatan34_scope on public.catatan_admin(office_id34,pemilik34,jangkauan34);
create table if not exists internal.catatan_requests34(
 pemilik uuid not null references public.profil_pengguna(id),kunci uuid not null,payload jsonb,hasil jsonb,
 primary key(pemilik,kunci)
);
alter table internal.catatan_requests34 enable row level security;
revoke all on internal.catatan_requests34 from public,anon,authenticated;

create or replace function internal.crew34() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profil_pengguna p where p.id=auth.uid() and p.peran::text='crew')
$$;
create or replace function internal.catatan34_boleh(p_owner uuid,p_office uuid,p_audience text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profil_pengguna p where p.id=auth.uid() and p.aktif
 and p.akses_portal and p.peran::text in ('administrator','super_admin','admin')
 and (p_audience='pribadi' and p_owner=p.id or p_audience='office' and p.office_id=p_office and p_office is not null))
$$;
create or replace function internal.catatan34_id(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.catatan_admin c where c.id=p_id and internal.catatan34_boleh(c.pemilik34,c.office_id34,c.jangkauan34))
$$;
create or replace function internal.catatan34_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare v_p public.profil_pengguna;begin
 select p.* into v_p from public.profil_pengguna p where p.id=auth.uid();
 if not found or not v_p.aktif or not v_p.akses_portal or v_p.peran::text not in ('administrator','super_admin','admin') then raise exception 'Akses Catatan tidak diizinkan.';end if;
 if TG_OP<>'INSERT' and not internal.catatan34_boleh(old.pemilik34,old.office_id34,old.jangkauan34) then raise exception 'Catatan ini tidak tersedia untuk akun atau office Anda.';end if;
 if TG_OP='DELETE' then return old;end if;
 if TG_OP='INSERT' then new.pemilik34:=v_p.id;new.office_id34:=v_p.office_id;
 elsif new.pemilik34 is distinct from old.pemilik34 or new.office_id34 is distinct from old.office_id34 then raise exception 'Pemilik dan office catatan tidak dapat dipindahkan.';end if;
 if TG_OP='UPDATE' and old.pemilik34<>v_p.id and new.jangkauan34 is distinct from old.jangkauan34 then raise exception 'Hanya pembuat catatan yang dapat mengubah jangkauan.';end if;
 if new.jangkauan34 not in ('pribadi','office') or new.jangkauan34 is null or (new.jangkauan34='office' and new.office_id34 is null) then raise exception 'Pilih jangkauan catatan. Catatan Office memerlukan office akun.';end if;
 if length(new.judul34)>160 then raise exception 'Judul maksimal 160 karakter.';end if;
 -- Kolom akun audit pada skema dasar tetap mengikuti status/tanggal tindakan.
 -- jsonb_populate_record mengabaikan kolom opsional yang tidak ada pada skema lama.
 if new.status='Aktif' then
  new:=jsonb_populate_record(new,'{"diselesaikan_oleh":null}'::jsonb);
 elsif new.status='Selesai' then
  if TG_OP='INSERT' then new:=jsonb_populate_record(new,jsonb_build_object('diselesaikan_oleh',v_p.id));
  elsif new.status is distinct from old.status or new.diselesaikan_pada is distinct from old.diselesaikan_pada then
   new:=jsonb_populate_record(new,jsonb_build_object('diselesaikan_oleh',v_p.id));end if;
 end if;
 if not new.disimpan then
  new:=jsonb_populate_record(new,'{"disimpan_oleh":null}'::jsonb);
 elsif TG_OP='INSERT' then new:=jsonb_populate_record(new,jsonb_build_object('disimpan_oleh',v_p.id));
 elsif new.disimpan is distinct from old.disimpan or new.disimpan_pada is distinct from old.disimpan_pada then
  new:=jsonb_populate_record(new,jsonb_build_object('disimpan_oleh',v_p.id));
 end if;
 return new;
end $$;
drop trigger if exists catatan34_scope_guard on public.catatan_admin;
create trigger catatan34_scope_guard before insert or update or delete on public.catatan_admin for each row execute function internal.catatan34_guard();
alter table public.catatan_admin enable row level security;
drop policy if exists catatan34_scope on public.catatan_admin;
create policy catatan34_scope on public.catatan_admin as restrictive for all to authenticated
 using(internal.catatan34_boleh(pemilik34,office_id34,jangkauan34))
 with check(internal.catatan34_boleh(pemilik34,office_id34,jangkauan34));
-- A new permissive policy complements legacy policies without allowing direct writes.
drop policy if exists catatan34_read on public.catatan_admin;
create policy catatan34_read on public.catatan_admin for select to authenticated using(internal.catatan34_boleh(pemilik34,office_id34,jangkauan34));
revoke insert,update,delete,truncate on public.catatan_admin from anon,authenticated;
grant select on public.catatan_admin to authenticated;

create or replace function public.catatan34_halaman(p_tab text default 'saya',p_cari text default '',p_status text default 'aktif',p_halaman integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_count integer;v_page integer;v_q text:=lower(btrim(coalesce(p_cari,'')));begin
 if not exists(select 1 from public.profil_pengguna p where p.id=auth.uid() and p.aktif and p.akses_portal and p.peran::text in ('administrator','super_admin','admin')) then raise exception 'Akses Catatan tidak diizinkan.';end if;
 if p_tab not in ('saya','office') or p_status not in ('aktif','selesai','arsip') or length(v_q)>200 then raise exception 'Filter catatan tidak valid.';end if;
 select count(*) into v_count from public.catatan_admin c where internal.catatan34_boleh(c.pemilik34,c.office_id34,c.jangkauan34)
 and (p_tab='saya' and c.pemilik34=auth.uid() or p_tab='office' and c.jangkauan34='office')
 and (case p_status when 'arsip' then c.disimpan when 'selesai' then c.status='Selesai' and not c.disimpan else c.status='Aktif' and not c.disimpan end)
 and (v_q='' or strpos(lower(concat_ws(' ',c.judul34,c.catatan,c.nama_pembuat)),v_q)>0);
 v_page:=least(greatest(coalesce(p_halaman,1),1),greatest(1,ceil(v_count/20.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(v) order by v.disematkan34 desc,v.diubah_pada desc nulls last,v.dibuat_pada desc,v.id),'[]') into v_rows from (
 select c.* from public.catatan_admin c where internal.catatan34_boleh(c.pemilik34,c.office_id34,c.jangkauan34)
 and (p_tab='saya' and c.pemilik34=auth.uid() or p_tab='office' and c.jangkauan34='office')
 and (case p_status when 'arsip' then c.disimpan when 'selesai' then c.status='Selesai' and not c.disimpan else c.status='Aktif' and not c.disimpan end)
 and (v_q='' or strpos(lower(concat_ws(' ',c.judul34,c.catatan,c.nama_pembuat)),v_q)>0)
 order by c.disematkan34 desc,c.diubah_pada desc nulls last,c.dibuat_pada desc,c.id limit 20 offset (v_page-1)*20) v;
 return jsonb_build_object('data',v_rows,'total',v_count,'halaman',v_page,'ukuran_halaman',20);
end $$;
create or replace function public.catatan34_tulis(p_pemilik uuid,p_kunci uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_p public.profil_pengguna;v_c public.catatan_admin;v_old public.catatan_admin;v_r internal.catatan_requests34;v_result jsonb;v_id uuid;v_action text;v_date date;v_nama text;begin
 if p_pemilik is distinct from auth.uid() or p_kunci is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Sesi penyimpanan tidak valid.';end if;
 select p.* into v_p from public.profil_pengguna p where p.id=auth.uid() for share;
 if not found or not v_p.aktif or not v_p.akses_portal or v_p.peran::text not in ('administrator','super_admin','admin') then raise exception 'Akses Catatan tidak diizinkan.';end if;
 -- Nama audit berasal dari profil sesi, bukan isian pengguna; tetap terisi bila nama profil belum lengkap.
 v_nama:=coalesce(nullif(btrim(v_p.nama),''),nullif(btrim(v_p.email),''),v_p.id::text);
 perform pg_advisory_xact_lock(hashtextextended('catatan34:'||p_pemilik::text||p_kunci::text,0));
 select * into v_r from internal.catatan_requests34 r where r.pemilik=p_pemilik and r.kunci=p_kunci;
 if found then if v_r.payload is null then raise exception 'Kiriman sudah ditutup. Simpan kembali dengan kunci baru.';end if;if v_r.hasil->'catatan' is not null and not internal.catatan34_id((v_r.hasil#>>'{catatan,id}')::uuid) then raise exception using errcode='42501',message='Akses catatan berubah.';end if;if v_r.payload is distinct from p_data then raise exception 'Kunci kiriman sudah digunakan untuk data lain.';end if;return v_r.hasil;end if;
 v_id:=nullif(p_data->>'id','')::uuid;v_action:=coalesce(p_data->>'tindakan','simpan');
 if v_id is not null then
  select c.* into v_old from public.catatan_admin c where c.id=v_id for update;
  if not found or not internal.catatan34_boleh(v_old.pemilik34,v_old.office_id34,v_old.jangkauan34) then raise exception 'Catatan tidak tersedia untuk akun atau office Anda.';end if;
  if v_old.versi is distinct from (p_data->>'versi')::integer then raise exception using errcode='PT409',message='Catatan berubah. Buka kembali sebelum menyimpan.';end if;
 end if;
 if v_action='simpan' then
  if nullif(btrim(p_data->>'judul'),'') is null or length(p_data->>'judul')>160 or nullif(btrim(p_data->>'isi'),'') is null or length(p_data->>'isi')>3000 then raise exception 'Isi judul dan catatan. Judul maksimal 160, isi maksimal 3000 karakter.';end if;
  if coalesce(p_data->>'jangkauan','') not in ('pribadi','office') or coalesce(p_data->>'jenis','') not in ('Pengingat','Administrasi Karyawan') then raise exception 'Jangkauan atau jenis catatan tidak valid.';end if;
  v_date:=nullif(p_data->>'tanggal','')::date;
  if p_data->>'jenis'='Administrasi Karyawan' and not exists(select 1 from public.karyawan k where k.id=nullif(p_data->>'karyawan_id','')::uuid) then raise exception 'Pilih karyawan untuk catatan administrasi.';end if;
  if v_id is null then
   insert into public.catatan_admin(jenis,karyawan_id,tanggal_pengingat,catatan,nama_pembuat,dibuat_oleh,judul34,jangkauan34,nama_pengubah,status,nama_penyelesai,diselesaikan_pada,disimpan,nama_penyimpan,disimpan_pada)
   values(p_data->>'jenis',case when p_data->>'jenis'='Administrasi Karyawan' then nullif(p_data->>'karyawan_id','')::uuid end,v_date,p_data->>'isi',v_nama,v_p.id,btrim(p_data->>'judul'),p_data->>'jangkauan',v_nama,'Aktif',null,null,false,null,null) returning * into v_c;
  else
   update public.catatan_admin set judul34=btrim(p_data->>'judul'),catatan=p_data->>'isi',jangkauan34=p_data->>'jangkauan',jenis=p_data->>'jenis',
   karyawan_id=case when p_data->>'jenis'='Administrasi Karyawan' then nullif(p_data->>'karyawan_id','')::uuid end,tanggal_pengingat=v_date,
   diubah_pada=clock_timestamp(),nama_pengubah=v_nama,versi=versi+1 where id=v_id returning * into v_c;
  end if;
 elsif v_id is not null and v_action in ('sematkan','selesai','buka','arsip','pulihkan') then
  update public.catatan_admin set disematkan34=case when v_action='sematkan' then not disematkan34 else disematkan34 end,
  status=case when v_action='selesai' then 'Selesai' when v_action='buka' then 'Aktif' else status end,
  diselesaikan_pada=case when v_action='selesai' then clock_timestamp() when v_action='buka' then null else diselesaikan_pada end,
  nama_penyelesai=case when v_action='selesai' then v_nama when v_action='buka' then null else nama_penyelesai end,
  disimpan=case when v_action='arsip' then true when v_action='pulihkan' then false else disimpan end,
  disimpan_pada=case when v_action='arsip' then clock_timestamp() when v_action='pulihkan' then null else disimpan_pada end,
  nama_penyimpan=case when v_action='arsip' then v_nama when v_action='pulihkan' then null else nama_penyimpan end,
  diubah_pada=clock_timestamp(),nama_pengubah=v_nama,versi=versi+1 where id=v_id returning * into v_c;
 else raise exception 'Tindakan catatan tidak valid.';end if;
 -- Ambil kondisi akhir sesudah seluruh trigger, termasuk trigger audit dasar.
 select * into v_c from public.catatan_admin where id=v_c.id;
 v_result:=jsonb_build_object('pemilik',v_p.id,'kunci',p_kunci,'catatan',to_jsonb(v_c));
 insert into internal.catatan_requests34 values(v_p.id,p_kunci,p_data,v_result);return v_result;
end $$;
create or replace function public.catatan34_status(p_pemilik uuid,p_kunci uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_r internal.catatan_requests34;begin
 if p_pemilik is distinct from auth.uid() or p_kunci is null or not exists(select 1 from public.profil_pengguna p where p.id=auth.uid() and p.aktif and p.akses_portal and p.peran::text in ('administrator','super_admin','admin')) then raise exception 'Sesi pemeriksaan tidak valid.';end if;
 perform pg_advisory_xact_lock(hashtextextended('catatan34:'||p_pemilik::text||p_kunci::text,0));
 select * into v_r from internal.catatan_requests34 r where r.pemilik=p_pemilik and r.kunci=p_kunci;
 if found then if v_r.hasil->'catatan' is not null and not internal.catatan34_id((v_r.hasil#>>'{catatan,id}')::uuid) then raise exception using errcode='42501',message='Akses catatan berubah.';end if;return v_r.hasil;end if;insert into internal.catatan_requests34(pemilik,kunci) values(p_pemilik,p_kunci);return null;
end $$;
revoke all on function public.catatan34_halaman(text,text,text,integer),public.catatan34_tulis(uuid,uuid,jsonb),public.catatan34_status(uuid,uuid) from public,anon;
grant execute on function public.catatan34_halaman(text,text,text,integer),public.catatan34_tulis(uuid,uuid,jsonb),public.catatan34_status(uuid,uuid) to authenticated;
revoke all on function internal.catatan34_guard(),internal.catatan34_id(uuid),internal.catatan34_boleh(uuid,uuid,text),internal.crew34() from public,anon;
grant execute on function internal.catatan34_boleh(uuid,uuid,text),internal.crew34() to authenticated;
