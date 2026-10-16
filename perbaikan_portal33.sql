-- Perbaikan SQL Pembaruan 33. Nama API 32 dipertahankan untuk instalasi yang sudah memakai Pembaruan 32.
begin;
create or replace function internal.pengguna_portal32(p_tulis boolean default false) returns public.profil_pengguna
language plpgsql security definer set search_path='' as $$
declare v_p public.profil_pengguna;begin
 if p_tulis then select p.* into v_p from public.profil_pengguna p where p.id=auth.uid() for share;
 else select p.* into v_p from public.profil_pengguna p where p.id=auth.uid();end if;
 if not found or not v_p.aktif or not v_p.akses_portal or v_p.peran::text='crew' or (p_tulis and v_p.peran::text not in ('administrator','super_admin','admin')) then raise exception 'Akses Portal GA tidak diizinkan.';end if;return v_p;
end $$;
revoke all on function internal.pengguna_portal32(boolean) from public,anon,authenticated;
create table if not exists internal.skc_input_requests32 (
 user_id uuid not null references public.profil_pengguna(id),request_id uuid not null,payload jsonb,result jsonb,created_at timestamptz not null default now(),primary key(user_id,request_id)
);
alter table internal.skc_input_requests32 enable row level security;
revoke all on internal.skc_input_requests32 from public,anon,authenticated;
create or replace function public.simpan_skc_excel32(p_rows jsonb,p_kunci uuid,p_pemilik uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_p public.profil_pengguna;v_prior internal.skc_input_requests32;v_row jsonb;v_nik text;v_employee public.karyawan;v_date date;v_link text;v_exit text;v_created jsonb;v_receipt jsonb;v_rows jsonb:='[]';v_number integer:=0;v_message text;begin
 v_p:=internal.pengguna_portal32(true);
 if p_pemilik is distinct from v_p.id or p_kunci is null then raise exception 'Sesi penyimpanan SKC tidak cocok.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_pemilik::text||p_kunci::text,32));
 select r.* into v_prior from internal.skc_input_requests32 r where r.user_id=p_pemilik and r.request_id=p_kunci;
 if found then
  if v_prior.payload is null then raise exception 'Kiriman ini sudah ditutup. Periksa isian lalu simpan kembali.';end if;
  if v_prior.payload is distinct from p_rows then raise exception 'Kunci kiriman sudah dipakai untuk isian lain.';end if;return v_prior.result;
 end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'Isi 1 sampai 100 SKC per kiriman.';end if;
 lock table public.pengambilan_skc in share row exclusive mode;
 insert into internal.skc_input_requests32(user_id,request_id,payload) values(p_pemilik,p_kunci,p_rows);
 for v_row in select x.value from jsonb_array_elements(p_rows) x loop
  v_number:=v_number+1;
  begin
   v_nik:=btrim(coalesce(v_row->>'nik',''));
   if v_nik='' or length(v_nik)>40 then raise exception 'NIK wajib diisi, maksimal 40 karakter.';end if;
   if (select count(*) from public.karyawan k where lower(btrim(k.nik))=lower(v_nik) and k.aktif)<>1 then raise exception 'NIK tidak ditemukan, nonaktif, atau lebih dari satu. Periksa master karyawan.';end if;
   select k.* into strict v_employee from public.karyawan k where lower(btrim(k.nik))=lower(v_nik) and k.aktif;
   if coalesce(v_row->>'tanggal_cuti','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Tanggal cuti wajib berupa tanggal yang valid.';end if;
   v_date:=(v_row->>'tanggal_cuti')::date;
   v_link:=btrim(coalesce(v_row->>'link_form_cuti',''));v_exit:=btrim(coalesce(v_row->>'link_exit',''));
   if length(v_link)>3000 or length(v_exit)>3000 or (v_link<>'' and v_link !~* '^https://(drive[.]google[.]com|docs[.]google[.]com)/') or (v_exit<>'' and v_exit !~* '^https://(drive[.]google[.]com|docs[.]google[.]com)/') then raise exception 'Gunakan link HTTPS Google Drive atau Google Docs yang valid.';end if;
   if exists(select 1 from public.pengambilan_skc s where s.karyawan_id=v_employee.id and s.tanggal_cuti=v_date) then raise exception 'Karyawan ini sudah memiliki SKC pada tanggal cuti tersebut.';end if;
   select to_jsonb(x) into v_created from public.tambah_skc(p_data=>jsonb_build_object('karyawan_id',v_employee.id,'tanggal_cuti',v_date,'link_form_cuti',v_link,'link_exit',v_exit)) x;
   if not exists(select 1 from public.pengambilan_skc s where s.id=(v_created->>'id')::uuid and s.karyawan_id=v_employee.id and s.tanggal_cuti=v_date) then raise exception 'Konfirmasi SKC tidak lengkap.';end if;
   v_rows:=v_rows||jsonb_build_array(jsonb_build_object('id',v_created->>'id','karyawan_id',v_employee.id,'nik',v_employee.nik,'nama',v_employee.nama,'tanggal_cuti',v_date));
  exception when others then get stacked diagnostics v_message=MESSAGE_TEXT;raise exception 'Baris %: %',v_number,v_message;end;
 end loop;
 v_receipt:=jsonb_build_object('pemilik',p_pemilik,'kunci',p_kunci,'jumlah',v_number,'skc',v_rows);
 update internal.skc_input_requests32 r set result=v_receipt where r.user_id=p_pemilik and r.request_id=p_kunci;return v_receipt;
end $$;
create or replace function public.status_input_skc32(p_kunci uuid,p_pemilik uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p public.profil_pengguna;v_prior internal.skc_input_requests32;begin
 v_p:=internal.pengguna_portal32(true);if p_pemilik is distinct from v_p.id or p_kunci is null then raise exception 'Sesi pemeriksaan tidak cocok.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_pemilik::text||p_kunci::text,32));
 select r.* into v_prior from internal.skc_input_requests32 r where r.user_id=p_pemilik and r.request_id=p_kunci;
 if found then return v_prior.result;end if;
 insert into internal.skc_input_requests32(user_id,request_id) values(p_pemilik,p_kunci);return null;
end $$;
create or replace function public.halaman_dokumen_selesai32(p_filter jsonb default '{}',p_halaman integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_p public.profil_pengguna;v_meta jsonb;v_q text:=lower(btrim(coalesce(p_filter->>'query','')));v_bu text:=coalesce(p_filter->>'bu','');v_status text:=coalesce(p_filter->>'status','');v_office uuid;v_from date;v_to date;v_total integer;v_page integer;v_rows jsonb;begin
 v_p:=internal.pengguna_portal32(false);
 v_meta:=public.halaman_dokumen(p_filter=>coalesce(p_filter,'{}')||jsonb_build_object('selesai',true),p_halaman=>1);
 v_office:=case when v_p.peran::text='administrator' then nullif(p_filter->>'office','')::uuid else v_p.office_id end;
 if v_p.peran::text<>'administrator' and v_office is null then raise exception 'Office akun belum ditetapkan.';end if;
 v_from:=nullif(p_filter->>'dateFrom','')::date;v_to:=nullif(p_filter->>'dateTo','')::date;
 if v_from>v_to then raise exception 'Tanggal awal tidak boleh setelah tanggal akhir.';end if;
 if length(v_q)>200 then raise exception 'Pencarian maksimal 200 karakter.';end if;
 with cocok as (
  select d.* from public.dokumen d left join public.kantor k on k.id=d.office_id
  where d.status_terakhir::text in ('Sudah Diambil','Selesai','Dibatalkan') and (v_office is null or d.office_id=v_office)
  and (v_bu='' or d.bu::text=v_bu) and (v_status='' or d.status_terakhir::text=v_status)
  and (v_from is null or d.tanggal_masuk>=v_from) and (v_to is null or d.tanggal_masuk<=v_to)
  and (v_q='' or strpos(lower(concat_ws(' ',d.kode,d.nama_dokumen,d.nomor_dokumen,d.jenis_dokumen,d.jenis_lainnya,d.bu,d.posisi_sekarang,d.catatan,k.nama)),v_q)>0)
 ) select count(*) into v_total from cocok;
 v_page:=least(greatest(coalesce(p_halaman,1),1),greatest(1,ceil(v_total/20.0)::integer));
 with cocok as (
  select d.*,k.nama office_asal,coalesce(d.perpindahan_terakhir,d.tanggal_masuk) selesai_tanggal,
   coalesce((select max(m.dicatat_pada) from public.perpindahan_dokumen m where m.dokumen_id=d.id),nullif(to_jsonb(d)->>'diubah_pada','')::timestamptz,d.dibuat_pada) selesai_waktu
  from public.dokumen d left join public.kantor k on k.id=d.office_id
  where d.status_terakhir::text in ('Sudah Diambil','Selesai','Dibatalkan') and (v_office is null or d.office_id=v_office)
  and (v_bu='' or d.bu::text=v_bu) and (v_status='' or d.status_terakhir::text=v_status)
  and (v_from is null or d.tanggal_masuk>=v_from) and (v_to is null or d.tanggal_masuk<=v_to)
  and (v_q='' or strpos(lower(concat_ws(' ',d.kode,d.nama_dokumen,d.nomor_dokumen,d.jenis_dokumen,d.jenis_lainnya,d.bu,d.posisi_sekarang,d.catatan,k.nama)),v_q)>0)
 ), lembar as (select c.* from cocok c order by c.selesai_tanggal desc,c.selesai_waktu desc,c.id desc limit 20 offset (v_page-1)*20)
 select coalesce(jsonb_agg(to_jsonb(l)-'selesai_tanggal'-'selesai_waktu' order by l.selesai_tanggal desc,l.selesai_waktu desc,l.id desc),'[]') into v_rows from lembar l;
 return coalesce(v_meta,'{}')||jsonb_build_object('data',v_rows,'total',v_total,'halaman',v_page,'ukuran_halaman',20);
end $$;
revoke all on function public.simpan_skc_excel32(jsonb,uuid,uuid),public.status_input_skc32(uuid,uuid),public.halaman_dokumen_selesai32(jsonb,integer) from public,anon;
grant execute on function public.simpan_skc_excel32(jsonb,uuid,uuid),public.status_input_skc32(uuid,uuid),public.halaman_dokumen_selesai32(jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
