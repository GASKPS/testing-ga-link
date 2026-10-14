-- Menu Stok Barang & Opname. Jalankan sekali pada proyek Supabase Portal GA.
-- Menambah tabel baru. Tidak mengubah data mess, dokumen, perangkat, atau akun.
begin;
do $$ begin
 if to_regclass('public.profil_pengguna') is null or to_regprocedure('internal.administrator()') is null then
  raise exception 'Pasang database Portal GA dan pembaruan Administrator terlebih dahulu.';
 end if;
end $$;

create table if not exists public.stok_kunci (id integer primary key check(id=1));
insert into public.stok_kunci values(1) on conflict do nothing;
create table if not exists public.stok_item (
 id uuid primary key default gen_random_uuid(), kode text not null check(length(kode) between 1 and 60),
 nama text not null check(length(nama) between 1 and 200), spesifikasi text not null default '' check(length(spesifikasi)<=500),
 jenis_aset text not null default 'Consumable' check(length(jenis_aset) between 1 and 100),
 satuan text not null check(length(satuan) between 1 and 40),
 saldo numeric(14,3) not null default 0 check(saldo>=0), aktif boolean not null default true,
 versi integer not null default 1, dibuat_pada timestamptz not null default now()
);
create unique index if not exists stok_item_kode on public.stok_item(lower(kode));
create table if not exists public.stok_opname (
 id uuid primary key, tanggal date not null default internal.hari_ini(), crew text not null check(length(crew) between 1 and 200),
 catatan text not null default '' check(length(catatan)<=2000), mulai_pada timestamptz not null default clock_timestamp(),
 status text not null default 'draf' check(status in ('draf','menunggu','sesuai','disesuaikan','ditutup','batal')),
 versi integer not null default 1, dibuat_oleh uuid not null references public.profil_pengguna(id), nama_pencatat text not null,
 selesai_pada timestamptz, diperiksa_pada timestamptz, diperiksa_oleh uuid references public.profil_pengguna(id),
 nama_pemeriksa text, alasan text not null default '' check(length(alasan)<=2000)
);
create unique index if not exists stok_satu_opname_aktif on public.stok_opname((true)) where status='draf';
create table if not exists public.stok_opname_baris (
 id uuid primary key default gen_random_uuid(), opname_id uuid not null references public.stok_opname(id),
 item_id uuid not null references public.stok_item(id), kode text not null, nama text not null, spesifikasi text not null,
 jenis_aset text not null, satuan text not null, stok_catatan numeric(14,3) not null check(stok_catatan>=0),
 fisik numeric(14,3) check(fisik>=0), selisih numeric(14,3) generated always as (fisik-stok_catatan) stored,
 catatan text not null default '' check(length(catatan)<=1000), unique(opname_id,item_id)
);
create table if not exists public.stok_transaksi (
 id uuid primary key, jenis text not null check(jenis in ('awal','masuk','keluar','penyesuaian')),
 tanggal date not null, tujuan text not null default '' check(length(tujuan)<=200), catatan text not null default '' check(length(catatan)<=2000),
 dibuat_oleh uuid not null references public.profil_pengguna(id), nama_petugas text not null, dibuat_pada timestamptz not null default now(),
 opname_id uuid references public.stok_opname(id), permintaan jsonb
);
create table if not exists public.stok_mutasi (
 id uuid primary key default gen_random_uuid(), transaksi_id uuid not null references public.stok_transaksi(id),
 item_id uuid not null references public.stok_item(id), kode text not null, nama text not null, satuan text not null,
 jumlah numeric(14,3) not null check(jumlah<>0), saldo_sebelum numeric(14,3) not null check(saldo_sebelum>=0),
 saldo_setelah numeric(14,3) not null check(saldo_setelah>=0), unique(transaksi_id,item_id)
);
create index if not exists stok_opname_tanggal on public.stok_opname(mulai_pada desc,id);
create index if not exists stok_transaksi_tanggal on public.stok_transaksi(dibuat_pada desc,id);
create index if not exists stok_mutasi_item on public.stok_mutasi(item_id,transaksi_id);

