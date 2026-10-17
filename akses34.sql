-- Crew memakai pilihan peran tersendiri. Keanggotaan Crew v33 yang aktif dimigrasikan.
update public.profil_pengguna p set peran=(jsonb_populate_record(null::public.profil_pengguna,'{"peran":"crew"}'::jsonb)).peran,akses_portal=true,akses_mess=false
 where p.peran::text='pembaca' and exists(select 1 from public.stok_anggota33 a where a.user_id=p.id and a.aktif and a.office_id=p.office_id);
create or replace function public.atur_akun34(p_id uuid,p_versi integer,p_peran text,p_aktif boolean,p_akses_portal boolean,p_akses_mess boolean,p_office_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_caller public.profil_pengguna;v_target public.profil_pengguna;v_result public.profil_pengguna;v_role text:=p_peran;v_name text;v_type text;v_json jsonb;begin
 select p.* into v_caller from public.profil_pengguna p where p.id=auth.uid() for share;
 if not found or not v_caller.aktif or v_caller.peran::text not in ('administrator','super_admin') then raise exception 'Hanya pengelola akun yang diizinkan.';end if;
 if p_peran not in ('administrator','super_admin','admin','pembaca','crew') then raise exception 'Peran tidak tersedia.';end if;
 select p.* into v_target from public.profil_pengguna p where p.id=p_id for update;
 if not found or v_target.versi is distinct from p_versi then raise exception using errcode='PT409',message='Akun berubah. Buka kembali pengaturannya.';end if;
 if v_caller.peran::text<>'administrator' and (v_target.peran::text in ('administrator','super_admin') or p_peran in ('administrator','super_admin') or p_office_id is distinct from v_target.office_id) then raise exception 'Perubahan ini memerlukan Administrator.';end if;
 if exists(select 1 from public.stok_opname o where o.crew_id=p_id and o.status='draf') or exists(select 1 from public.stok_hitung_keluar33 h where h.crew_id=p_id and h.status='draf') then
  if p_office_id is distinct from v_target.office_id or not p_aktif or not p_akses_portal or p_peran not in ('crew','admin','super_admin','administrator') then raise exception 'Alihkan atau selesaikan lembar hitungan aktif sebelum mengubah akses Crew.';end if;
 end if;
 if p_peran='crew' and (p_office_id is null or not exists(select 1 from public.kantor k where k.id=p_office_id and k.aktif)) then raise exception 'Tetapkan office aktif untuk akun Crew.';end if;
 if p_peran='crew' then v_role:='pembaca';p_akses_portal:=true;p_akses_mess:=false;end if;
 -- Delegasi ke pemeriksaan lama mempertahankan batas kewenangan dan perlindungan akun terakhir.
 if v_target.peran::text='crew' then update public.profil_pengguna set peran=(jsonb_populate_record(null::public.profil_pengguna,'{"peran":"pembaca"}'::jsonb)).peran where id=p_id;end if;
 v_name:=case when v_caller.peran::text='administrator' then 'atur_hak_akses_office' else 'atur_hak_akses' end;
 select format_type(p.proargtypes[a.i-1],null) into v_type from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral generate_subscripts(p.proargnames,1) a(i)
 where n.nspname='public' and p.proname=v_name and p.proargnames[a.i]='p_peran' limit 1;
 if v_type is null then raise exception 'Fungsi hak akses dasar belum lengkap.';end if;
 execute format('select to_jsonb(v) from public.%I(p_id=>$1,p_versi=>$2,p_peran=>$3::%s,p_aktif=>$4,p_akses_portal=>$5,p_akses_mess=>$6%s) v',v_name,v_type,case when v_name='atur_hak_akses_office' then ',p_office_id=>$7' else '' end)
 into v_json using p_id,p_versi,v_role,p_aktif,p_akses_portal,p_akses_mess,p_office_id;
 v_result:=jsonb_populate_record(null::public.profil_pengguna,v_json);
 if p_peran<>'crew' then update public.stok_anggota33 set aktif=false where user_id=p_id;end if;
 if p_peran='crew' then update public.profil_pengguna set peran=(jsonb_populate_record(null::public.profil_pengguna,'{"peran":"crew"}'::jsonb)).peran where id=p_id returning * into v_result;end if;
 return to_jsonb(v_result);
end $$;
revoke all on function public.atur_akun34(uuid,integer,text,boolean,boolean,boolean,uuid) from public,anon;
grant execute on function public.atur_akun34(uuid,integer,text,boolean,boolean,boolean,uuid) to authenticated;

-- Sanitasi hasil RPC lama termasuk ekspor, pengingat, pencarian, dan arsip.
create or replace function internal.catatan34_scrub(p_value jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;v_piece jsonb;v_key text;v_id uuid;begin
 if p_value is null then return null;end if;
 if jsonb_typeof(p_value)='object' then
  if coalesce(p_value->>'id','') ~ '^[0-9a-fA-F-]{36}$' then
   begin v_id:=(p_value->>'id')::uuid;exception when invalid_text_representation then v_id:=null;end;
   if exists(select 1 from public.catatan_admin c where c.id=v_id) and not internal.catatan34_id(v_id) then return null;end if;
  end if;
  v_result:='{}'::jsonb;
  for v_key,v_piece in select key,value from jsonb_each(p_value) loop
   if v_key='catatan_admin' and jsonb_typeof(v_piece)='array' then
    select coalesce(jsonb_agg(x),'[]') into v_piece from jsonb_array_elements(v_piece) x where coalesce(x->>'id','') ~ '^[0-9a-fA-F-]{36}$' and internal.catatan34_id((x->>'id')::uuid);
   end if;v_piece:=internal.catatan34_scrub(v_piece);
   if v_piece is not null then v_result:=v_result||jsonb_build_object(v_key,v_piece);end if;
  end loop;return v_result;
 elsif jsonb_typeof(p_value)='array' then
  select coalesce(jsonb_agg(v order by ord),'[]') into v_result from (select internal.catatan34_scrub(value) v,ordinality ord from jsonb_array_elements(p_value) with ordinality) t where v is not null;
  return v_result;
 end if;return p_value;
end $$;
revoke all on function internal.catatan34_scrub(jsonb) from public,anon,authenticated;

-- Muat pg_trgm di sesi pemasangan sebelum menyalin konfigurasi fungsi lama.
-- Pada koneksi baru, GUC ekstensi belum terdaftar sampai fungsi C-nya dipanggil.
-- Akun pemasang non-superuser kemudian dapat mempertahankan SET pg_trgm.*.
-- Tidak memasang ekstensi baru dan tidak mengubah nilai ambang pencarian.
do $$
declare v_schema text;begin
 select n.nspname into v_schema
 from pg_extension e join pg_namespace n on n.oid=e.extnamespace
 where e.extname='pg_trgm';
 if v_schema is not null then
  execute format('select %I.similarity(%L::text,%L::text)',v_schema,'','');
 end if;
end $$;

-- Salinan fungsi tetap internal dan tidak bisa dipanggil langsung pengguna.
-- Pembungkus menjaga Crew serta isi catatan, termasuk RPC lama SECURITY DEFINER.
do $$
declare v_f record;v_def text;v_args text;v_result text;v_call text;v_body text;v_base text;v_n integer;v_can_auth boolean;v_can_service boolean;begin
 for v_f in select p.*,pg_get_function_arguments(p.oid) args,pg_get_function_result(p.oid) result,n.nspname ns
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and p.prokind='f' and p.prorettype<>'trigger'::regtype
 and (select l.lanname from pg_language l where l.oid=p.prolang) in ('sql','plpgsql') loop
  if position('portal34 guard' in v_f.prosrc)>0 then continue;end if;
  v_can_auth:=has_function_privilege('authenticated',v_f.oid,'execute');v_can_service:=has_function_privilege('service_role',v_f.oid,'execute');
  v_base:='g34_'||v_f.proname;v_def:=pg_get_functiondef(v_f.oid);
  v_def:=regexp_replace(v_def,'CREATE OR REPLACE FUNCTION public\.'||v_f.proname||'\(', 'CREATE OR REPLACE FUNCTION internal.'||v_base||'(');
  execute v_def;
  v_args:='';for v_n in 1..v_f.pronargs loop v_args:=v_args||case when v_n>1 then ',' else '' end||'$'||v_n;end loop;
  v_call:=format('internal.%I(%s)',v_base,v_args);
  v_body:='-- portal34 guard'||E'\n'||'begin ';
  if v_f.proname not in ('stok33_konteks','stok33_halaman','stok33_detail','stok33_tulis','stok33_status','stok34_tulis','stok34_crew_halaman','stok34_crew_detail','stok34_bandingkan','simpan_foto_profil') then
   v_body:=v_body||'if internal.crew34() then raise exception using errcode=''42501'',message=''Akun Crew hanya memiliki akses pencatatan barang keluar dan hitungan fisik.'';end if;';
  end if;
  if v_f.proname='halaman_agenda' then v_body:=v_body||'if $1 is distinct from ''tamu'' then raise exception ''Buka Catatan Saya atau Catatan Office pada tampilan terbaru.'';end if;';end if;
  if v_f.proname='stok33_halaman' then v_body:=v_body||'if internal.crew34() and $2 not in (''keluar'',''opname'') then raise exception ''Halaman ini hanya untuk admin stok.'';end if;';end if;
  if v_f.proname='stok33_status' then v_body:=v_body||'if internal.crew34() and $2 not in (''hitung_keluar'',''hitung_opname'',''crew_catat'') then raise exception using errcode=''42501'',message=''Crew tidak diizinkan membaca kiriman stok resmi.'';end if;';end if;
  if v_f.proname='stok33_tulis' then v_body:=v_body||'if $2=''tim'' then raise exception ''Atur peran Crew melalui Pengaturan Akun.'';end if;';v_body:=v_body||'if internal.crew34() and $2 not in (''hitung_keluar'',''hitung_opname'') then raise exception ''Crew tidak diizinkan mengubah stok resmi.'';end if;';end if;
  if v_f.proretset then
   if v_f.prorettype in ('json'::regtype,'jsonb'::regtype) then v_body:=v_body||'return query select internal.catatan34_scrub(t::jsonb)::'||format_type(v_f.prorettype,null)||' from '||v_call||' t where internal.catatan34_scrub(t::jsonb) is not null;';
   elsif v_f.prorettype='public.catatan_admin'::regtype then v_body:=v_body||'return query select t.* from '||v_call||' t where internal.catatan34_id(t.id);';
   elsif position('catatan_admin' in v_f.prosrc)>0 and v_f.prorettype not in ('json'::regtype,'jsonb'::regtype) then v_body:=v_body||'raise exception ''Gunakan halaman Catatan terbaru.'';';
   else v_body:=v_body||'return query select * from '||v_call||';';end if;
  elsif v_f.prorettype in ('json'::regtype,'jsonb'::regtype) then
   v_body:='declare v_result jsonb; '||v_body||'v_result:=internal.catatan34_scrub('||v_call||'::jsonb);';
   if v_f.proname='stok33_konteks' then
    v_body:=v_body||'if internal.crew34() then v_result:=jsonb_set(v_result,''{lama}'',''{"barang":0,"opname":0,"transaksi":0,"draf":0}''::jsonb);v_result:=jsonb_set(v_result,''{ringkasan,minimum}'',''null''::jsonb);v_result:=jsonb_set(v_result,''{ringkasan,menunggu}'',to_jsonb((select count(*) from public.stok_opname o where o.office_id=(v_result->>''office_id'')::uuid and o.crew_id=auth.uid() and o.status=''menunggu'')));if v_result#>>''{ringkasan,draf,crew_id}'' is distinct from auth.uid()::text then v_result:=jsonb_set(v_result,''{ringkasan,draf}'',''null''::jsonb);end if;end if;';
   elsif v_f.proname='stok33_halaman' then
    v_body:=v_body||'if internal.crew34() then v_result:=jsonb_set(v_result,''{data}'',coalesce((select jsonb_agg(x-''jumlah_selisih'') from jsonb_array_elements(v_result->''data'') x),''[]''::jsonb));end if;';
   elsif v_f.proname='stok33_detail' then
    v_body:=v_body||'if internal.crew34() then if $2=''barang'' and $3 is not null or $2=''transaksi'' then raise exception ''Rincian saldo hanya tersedia untuk admin stok.'';end if;v_result:=jsonb_set(v_result,''{baris}'',coalesce((select jsonb_agg(x-''saldo''-''minimum''-''keluar_admin''-''admin_terkini''-''stok_catatan''-''saldo_terkini''-''selisih'') from jsonb_array_elements(v_result->''baris'') x),''[]''::jsonb));if v_result ? ''audit'' then v_result:=jsonb_set(v_result,''{audit}'',''[]''::jsonb);end if;end if;';
   end if;
   v_body:=v_body||'return v_result::'||v_f.result||';';
  elsif v_f.prorettype='void'::regtype then v_body:=v_body||'perform '||v_call||';return;';
  elsif v_f.prorettype='public.catatan_admin'::regtype then
   v_body:='declare v_row public.catatan_admin; '||v_body||'v_row:='||v_call||';if not internal.catatan34_id(v_row.id) then raise exception ''Catatan tidak tersedia untuk akun Anda.'';end if;return v_row;';
  elsif position('catatan_admin' in v_f.prosrc)>0 then v_body:=v_body||'raise exception ''Gunakan halaman Catatan terbaru.'';';
  else v_body:=v_body||'return '||v_call||';';end if;
  v_body:=v_body||'end';
  execute format('create or replace function public.%I(%s) returns %s language plpgsql %s security definer set search_path='''' as %L',v_f.proname,v_f.args,v_f.result,case v_f.provolatile when 's' then 'stable' when 'i' then 'stable' else 'volatile' end,v_body);
  execute format('revoke all on function internal.%I(%s) from public,anon,authenticated,service_role',v_base,pg_get_function_identity_arguments(v_f.oid));
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',v_f.proname,pg_get_function_identity_arguments(v_f.oid));
  if v_can_auth then execute format('grant execute on function public.%I(%s) to authenticated',v_f.proname,pg_get_function_identity_arguments(v_f.oid));end if;
  if v_can_service then execute format('grant execute on function public.%I(%s) to service_role',v_f.proname,pg_get_function_identity_arguments(v_f.oid));end if;
 end loop;
end $$;

-- Akses tabel langsung ikut dibatasi, bukan sekadar menyembunyikan menu.
do $$ declare v_t record;v_rule text;begin
 for v_t in select c.oid,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') loop
  v_rule:=case v_t.relname when 'profil_pengguna' then 'not internal.crew34() or id=auth.uid()' when 'kantor' then 'not internal.crew34() or id=(select p.office_id from public.profil_pengguna p where p.id=auth.uid())' else 'not internal.crew34()' end;
  if not v_t.relrowsecurity then
   execute format('alter table public.%I enable row level security',v_t.relname);
   execute format('drop policy if exists portal34_existing on public.%I',v_t.relname);
   execute format('create policy portal34_existing on public.%I for all to authenticated using(%s) with check(not internal.crew34())',v_t.relname,v_rule);
  end if;
  execute format('drop policy if exists portal34_crew_guard on public.%I',v_t.relname);
  execute format('create policy portal34_crew_guard on public.%I as restrictive for all to authenticated using(%s) with check(not internal.crew34())',v_t.relname,v_rule);
 end loop;
 for v_t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' loop
  execute format('alter view public.%I set (security_invoker=true)',v_t.relname);
 end loop;
 if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists portal34_crew_guard on storage.objects';
  execute 'create policy portal34_crew_guard on storage.objects as restrictive for all to authenticated using(not internal.crew34() or (bucket_id=''foto_profil'' and split_part(name,''/'',1)=auth.uid()::text)) with check(not internal.crew34() or (bucket_id=''foto_profil'' and split_part(name,''/'',1)=auth.uid()::text))';
 end if;
end $$;
