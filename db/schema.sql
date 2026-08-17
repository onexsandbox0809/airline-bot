-- =========================================================
-- Airline Bot - Database Schema (Supabase / PostgreSQL)
-- Run this once in the Supabase SQL editor (or via psql)
-- before running seed.sql
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- USERS
-- ---------------------------------------------------------
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- AIRPORTS
-- ---------------------------------------------------------
create table if not exists airports (
  id        uuid primary key default gen_random_uuid(),
  code      varchar(3) not null unique,      -- DEL, BOM, BLR, GOI, DXB
  name      text not null,
  city      text not null,
  country   text not null,
  timezone  text not null                    -- e.g. Asia/Kolkata
);

-- ---------------------------------------------------------
-- ROUTES  (configurable, not hardcoded in app code)
-- ---------------------------------------------------------
create table if not exists routes (
  id                     uuid primary key default gen_random_uuid(),
  origin_airport_id      uuid not null references airports(id) on delete restrict,
  destination_airport_id uuid not null references airports(id) on delete restrict,
  active                 boolean not null default true,
  unique (origin_airport_id, destination_airport_id)
);

-- ---------------------------------------------------------
-- FLIGHTS
-- ---------------------------------------------------------
create table if not exists flights (
  id               uuid primary key default gen_random_uuid(),
  flight_number    text not null,
  airline          text not null default 'Demo Airways',
  route_id         uuid not null references routes(id) on delete restrict,
  departure_date   date not null,
  departure_time   time not null,
  arrival_date     date not null,
  arrival_time     time not null,
  duration         text not null,             -- 'HH:MM'
  stops            int  not null default 0,
  status           text not null default 'SCHEDULED'
                    check (status in ('SCHEDULED','DELAYED','CANCELLED','DEPARTED','ARRIVED'))
);

create index if not exists idx_flights_route_date on flights(route_id, departure_date);

-- ---------------------------------------------------------
-- FLIGHT INVENTORY  (per cabin class, drives pricing/availability)
-- ---------------------------------------------------------
create table if not exists flight_inventory (
  id                 uuid primary key default gen_random_uuid(),
  flight_id          uuid not null references flights(id) on delete cascade,
  cabin_class        text not null check (cabin_class in ('ECONOMY','BUSINESS')),
  total_seats        int not null,
  available_seats    int not null,
  base_fare          numeric(10,2) not null,
  taxes              numeric(10,2) not null,
  baggage_allowance  text not null default '15 KG',
  refundable         boolean not null default true,
  unique (flight_id, cabin_class)
);

-- ---------------------------------------------------------
-- BOOKINGS
-- ---------------------------------------------------------
create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  pnr             varchar(6) not null unique,
  user_id         uuid not null references users(id) on delete restrict,
  flight_id       uuid not null references flights(id) on delete restrict,
  booking_status  text not null default 'PENDING'
                   check (booking_status in ('PENDING','CONFIRMED','CANCELLED')),
  payment_status  text not null default 'PENDING'
                   check (payment_status in ('PENDING','PAID','FAILED','REFUNDED')),
  cabin_class     text not null check (cabin_class in ('ECONOMY','BUSINESS')),
  total_amount    numeric(10,2) not null,
  currency        text not null default 'INR',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_bookings_pnr on bookings(pnr);
create index if not exists idx_bookings_user on bookings(user_id);
create index if not exists idx_bookings_status on bookings(booking_status);

-- ---------------------------------------------------------
-- PASSENGERS
-- ---------------------------------------------------------
create table if not exists passengers (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references bookings(id) on delete cascade,
  first_name       text not null,
  last_name        text not null,
  date_of_birth    date not null,
  gender           text not null check (gender in ('MALE','FEMALE','OTHER')),
  email            text,
  phone            text,
  passport_number  text
);

create index if not exists idx_passengers_booking on passengers(booking_id);
create index if not exists idx_passengers_lastname on passengers(booking_id, last_name);

-- ---------------------------------------------------------
-- CHECK-IN
-- ---------------------------------------------------------
create table if not exists checkins (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references bookings(id) on delete cascade,
  passenger_id      uuid not null references passengers(id) on delete cascade,
  check_in_status   text not null default 'NOT_CHECKED_IN'
                     check (check_in_status in ('NOT_CHECKED_IN','COMPLETED')),
  seat_number       text,
  boarding_group    text,
  boarding_pass_id  text unique,
  checked_in_at     timestamptz,
  unique (passenger_id)
);

create index if not exists idx_checkins_boarding_pass on checkins(boarding_pass_id);
