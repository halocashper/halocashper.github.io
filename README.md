# Cashper HR Admin Portal 🚀

Portal Web Admin untuk HRD mendaftarkan karyawan baru ke database Supabase, sehingga karyawan bisa langsung login di aplikasi Android **Cashper** tanpa akun demo.

---

## ⚡ Fitur Utama
1. **Daftar Karyawan Baru (Atomic)**: Membuat akun Supabase Auth (auto-confirmed) + data tabel `employees` secara otomatis dalam 1 klik.
2. **Direktori Karyawan**: Melihat data seluruh karyawan, status aktif/nonaktif, jabatan, gaji pokok, rekening, dan jadwal gajian.
3. **Pencarian Realtime**: Filter cepat berdasarkan nama, email, perusahaan, atau jabatan.
4. **Nonaktifkan / Aktifkan Karyawan**: Memblokir akses penarikan EWA dan login karyawan yang sudah resign / cuti.
5. **Zero Dependencies**: Murni HTML5, CSS3, dan Vanilla JS via CDN Supabase. Tanpa perlu `npm install` atau build bundler!

---

## 🌐 Cara Upload ke GitHub Pages (Gratis & Mudah)

### Cara 1: Lewat Repository GitHub (Paling Mudah)
1. Push folder `web-admin` ini ke repository GitHub Anda (bisa di repo yang sama dengan Android atau buat repo baru misal `cashper-admin`).
2. Di GitHub, buka repository tersebut > klik menu **Settings** > **Pages** (di sidebar kiri).
3. Pada bagian **Build and deployment**:
   - **Source:** Pilih `Deploy from a branch`.
   - **Branch:** Pilih `main` (atau `master`) dan pilih folder `/web-admin` (atau `/root` jika ditaruh di repo tersendiri).
4. Klik **Save**.
5. Tunggu 1–2 menit, link GitHub Pages Anda akan muncul (contoh: `https://username.github.io/cashper-admin/`).

---

## 🛠️ Persiapan di Supabase SQL Editor (Wajib)

Pastikan fungsi RPC pendaftaran admin sudah dipasang di Supabase. Buka **Supabase Dashboard > SQL Editor**, lalu jalankan skrip berikut:

```sql
-- Fungsi atomic untuk mendaftarkan user auth + karyawan dari Web Admin
CREATE OR REPLACE FUNCTION public.admin_register_employee(
  p_email text,
  p_password text,
  p_full_name text,
  p_company text,
  p_role_id smallint,
  p_bank_name text,
  p_bank_account_number text,
  p_payday_day smallint default 28
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  existing_id uuid;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email tidak boleh kosong';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password minimal 6 karakter';
  END IF;

  SELECT id INTO existing_id FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF existing_id IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        updated_at = now()
    where id = existing_id;
    v_user_id := existing_id;
  ELSE
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', lower(trim(p_email)),
      crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      json_build_object('sub', v_user_id, 'email', lower(trim(p_email))),
      'email', lower(trim(p_email)),
      now(), now(), now()
    );
  END IF;

  INSERT INTO public.employees (
    user_id, email, full_name, company, role_id,
    bank_name, bank_account_number, payday_day, is_active
  ) VALUES (
    v_user_id, lower(trim(p_email)), p_full_name, coalesce(nullif(trim(p_company), ''), 'PT Maju Bersama'),
    p_role_id, p_bank_name, p_bank_account_number, coalesce(p_payday_day, 28), true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    company = EXCLUDED.company,
    role_id = EXCLUDED.role_id,
    bank_name = EXCLUDED.bank_name,
    bank_account_number = EXCLUDED.bank_account_number,
    payday_day = EXCLUDED.payday_day,
    is_active = true;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', lower(trim(p_email)),
    'full_name', p_full_name
  );
END $$;

-- Fungsi mengambil daftar karyawan
CREATE OR REPLACE FUNCTION public.admin_get_employees()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  res jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'email', e.email,
      'full_name', e.full_name,
      'company', e.company,
      'role_id', e.role_id,
      'role_name', r.name,
      'base_salary', r.base_salary,
      'bank_name', e.bank_name,
      'bank_account_number', e.bank_account_number,
      'payday_day', e.payday_day,
      'is_active', e.is_active,
      'created_at', e.created_at
    ) ORDER BY e.created_at DESC
  ), '[]'::jsonb) INTO res
  FROM public.employees e
  JOIN public.roles r ON r.id = e.role_id;
  RETURN res;
END $$;

-- Fungsi toggle status karyawan
CREATE OR REPLACE FUNCTION public.admin_toggle_employee_status(p_employee_id uuid, p_active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.employees SET is_active = p_active WHERE id = p_employee_id;
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_register_employee(text, text, text, text, smallint, text, text, smallint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_employees() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_employee_status(uuid, boolean) TO anon, authenticated;
```

Selesai! Web Admin siap digunakan secara publik di GitHub Pages dan terhubung langsung ke APK Android Cashper.
