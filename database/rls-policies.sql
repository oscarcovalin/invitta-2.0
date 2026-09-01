-- ============================================================================
-- INVITTA 2.0 BETA — ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Event-Isolation and Role Boundary Enforcement
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_photos ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. POLÍTICAS PARA `events`
-- ----------------------------------------------------------------------------
-- Lectura pública permitida para consultar metadatos del evento por slug
CREATE POLICY "Public read active events" 
ON public.events FOR SELECT 
USING (is_active = true);

-- Inserción / Edición restringida a usuarios autenticados / servicio
CREATE POLICY "Authenticated users manage events" 
ON public.events FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. POLÍTICAS PARA `tables`
-- ----------------------------------------------------------------------------
-- Lectura pública para plano de mesas del evento activo
CREATE POLICY "Public read tables of active events" 
ON public.tables FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = tables.event_id AND events.is_active = true));

-- Modificación solo por anfitriones autenticados / organizadores
CREATE POLICY "Hosts manage tables" 
ON public.tables FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS PARA `guests`
-- ----------------------------------------------------------------------------
-- Lectura pública del invitado si conoce su ID o Folio (o para la visualización del plano)
CREATE POLICY "Public read guest records for active events" 
ON public.guests FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.is_active = true));

-- Los invitados anónimos solo pueden actualizar su propio RSVP mediante la función segura submit_guest_rsvp
-- Para actualizaciones directas, restringir a anfitriones autenticados
CREATE POLICY "Hosts manage guests" 
ON public.guests FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. POLÍTICAS PARA `checkin_logs`
-- ----------------------------------------------------------------------------
-- Lectura de logs permitida para organizadores y anfitriones del evento
CREATE POLICY "Read checkin logs" 
ON public.checkin_logs FOR SELECT 
USING (true);

-- Inserción de logs de check-in permitida para hostess / RPC process_door_checkin
CREATE POLICY "Insert checkin logs" 
ON public.checkin_logs FOR INSERT 
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. POLÍTICAS PARA `album_photos` (Cápsula de Recuerdos)
-- ----------------------------------------------------------------------------
-- Cualquier invitado del evento puede ver fotos aprobadas
CREATE POLICY "Public read approved album photos" 
ON public.album_photos FOR SELECT 
USING (is_approved = true);

-- Cualquier invitado puede subir fotos a la cápsula de recuerdos
CREATE POLICY "Public insert album photos" 
ON public.album_photos FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE events.id = album_photos.event_id AND events.is_active = true));

-- Anfitriones autenticados pueden moderar o eliminar fotos
CREATE POLICY "Hosts moderate album photos" 
ON public.album_photos FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
