-- ============================================================================
-- INVITTA 2.0 BETA — CLOUD POSTGRESQL / SUPABASE PRODUCTION SCHEMA
-- Multi-Event Tenancy, Access Control, RSVP & Collaborative Photo Capsule
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLA: EVENTS (Raíz de Inquilino / Eventos de Gala)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'boda' CHECK (event_type IN ('boda', 'xv', 'corporativo', 'bautizo', 'gala')),
    hosts TEXT NOT NULL,
    event_date TIMESTAMPTZ,
    venue TEXT,
    master_pin_hash TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);

-- ----------------------------------------------------------------------------
-- 2. TABLA: TABLES (Distribución y Plano de Mesas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'circular' CHECK (type IN ('imperial', 'circular', 'rectangular', 'cocktail', 'vip')),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tables_event_id ON public.tables(event_id);

-- ----------------------------------------------------------------------------
-- 3. TABLA: GUESTS (Gestión de Invitados, Pases y Folios de Gala)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    contact_name TEXT,
    family_key TEXT,
    passes INTEGER NOT NULL DEFAULT 2 CHECK (passes > 0),
    confirmed_passes INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_passes >= 0),
    admitted_passes INTEGER NOT NULL DEFAULT 0 CHECK (admitted_passes >= 0),
    folio TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'CONFIRMED', 'DECLINED', 'CHECKED_IN', 'EMERGENCY')),
    phone TEXT,
    email TEXT,
    diet TEXT DEFAULT 'none',
    notes TEXT,
    is_court BOOLEAN NOT NULL DEFAULT false,
    is_vip BOOLEAN NOT NULL DEFAULT false,
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_event_id ON public.guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_folio ON public.guests(folio);
CREATE INDEX IF NOT EXISTS idx_guests_event_folio ON public.guests(event_id, folio);
CREATE INDEX IF NOT EXISTS idx_guests_status ON public.guests(status);

-- ----------------------------------------------------------------------------
-- 4. TABLA: CHECKIN_LOGS (Auditoría de Acceso en Puerta / Hostess)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    folio TEXT NOT NULL,
    admitted_passes INTEGER NOT NULL CHECK (admitted_passes > 0),
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    scanned_by TEXT DEFAULT 'Hostess Puerta Principal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkin_logs_event ON public.checkin_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_checkin_logs_created ON public.checkin_logs(created_at);

-- ----------------------------------------------------------------------------
-- 5. TABLA: ALBUM_PHOTOS (Cápsula de Recuerdos Colaborativa)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.album_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL DEFAULT 'Invitado Especial',
    photo_url TEXT NOT NULL,
    storage_path TEXT,
    dedication TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_album_photos_event ON public.album_photos(event_id);

-- ----------------------------------------------------------------------------
-- PROCEDIMIENTOS ALMACENADOS / ATOMIC RPCs
-- ----------------------------------------------------------------------------

-- Actualización atómica de RSVP
CREATE OR REPLACE FUNCTION public.submit_guest_rsvp(
    p_guest_id UUID,
    p_confirmed BOOLEAN,
    p_confirmed_passes INTEGER,
    p_diet TEXT,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_guest public.guests%ROWTYPE;
    v_valid_passes INTEGER;
BEGIN
    SELECT * INTO v_guest FROM public.guests WHERE id = p_guest_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitado no encontrado');
    END IF;

    IF p_confirmed THEN
        v_valid_passes := LEAST(v_guest.passes, GREATEST(0, COALESCE(p_confirmed_passes, v_guest.passes)));
    ELSE
        v_valid_passes := 0;
    END IF;

    UPDATE public.guests
    SET status = CASE WHEN p_confirmed THEN 'CONFIRMED' ELSE 'DECLINED' END,
        confirmed_passes = v_valid_passes,
        diet = COALESCE(p_diet, 'none'),
        notes = COALESCE(p_notes, ''),
        responded_at = now(),
        updated_at = now()
    WHERE id = p_guest_id
    RETURNING * INTO v_guest;

    RETURN jsonb_build_object('success', true, 'guest', to_jsonb(v_guest));
END;
$$;

-- Check-in atómico en puerta (Hostess)
CREATE OR REPLACE FUNCTION public.process_door_checkin(
    p_event_id UUID,
    p_query_or_folio TEXT,
    p_admitted_passes INTEGER,
    p_scanned_by TEXT DEFAULT 'Hostess Puerta'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_guest public.guests%ROWTYPE;
    v_final_passes INTEGER;
    v_clean_query TEXT;
BEGIN
    v_clean_query := TRIM(LOWER(p_query_or_folio));
    IF v_clean_query = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Query o Folio requerido');
    END IF;

    -- Búsqueda por ID, folio exacto o folio sin guiones
    SELECT * INTO v_guest 
    FROM public.guests 
    WHERE event_id = p_event_id 
      AND (
        id::text = v_clean_query OR 
        LOWER(folio) = v_clean_query OR 
        REPLACE(LOWER(folio), '-', '') = REPLACE(v_clean_query, '-', '')
      )
    LIMIT 1;

    -- Si no se encontró y la consulta tiene al menos 2 caracteres alfanuméricos, búsqueda difusa
    IF NOT FOUND AND length(regexp_replace(v_clean_query, '[^a-z0-9]', '', 'g')) >= 2 THEN
        SELECT * INTO v_guest
        FROM public.guests
        WHERE event_id = p_event_id
          AND (
            LOWER(name) LIKE '%' || v_clean_query || '%' OR
            LOWER(contact_name) LIKE '%' || v_clean_query || '%'
          )
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitado no encontrado en este evento');
    END IF;

    v_final_passes := LEAST(v_guest.passes, GREATEST(1, COALESCE(p_admitted_passes, v_guest.confirmed_passes, v_guest.passes)));

    UPDATE public.guests
    SET status = 'CHECKED_IN',
        admitted_passes = v_final_passes,
        checked_in_at = now(),
        updated_at = now()
    WHERE id = v_guest.id
    RETURNING * INTO v_guest;

    INSERT INTO public.checkin_logs(event_id, guest_id, folio, admitted_passes, is_emergency, scanned_by)
    VALUES (p_event_id, v_guest.id, v_guest.folio, v_final_passes, v_guest.is_emergency, p_scanned_by);

    RETURN jsonb_build_object('success', true, 'guest', to_jsonb(v_guest));
END;
$$;
