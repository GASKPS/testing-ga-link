-- Akses baca Data Tamu untuk akun Pembaca aktif dengan akses Portal GA.
-- Jalankan sekali jika akun Pembaca perlu melihat Data Tamu.
begin;

do $$
begin
 if to_regclass('public.tamu') is null or to_regclass('public.profil_pengguna') is null or to_regprocedure('internal.izin_portal()') is null then
  raise exception 'Database dasar Portal GA belum lengkap. Pasang database dasar sebelum menjalankan tamu_baca27.sql.';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.tamu'::regclass) then
  raise exception 'RLS tabel tamu harus sudah aktif. Skrip ini tidak mengubah konfigurasi RLS instalasi lama.';
 end if;
end $$;

drop policy if exists tamu_baca_pembaca27 on public.tamu;
create policy tamu_baca_pembaca27 on public.tamu
 for select to authenticated
 using (
  internal.izin_portal()
  and exists (
   select 1 from public.profil_pengguna p
   where p.id=(select auth.uid())
     and p.aktif and p.akses_portal and p.peran='pembaca'
  )
 );
grant select on public.tamu to authenticated;

commit;
