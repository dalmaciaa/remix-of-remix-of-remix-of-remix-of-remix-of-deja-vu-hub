CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: adjustment_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.adjustment_reason AS ENUM (
    'loss',
    'internal_consumption',
    'breakage',
    'correction'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'mozo',
    'cocina',
    'bartender'
);


--
-- Name: expense_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expense_category AS ENUM (
    'drinks',
    'suppliers',
    'staff',
    'events',
    'maintenance',
    'others'
);


--
-- Name: kitchen_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kitchen_order_status AS ENUM (
    'pendiente',
    'en_preparacion',
    'listo',
    'entregado'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'transfer',
    'qr'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'no_cobrado',
    'cobrado'
);


--
-- Name: product_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_category AS ENUM (
    'drinks',
    'cocktails',
    'food',
    'supplies',
    'others'
);


--
-- Name: stock_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stock_status AS ENUM (
    'normal',
    'low',
    'critical'
);


--
-- Name: get_staff_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_staff_roles(_staff_id uuid) RETURNS public.app_role[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT ARRAY_AGG(role)
  FROM public.user_roles
  WHERE staff_id = _staff_id
$$;


--
-- Name: staff_has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_has_role(_staff_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE staff_id = _staff_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: event_complements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_complements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    name text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    event_date timestamp with time zone NOT NULL,
    client_name text NOT NULL,
    client_phone text,
    base_price numeric DEFAULT 0 NOT NULL,
    total_amount numeric DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amount numeric(10,2) NOT NULL,
    category public.expense_category NOT NULL,
    description text,
    payment_method public.payment_method NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kitchen_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kitchen_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kitchen_order_id uuid NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    quantity integer NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kitchen_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kitchen_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid,
    staff_id uuid,
    staff_name text NOT NULL,
    table_number text,
    notes text,
    status public.kitchen_order_status DEFAULT 'pendiente'::public.kitchen_order_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: login_verification_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_verification_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(6) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
    used boolean DEFAULT false NOT NULL,
    ip_address text,
    user_agent text
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category public.product_category NOT NULL,
    purchase_price numeric(10,2) DEFAULT 0 NOT NULL,
    sale_price numeric(10,2) DEFAULT 0 NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    min_stock numeric DEFAULT 5 NOT NULL,
    status public.stock_status DEFAULT 'normal'::public.stock_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_for_sale boolean DEFAULT true NOT NULL,
    is_compound boolean DEFAULT false NOT NULL,
    requires_kitchen boolean DEFAULT false NOT NULL,
    unit_base text DEFAULT 'unidad'::text,
    cost_per_unit numeric DEFAULT 0
);


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric NOT NULL,
    unit text DEFAULT 'unidad'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    payment_method public.payment_method NOT NULL,
    concept text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_status public.payment_status DEFAULT 'no_cobrado'::public.payment_status NOT NULL,
    staff_id uuid,
    staff_name text,
    table_number text
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staff_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid,
    role_target public.app_role,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    related_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    previous_quantity numeric NOT NULL,
    new_quantity numeric NOT NULL,
    reason public.adjustment_reason NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_complements event_complements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_complements
    ADD CONSTRAINT event_complements_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: kitchen_order_items kitchen_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_order_items
    ADD CONSTRAINT kitchen_order_items_pkey PRIMARY KEY (id);


--
-- Name: kitchen_orders kitchen_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_orders
    ADD CONSTRAINT kitchen_orders_pkey PRIMARY KEY (id);


--
-- Name: login_verification_codes login_verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_verification_codes
    ADD CONSTRAINT login_verification_codes_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_product_id_ingredient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_product_id_ingredient_id_key UNIQUE (product_id, ingredient_id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: staff_notifications staff_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_notifications
    ADD CONSTRAINT staff_notifications_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff staff_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_username_key UNIQUE (username);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_staff_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_staff_id_role_key UNIQUE (staff_id, role);


--
-- Name: idx_event_complements_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_complements_event_id ON public.event_complements USING btree (event_id);


--
-- Name: idx_events_event_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_event_date ON public.events USING btree (event_date);


--
-- Name: idx_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_status ON public.events USING btree (status);


--
-- Name: idx_expenses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_category ON public.expenses USING btree (category);


--
-- Name: idx_expenses_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_created_at ON public.expenses USING btree (created_at);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category);


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_status ON public.products USING btree (status);


--
-- Name: idx_sale_items_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_sale_id ON public.sale_items USING btree (sale_id);


--
-- Name: idx_sales_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_created_at ON public.sales USING btree (created_at);


--
-- Name: idx_verification_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_codes_code ON public.login_verification_codes USING btree (code);


--
-- Name: idx_verification_codes_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_codes_expires ON public.login_verification_codes USING btree (expires_at);


--
-- Name: events update_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: kitchen_orders update_kitchen_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_kitchen_orders_updated_at BEFORE UPDATE ON public.kitchen_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: staff update_staff_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: event_complements event_complements_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_complements
    ADD CONSTRAINT event_complements_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: kitchen_order_items kitchen_order_items_kitchen_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_order_items
    ADD CONSTRAINT kitchen_order_items_kitchen_order_id_fkey FOREIGN KEY (kitchen_order_id) REFERENCES public.kitchen_orders(id) ON DELETE CASCADE;


--
-- Name: kitchen_order_items kitchen_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_order_items
    ADD CONSTRAINT kitchen_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: kitchen_orders kitchen_orders_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_orders
    ADD CONSTRAINT kitchen_orders_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: kitchen_orders kitchen_orders_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_orders
    ADD CONSTRAINT kitchen_orders_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: recipes recipes_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: recipes recipes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sales sales_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: staff_notifications staff_notifications_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_notifications
    ADD CONSTRAINT staff_notifications_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: stock_adjustments stock_adjustments_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: event_complements Allow all access to event_complements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to event_complements" ON public.event_complements USING (true) WITH CHECK (true);


--
-- Name: events Allow all access to events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to events" ON public.events USING (true) WITH CHECK (true);


--
-- Name: expenses Allow all access to expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to expenses" ON public.expenses USING (true) WITH CHECK (true);


--
-- Name: kitchen_order_items Allow all access to kitchen_order_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to kitchen_order_items" ON public.kitchen_order_items USING (true) WITH CHECK (true);


--
-- Name: kitchen_orders Allow all access to kitchen_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to kitchen_orders" ON public.kitchen_orders USING (true) WITH CHECK (true);


--
-- Name: products Allow all access to products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to products" ON public.products USING (true) WITH CHECK (true);


--
-- Name: recipes Allow all access to recipes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to recipes" ON public.recipes USING (true) WITH CHECK (true);


--
-- Name: sale_items Allow all access to sale_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to sale_items" ON public.sale_items USING (true) WITH CHECK (true);


--
-- Name: sales Allow all access to sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to sales" ON public.sales USING (true) WITH CHECK (true);


--
-- Name: staff Allow all access to staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to staff" ON public.staff USING (true) WITH CHECK (true);


--
-- Name: stock_adjustments Allow all access to stock_adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to stock_adjustments" ON public.stock_adjustments USING (true) WITH CHECK (true);


--
-- Name: user_roles Allow all access to user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all access to user_roles" ON public.user_roles USING (true) WITH CHECK (true);


--
-- Name: login_verification_codes Allow insert from service role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert from service role" ON public.login_verification_codes FOR INSERT WITH CHECK (true);


--
-- Name: staff_notifications Allow insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert notifications" ON public.staff_notifications FOR INSERT WITH CHECK (true);


--
-- Name: login_verification_codes Allow select for verification; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow select for verification" ON public.login_verification_codes FOR SELECT USING (true);


--
-- Name: login_verification_codes Allow update for marking used; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update for marking used" ON public.login_verification_codes FOR UPDATE USING (true);


--
-- Name: staff_notifications Allow update notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update notifications" ON public.staff_notifications FOR UPDATE USING (true);


--
-- Name: staff_notifications Staff can read notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can read notifications" ON public.staff_notifications FOR SELECT USING (true);


--
-- Name: event_complements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_complements ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: kitchen_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kitchen_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: kitchen_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kitchen_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: login_verification_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_verification_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: recipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;