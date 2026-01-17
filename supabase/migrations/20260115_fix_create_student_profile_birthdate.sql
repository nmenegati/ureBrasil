CREATE OR REPLACE FUNCTION public.create_student_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_full_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_cpf TEXT := COALESCE(NEW.raw_user_meta_data->>'cpf', '');
  v_phone TEXT := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_birth_text TEXT := COALESCE(NEW.raw_user_meta_data->>'birth_date', '');
  v_birth_date DATE;
BEGIN
  -- birth_date: apenas castear se formato ISO válido; caso contrário usar fallback seguro
  IF v_birth_text ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_birth_date := v_birth_text::date;
  ELSE
    v_birth_date := DATE '2000-01-01';
  END IF;

  INSERT INTO public.student_profiles (
    user_id,
    full_name,
    cpf,
    phone,
    birth_date,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_full_name,
    v_cpf,
    v_phone,
    v_birth_date,
    now(),
    now()
  );

  RETURN NEW;
END;
$function$;

