-- Konflik data aplikasi memakai HTTP 409, bukan kode retry mesin PostgreSQL.
-- Termasuk implementasi RPC Portal GA lama yang sudah berada di database pengguna.
do $$ declare v_schema text;begin
 select n.nspname into v_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
 if v_schema is not null then execute format('select %I.similarity(%L::text,%L::text)',v_schema,'','');end if;
end $$;
do $$
declare v_f record;v_before text;v_after text;v_count integer:=0;
 v_pattern text:='(?i)(errcode[[:space:]]*=[[:space:]]*|raise[[:space:]]+(exception[[:space:]]+)?sqlstate[[:space:]]+)''40001''';
begin
 for v_f in
  select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname in ('public','internal') and p.prokind='f' and l.lanname in ('sql','plpgsql')
  and p.prosrc ~ v_pattern
  and (p.proname ~ '^g34_' or p.proname ~ '^(g34_)?(catatan|stok|tracking|skc|atur_akun|simpan_|catat_|ubah_|tambah_|ambil_)'
   or p.prosrc ~ '\m(catatan_admin|profil_pengguna|karyawan|dokumen|pengambilan_skc|stok_item|stok_opname|stok_crew_keluar34|data_mess|pengaturan_mess|riwayat_pencarian_mess|tamu|perangkat|serah_terima|extra|cuti)\M')
 loop
  v_before:=pg_get_functiondef(v_f.oid);
  v_after:=regexp_replace(v_before,v_pattern,'\1''PT409''','g');
  if v_after is distinct from v_before then execute v_after;v_count:=v_count+1;end if;
 end loop;
 raise notice 'Kode konflik pada % fungsi Portal GA diperbarui. Pemeriksaan versi tetap berlaku.',v_count;
end $$;
