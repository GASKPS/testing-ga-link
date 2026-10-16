-- Pembaruan 33: stok per office, transaksi, hitungan crew, dan opname.
-- Jalankan melalui SQL Editor; tidak membutuhkan Node.js. Simpan cadangan terlebih dahulu.
begin;
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

create table if not exists public.stok_opname (
 id uuid primary key, tanggal date not null default internal.hari_ini(), crew text not null check(length(crew) between 1 and 200),
 catatan text not null default '' check(length(catatan)<=2000), mulai_pada timestamptz not null default clock_timestamp(),
 status text not null default 'draf' check(status in ('draf','menunggu','sesuai','disesuaikan','ditutup','batal')),
 versi integer not null default 1, dibuat_oleh uuid not null references public.profil_pengguna(id), nama_pencatat text not null,
 selesai_pada timestamptz, diperiksa_pada timestamptz, diperiksa_oleh uuid references public.profil_pengguna(id),
 nama_pemeriksa text, alasan text not null default '' check(length(alasan)<=2000)
);

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

alter table public.stok_item add column if not exists office_id uuid references public.kantor(id);
alter table public.stok_item add column if not exists minimum numeric(14,3) not null default 0 check(minimum>=0);
alter table public.stok_opname add column if not exists office_id uuid references public.kantor(id);
alter table public.stok_opname add column if not exists crew_id uuid references public.profil_pengguna(id);
alter table public.stok_transaksi add column if not exists office_id uuid references public.kantor(id);
alter table public.stok_transaksi add column if not exists koreksi_dari uuid unique references public.stok_transaksi(id);
drop index if exists public.stok_item_kode;
drop index if exists public.stok_satu_opname_aktif;
create unique index if not exists stok33_kode_office on public.stok_item(office_id,lower(kode)) where office_id is not null;
create unique index if not exists stok33_kode_lama on public.stok_item(lower(kode)) where office_id is null;
create unique index if not exists stok33_satu_opname on public.stok_opname(office_id) where status='draf' and office_id is not null;
create index if not exists stok33_transaksi_periode on public.stok_transaksi(office_id,tanggal,jenis);
create table if not exists public.stok_anggota33 (
 user_id uuid primary key references public.profil_pengguna(id), office_id uuid not null references public.kantor(id),
 aktif boolean not null default true, diubah_oleh uuid not null references public.profil_pengguna(id), diubah_pada timestamptz not null default now()
);
create table if not exists public.stok_hitung_keluar33 (
 id uuid primary key default gen_random_uuid(), office_id uuid not null references public.kantor(id),
 dari date not null, sampai date not null check(sampai>=dari), crew_id uuid not null references public.profil_pengguna(id), crew text not null,
 status text not null default 'draf' check(status in ('draf','menunggu','disetujui','ditutup','batal')), versi integer not null default 1,
 catatan text not null default '' check(length(catatan)<=2000), dibuat_oleh uuid not null references public.profil_pengguna(id), nama_pencatat text not null,
 dibuat_pada timestamptz not null default now(), selesai_pada timestamptz, diperiksa_pada timestamptz,
 diperiksa_oleh uuid references public.profil_pengguna(id), nama_pemeriksa text, alasan text not null default '' check(length(alasan)<=2000)
);
create table if not exists public.stok_keluar_baris33 (
 id uuid primary key default gen_random_uuid(), hitung_id uuid not null references public.stok_hitung_keluar33(id), item_id uuid not null references public.stok_item(id),
 kode text not null,nama text not null,satuan text not null,keluar_crew numeric(14,3) check(keluar_crew>=0),keluar_admin numeric(14,3) not null default 0,
 catatan text not null default '' check(length(catatan)<=1000), unique(hitung_id,item_id)
);
create table if not exists public.stok_audit33 (
 id uuid primary key default gen_random_uuid(),office_id uuid not null references public.kantor(id),entitas text not null,entitas_id uuid not null,
 tindakan text not null,petugas_id uuid not null references public.profil_pengguna(id),nama_petugas text not null,
 dicatat_pada timestamptz not null default clock_timestamp(),detail jsonb not null default '{}'
);
create index if not exists stok33_audit_entitas on public.stok_audit33(entitas_id,dicatat_pada desc);
create table if not exists internal.stok_requests33 (
 user_id uuid not null references public.profil_pengguna(id),kunci uuid not null,office_id uuid not null references public.kantor(id),jenis text not null,
 payload jsonb,hasil jsonb,dibuat_pada timestamptz not null default now(),primary key(user_id,kunci)
);
alter table internal.stok_requests33 enable row level security;
revoke all on internal.stok_requests33 from public,anon,authenticated;

create or replace function internal.stok33_role(p_office uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_p public.profil_pengguna; begin
 select p.* into v_p from public.profil_pengguna p where p.id=auth.uid();
 if not found or not v_p.aktif or not coalesce(v_p.akses_portal,false) then return ''; end if;
 if v_p.peran::text='administrator' then return 'admin'; end if;
 if v_p.office_id is distinct from p_office or p_office is null then return ''; end if;
 if v_p.peran::text in ('super_admin','admin') then return 'admin'; end if;
 if exists(select 1 from public.stok_anggota33 a where a.user_id=v_p.id and a.office_id=p_office and a.aktif) then return 'crew'; end if;
 return 'pembaca';
end $$;
create or replace function internal.stok33_global() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profil_pengguna p where p.id=auth.uid() and p.aktif and p.akses_portal and p.peran::text='administrator')
$$;
create or replace function internal.stok33_nama() returns text language sql stable security definer set search_path='' as $$
 select p.nama from public.profil_pengguna p where p.id=auth.uid()
$$;
create or replace function internal.stok33_jumlah(p_nilai jsonb,p_nol boolean default true) returns numeric language plpgsql immutable set search_path='' as $$
declare v_n numeric;v_s text:=p_nilai#>>'{}';begin
 if v_s is null or v_s !~ '^[0-9]+([.][0-9]{1,3})?$' then raise exception 'Jumlah harus angka, maksimal 3 angka desimal.';end if;
 v_n:=v_s::numeric;if v_n>99999999999.999 or (not p_nol and v_n=0) then raise exception 'Jumlah tidak valid.';end if;return v_n;
end $$;
create or replace function internal.stok33_teks(p_data jsonb,p_key text,p_max integer,p_wajib boolean default false) returns text language plpgsql immutable set search_path='' as $$
declare v_s text:=btrim(coalesce(p_data->>p_key,''));begin
 if length(v_s)>p_max or (p_wajib and v_s='') then raise exception 'Kolom % wajib diisi dengan panjang maksimal % karakter.',p_key,p_max;end if;return v_s;
