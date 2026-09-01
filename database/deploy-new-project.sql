-- ============================================================================
-- INVITTA 2.0 BETA — DEPLOYMENT COMPLETO PARA NUEVO PROYECTO SUPABASE
-- Ejecutar este script COMPLETO en el "SQL Editor" de tu nuevo proyecto Supabase
-- ============================================================================

-- 1. Extensiones del Sistema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Limpieza de tablas previas (solo si existen en este esquema nuevo)
DROP TABLE IF EXISTS public.album_photos CASCADE;
DROP TABLE IF EXISTS public.checkin_logs CASCADE;
DROP TABLE IF EXISTS public.guests CASCADE;
DROP TABLE IF EXISTS public.tables CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;

-- ----------------------------------------------------------------------------
-- 3. TABLA: EVENTS (Raíz de Inquilino / Eventos de Gala)
-- ----------------------------------------------------------------------------
CREATE TABLE public.events (
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

CREATE INDEX idx_events_slug ON public.events(slug);
CREATE INDEX idx_events_date ON public.events(event_date);

-- ----------------------------------------------------------------------------
-- 4. TABLA: TABLES (Plano y Distribución de Mesas)
-- ----------------------------------------------------------------------------
CREATE TABLE public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'circular' CHECK (type IN ('imperial', 'circular', 'rectangular', 'cocktail', 'vip')),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tables_event_id ON public.tables(event_id);

-- ----------------------------------------------------------------------------
-- 5. TABLA: GUESTS (Gestión de Invitados, Pases y Folios de Gala)
-- ----------------------------------------------------------------------------
CREATE TABLE public.guests (
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

CREATE INDEX idx_guests_event_id ON public.guests(event_id);
CREATE INDEX idx_guests_folio ON public.guests(folio);
CREATE INDEX idx_guests_event_folio ON public.guests(event_id, folio);
CREATE INDEX idx_guests_status ON public.guests(status);

-- ----------------------------------------------------------------------------
-- 6. TABLA: CHECKIN_LOGS (Auditoría de Acceso en Puerta / Hostess)
-- ----------------------------------------------------------------------------
CREATE TABLE public.checkin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    folio TEXT NOT NULL,
    admitted_passes INTEGER NOT NULL CHECK (admitted_passes > 0),
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    scanned_by TEXT DEFAULT 'Hostess Puerta Principal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkin_logs_event ON public.checkin_logs(event_id);
CREATE INDEX idx_checkin_logs_created ON public.checkin_logs(created_at);

-- ----------------------------------------------------------------------------
-- 7. TABLA: ALBUM_PHOTOS (Cápsula de Recuerdos Colaborativa)
-- ----------------------------------------------------------------------------
CREATE TABLE public.album_photos (
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

CREATE INDEX idx_album_photos_event ON public.album_photos(event_id);

-- ----------------------------------------------------------------------------
-- 8. PROCEDIMIENTOS ALMACENADOS / ATOMIC RPCs
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

    SELECT * INTO v_guest 
    FROM public.guests 
    WHERE event_id = p_event_id 
      AND (
        id::text = v_clean_query OR 
        LOWER(folio) = v_clean_query OR 
        REPLACE(LOWER(folio), '-', '') = REPLACE(v_clean_query, '-', '')
      )
    LIMIT 1;

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

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_photos ENABLE ROW LEVEL SECURITY;

-- Políticas Events
CREATE POLICY "Public read active events" ON public.events FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users manage events" ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas Tables
CREATE POLICY "Public read tables of active events" ON public.tables FOR SELECT USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = tables.event_id AND events.is_active = true));
CREATE POLICY "Hosts manage tables" ON public.tables FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas Guests
CREATE POLICY "Public read guest records for active events" ON public.guests FOR SELECT USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.is_active = true));
CREATE POLICY "Hosts manage guests" ON public.guests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas Checkin Logs
CREATE POLICY "Read checkin logs" ON public.checkin_logs FOR SELECT USING (true);
CREATE POLICY "Insert checkin logs" ON public.checkin_logs FOR INSERT WITH CHECK (true);

-- Políticas Album Photos
CREATE POLICY "Public read approved album photos" ON public.album_photos FOR SELECT USING (is_approved = true);
CREATE POLICY "Public insert album photos" ON public.album_photos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE events.id = album_photos.event_id AND events.is_active = true));
CREATE POLICY "Hosts moderate album photos" ON public.album_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 10. BUCKET DE ALMACENAMIENTO PARA FOTOS (STORAGE)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invitta-album-photos', 'invitta-album-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para el bucket
CREATE POLICY "Public Album Storage Read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'invitta-album-photos');

CREATE POLICY "Public Album Storage Insert" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'invitta-album-photos');

-- ----------------------------------------------------------------------------
-- 11. DATOS SEMILLA INICIALES (DEMO BODA VALENTINA & SEBASTIÁN)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_evt_id UUID;
    v_tbl_imp_id UUID;
    v_tbl_2_id UUID;
BEGIN
    INSERT INTO public.events (slug, title, event_type, hosts, event_date, venue)
    VALUES ('boda-valentina-sebastian', '💍 Boda Real · Valentina & Sebastián', 'boda', 'Valentina & Sebastián', '2027-10-24 18:00:00-06', 'Hacienda San José de las Palmas')
    RETURNING id INTO v_evt_id;

    INSERT INTO public.tables (event_id, name, type, capacity, order_index)
    VALUES (v_evt_id, 'Mesa Imperial (Novios & Corte)', 'imperial', 16, 1)
    RETURNING id INTO v_tbl_imp_id;

    INSERT INTO public.tables (event_id, name, type, capacity, order_index)
    VALUES (v_evt_id, 'Mesa 02 (Familiares Directos)', 'circular', 10, 2)
    RETURNING id INTO v_tbl_2_id;

    INSERT INTO public.guests (event_id, table_id, name, contact_name, passes, confirmed_passes, folio, status, phone, is_court, is_vip)
    VALUES 
    (v_evt_id, v_tbl_imp_id, 'Lic. Roberto Garza & Familia', 'Roberto Garza', 3, 3, 'MIMP-GARZA-3P', 'CONFIRMED', '+528112345678', true, true),
    (v_evt_id, v_tbl_imp_id, 'Camila Ortiz', 'Camila Ortiz', 2, 2, 'MIMP-ORTIZ-2P', 'CONFIRMED', '+525598765432', true, true),
    (v_evt_id, v_tbl_2_id, 'Familia Martínez Valdés', 'Elena Martínez', 4, 0, 'M02-MARTINEZ-4P', 'SENT', '+525512345678', false, false);
END $$;