-- Semua mutasi dan pengambilan snapshot menggunakan kunci yang sama.
-- Snapshot opname tetap berlaku saat administrator meninjau hasilnya nanti.
create or replace function internal.kunci_stok(p_larang_draf boolean default true) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform id from public.stok_kunci where id=1 for update;
 if p_larang_draf and exists(select 1 from public.stok_opname where status='draf') then
  raise exception 'Opname sedang berjalan. Selesaikan atau batalkan opname sebelum mencatat barang masuk/keluar atau mengubah master.';
 end if;
end $$;
create or replace function internal.jumlah_stok(p_nilai jsonb,p_nol boolean default true) returns numeric
language plpgsql immutable set search_path='' as $$
declare n numeric; v text:=p_nilai#>>'{}'; begin
 if v is null or v !~ '^[0-9]+([.][0-9]{1,3})?$' then raise exception 'Jumlah harus angka, maksimal 3 angka desimal.'; end if;
 n:=v::numeric;
 if n>99999999999.999 or (not p_nol and n=0) then raise exception 'Jumlah tidak valid.'; end if;
 return n;
end $$;
revoke all on function internal.kunci_stok(boolean),internal.jumlah_stok(jsonb,boolean) from public,anon,authenticated;

create or replace function public.stok_simpan_item(p_data jsonb,p_id uuid default null,p_versi integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.stok_item; n numeric; transaksi uuid; begin
 if not internal.super_admin() then raise exception 'Master barang hanya dapat diubah oleh Super Admin atau Administrator.'; end if;
 perform internal.kunci_stok();
 if p_id is not null then
  select * into v from public.stok_item where id=p_id for update;
  if not found or p_versi is distinct from v.versi then raise exception 'Data berubah. Muat ulang master barang.'; end if;
  if internal.teks(p_data,'kode',60,true)<>v.kode or internal.teks(p_data,'satuan',40,true)<>v.satuan then
   raise exception 'Kode dan satuan barang yang sudah tersimpan tetap. Tambahkan barang baru untuk kode atau satuan berbeda.';
  end if;
  if not coalesce((p_data->>'aktif')::boolean,true) and v.saldo<>0 then raise exception 'Stok harus nol sebelum barang dinonaktifkan.'; end if;
  if not coalesce((p_data->>'aktif')::boolean,true) and exists(select 1 from public.stok_opname_baris b join public.stok_opname o on o.id=b.opname_id where b.item_id=p_id and b.selisih<>0 and o.status='menunggu') then
   raise exception 'Selesaikan pemeriksaan selisih barang ini terlebih dahulu.';
  end if;
  update public.stok_item set nama=internal.teks(p_data,'nama',200,true),spesifikasi=internal.teks(p_data,'spesifikasi',500),
   jenis_aset=internal.teks(p_data,'jenis_aset',100,true),aktif=coalesce((p_data->>'aktif')::boolean,true),versi=versi+1 where id=p_id returning * into v;
 else
  n:=internal.jumlah_stok(p_data->'saldo_awal');
  insert into public.stok_item(kode,nama,spesifikasi,jenis_aset,satuan,saldo)
   values(internal.teks(p_data,'kode',60,true),internal.teks(p_data,'nama',200,true),internal.teks(p_data,'spesifikasi',500),
   internal.teks(p_data,'jenis_aset',100,true),internal.teks(p_data,'satuan',40,true),n) returning * into v;
  if n>0 then
   transaksi:=gen_random_uuid();
   insert into public.stok_transaksi(id,jenis,tanggal,catatan,dibuat_oleh,nama_petugas)
    values(transaksi,'awal',internal.hari_ini(),'Saldo awal saat barang ditambahkan',auth.uid(),internal.petugas());
   insert into public.stok_mutasi(transaksi_id,item_id,kode,nama,satuan,jumlah,saldo_sebelum,saldo_setelah)
    values(transaksi,v.id,v.kode,v.nama,v.satuan,n,0,n);
  end if;
 end if;
 return to_jsonb(v);
exception when unique_violation then raise exception 'Kode barang sudah digunakan. Pilih barang yang sudah ada.';
end $$;

create or replace function public.stok_catat_transaksi(p_id uuid,p_data jsonb,p_baris jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.stok_transaksi; v public.stok_item; r jsonb; n numeric; jenis text; tanggal date; permintaan jsonb; begin
 if not internal.izin_portal(true) then raise exception 'Akses mencatat stok tidak diizinkan.'; end if;
 if p_id is null then raise exception 'ID transaksi diperlukan.'; end if;
 perform internal.kunci_stok(false);
 permintaan:=jsonb_build_object('data',p_data,'baris',p_baris);
 select * into t from public.stok_transaksi where id=p_id;
 if found then
  if t.dibuat_oleh<>auth.uid() or t.permintaan is distinct from permintaan then raise exception 'ID transaksi sudah dipakai. Muat ulang formulir.'; end if;
  return to_jsonb(t);
 end if;
 perform internal.kunci_stok();
 jenis:=p_data->>'jenis';
 if jenis not in ('masuk','keluar') or jenis is null then raise exception 'Pilih barang masuk atau barang keluar.'; end if;
 tanggal:=(p_data->>'tanggal')::date;
 if tanggal is null or tanggal>internal.hari_ini() then raise exception 'Tanggal wajib diisi dan tidak boleh melewati hari ini.'; end if;
 if jsonb_typeof(p_baris) is distinct from 'array' then raise exception 'Daftar barang tidak valid.'; end if;
 if jsonb_array_length(p_baris) not between 1 and 200 then raise exception 'Isi 1 sampai 200 barang dalam satu transaksi.'; end if;
 if (select count(distinct value->>'item_id') from jsonb_array_elements(p_baris))<>jsonb_array_length(p_baris) then raise exception 'Pilih setiap barang satu kali.'; end if;
 insert into public.stok_transaksi(id,jenis,tanggal,tujuan,catatan,dibuat_oleh,nama_petugas,permintaan)
  values(p_id,jenis,tanggal,internal.teks(p_data,'tujuan',200,jenis='keluar'),internal.teks(p_data,'catatan',2000),auth.uid(),internal.petugas(),permintaan) returning * into t;
 for r in select value from jsonb_array_elements(p_baris) loop
  select * into v from public.stok_item where id=(r->>'item_id')::uuid for update;
  if not found or not v.aktif then raise exception 'Barang tidak ditemukan atau nonaktif.'; end if;
  n:=internal.jumlah_stok(r->'jumlah',false)*(case when jenis='keluar' then -1 else 1 end);
  if v.saldo+n<0 then raise exception 'Stok % tidak cukup. Sisa % %.',v.nama,v.saldo,v.satuan; end if;
  insert into public.stok_mutasi(transaksi_id,item_id,kode,nama,satuan,jumlah,saldo_sebelum,saldo_setelah)
   values(t.id,v.id,v.kode,v.nama,v.satuan,n,v.saldo,v.saldo+n);
  update public.stok_item set saldo=saldo+n,versi=versi+1 where id=v.id;
 end loop;
 return to_jsonb(t);
end $$;

create or replace function public.stok_mulai_opname(p_id uuid,p_crew text,p_catatan text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.stok_opname; begin
 if not internal.izin_portal(true) then raise exception 'Akses opname tidak diizinkan.'; end if;
 if p_id is null or length(btrim(coalesce(p_crew,''))) not between 1 and 200 or length(coalesce(p_catatan,''))>2000 then raise exception 'Isi nama crew yang menghitung.'; end if;
 perform internal.kunci_stok(false);
 select * into o from public.stok_opname where id=p_id;
 if found then
  if o.dibuat_oleh<>auth.uid() or o.crew<>btrim(p_crew) or o.catatan<>coalesce(p_catatan,'') then raise exception 'ID opname sudah digunakan.'; end if;
  return to_jsonb(o);
 end if;
 perform internal.kunci_stok();
 if exists(select 1 from public.stok_opname where status='menunggu') then
  raise exception 'Periksa selisih opname sebelumnya sebelum mulai opname baru.';
 end if;
 if not exists(select 1 from public.stok_item where aktif) then raise exception 'Tambahkan barang beserta stok awal terlebih dahulu.'; end if;
 insert into public.stok_opname(id,crew,catatan,dibuat_oleh,nama_pencatat)
  values(p_id,btrim(p_crew),coalesce(p_catatan,''),auth.uid(),internal.petugas()) returning * into o;
 insert into public.stok_opname_baris(opname_id,item_id,kode,nama,spesifikasi,jenis_aset,satuan,stok_catatan)
  select o.id,id,kode,nama,spesifikasi,jenis_aset,satuan,saldo from public.stok_item where aktif;
 return to_jsonb(o);
end $$;

create or replace function public.stok_detail_opname(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.stok_opname; begin
 if not internal.izin_portal() then raise exception 'Akses tidak diizinkan.'; end if;
 select * into o from public.stok_opname where id=p_id;
 if not found then raise exception 'Opname tidak ditemukan.'; end if;
 return jsonb_build_object('opname',to_jsonb(o),'baris',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('saldo_terkini',i.saldo) order by b.nama,b.kode) from public.stok_opname_baris b join public.stok_item i on i.id=b.item_id where opname_id=p_id),'[]'::jsonb));
end $$;

create or replace function public.stok_simpan_opname(p_id uuid,p_versi integer,p_baris jsonb,p_selesai boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.stok_opname; r jsonb; n numeric; begin
 if not internal.izin_portal(true) then raise exception 'Akses opname tidak diizinkan.'; end if;
 if p_selesai is null then raise exception 'Status penyelesaian wajib diisi.'; end if;
 perform internal.kunci_stok(false);
 select * into o from public.stok_opname where id=p_id for update;
 if not found or o.status<>'draf' or p_versi is distinct from o.versi then raise exception 'Opname berubah atau sudah selesai. Buka ulang hasilnya.'; end if;
 if jsonb_typeof(p_baris) is distinct from 'array' then raise exception 'Hasil hitungan tidak valid.'; end if;
 if (select count(distinct value->>'item_id') from jsonb_array_elements(p_baris))<>jsonb_array_length(p_baris) then raise exception 'Barang tidak boleh berulang.'; end if;
 for r in select value from jsonb_array_elements(p_baris) loop
  n:=case when r->'fisik' is null or r->'fisik'='null'::jsonb then null else internal.jumlah_stok(r->'fisik') end;
  update public.stok_opname_baris set fisik=n,catatan=internal.teks(r,'catatan',1000) where opname_id=p_id and item_id=(r->>'item_id')::uuid;
  if not found then raise exception 'Barang tidak termasuk dalam opname ini.'; end if;
 end loop;
 if p_selesai and exists(select 1 from public.stok_opname_baris where opname_id=p_id and fisik is null) then
  raise exception 'Masih ada barang belum dihitung. Isi 0 jika stok fisiknya memang habis.';
 end if;
 update public.stok_opname set versi=versi+1,status=case when not p_selesai then 'draf'
  when exists(select 1 from public.stok_opname_baris where opname_id=p_id and selisih<>0) then 'menunggu' else 'sesuai' end,
  selesai_pada=case when p_selesai then now() else null end where id=p_id returning * into o;
 return to_jsonb(o);
end $$;

create or replace function public.stok_periksa_opname(p_id uuid,p_versi integer,p_tindakan text,p_alasan text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.stok_opname; r public.stok_opname_baris; v public.stok_item; transaksi uuid; begin
 if not internal.izin_portal(true) then raise exception 'Akses tidak diizinkan.'; end if;
 if p_tindakan not in ('batalkan','sesuaikan','tutup') or p_tindakan is null then raise exception 'Tindakan tidak valid.'; end if;
 if p_tindakan<>'batalkan' and not internal.administrator() then raise exception 'Hanya Administrator dapat memeriksa dan menyesuaikan selisih.'; end if;
 if length(btrim(coalesce(p_alasan,''))) not between 1 and 2000 then raise exception 'Isi alasan pemeriksaan atau pembatalan.'; end if;
 perform internal.kunci_stok(p_tindakan<>'batalkan');
 select * into o from public.stok_opname where id=p_id for update;
 if not found or p_versi is distinct from o.versi then raise exception 'Opname berubah. Buka ulang hasilnya.'; end if;
 if (p_tindakan='batalkan' and o.status<>'draf') or (p_tindakan<>'batalkan' and o.status<>'menunggu') then raise exception 'Status opname tidak sesuai untuk tindakan ini.'; end if;
 if p_tindakan='sesuaikan' then
  transaksi:=gen_random_uuid();
  insert into public.stok_transaksi(id,jenis,tanggal,catatan,dibuat_oleh,nama_petugas,opname_id)
   values(transaksi,'penyesuaian',internal.hari_ini(),btrim(p_alasan),auth.uid(),internal.petugas(),o.id);
  for r in select * from public.stok_opname_baris where opname_id=p_id and selisih<>0 order by item_id loop
   select * into v from public.stok_item where id=r.item_id for update;
   -- Tambahkan selisih ke saldo terbaru; jangan menimpa transaksi setelah opname.
   if v.saldo+r.selisih<0 then raise exception 'Penyesuaian % membuat stok negatif. Periksa transaksi setelah opname.',r.nama; end if;
   insert into public.stok_mutasi(transaksi_id,item_id,kode,nama,satuan,jumlah,saldo_sebelum,saldo_setelah)
    values(transaksi,v.id,v.kode,v.nama,v.satuan,r.selisih,v.saldo,v.saldo+r.selisih);
   update public.stok_item set saldo=saldo+r.selisih,versi=versi+1 where id=v.id;
  end loop;
 end if;
 update public.stok_opname set status=case p_tindakan when 'batalkan' then 'batal' when 'sesuaikan' then 'disesuaikan' else 'ditutup' end,
  versi=versi+1,diperiksa_pada=now(),diperiksa_oleh=auth.uid(),nama_pemeriksa=internal.petugas(),alasan=btrim(p_alasan) where id=p_id returning * into o;
 return to_jsonb(o);
end $$;

create or replace function public.stok_halaman(p_tab text default 'stok',p_cari text default '',p_halaman integer default 1,p_jenis text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare total integer; halaman integer; hasil jsonb; q text:=btrim(coalesce(p_cari,'')); opname_aktif jsonb; ringkasan jsonb; begin
 if not internal.izin_portal() then raise exception 'Akses tidak diizinkan.'; end if;
 if length(q)>200 then raise exception 'Kata pencarian terlalu panjang.'; end if;
 select to_jsonb(o) into opname_aktif from public.stok_opname o where status='draf';
 ringkasan:=jsonb_build_object('barang',(select count(*) from public.stok_item where aktif),
  'habis',(select count(*) from public.stok_item where aktif and saldo=0),
  'menunggu',(select count(*) from public.stok_opname where status='menunggu'),
  'terakhir',(select to_jsonb(o) from public.stok_opname o where status not in ('draf','batal') order by mulai_pada desc limit 1));
 if p_tab='stok' then
  select count(*) into total from public.stok_item i where (p_jenis='nonaktif' and not i.aktif or p_jenis<>'nonaktif' and i.aktif)
   and (q='' or strpos(lower(i.kode||' '||i.nama||' '||i.spesifikasi),lower(q))>0);
  halaman:=least(greatest(coalesce(p_halaman,1),1),greatest(1,ceil(total/20.0)::integer));
  select coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) into hasil from (select * from public.stok_item i
   where (p_jenis='nonaktif' and not i.aktif or p_jenis<>'nonaktif' and i.aktif) and (q='' or strpos(lower(i.kode||' '||i.nama||' '||i.spesifikasi),lower(q))>0)
   order by nama,kode limit 20 offset (halaman-1)*20) v;
 elsif p_tab='opname' then
  select count(*) into total from public.stok_opname o where (p_jenis='' or status=p_jenis)
   and (q='' or strpos(lower(crew||' '||nama_pencatat||' '||catatan),lower(q))>0);
  halaman:=least(greatest(coalesce(p_halaman,1),1),greatest(1,ceil(total/20.0)::integer));
  select coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) into hasil from (select o.*,
   (select count(*) from public.stok_opname_baris where opname_id=o.id and fisik is null) belum,
   (select count(*) from public.stok_opname_baris where opname_id=o.id and selisih<>0) jumlah_selisih
   from public.stok_opname o where (p_jenis='' or status=p_jenis) and (q='' or strpos(lower(crew||' '||nama_pencatat||' '||catatan),lower(q))>0)
   order by mulai_pada desc,id limit 20 offset (halaman-1)*20) v;
 elsif p_tab='mutasi' then
  select count(*) into total from public.stok_mutasi m join public.stok_transaksi t on t.id=m.transaksi_id
   where (p_jenis='' or t.jenis=p_jenis) and (q='' or strpos(lower(m.kode||' '||m.nama||' '||t.tujuan||' '||t.catatan),lower(q))>0);
  halaman:=least(greatest(coalesce(p_halaman,1),1),greatest(1,ceil(total/20.0)::integer));
  select coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) into hasil from (select m.*,t.jenis,t.tanggal,t.tujuan,t.catatan,t.nama_petugas,t.dibuat_pada,t.opname_id
   from public.stok_mutasi m join public.stok_transaksi t on t.id=m.transaksi_id where (p_jenis='' or t.jenis=p_jenis)
   and (q='' or strpos(lower(m.kode||' '||m.nama||' '||t.tujuan||' '||t.catatan),lower(q))>0)
   order by t.dibuat_pada desc,m.id limit 20 offset (halaman-1)*20) v;
 else raise exception 'Halaman stok tidak valid.';
 end if;
 return jsonb_build_object('data',hasil,'total',total,'halaman',halaman,'ukuran_halaman',20,'aktif',opname_aktif,'ringkasan',ringkasan);
end $$;

-- Salinan JSON stok terpisah, seluruh halaman; tidak mengubah format cadangan portal lama.
create or replace function public.stok_ekspor() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not internal.super_admin() then raise exception 'Cadangan stok hanya untuk Super Admin atau Administrator.'; end if;
 return jsonb_build_object('format','GA_STOK','versi',1,'dibuat_pada',now(),'data',jsonb_build_object(
  'item',coalesce((select jsonb_agg(to_jsonb(i)) from public.stok_item i),'[]'::jsonb),
  'transaksi',coalesce((select jsonb_agg(to_jsonb(t)-'permintaan') from public.stok_transaksi t),'[]'::jsonb),
  'mutasi',coalesce((select jsonb_agg(to_jsonb(m)) from public.stok_mutasi m),'[]'::jsonb),
  'opname',coalesce((select jsonb_agg(to_jsonb(o)) from public.stok_opname o),'[]'::jsonb),
  'baris_opname',coalesce((select jsonb_agg(to_jsonb(b)) from public.stok_opname_baris b),'[]'::jsonb)));
end $$;

do $$ declare t text; f text; begin
 foreach t in array array['stok_kunci','stok_item','stok_opname','stok_opname_baris','stok_transaksi','stok_mutasi'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  if t<>'stok_kunci' then
   execute format('drop policy if exists stok_baca on public.%I',t);
   execute format('create policy stok_baca on public.%I for select to authenticated using (internal.izin_portal())',t);
   execute format('grant select on public.%I to authenticated',t);
  end if;
 end loop;
 foreach f in array array['public.stok_simpan_item(jsonb,uuid,integer)','public.stok_catat_transaksi(uuid,jsonb,jsonb)',
  'public.stok_mulai_opname(uuid,text,text)','public.stok_detail_opname(uuid)','public.stok_simpan_opname(uuid,integer,jsonb,boolean)',
  'public.stok_periksa_opname(uuid,integer,text,text)','public.stok_halaman(text,text,integer,text)','public.stok_ekspor()'] loop
  execute format('revoke all on function %s from public,anon',f);
  execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