end $$;
create or replace function internal.stok33_audit(p_office uuid,p_entitas text,p_id uuid,p_tindakan text,p_detail jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.stok_audit33(office_id,entitas,entitas_id,tindakan,petugas_id,nama_petugas,detail)
 values(p_office,p_entitas,p_id,p_tindakan,auth.uid(),internal.stok33_nama(),p_detail)
$$;
create or replace function internal.stok33_keluar(p_office uuid,p_item uuid,p_dari date,p_sampai date) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(-m.jumlah),0) from public.stok_mutasi m join public.stok_transaksi t on t.id=m.transaksi_id
 where t.office_id=p_office and m.item_id=p_item and t.jenis='keluar' and t.tanggal between p_dari and p_sampai
 and not exists(select 1 from public.stok_transaksi k where k.koreksi_dari=t.id)
$$;
create or replace function internal.stok33_buka_perbandingan(p_office uuid,p_tanggal date) returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid;begin
 for v_id in update public.stok_hitung_keluar33 h set status=case when h.status in ('disetujui','ditutup') then 'menunggu' else h.status end,
 versi=h.versi+1 where h.office_id=p_office and h.status<>'batal' and p_tanggal between h.dari and h.sampai returning h.id loop
  perform internal.stok33_audit(p_office,'keluar',v_id,'Transaksi admin berubah',jsonb_build_object('tanggal',p_tanggal));
 end loop;
end $$;
create or replace function public.stok33_konteks(p_office uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_office uuid;v_role text;v_offices jsonb;begin
 select coalesce(jsonb_agg(to_jsonb(k) order by k.nama),'[]') into v_offices from public.kantor k where internal.stok33_role(k.id)<>'';
 select k.id into v_office from public.kantor k where internal.stok33_role(k.id)<>'' order by (k.id=p_office) desc nulls last,(k.id=(select p.office_id from public.profil_pengguna p where p.id=auth.uid())) desc nulls last,k.aktif desc,k.nama limit 1;
 v_role:=internal.stok33_role(v_office);
 if v_office is null then raise exception 'Office akun belum ditetapkan atau akses Portal GA tidak aktif.';end if;
 return jsonb_build_object('office_id',v_office,'offices',v_offices,'peran',v_role,'administrator',internal.stok33_global(),
 'crew',case when v_role='admin' then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nama',p.nama,'email',p.email,'crew',a.aktif,'peran',p.peran) order by p.nama)
  from public.profil_pengguna p left join public.stok_anggota33 a on a.user_id=p.id and a.office_id=v_office
  where p.aktif and p.akses_portal and p.office_id=v_office),'[]') else '[]'::jsonb end,
 'lama',jsonb_build_object('barang',(select count(*) from public.stok_item i where i.office_id is null),'opname',(select count(*) from public.stok_opname o where o.office_id is null),'transaksi',(select count(*) from public.stok_transaksi t where t.office_id is null),'draf',(select count(*) from public.stok_opname o where o.office_id is null and o.status='draf')),
 'ringkasan',jsonb_build_object('barang',(select count(*) from public.stok_item i where i.office_id=v_office and i.aktif),
 'minimum',(select count(*) from public.stok_item i where i.office_id=v_office and i.aktif and i.saldo<=i.minimum),
 'menunggu',(select count(*) from public.stok_opname o where o.office_id=v_office and o.status='menunggu')+(select count(*) from public.stok_hitung_keluar33 h where h.office_id=v_office and h.status='menunggu'),
 'draf',(select to_jsonb(o) from public.stok_opname o where o.office_id=v_office and o.status='draf')));
end $$;

