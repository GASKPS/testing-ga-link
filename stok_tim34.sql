-- Catatan keluar Crew adalah bukti terpisah; tidak mengubah stok resmi.
create table if not exists public.stok_crew_keluar34(
 id uuid primary key default gen_random_uuid(),office_id uuid not null references public.kantor(id),crew_id uuid not null references public.profil_pengguna(id),
 tanggal date not null,penerima text not null check(length(penerima) between 1 and 200),keperluan text not null default '' check(length(keperluan)<=2000),
 status text not null default 'draf' check(status in ('draf','menunggu','dikembalikan','sesuai','selisih_dijelaskan','batal')),
 versi integer not null default 1,nama_crew text not null,dibuat_pada timestamptz not null default clock_timestamp(),diubah_pada timestamptz not null default clock_timestamp(),
 alasan text not null default '',diperiksa_oleh uuid references public.profil_pengguna(id),nama_pemeriksa text,diperiksa_pada timestamptz
);
create table if not exists public.stok_crew_baris34(
 id uuid primary key default gen_random_uuid(),keluar_id uuid not null references public.stok_crew_keluar34(id) on delete cascade,
 item_id uuid not null references public.stok_item(id),kode text not null,nama text not null,satuan text not null,jumlah numeric(14,3) not null check(jumlah>0),unique(keluar_id,item_id)
);
create index if not exists stok_crew34_list on public.stok_crew_keluar34(office_id,crew_id,tanggal desc);
create or replace function public.stok34_crew_halaman(p_office uuid,p_filter jsonb default '{}',p_halaman integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text:=internal.stok33_role(p_office);v_total integer;v_page integer;v_rows jsonb;v_q text:=lower(btrim(coalesce(p_filter->>'q','')));v_from date:=nullif(p_filter->>'dari','')::date;v_to date:=nullif(p_filter->>'sampai','')::date;begin
 if v_role not in ('admin','crew') then raise exception 'Akses catatan Crew tidak diizinkan.';end if;
 if length(v_q)>200 or v_from>v_to then raise exception 'Filter tidak valid.';end if;
 select count(*) into v_total from public.stok_crew_keluar34 h where h.office_id=p_office and (v_role='admin' or h.crew_id=auth.uid())
 and (coalesce(p_filter->>'status','')='' or h.status=p_filter->>'status') and (v_from is null or h.tanggal>=v_from) and (v_to is null or h.tanggal<=v_to)
 and (v_q='' or strpos(lower(concat_ws(' ',h.penerima,h.keperluan,h.nama_crew)),v_q)>0);
 v_page:=least(greatest(coalesce(p_halaman,1),1),greatest(1,ceil(v_total/20.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(v) order by v.tanggal desc,v.dibuat_pada desc,v.id),'[]') into v_rows from (
 select h.*,(select count(*) from public.stok_crew_baris34 b where b.keluar_id=h.id) jumlah_barang from public.stok_crew_keluar34 h where h.office_id=p_office and (v_role='admin' or h.crew_id=auth.uid())
 and (coalesce(p_filter->>'status','')='' or h.status=p_filter->>'status') and (v_from is null or h.tanggal>=v_from) and (v_to is null or h.tanggal<=v_to)
 and (v_q='' or strpos(lower(concat_ws(' ',h.penerima,h.keperluan,h.nama_crew)),v_q)>0)
 order by h.tanggal desc,h.dibuat_pada desc,h.id limit 20 offset (v_page-1)*20) v;
 return jsonb_build_object('data',v_rows,'total',v_total,'halaman',v_page,'ukuran_halaman',20);
end $$;
create or replace function public.stok34_crew_detail(p_office uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text:=internal.stok33_role(p_office);v_h public.stok_crew_keluar34;v_rows jsonb;v_audit jsonb;begin
 if v_role not in ('admin','crew') then raise exception 'Akses catatan Crew tidak diizinkan.';end if;
 select * into v_h from public.stok_crew_keluar34 h where h.id=p_id and h.office_id=p_office and (v_role='admin' or h.crew_id=auth.uid());
 if not found then raise exception 'Catatan tidak ditemukan atau bukan milik Anda.';end if;
 select coalesce(jsonb_agg(to_jsonb(b) order by b.nama,b.kode),'[]') into v_rows from public.stok_crew_baris34 b where b.keluar_id=p_id;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.dicatat_pada),'[]') into v_audit from public.stok_audit33 a where a.office_id=p_office and a.entitas_id=p_id;
 return jsonb_build_object('header',to_jsonb(v_h),'baris',v_rows,'audit',v_audit);
end $$;
create or replace function public.stok34_bandingkan(p_office uuid,p_dari date,p_sampai date,p_halaman integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_total integer;v_page integer;v_rows jsonb;v_pending integer;begin
 if internal.stok33_role(p_office)<>'admin' then raise exception 'Perbandingan hanya tersedia untuk admin stok.';end if;
 if p_dari is null or p_sampai is null or p_dari>p_sampai then raise exception 'Isi periode yang valid.';end if;
 select count(*) into v_total from public.stok_item i where i.office_id=p_office;
 v_page:=least(greatest(coalesce(p_halaman,1),1),greatest(1,ceil(v_total/20.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('selisih',v.keluar_crew-v.keluar_admin) order by v.nama,v.kode),'[]') into v_rows from (
 select i.id,i.kode,i.nama,i.satuan,internal.stok33_keluar(p_office,i.id,p_dari,p_sampai) keluar_admin,
 coalesce((select sum(b.jumlah) from public.stok_crew_baris34 b join public.stok_crew_keluar34 h on h.id=b.keluar_id where h.office_id=p_office and b.item_id=i.id and h.tanggal between p_dari and p_sampai and h.status in ('menunggu','sesuai','selisih_dijelaskan')),0) keluar_crew
 from public.stok_item i where i.office_id=p_office order by i.nama,i.kode,i.id limit 20 offset (v_page-1)*20) v;
 select count(*) into v_pending from public.stok_crew_keluar34 h where h.office_id=p_office and h.tanggal between p_dari and p_sampai and h.status in ('draf','dikembalikan');
 return jsonb_build_object('data',v_rows,'total',v_total,'halaman',v_page,'ukuran_halaman',20,'belum_dikirim',v_pending);
end $$;
create or replace function public.stok34_tulis(p_office uuid,p_jenis text,p_kunci uuid,p_pemilik uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text;v_prior internal.stok_requests33;v_h public.stok_crew_keluar34;v_item public.stok_item;v_row jsonb;v_id uuid;v_action text;v_result jsonb;v_receipt jsonb;v_status text;v_reason text;v_delta integer;v_before jsonb;begin
 if p_jenis not in ('crew_catat','crew_periksa') then return public.stok33_tulis(p_office,p_jenis,p_kunci,p_pemilik,p_data);end if;
 if p_pemilik is distinct from auth.uid() or p_kunci is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Sesi penyimpanan tidak valid.';end if;
 perform pg_advisory_xact_lock_shared(330001);perform pg_advisory_xact_lock(hashtextextended('stok33:'||coalesce(p_office::text,''),0));
 perform 1 from public.profil_pengguna p where p.id=auth.uid() for share;
 v_role:=internal.stok33_role(p_office);if v_role not in ('admin','crew') then raise exception 'Akses tidak diizinkan.';end if;
 if not exists(select 1 from public.kantor k where k.id=p_office and k.aktif) then raise exception 'Office tidak aktif.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_pemilik::text||p_kunci::text,33));
 select * into v_prior from internal.stok_requests33 r where r.user_id=p_pemilik and r.kunci=p_kunci;
 if found then if v_prior.payload is null then raise exception 'Kiriman sudah ditutup.';end if;if v_prior.payload is distinct from p_data or v_prior.office_id is distinct from p_office or v_prior.jenis is distinct from p_jenis then raise exception 'Kunci sudah dipakai untuk data lain.';end if;return v_prior.hasil;end if;
 if exists(select 1 from public.stok_item i where i.office_id is null) then raise exception 'Tetapkan office data stok lama terlebih dahulu.';end if;
 v_id:=nullif(p_data->>'id','')::uuid;v_reason:=internal.stok33_teks(p_data,'alasan',2000);
 if v_id is not null then select * into v_h from public.stok_crew_keluar34 h where h.id=v_id and h.office_id=p_office for update;
  if not found or (v_role='crew' and v_h.crew_id<>auth.uid()) then raise exception 'Catatan tidak tersedia untuk akun Anda.';end if;
  if v_h.versi is distinct from (p_data->>'versi')::integer then raise exception using errcode='40001',message='Catatan berubah. Buka kembali sebelum menyimpan.';end if;
 end if;
 if p_jenis='crew_catat' then
  if v_role<>'crew' then raise exception 'Catatan Crew diisi oleh akun Crew. Admin mencatat transaksi resmi.';end if;
  if v_id is not null and v_h.status not in ('draf','dikembalikan') then raise exception 'Catatan sudah dikirim. Minta admin mengembalikan untuk koreksi.';end if;
  if jsonb_typeof(p_data->'baris') is distinct from 'array' or jsonb_array_length(p_data->'baris') not between 1 and 200 then raise exception 'Isi 1 sampai 200 baris barang.';end if;
  if (p_data->>'tanggal')::date>internal.hari_ini() then raise exception 'Tanggal tidak boleh melewati hari ini.';end if;
  v_status:=case when coalesce((p_data->>'selesai')::boolean,false) then 'menunggu' else 'draf' end;
  select coalesce(jsonb_agg(to_jsonb(b)),'[]') into v_before from public.stok_crew_baris34 b where b.keluar_id=v_id;
  if v_id is null then insert into public.stok_crew_keluar34(office_id,crew_id,tanggal,penerima,keperluan,nama_crew,status) values(p_office,auth.uid(),(p_data->>'tanggal')::date,internal.stok33_teks(p_data,'penerima',200,true),internal.stok33_teks(p_data,'keperluan',2000),internal.stok33_nama(),v_status) returning id into v_id;
  else update public.stok_crew_keluar34 set tanggal=(p_data->>'tanggal')::date,penerima=internal.stok33_teks(p_data,'penerima',200,true),keperluan=internal.stok33_teks(p_data,'keperluan',2000),status=v_status,versi=versi+1,diubah_pada=clock_timestamp() where id=v_id;
   delete from public.stok_crew_baris34 where keluar_id=v_id;
  end if;
  for v_row in select value from jsonb_array_elements(p_data->'baris') loop
   select * into v_item from public.stok_item i where i.id=(v_row->>'item_id')::uuid and i.office_id=p_office and (i.aktif or exists(select 1 from jsonb_array_elements(v_before) b where b->>'item_id'=i.id::text));
   if not found then raise exception 'Barang tidak tersedia pada office ini.';end if;
   insert into public.stok_crew_baris34(keluar_id,item_id,kode,nama,satuan,jumlah) values(v_id,v_item.id,v_item.kode,v_item.nama,v_item.satuan,internal.stok33_jumlah(v_row->'jumlah',false));
  end loop;
  perform internal.stok33_audit(p_office,'crew_keluar',v_id,case when v_status='menunggu' then 'Crew mengirim catatan' else 'Crew menyimpan draf' end,jsonb_build_object('sebelum',to_jsonb(v_h),'baris_sebelum',v_before,'sesudah',public.stok34_crew_detail(p_office,v_id)));
 else
  if v_role<>'admin' or v_id is null then raise exception 'Pemeriksaan memerlukan admin stok.';end if;
  v_action:=p_data->>'tindakan';
  if v_h.status in ('draf','batal') or (v_h.status='dikembalikan' and v_action<>'batal') or v_action not in ('sesuai','selisih_dijelaskan','dikembalikan','batal') then raise exception 'Tindakan pemeriksaan tidak valid.';end if;
  if v_action<>'sesuai' and v_reason='' then raise exception 'Isi alasan pemeriksaan atau pengembalian.';end if;
  if v_action='sesuai' then
   select count(*) into v_delta from public.stok_item i where i.office_id=p_office and internal.stok33_keluar(p_office,i.id,v_h.tanggal,v_h.tanggal) is distinct from
   coalesce((select sum(b.jumlah) from public.stok_crew_baris34 b join public.stok_crew_keluar34 h on h.id=b.keluar_id where h.office_id=p_office and b.item_id=i.id and h.tanggal=v_h.tanggal and h.status in ('menunggu','sesuai','selisih_dijelaskan')),0);
   if v_delta>0 then raise exception 'Masih ada selisih pada tanggal ini. Periksa perbandingan atau jelaskan selisih.';end if;
  end if;
  update public.stok_crew_keluar34 set status=v_action,alasan=v_reason,diperiksa_oleh=auth.uid(),nama_pemeriksa=internal.stok33_nama(),diperiksa_pada=clock_timestamp(),versi=versi+1,diubah_pada=clock_timestamp() where id=v_id;
  perform internal.stok33_audit(p_office,'crew_keluar',v_id,'Pemeriksaan admin',jsonb_build_object('sebelum',to_jsonb(v_h),'tindakan',v_action,'alasan',v_reason));
 end if;
 -- Setiap perubahan jumlah Crew membatalkan hasil cocok yang terdampak pada hari yang sama.
 if p_jenis='crew_catat' or p_data->>'tindakan' in ('dikembalikan','batal') then
  for v_row in select to_jsonb(h) from public.stok_crew_keluar34 h where h.office_id=p_office and h.id<>v_id and h.status in ('sesuai','selisih_dijelaskan')
   and (h.tanggal=v_h.tanggal or h.tanggal=(select x.tanggal from public.stok_crew_keluar34 x where x.id=v_id)) loop
   update public.stok_crew_keluar34 set status='menunggu',versi=versi+1,diubah_pada=clock_timestamp() where id=(v_row->>'id')::uuid;
   perform internal.stok33_audit(p_office,'crew_keluar',(v_row->>'id')::uuid,'Catatan Crew berubah',jsonb_build_object('catatan_id',v_id));
  end loop;
 end if;
 v_result:=jsonb_build_object('id',v_id);v_receipt:=jsonb_build_object('pemilik',p_pemilik,'kunci',p_kunci,'office_id',p_office,'jenis',p_jenis,'hasil',v_result);
 insert into internal.stok_requests33(user_id,kunci,office_id,jenis,payload,hasil) values(p_pemilik,p_kunci,p_office,p_jenis,p_data,v_receipt);return v_receipt;
end $$;
create or replace function internal.stok34_reopen() returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid;begin
 for v_id in update public.stok_crew_keluar34 h set status='menunggu',versi=h.versi+1,diubah_pada=clock_timestamp()
 where h.office_id=new.office_id and h.status in ('sesuai','selisih_dijelaskan') and (h.tanggal=new.tanggal or h.tanggal=(select t.tanggal from public.stok_transaksi t where t.id=new.koreksi_dari)) returning h.id loop
 perform internal.stok33_audit(new.office_id,'crew_keluar',v_id,'Transaksi admin berubah',jsonb_build_object('transaksi_id',new.id));end loop;return new;
end $$;
drop trigger if exists stok34_reopen on public.stok_transaksi;
create trigger stok34_reopen after insert on public.stok_transaksi for each row execute function internal.stok34_reopen();
alter table public.stok_crew_keluar34 enable row level security;alter table public.stok_crew_baris34 enable row level security;
revoke all on public.stok_crew_keluar34,public.stok_crew_baris34 from public,anon,authenticated;
revoke all on function public.stok34_tulis(uuid,text,uuid,uuid,jsonb),public.stok34_crew_halaman(uuid,jsonb,integer),public.stok34_crew_detail(uuid,uuid),public.stok34_bandingkan(uuid,date,date,integer) from public,anon;
grant execute on function public.stok34_tulis(uuid,text,uuid,uuid,jsonb),public.stok34_crew_halaman(uuid,jsonb,integer),public.stok34_crew_detail(uuid,uuid),public.stok34_bandingkan(uuid,date,date,integer) to authenticated;

-- Backup v34
create or replace function public.stok33_ekspor(p_office uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if (p_office is null and not internal.stok33_global()) or (p_office is not null and internal.stok33_role(p_office)<>'admin') then raise exception 'Cadangan stok memerlukan admin office atau Administrator.';end if;
 return jsonb_build_object('format','GA_STOK','versi',1,'pembaruan',34,'dibuat_pada',now(),'office_id',p_office,'data',jsonb_build_object(
 'item',coalesce((select jsonb_agg(to_jsonb(i)) from public.stok_item i where p_office is null or i.office_id=p_office),'[]'),
 'transaksi',coalesce((select jsonb_agg(to_jsonb(t)-'permintaan') from public.stok_transaksi t where p_office is null or t.office_id=p_office),'[]'),
 'mutasi',coalesce((select jsonb_agg(to_jsonb(m)) from public.stok_mutasi m join public.stok_transaksi t on t.id=m.transaksi_id where p_office is null or t.office_id=p_office),'[]'),
 'opname',coalesce((select jsonb_agg(to_jsonb(o)) from public.stok_opname o where p_office is null or o.office_id=p_office),'[]'),
 'baris_opname',coalesce((select jsonb_agg(to_jsonb(b)) from public.stok_opname_baris b join public.stok_opname o on o.id=b.opname_id where p_office is null or o.office_id=p_office),'[]'),
 'hitung_keluar',coalesce((select jsonb_agg(to_jsonb(h)) from public.stok_hitung_keluar33 h where p_office is null or h.office_id=p_office),'[]'),
 'baris_keluar',coalesce((select jsonb_agg(to_jsonb(b)) from public.stok_keluar_baris33 b join public.stok_hitung_keluar33 h on h.id=b.hitung_id where p_office is null or h.office_id=p_office),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(a)) from public.stok_audit33 a where p_office is null or a.office_id=p_office),'[]'),
 'crew_keluar',coalesce((select jsonb_agg(to_jsonb(h)) from public.stok_crew_keluar34 h where p_office is null or h.office_id=p_office),'[]'),
 'crew_baris',coalesce((select jsonb_agg(to_jsonb(b)) from public.stok_crew_baris34 b join public.stok_crew_keluar34 h on h.id=b.keluar_id where p_office is null or h.office_id=p_office),'[]'),
 'tim',coalesce((select jsonb_agg(to_jsonb(a)) from public.stok_anggota33 a where p_office is null or a.office_id=p_office),'[]')));
end $$;
