-- ============================================================================
-- INVITTA 2.0 — ESQUEMA DE BASE DE DATOS DE PRODUCCIÓN (PostgreSQL / Supabase)
-- Modelo: Cuenta (multi-tenant) -> Eventos -> Invitados + Entitlements por plan
-- ============================================================================

-- Habilitar extensión para UUIDs criptográficos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PLANES DISPONIBLES (catálogo comercial)
-- ----------------------------------------------------------------------------
CREATE TABLE plans (
    id                      SERIAL PRIMARY KEY,
    key                     TEXT UNIQUE NOT NULL,        -- 'invitacion_simple' | 'invitacion_gestion' | 'planner' | 'salon'
    name                    TEXT NOT NULL,
    price_type              TEXT NOT NULL CHECK (price_type IN ('one_time', 'subscription')),
    price_mxn               NUMERIC(10,2) NOT NULL,
    billing_period          TEXT CHECK (billing_period IN ('monthly', 'yearly', NULL)),
    max_events              INTEGER,                     -- NULL = ilimitado
    max_guests_per_event    INTEGER,                     -- NULL = ilimitado
    created_at              TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. CUENTAS (el cliente que paga: persona, planner o salón)
-- ----------------------------------------------------------------------------
CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type    TEXT NOT NULL CHECK (account_type IN ('persona', 'planner', 'salon')),
    business_name   TEXT,                                -- solo relevante para planner/salon
    billing_email   TEXT NOT NULL,
    phone           TEXT,
    plan_id         INTEGER REFERENCES plans(id),
    plan_status     TEXT DEFAULT 'active' CHECK (plan_status IN ('active', 'trial', 'past_due', 'canceled')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. ENTITLEMENTS (features habilitadas por cuenta — capa de permisos por plan)
--    Esta tabla es la fuente de verdad de "qué puede ver/hacer" cada cuenta.
-- ----------------------------------------------------------------------------
CREATE TABLE entitlements (
    id              SERIAL PRIMARY KEY,
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    feature_key     TEXT NOT NULL,                       -- 'guest_list' | 'rsvp' | 'seating' | 'multi_event' | 'white_label' | 'checkin' | 'catering_module'
    enabled         BOOLEAN DEFAULT true,
    limit_value     INTEGER,                             -- ej. max_events del add-on, si aplica
    UNIQUE(account_id, feature_key)
);

-- ----------------------------------------------------------------------------
-- 4. USUARIOS (personas que hacen login dentro de una cuenta)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    email           TEXT UNIQUE NOT NULL,
    full_name       TEXT,
    is_owner        BOOLEAN DEFAULT false,               -- dueño de la cuenta (admin/novios/dueño del salón)
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. EVENTOS (una cuenta puede tener 1 o varios, según su plan)
-- ----------------------------------------------------------------------------
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    event_type      TEXT CHECK (event_type IN ('boda', 'xv', 'cumpleanos', 'otro')),
    event_date      TIMESTAMPTZ,
    venue           TEXT,
    city            TEXT,
    theme           TEXT DEFAULT 'vino',
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'delivered', 'archived')),
    master_pin_hash TEXT,                                 -- hash del PIN, ya NO en texto plano
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. CONFIGURACIÓN DE INVITACIÓN (mapea el config.json que genera TemplateEngine)
-- ----------------------------------------------------------------------------
CREATE TABLE invitation_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    config_json     JSONB NOT NULL,                       -- todo lo que vive en ProjectsVault.config
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. COLABORADORES DEL EVENTO (roles operativos: designer, planner, hostess, catering)
-- ----------------------------------------------------------------------------
CREATE TABLE event_collaborators (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    email           TEXT,                                 -- puede no tener cuenta de usuario, solo link delegado
    role            TEXT NOT NULL CHECK (role IN ('admin', 'designer', 'planner', 'hostess', 'catering')),
    access_token    TEXT UNIQUE NOT NULL,                 -- token seguro para enlaces delegados
    invited_at      TIMESTAMPTZ DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 8. MESAS / SEATING (creado antes de guests para integridad referencial FK)
-- ----------------------------------------------------------------------------
CREATE TABLE event_tables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    capacity        INTEGER NOT NULL DEFAULT 10,
    position_x      NUMERIC,
    position_y      NUMERIC,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 9. INVITADOS
-- ----------------------------------------------------------------------------
CREATE TABLE guests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    phone           TEXT,
    email           TEXT,
    group_name      TEXT,                                 -- ej. "Familia Pérez"
    table_id        UUID REFERENCES event_tables(id) ON DELETE SET NULL,
    rsvp_status     TEXT DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'confirmed', 'declined')),
    plus_ones       INTEGER DEFAULT 0,
    dietary_notes   TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 10. CHECK-IN (feature exclusiva de plan Salón / add-on)