create or replace function public.stok33_halaman(p_office uuid,p_tab text default 'barang',p_filter jsonb default '{}',p_halaman integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_sql text;v_order text;v_outer text;v_rows jsonb;v_total integer;v_page integer;v_q text:=lower(btrim(coalesce(p_filter->>'q','')));v_status text:=coalesce(p_filter->>'status','');v_from date;v_to date;begin
 if internal.stok33_role(p_office)='' then raise exception 'Akses office tidak diizinkan.';end if;
 if length(v_q)>200 then raise exception 'Pencarian maksimal 200 karakter.';end if;
 v_from:=nullif(p_filter->>'dari','')::date;v_to:=nullif(p_filter->>'sampai','')::date;if v_from>v_to then raise exception 'Tanggal awal tidak boleh setelah tanggal akhir.';end if;
 -- All SQL fragments are fixed below. Filter values always use bound parameters.
 if p_tab='barang' then
  v_sql:=$q$select i.* from public.stok_item i where i.office_id=$1
   and (case $3 when 'nonaktif' then not i.aktif when 'minimum' then i.aktif and i.saldo<=i.minimum else i.aktif end)
   and ($2='' or strpos(lower(i.kode||' '||i.nama||' '||i.spesifikasi),$2)>0)$q$;
  v_order:='i.nama,i.kode,i.id';v_outer:='v.nama,v.kode,v.id';
 elsif p_tab='transaksi' then
  v_sql:=$q$select t.id,t.jenis,t.tanggal,t.tujuan,t.catatan,t.nama_petugas,t.dibuat_pada,t.opname_id,t.koreksi_dari,
   exists(select 1 from public.stok_transaksi k where k.koreksi_dari=t.id) dibatalkan,
   (select count(*) from public.stok_mutasi m where m.transaksi_id=t.id) jumlah_barang
   from public.stok_transaksi t where t.office_id=$1 and ($3='' or t.jenis=$3) and ($4::date is null or t.tanggal>=$4) and ($5::date is null or t.tanggal<=$5)
   and ($2='' or strpos(lower(t.tujuan||' '||t.catatan||' '||t.nama_petugas),$2)>0 or exists(select 1 from public.stok_mutasi m where m.transaksi_id=t.id and strpos(lower(m.kode||' '||m.nama),$2)>0))$q$;
  v_order:='t.dibuat_pada desc,t.id';v_outer:='v.dibuat_pada desc,v.id';
 elsif p_tab='keluar' then
  v_sql:=$q$select h.*,(select count(*) from public.stok_keluar_baris33 b where b.hitung_id=h.id and b.keluar_crew is null) belum,
   (select count(*) from public.stok_keluar_baris33 b where b.hitung_id=h.id and b.keluar_crew is not null and b.keluar_crew<>internal.stok33_keluar($1,b.item_id,h.dari,h.sampai)) jumlah_selisih
   from public.stok_hitung_keluar33 h where h.office_id=$1 and ($3='' or h.status=$3) and ($2='' or strpos(lower(h.crew||' '||h.catatan),$2)>0)
   and (internal.stok33_role($1)<>'crew' or h.crew_id=auth.uid()) and ($4::date is null or h.sampai>=$4) and ($5::date is null or h.dari<=$5)$q$;
  v_order:='h.dibuat_pada desc,h.id';v_outer:='v.dibuat_pada desc,v.id';
 elsif p_tab='opname' then
  v_sql:=$q$select o.*,(select count(*) from public.stok_opname_baris b where b.opname_id=o.id and b.fisik is null) belum,
   (select count(*) from public.stok_opname_baris b where b.opname_id=o.id and b.selisih<>0) jumlah_selisih
   from public.stok_opname o where o.office_id=$1 and ($3='' or o.status=$3) and ($2='' or strpos(lower(o.crew||' '||o.catatan),$2)>0)
   and (internal.stok33_role($1)<>'crew' or o.crew_id=auth.uid()) and ($4::date is null or o.tanggal>=$4) and ($5::date is null or o.tanggal<=$5)$q$;
  v_order:='o.mulai_pada desc,o.id';v_outer:='v.mulai_pada desc,v.id';
 else raise exception 'Halaman stok tidak valid.';end if;
 execute 'select count(*) from ('||v_sql||') v' into v_total using p_office,v_q,v_status,v_from,v_to;
 v_page:=least(greatest(coalesce(p_halaman,1),1),greatest(1,ceil(v_total/20.0)::integer));
 execute 'select coalesce(jsonb_agg(to_jsonb(v) order by '||v_outer||'),''[]''::jsonb) from ('||v_sql||' order by '||v_order||' limit 20 offset $6) v'
  into v_rows using p_office,v_q,v_status,v_from,v_to,(v_page-1)*20;
 return jsonb_build_object('data',v_rows,'total',v_total,'halaman',v_page,'ukuran_halaman',20);
end $$;

create or replace function public.stok33_detail(p_office uuid,p_jenis text,p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_header jsonb;v_rows jsonb;v_audit jsonb;v_role text:=internal.stok33_role(p_office);begin
 if v_role='' then raise exception 'Akses office tidak diizinkan.';end if;
 if p_jenis='barang' then
  if p_id is null then select coalesce(jsonb_agg(to_jsonb(i) order by i.nama,i.kode),'[]') into v_rows from public.stok_item i where i.office_id=p_office and i.aktif;return jsonb_build_object('baris',v_rows);end if;
  select to_jsonb(i) into v_header from public.stok_item i where i.id=p_id and i.office_id=p_office;
  select coalesce(jsonb_agg(to_jsonb(v) order by v.dibuat_pada desc),'[]') into v_rows from (select m.*,t.jenis,t.tanggal,t.dibuat_pada,t.nama_petugas,t.tujuan,t.koreksi_dari from public.stok_mutasi m join public.stok_transaksi t on t.id=m.transaksi_id where m.item_id=p_id and t.office_id=p_office order by t.dibuat_pada desc limit 100) v;
 elsif p_jenis='transaksi' then
  select to_jsonb(t)-'permintaan'||jsonb_build_object('dibatalkan',exists(select 1 from public.stok_transaksi k where k.koreksi_dari=t.id)) into v_header from public.stok_transaksi t where t.id=p_id and t.office_id=p_office;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.nama,m.kode),'[]') into v_rows from public.stok_mutasi m where m.transaksi_id=p_id;
 elsif p_jenis='keluar' then
  select to_jsonb(h) into v_header from public.stok_hitung_keluar33 h where h.id=p_id and h.office_id=p_office and (v_role<>'crew' or h.crew_id=auth.uid());
  select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('admin_terkini',internal.stok33_keluar(p_office,b.item_id,(v_header->>'dari')::date,(v_header->>'sampai')::date)) order by b.nama,b.kode),'[]') into v_rows from public.stok_keluar_baris33 b where b.hitung_id=p_id;
 elsif p_jenis='opname' then
  select to_jsonb(o) into v_header from public.stok_opname o where o.id=p_id and o.office_id=p_office and (v_role<>'crew' or o.crew_id=auth.uid());
  select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('saldo_terkini',i.saldo) order by b.nama,b.kode),'[]') into v_rows from public.stok_opname_baris b join public.stok_item i on i.id=b.item_id where b.opname_id=p_id;
 else raise exception 'Detail tidak valid.';end if;
 if v_header is null then raise exception 'Data tidak ditemukan atau tidak ditugaskan kepada akun Anda.';end if;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.dicatat_pada desc),'[]') into v_audit from public.stok_audit33 a where a.office_id=p_office and a.entitas_id=p_id;
 return jsonb_build_object('header',v_header,'baris',v_rows,'audit',v_audit,'boleh_hitung',v_header->>'status'='draf' and (v_header->>'crew_id')::uuid=auth.uid() and v_role in ('admin','crew'));