-- ----------------------------------------------------------------------------
CREATE TABLE checkin_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_id        UUID REFERENCES guests(id) ON DELETE SET NULL,
    scanned_at      TIMESTAMPTZ DEFAULT now(),
    scanned_by      TEXT                                  -- email o nombre del hostess que escaneó
);

-- ----------------------------------------------------------------------------
-- 11. PAGOS Y SUSCRIPCIONES (integración Stripe / pasarela de pagos)
-- ----------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan_id                 INTEGER NOT NULL REFERENCES plans(id),
    status                  TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    external_ref            TEXT,                         -- id de suscripción en Stripe
    created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount_mxn      NUMERIC(10,2) NOT NULL,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    external_ref    TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- ÍNDICES DE RENDIMIENTO (Performance Tuning)
-- ----------------------------------------------------------------------------
CREATE INDEX idx_events_account ON events(account_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_guests_event ON guests(event_id);
CREATE INDEX idx_guests_table ON guests(table_id);
CREATE INDEX idx_guests_rsvp ON guests(rsvp_status);
CREATE INDEX idx_tables_event ON event_tables(event_id);
CREATE INDEX idx_collaborators_token ON event_collaborators(access_token);
CREATE INDEX idx_collaborators_event ON event_collaborators(event_id);
CREATE INDEX idx_entitlements_account ON entitlements(account_id);

-- ----------------------------------------------------------------------------
-- TRIGGER PARA ACTUALIZACIÓN AUTOMÁTICA DE updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trg_invitation_configs_updated_at BEFORE UPDATE ON invitation_configs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trg_guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS — AISLAMIENTO TOTAL MULTI-TENANT EN SUPABASE)
-- ----------------------------------------------------------------------------
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para Eventos
CREATE POLICY "Dueño y miembros ven eventos de su propia cuenta"
ON events FOR ALL
USING (
    account_id IN (
        SELECT account_id FROM users WHERE users.id = auth.uid()
    )
);

-- Políticas para Configuraciones de Invitación
CREATE POLICY "Dueño y miembros gestionan la configuración de invitaciones de su cuenta"
ON invitation_configs FOR ALL
USING (
    event_id IN (
        SELECT e.id FROM events e
        JOIN users u ON u.account_id = e.account_id
        WHERE u.id = auth.uid()
    )
);

-- Políticas para Invitados y Mesas
CREATE POLICY "Gestión de invitados por cuenta"
ON guests FOR ALL
USING (
    event_id IN (
        SELECT e.id FROM events e
        JOIN users u ON u.account_id = e.account_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY "Gestión de mesas por cuenta"
ON event_tables FOR ALL
USING (
    event_id IN (
        SELECT e.id FROM events e
        JOIN users u ON u.account_id = e.account_id
        WHERE u.id = auth.uid()
    )
);

-- ----------------------------------------------------------------------------
-- 13. DATOS INICIALES DE PLANES (CATÁLOGO OFICIAL DE PRICING)
-- ----------------------------------------------------------------------------
INSERT INTO plans (key, name, price_type, price_mxn, billing_period, max_events, max_guests_per_event) VALUES
('invitacion_simple',   'Invitación Simple',       'one_time',     449.00, NULL,      1,    NULL),
('invitacion_gestion',  'Invitación + Gestión',    'one_time',    1199.00, NULL,      1,    300),
('planner',             'Planner',                 'subscription', 899.00, 'monthly', 10,   NULL),
('salon',               'Salón de Fiestas',        'subscription',1799.00, 'monthly', NULL, NULL)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    price_type = EXCLUDED.price_type,
    price_mxn = EXCLUDED.price_mxn,
    billing_period = EXCLUDED.billing_period,
    max_events = EXCLUDED.max_events,
    max_guests_per_event = EXCLUDED.max_guests_per_event;