end $$;
create or replace function public.stok33_tulis(p_office uuid,p_jenis text,p_kunci uuid,p_pemilik uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_role text;v_saved internal.stok_requests33;v_result jsonb;v_receipt jsonb;v_id uuid;v_tx uuid;v_n numeric;v_delta numeric;v_date date;v_from date;v_to date;
 v_constraint text;v_kind text;v_action text;v_reason text;v_name text;v_r jsonb;v_item public.stok_item;v_h public.stok_hitung_keluar33;v_o public.stok_opname;v_t public.stok_transaksi;v_m public.stok_mutasi;v_b public.stok_opname_baris;v_crew public.profil_pengguna;
begin
 if p_pemilik is distinct from auth.uid() or p_kunci is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Sesi penyimpanan tidak valid.';end if;
 if p_jenis='migrasi' then perform pg_advisory_xact_lock(330001);else perform pg_advisory_xact_lock_shared(330001);end if;
 perform pg_advisory_xact_lock(hashtextextended('stok33:'||coalesce(p_office::text,''),0));
 v_role:=internal.stok33_role(p_office);if v_role='' then raise exception 'Akses office tidak diizinkan.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_pemilik::text||p_kunci::text,33));
 select r.* into v_saved from internal.stok_requests33 r where r.user_id=p_pemilik and r.kunci=p_kunci;
 if found then
  if v_saved.payload is null then raise exception 'Kiriman lama sudah ditutup. Periksa isian lalu kirim sebagai perubahan baru.';end if;
  if v_saved.office_id is distinct from p_office or v_saved.jenis is distinct from p_jenis or v_saved.payload is distinct from p_data then raise exception 'Kunci kiriman sudah digunakan untuk data lain.';end if;
  return v_saved.hasil;
 end if;
 if not exists(select 1 from public.kantor k where k.id=p_office and k.aktif) then raise exception 'Office nonaktif. Aktifkan office sebelum mencatat.';end if;
 if p_jenis not in ('barang','transaksi','mulai_keluar','mulai_opname','hitung_keluar','hitung_opname','periksa_keluar','periksa_opname','tim','migrasi','koreksi') then raise exception 'Tindakan stok tidak valid.';end if;
 if p_jenis in ('tim','migrasi') and not internal.stok33_global() then raise exception 'Pengaturan tim dan migrasi hanya untuk Administrator.';end if;
 if p_jenis not in ('hitung_keluar','hitung_opname','tim','migrasi') and v_role<>'admin' then raise exception 'Hanya admin stok yang dapat melakukan tindakan ini.';end if;
 if p_jenis not in ('tim','migrasi') and (exists(select 1 from public.stok_item i where i.office_id is null) or exists(select 1 from public.stok_opname o where o.office_id is null) or exists(select 1 from public.stok_transaksi t where t.office_id is null)) then raise exception 'Administrator perlu menetapkan office untuk data stok lama terlebih dahulu.';end if;
 if p_jenis in ('barang','transaksi','koreksi') and exists(select 1 from public.stok_opname o where o.office_id=p_office and o.status='draf') then raise exception 'Penghitungan fisik sedang berjalan di office ini. Selesaikan atau batalkan opname sebelum mencatat transaksi atau mengubah master.';end if;
 insert into internal.stok_requests33(user_id,kunci,office_id,jenis,payload) values(p_pemilik,p_kunci,p_office,p_jenis,p_data);
 v_name:=internal.stok33_nama();v_id:=nullif(p_data->>'id','')::uuid;
 if p_jenis='tim' then
  select p.* into v_crew from public.profil_pengguna p where p.id=(p_data->>'user_id')::uuid and p.office_id=p_office and p.aktif and p.akses_portal;
  if not found then raise exception 'Pilih akun aktif dengan akses Portal GA dan office yang sama.';end if;
  if not coalesce((p_data->>'aktif')::boolean,false) and (exists(select 1 from public.stok_opname o where o.crew_id=v_crew.id and o.status='draf') or exists(select 1 from public.stok_hitung_keluar33 h where h.crew_id=v_crew.id and h.status='draf')) then raise exception 'Alihkan atau selesaikan penugasan draf akun ini sebelum menonaktifkan akses crew.';end if;
  insert into public.stok_anggota33(user_id,office_id,aktif,diubah_oleh) values(v_crew.id,p_office,(p_data->>'aktif')::boolean,auth.uid())
  on conflict(user_id) do update set office_id=excluded.office_id,aktif=excluded.aktif,diubah_oleh=excluded.diubah_oleh,diubah_pada=now();
  v_id:=v_crew.id;v_result:=jsonb_build_object('id',v_id);perform internal.stok33_audit(p_office,'tim',v_id,'Akses crew diubah',p_data);
 elsif p_jenis='migrasi' then
  if exists(select 1 from public.stok_item i where i.office_id=p_office) then raise exception 'Pilih office yang belum mempunyai barang, agar data stok lama tidak tercampur.';end if;
  if exists(select 1 from public.stok_opname o where o.office_id is null and o.status='draf') then
   select p.* into v_crew from public.profil_pengguna p where p.id=(p_data->>'crew_id')::uuid and p.office_id=p_office and p.aktif and p.akses_portal and (p.peran::text in ('administrator','super_admin','admin') or exists(select 1 from public.stok_anggota33 a where a.user_id=p.id and a.office_id=p_office and a.aktif));
   if not found then raise exception 'Pilih crew atau admin office ini untuk melanjutkan opname lama.';end if;
  end if;
  update public.stok_item set office_id=p_office where office_id is null;
  update public.stok_transaksi set office_id=p_office where office_id is null;
  update public.stok_opname set office_id=p_office,crew_id=case when status='draf' then v_crew.id else crew_id end,crew=case when status='draf' then v_crew.nama else crew end where office_id is null;
  v_result:=jsonb_build_object('office_id',p_office);perform internal.stok33_audit(p_office,'migrasi',p_office,'Office data lama ditetapkan');
 elsif p_jenis='barang' then
  if v_id is not null then
   select i.* into v_item from public.stok_item i where i.id=v_id and i.office_id=p_office for update;
   if not found or v_item.versi is distinct from (p_data->>'versi')::integer then raise exception using errcode='40001',message='Barang berubah. Buka ulang sebelum menyimpan.';end if;
   if v_item.kode<>internal.stok33_teks(p_data,'kode',60,true) or v_item.satuan<>internal.stok33_teks(p_data,'satuan',40,true) then raise exception 'Kode dan satuan barang yang sudah tersimpan tidak dapat diubah.';end if;
   if not coalesce((p_data->>'aktif')::boolean,true) and (v_item.saldo<>0 or exists(select 1 from public.stok_opname_baris b join public.stok_opname o on o.id=b.opname_id where b.item_id=v_id and o.status in ('draf','menunggu'))) then raise exception 'Barang hanya dapat dinonaktifkan jika saldo nol dan pemeriksaan opname sudah selesai.';end if;
   update public.stok_item i set nama=internal.stok33_teks(p_data,'nama',200,true),spesifikasi=internal.stok33_teks(p_data,'spesifikasi',500),jenis_aset=internal.stok33_teks(p_data,'jenis_aset',100,true),minimum=internal.stok33_jumlah(p_data->'minimum'),aktif=coalesce((p_data->>'aktif')::boolean,true),versi=i.versi+1 where i.id=v_id returning i.* into v_item;
  else
   v_n:=internal.stok33_jumlah(p_data->'saldo_awal');
   insert into public.stok_item(office_id,kode,nama,spesifikasi,jenis_aset,satuan,saldo,minimum) values(p_office,internal.stok33_teks(p_data,'kode',60,true),internal.stok33_teks(p_data,'nama',200,true),internal.stok33_teks(p_data,'spesifikasi',500),internal.stok33_teks(p_data,'jenis_aset',100,true),internal.stok33_teks(p_data,'satuan',40,true),v_n,internal.stok33_jumlah(p_data->'minimum')) returning * into v_item;
   v_id:=v_item.id;
   if v_n>0 then
    v_tx:=gen_random_uuid();insert into public.stok_transaksi(id,office_id,jenis,tanggal,catatan,dibuat_oleh,nama_petugas) values(v_tx,p_office,'awal',internal.hari_ini(),'Saldo awal barang',auth.uid(),v_name);
    insert into public.stok_mutasi(transaksi_id,item_id,kode,nama,satuan,jumlah,saldo_sebelum,saldo_setelah) values(v_tx,v_id,v_item.kode,v_item.nama,v_item.satuan,v_n,0,v_n);
   end if;
  end if;
  v_result:=to_jsonb(v_item);perform internal.stok33_audit(p_office,'barang',v_id,'Master barang disimpan',v_result);
 elsif p_jenis='transaksi' then
  v_kind:=p_data->>'jenis';v_date:=(p_data->>'tanggal')::date;
  if v_kind is null or v_kind not in ('masuk','keluar') or v_date is null or v_date>internal.hari_ini() then raise exception 'Pilih jenis dan tanggal transaksi yang valid, maksimal hari ini.';end if;
  if jsonb_typeof(p_data->'baris') is distinct from 'array' or jsonb_array_length(p_data->'baris') not between 1 and 200 then raise exception 'Isi 1 sampai 200 barang dalam satu transaksi.';end if;
  if (select count(distinct x.value->>'item_id') from jsonb_array_elements(p_data->'baris') x)<>jsonb_array_length(p_data->'baris') then raise exception 'Setiap barang hanya boleh satu kali dalam satu transaksi.';end if;
  v_tx:=gen_random_uuid();insert into public.stok_transaksi(id,office_id,jenis,tanggal,tujuan,catatan,dibuat_oleh,nama_petugas) values(v_tx,p_office,v_kind,v_date,internal.stok33_teks(p_data,'tujuan',200,v_kind='keluar'),internal.stok33_teks(p_data,'catatan',2000),auth.uid(),v_name);
  for v_r in select x.value from jsonb_array_elements(p_data->'baris') x loop
   select i.* into v_item from public.stok_item i where i.id=(v_r->>'item_id')::uuid and i.office_id=p_office and i.aktif for update;
   if not found then raise exception 'Barang tidak aktif atau berasal dari office lain.';end if;
   v_n:=internal.stok33_jumlah(v_r->'jumlah',false)*(case when v_kind='keluar' then -1 else 1 end);
   if v_item.saldo+v_n<0 then raise exception 'Saldo % tidak cukup. Sisa % %.',v_item.nama,v_item.saldo,v_item.satuan;end if;
   insert into public.stok_mutasi(transaksi_id,item_id,kode,nama,satuan,jumlah,saldo_sebelum,saldo_setelah) values(v_tx,v_item.id,v_item.kode,v_item.nama,v_item.satuan,v_n,v_item.saldo,v_item.saldo+v_n);
   update public.stok_item i set saldo=i.saldo+v_n,versi=i.versi+1 where i.id=v_item.id;
  end loop;
  if v_kind='keluar' then
   insert into public.stok_keluar_baris33(hitung_id,item_id,kode,nama,satuan)
    select h.id,i.id,i.kode,i.nama,i.satuan from public.stok_hitung_keluar33 h join public.stok_mutasi m on m.transaksi_id=v_tx join public.stok_item i on i.id=m.item_id
    where h.office_id=p_office and h.status<>'batal' and v_date between h.dari and h.sampai on conflict(hitung_id,item_id) do nothing;
   perform internal.stok33_buka_perbandingan(p_office,v_date);
  end if;
  v_result:=jsonb_build_object('id',v_tx);perform internal.stok33_audit(p_office,'transaksi',v_tx,'Barang '||v_kind||' dicatat',p_data);
 elsif p_jenis='koreksi' then
  v_reason:=internal.stok33_teks(p_data,'alasan',2000,true);
  select t.* into v_t from public.stok_transaksi t where t.id=v_id and t.office_id=p_office and t.jenis in ('masuk','keluar') and t.koreksi_dari is null for update;
  if not found or exists(select 1 from public.stok_transaksi k where k.koreksi_dari=v_id) then raise exception 'Hanya transaksi masuk/keluar yang belum dibatalkan dapat dikoreksi.';end if;
  v_tx:=gen_random_uuid();insert into public.stok_transaksi(id,office_id,jenis,tanggal,catatan,dibuat_oleh,nama_petugas,koreksi_dari) values(v_tx,p_office,'penyesuaian',internal.hari_ini(),v_reason,auth.uid(),v_name,v_id);
  for v_m in select m.* from public.stok_mutasi m where m.transaksi_id=v_id order by m.item_id loop
   select i.* into v_item from public.stok_item i where i.id=v_m.item_id for update;v_delta:=-v_m.jumlah;
   if v_item.saldo+v_delta<0 then raise exception 'Pembatalan membuat saldo % negatif. Periksa transaksi berikutnya.',v_item.nama;end if;
   insert into public.stok_mutasi(transaksi_id,item_id,kode,nama,satuan,jumlah,saldo_sebelum,saldo_setelah) values(v_tx,v_item.id,v_item.kode,v_item.nama,v_item.satuan,v_delta,v_item.saldo,v_item.saldo+v_delta);
   update public.stok_item i set saldo=i.saldo+v_delta,versi=i.versi+1 where i.id=v_item.id;
  end loop;
  if v_t.jenis='keluar' then perform internal.stok33_buka_perbandingan(p_office,v_t.tanggal);end if;
  v_result:=jsonb_build_object('id',v_tx);perform internal.stok33_audit(p_office,'transaksi',v_id,'Transaksi dibatalkan',jsonb_build_object('alasan',v_reason,'transaksi_koreksi',v_tx));
 elsif p_jenis in ('mulai_keluar','mulai_opname') then
  select p.* into v_crew from public.profil_pengguna p where p.id=(p_data->>'crew_id')::uuid and p.office_id=p_office and p.aktif and p.akses_portal and (p.peran::text in ('administrator','super_admin','admin') or exists(select 1 from public.stok_anggota33 a where a.user_id=p.id and a.office_id=p_office and a.aktif));
  if not found then raise exception 'Pilih crew aktif yang memiliki izin menghitung di office ini.';end if;
  v_reason:=internal.stok33_teks(p_data,'catatan',2000);v_id:=gen_random_uuid();
  if p_jenis='mulai_keluar' then
   v_from:=(p_data->>'dari')::date;v_to:=(p_data->>'sampai')::date;
   if v_from is null or v_to is null or v_to<v_from or v_to>internal.hari_ini() or v_to-v_from>366 then raise exception 'Isi periode sampai hari ini, maksimal 367 hari.';end if;
   if exists(select 1 from public.stok_hitung_keluar33 h where h.office_id=p_office and h.status<>'batal' and h.dari<=v_to and h.sampai>=v_from) then raise exception 'Periode beririsan dengan lembar yang sudah ada. Buka lembar tersebut atau batalkan dengan alasan.';end if;
   insert into public.stok_hitung_keluar33(id,office_id,dari,sampai,crew_id,crew,catatan,dibuat_oleh,nama_pencatat) values(v_id,p_office,v_from,v_to,v_crew.id,v_crew.nama,v_reason,auth.uid(),v_name);
   insert into public.stok_keluar_baris33(hitung_id,item_id,kode,nama,satuan,keluar_admin) select v_id,i.id,i.kode,i.nama,i.satuan,internal.stok33_keluar(p_office,i.id,v_from,v_to) from public.stok_item i where i.office_id=p_office and (i.aktif or internal.stok33_keluar(p_office,i.id,v_from,v_to)>0);
   if not found then raise exception 'Tambahkan barang terlebih dahulu.';end if;
   perform internal.stok33_audit(p_office,'keluar',v_id,'Lembar hitung dibuat',p_data);
  else
   if exists(select 1 from public.stok_opname o where o.office_id=p_office and o.status in ('draf','menunggu')) then raise exception 'Selesaikan penghitungan atau pemeriksaan opname office ini terlebih dahulu.';end if;
   insert into public.stok_opname(id,office_id,crew_id,crew,catatan,dibuat_oleh,nama_pencatat) values(v_id,p_office,v_crew.id,v_crew.nama,v_reason,auth.uid(),v_name);
   insert into public.stok_opname_baris(opname_id,item_id,kode,nama,spesifikasi,jenis_aset,satuan,stok_catatan) select v_id,i.id,i.kode,i.nama,i.spesifikasi,i.jenis_aset,i.satuan,i.saldo from public.stok_item i where i.office_id=p_office and i.aktif;
   if not found then raise exception 'Tambahkan barang aktif terlebih dahulu.';end if;
   perform internal.stok33_audit(p_office,'opname',v_id,'Opname dimulai',p_data);
  end if;
  v_result:=jsonb_build_object('id',v_id);
 elsif p_jenis in ('hitung_keluar','hitung_opname') then
  if v_role not in ('crew','admin') then raise exception 'Akun ini belum memiliki izin menghitung stok.';end if;
  if p_jenis='hitung_keluar' then
   select h.* into v_h from public.stok_hitung_keluar33 h where h.id=v_id and h.office_id=p_office for update;
   if not found or v_h.crew_id<>auth.uid() or v_h.status<>'draf' or v_h.versi is distinct from (p_data->>'versi')::integer then raise exception using errcode='40001',message='Lembar berubah, sudah dikirim, atau bukan penugasan Anda. Buka ulang lembar.';end if;
  else
   select o.* into v_o from public.stok_opname o where o.id=v_id and o.office_id=p_office for update;
   if not found or v_o.crew_id<>auth.uid() or v_o.status<>'draf' or v_o.versi is distinct from (p_data->>'versi')::integer then raise exception using errcode='40001',message='Opname berubah, sudah dikirim, atau bukan penugasan Anda. Buka ulang lembar.';end if;
  end if;
  if jsonb_typeof(p_data->'baris') is distinct from 'array' or jsonb_array_length(p_data->'baris')>10000 then raise exception 'Baris hitungan tidak valid.';end if;
  if (select count(distinct x.value->>'item_id') from jsonb_array_elements(p_data->'baris') x)<>jsonb_array_length(p_data->'baris') then raise exception 'Barang hitungan tidak boleh berulang.';end if;
  for v_r in select x.value from jsonb_array_elements(p_data->'baris') x loop
   v_n:=case when v_r->'jumlah' is null or v_r->'jumlah'='null'::jsonb then null else internal.stok33_jumlah(v_r->'jumlah') end;
   if p_jenis='hitung_keluar' then update public.stok_keluar_baris33 b set keluar_crew=v_n,catatan=internal.stok33_teks(v_r,'catatan',1000) where b.hitung_id=v_id and b.item_id=(v_r->>'item_id')::uuid;
   else update public.stok_opname_baris b set fisik=v_n,catatan=internal.stok33_teks(v_r,'catatan',1000) where b.opname_id=v_id and b.item_id=(v_r->>'item_id')::uuid;end if;
   if not found then raise exception 'Barang bukan bagian dari lembar ini.';end if;
  end loop;
  if coalesce((p_data->>'selesai')::boolean,false) then
   if p_jenis='hitung_keluar' then
    if exists(select 1 from public.stok_keluar_baris33 b where b.hitung_id=v_id and b.keluar_crew is null) then raise exception 'Masih ada barang belum dihitung. Isi 0 jika tidak ada barang keluar.';end if;
    update public.stok_keluar_baris33 b set keluar_admin=internal.stok33_keluar(p_office,b.item_id,v_h.dari,v_h.sampai) where b.hitung_id=v_id;
   elsif exists(select 1 from public.stok_opname_baris b where b.opname_id=v_id and b.fisik is null) then raise exception 'Masih ada barang belum dihitung. Isi 0 jika stok fisik habis.';end if;
  end if;
  if p_jenis='hitung_keluar' then update public.stok_hitung_keluar33 h set versi=h.versi+1,status=case when coalesce((p_data->>'selesai')::boolean,false) then 'menunggu' else 'draf' end,selesai_pada=case when coalesce((p_data->>'selesai')::boolean,false) then now() else null end where h.id=v_id returning to_jsonb(h) into v_result;
  else update public.stok_opname o set versi=o.versi+1,status=case when coalesce((p_data->>'selesai')::boolean,false) then 'menunggu' else 'draf' end,selesai_pada=case when coalesce((p_data->>'selesai')::boolean,false) then now() else null end where o.id=v_id returning to_jsonb(o) into v_result;end if;
  perform internal.stok33_audit(p_office,case when p_jenis='hitung_keluar' then 'keluar' else 'opname' end,v_id,case when coalesce((p_data->>'selesai')::boolean,false) then 'Hitungan dikirim' else 'Draf disimpan' end,jsonb_build_object('baris',p_data->'baris'));
 elsif p_jenis in ('periksa_keluar','periksa_opname') then
  v_action:=p_data->>'tindakan';v_reason:=internal.stok33_teks(p_data,'alasan',2000,v_action<>'setujui');
  if v_action is null or v_action not in ('setujui','sesuaikan','tutup','ulang','batal','alihkan') then raise exception 'Tindakan pemeriksaan tidak valid.';end if;
  if v_action='alihkan' then
   select p.* into v_crew from public.profil_pengguna p where p.id=(p_data->>'crew_id')::uuid and p.office_id=p_office and p.aktif and p.akses_portal and (p.peran::text in ('administrator','super_admin','admin') or exists(select 1 from public.stok_anggota33 a where a.user_id=p.id and a.office_id=p_office and a.aktif));
   if not found then raise exception 'Pilih crew yang aktif dan berizin.';end if;
  end if;
  if p_jenis='periksa_keluar' then
   select h.* into v_h from public.stok_hitung_keluar33 h where h.id=v_id and h.office_id=p_office for update;
   if not found or v_h.versi is distinct from (p_data->>'versi')::integer or v_h.status not in ('draf','menunggu') then raise exception using errcode='40001',message='Lembar berubah atau sudah diperiksa. Buka ulang hasilnya.';end if;
   if (v_h.status='draf' and v_action not in ('batal','alihkan')) or v_action='sesuaikan' or (v_action='alihkan' and v_h.status<>'draf') then raise exception 'Tindakan tidak sesuai status lembar.';end if;
   if v_action in ('setujui','tutup') then
    if exists(select 1 from public.stok_keluar_baris33 b where b.hitung_id=v_id and b.keluar_crew is null) then raise exception 'Ada barang belum dihitung. Minta hitung ulang terlebih dahulu.';end if;
    if v_action='setujui' and v_reason='' and exists(select 1 from public.stok_keluar_baris33 b where b.hitung_id=v_id and b.keluar_crew<>internal.stok33_keluar(p_office,b.item_id,v_h.dari,v_h.sampai)) then raise exception 'Jelaskan penyebab selisih sebelum menyetujui perbandingan.';end if;
    update public.stok_keluar_baris33 b set keluar_admin=internal.stok33_keluar(p_office,b.item_id,v_h.dari,v_h.sampai) where b.hitung_id=v_id;
   end if;
   update public.stok_hitung_keluar33 h set status=case v_action when 'batal' then 'batal' when 'ulang' then 'draf' when 'alihkan' then 'draf' when 'setujui' then 'disetujui' else 'ditutup' end,
    crew_id=case when v_action='alihkan' then v_crew.id else h.crew_id end,crew=case when v_action='alihkan' then v_crew.nama else h.crew end,
    versi=h.versi+1,diperiksa_pada=now(),diperiksa_oleh=auth.uid(),nama_pemeriksa=v_name,alasan=v_reason where h.id=v_id returning to_jsonb(h) into v_result;
   perform internal.stok33_audit(p_office,'keluar',v_id,'Pemeriksaan: '||v_action,p_data);
  else
   select o.* into v_o from public.stok_opname o where o.id=v_id and o.office_id=p_office for update;
   if not found or v_o.versi is distinct from (p_data->>'versi')::integer or v_o.status not in ('draf','menunggu') then raise exception using errcode='40001',message='Opname berubah atau sudah diperiksa. Buka ulang hasilnya.';end if;
   if (v_o.status='draf' and v_action not in ('batal','alihkan')) or (v_action='alihkan' and v_o.status<>'draf') then raise exception 'Tindakan tidak sesuai status opname.';end if;
   if v_action in ('setujui','sesuaikan','tutup') and exists(select 1 from public.stok_opname_baris b where b.opname_id=v_id and b.fisik is null) then raise exception 'Hitungan belum lengkap.';end if;
   if v_action='setujui' and exists(select 1 from public.stok_opname_baris b where b.opname_id=v_id and b.selisih<>0) then raise exception 'Ada selisih. Pilih penyesuaian, hitung ulang, atau tutup dengan alasan.';end if;
   if v_action='ulang' then
    if exists(select 1 from public.stok_opname o where o.office_id=p_office and o.status='draf' and o.id<>v_id) then raise exception 'Ada opname draf lain di office ini.';end if;
    perform internal.stok33_audit(p_office,'opname',v_id,'Hitungan sebelum penghitungan ulang',jsonb_build_object('baris',(select jsonb_agg(to_jsonb(b)) from public.stok_opname_baris b where b.opname_id=v_id)));
    update public.stok_opname_baris b set stok_catatan=i.saldo,fisik=null,catatan='' from public.stok_item i where b.opname_id=v_id and b.item_id=i.id;
   end if;
   if v_action='sesuaikan' then
    v_tx:=gen_random_uuid();insert into public.stok_transaksi(id,office_id,jenis,tanggal,catatan,dibuat_oleh,nama_petugas,opname_id) values(v_tx,p_office,'penyesuaian',internal.hari_ini(),v_reason,auth.uid(),v_name,v_id);
    for v_b in select b.* from public.stok_opname_baris b where b.opname_id=v_id and b.selisih<>0 order by b.item_id loop
     select i.* into v_item from public.stok_item i where i.id=v_b.item_id for update;
     if v_item.saldo+v_b.selisih<0 then raise exception 'Penyesuaian % membuat saldo negatif. Periksa transaksi setelah penghitungan.',v_item.nama;end if;
     insert into public.stok_mutasi(transaksi_id,item_id,kode,nama,satuan,jumlah,saldo_sebelum,saldo_setelah) values(v_tx,v_item.id,v_item.kode,v_item.nama,v_item.satuan,v_b.selisih,v_item.saldo,v_item.saldo+v_b.selisih);
     update public.stok_item i set saldo=i.saldo+v_b.selisih,versi=i.versi+1 where i.id=v_item.id;
    end loop;
   end if;
   update public.stok_opname o set status=case v_action when 'batal' then 'batal' when 'ulang' then 'draf' when 'alihkan' then 'draf' when 'sesuaikan' then 'disesuaikan' when 'setujui' then 'sesuai' else 'ditutup' end,
    crew_id=case when v_action='alihkan' then v_crew.id else o.crew_id end,crew=case when v_action='alihkan' then v_crew.nama else o.crew end,
    mulai_pada=case when v_action='ulang' then clock_timestamp() else o.mulai_pada end,tanggal=case when v_action='ulang' then internal.hari_ini() else o.tanggal end,
    versi=o.versi+1,diperiksa_pada=now(),diperiksa_oleh=auth.uid(),nama_pemeriksa=v_name,alasan=v_reason where o.id=v_id returning to_jsonb(o) into v_result;
   perform internal.stok33_audit(p_office,'opname',v_id,'Pemeriksaan: '||v_action,p_data);
  end if;
 end if;
 v_receipt:=jsonb_build_object('pemilik',p_pemilik,'kunci',p_kunci,'office_id',p_office,'jenis',p_jenis,'hasil',v_result);
 update internal.stok_requests33 r set hasil=v_receipt where r.user_id=p_pemilik and r.kunci=p_kunci;
 return v_receipt;
exception when unique_violation then
 get stacked diagnostics v_constraint=CONSTRAINT_NAME;
 if v_constraint in ('stok33_kode_office','stok33_kode_lama') then raise exception 'Kode barang sudah digunakan di office ini. Pilih barang yang sudah ada.';end if;
 raise;
end $$;

-- Memeriksa hasil juga menyegel kunci yang benar-benar belum tersimpan.
-- Kiriman terlambat dengan kunci yang sudah disegel tidak dapat membuat transaksi baru.
create or replace function public.stok33_status(p_office uuid,p_jenis text,p_kunci uuid,p_pemilik uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_r internal.stok_requests33;begin
 if p_pemilik is distinct from auth.uid() or p_kunci is null or internal.stok33_role(p_office)='' then raise exception 'Sesi pemeriksaan tidak valid.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_pemilik::text||p_kunci::text,33));
 select r.* into v_r from internal.stok_requests33 r where r.user_id=p_pemilik and r.kunci=p_kunci;
 if found then
  if v_r.office_id is distinct from p_office or v_r.jenis is distinct from p_jenis then raise exception 'Kiriman tidak cocok.';end if;
  return v_r.hasil;
 end if;
 insert into internal.stok_requests33(user_id,kunci,office_id,jenis) values(p_pemilik,p_kunci,p_office,p_jenis);
 return null;
end $$;

create or replace function public.stok33_ekspor(p_office uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if (p_office is null and not internal.stok33_global()) or (p_office is not null and internal.stok33_role(p_office)<>'admin') then raise exception 'Cadangan stok memerlukan admin office atau Administrator.';end if;
 return jsonb_build_object('format','GA_STOK','versi',1,'pembaruan',33,'dibuat_pada',now(),'office_id',p_office,'data',jsonb_build_object(
 'item',coalesce((select jsonb_agg(to_jsonb(i)) from public.stok_item i where p_office is null or i.office_id=p_office),'[]'),
 'transaksi',coalesce((select jsonb_agg(to_jsonb(t)-'permintaan') from public.stok_transaksi t where p_office is null or t.office_id=p_office),'[]'),
 'mutasi',coalesce((select jsonb_agg(to_jsonb(m)) from public.stok_mutasi m join public.stok_transaksi t on t.id=m.transaksi_id where p_office is null or t.office_id=p_office),'[]'),
 'opname',coalesce((select jsonb_agg(to_jsonb(o)) from public.stok_opname o where p_office is null or o.office_id=p_office),'[]'),
 'baris_opname',coalesce((select jsonb_agg(to_jsonb(b)) from public.stok_opname_baris b join public.stok_opname o on o.id=b.opname_id where p_office is null or o.office_id=p_office),'[]'),
 'hitung_keluar',coalesce((select jsonb_agg(to_jsonb(h)) from public.stok_hitung_keluar33 h where p_office is null or h.office_id=p_office),'[]'),
 'baris_keluar',coalesce((select jsonb_agg(to_jsonb(b)) from public.stok_keluar_baris33 b join public.stok_hitung_keluar33 h on h.id=b.hitung_id where p_office is null or h.office_id=p_office),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(a)) from public.stok_audit33 a where p_office is null or a.office_id=p_office),'[]'),
 'tim',coalesce((select jsonb_agg(to_jsonb(a)) from public.stok_anggota33 a where p_office is null or a.office_id=p_office),'[]')));
end $$;
-- Titik masuk cadangan lama tetap bekerja, dengan pembatasan office yang baru.
create or replace function public.stok_ekspor() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_office uuid;begin
 if internal.stok33_global() then return public.stok33_ekspor(null);end if;
 select p.office_id into v_office from public.profil_pengguna p where p.id=auth.uid();
 if v_office is null then raise exception 'Office akun belum ditetapkan.';end if;return public.stok33_ekspor(v_office);
end $$;

-- Nonaktifkan seluruh API tulis/baca global lama; jangan sisakan jalan pintas lintas office.
do $$ declare v_f regprocedure;begin
 for v_f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('stok_simpan_item','stok_catat_transaksi','stok_mulai_opname','stok_detail_opname','stok_simpan_opname','stok_periksa_opname','stok_halaman') loop
  execute format('revoke all on function %s from public,anon,authenticated',v_f);
 end loop;
end $$;
-- Klien menggunakan RPC. Tabel langsung dibatasi berdasarkan office juga.
do $$ declare v_t text;v_policy record;v_expr text;begin
 foreach v_t in array array['stok_kunci','stok_item','stok_opname','stok_opname_baris','stok_transaksi','stok_mutasi','stok_anggota33','stok_hitung_keluar33','stok_keluar_baris33','stok_audit33'] loop
  execute format('alter table public.%I enable row level security',v_t);
  execute format('revoke all on public.%I from public,anon,authenticated',v_t);
  for v_policy in select p.policyname from pg_policies p where p.schemaname='public' and p.tablename=v_t loop execute format('drop policy %I on public.%I',v_policy.policyname,v_t);end loop;
  if v_t='stok_kunci' then continue;end if;
  v_expr:=case v_t
   when 'stok_opname_baris' then 'exists(select 1 from public.stok_opname o where o.id=opname_id and internal.stok33_role(o.office_id)<>'''')'
   when 'stok_mutasi' then 'exists(select 1 from public.stok_transaksi t where t.id=transaksi_id and internal.stok33_role(t.office_id)<>'''')'
   when 'stok_keluar_baris33' then 'exists(select 1 from public.stok_hitung_keluar33 h where h.id=hitung_id and internal.stok33_role(h.office_id)<>'''')'
   else 'internal.stok33_role(office_id)<>''''' end;
  execute format('create policy stok33_baca on public.%I for select to authenticated using (%s)',v_t,v_expr);
  execute format('grant select on public.%I to authenticated',v_t);
 end loop;
end $$;
revoke all on function internal.stok33_global(),internal.stok33_nama(),internal.stok33_jumlah(jsonb,boolean),internal.stok33_teks(jsonb,text,integer,boolean),internal.stok33_audit(uuid,text,uuid,text,jsonb),internal.stok33_keluar(uuid,uuid,date,date),internal.stok33_buka_perbandingan(uuid,date) from public,anon,authenticated;
revoke all on function internal.stok33_role(uuid) from public,anon;
grant usage on schema internal to authenticated;
grant execute on function internal.stok33_role(uuid) to authenticated;
do $$ declare v_f regprocedure;begin
 for v_f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('stok33_konteks','stok33_halaman','stok33_detail','stok33_tulis','stok33_status','stok33_ekspor','stok_ekspor') loop
  execute format('revoke all on function %s from public,anon',v_f);execute format('grant execute on function %s to authenticated',v_f);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
