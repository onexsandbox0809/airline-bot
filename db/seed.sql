-- =========================================================
-- Airline Bot - Seed Data
-- Run AFTER schema.sql. Safe to re-run (guards with NOT EXISTS
-- / ON CONFLICT where sensible), but easiest is to run once on
-- a fresh schema.
-- =========================================================

-- ---------------------------------------------------------
-- AIRPORTS
-- ---------------------------------------------------------
insert into airports (code, name, city, country, timezone) values
  ('DEL', 'Indira Gandhi International Airport', 'Delhi',      'India', 'Asia/Kolkata'),
  ('BOM', 'Chhatrapati Shivaji Maharaj International Airport', 'Mumbai',    'India', 'Asia/Kolkata'),
  ('BLR', 'Kempegowda International Airport',    'Bengaluru', 'India', 'Asia/Kolkata'),
  ('GOI', 'Goa International Airport (Dabolim)', 'Goa',       'India', 'Asia/Kolkata'),
  ('DXB', 'Dubai International Airport',         'Dubai',     'United Arab Emirates', 'Asia/Dubai')
on conflict (code) do nothing;

-- ---------------------------------------------------------
-- ROUTES (DEL <-> BOM/BLR/GOI/DXB, both directions)
-- ---------------------------------------------------------
insert into routes (origin_airport_id, destination_airport_id, active)
select o.id, d.id, true
from airports o, airports d
where (o.code, d.code) in (
  ('DEL','BOM'), ('BOM','DEL'),
  ('DEL','BLR'), ('BLR','DEL'),
  ('DEL','GOI'), ('GOI','DEL'),
  ('DEL','DXB'), ('DXB','DEL')
)
on conflict (origin_airport_id, destination_airport_id) do nothing;

-- ---------------------------------------------------------
-- USERS (8 demo users, plain-text demo data only - no auth in MVP)
-- ---------------------------------------------------------
insert into users (name, email, phone) values
  ('Puneet Bhargava', 'puneet.bhargava@example.com', '+919999900001'),
  ('Aditi Sharma',     'aditi.sharma@example.com',    '+919999900002'),
  ('Rohan Mehta',      'rohan.mehta@example.com',     '+919999900003'),
  ('Sneha Iyer',       'sneha.iyer@example.com',      '+919999900004'),
  ('Kabir Khanna',     'kabir.khanna@example.com',    '+919999900005'),
  ('Ananya Rao',       'ananya.rao@example.com',      '+919999900006'),
  ('Vikram Singh',     'vikram.singh@example.com',    '+919999900007'),
  ('Neha Kapoor',      'neha.kapoor@example.com',     '+919999900008')
on conflict (email) do nothing;

-- ---------------------------------------------------------
-- FLIGHTS + INVENTORY
-- Generates 2 flights/day, per route, for the next 20 days,
-- each with ECONOMY + BUSINESS inventory.
-- Purely fictional "Demo Airways" / "Demo Express" carriers.
-- ---------------------------------------------------------
do $$
declare
  r record;
  d date;
  flight_row_id uuid;
  base_price numeric;
  flight_no_1 text;
  flight_no_2 text;
  seq int := 100;
begin
  for r in
    select ro.id as route_id, oa.code as origin_code, da.code as dest_code
    from routes ro
    join airports oa on oa.id = ro.origin_airport_id
    join airports da on da.id = ro.destination_airport_id
  loop
    -- base price differs by distance/destination (rough, fictional)
    base_price := case r.dest_code
      when 'BOM' then 4500
      when 'DEL' then 4500
      when 'BLR' then 5200
      when 'GOI' then 4800
      when 'DXB' then 15500
      else 5000
    end;

    for d in select generate_series(current_date + 1, current_date + 20, interval '1 day')::date loop
      seq := seq + 1;

      -- Morning flight
      insert into flights (flight_number, airline, route_id, departure_date, departure_time,
                            arrival_date, arrival_time, duration, stops, status)
      values ('DA' || seq, 'Demo Airways', r.route_id, d, time '08:00',
              d, (time '08:00' + interval '2 hours 10 minutes')::time, '02:10', 0, 'SCHEDULED')
      returning id into flight_row_id;

      insert into flight_inventory (flight_id, cabin_class, total_seats, available_seats, base_fare, taxes, baggage_allowance, refundable)
      values
        (flight_row_id, 'ECONOMY',  150, 42, base_price,       round(base_price * 0.18), '15 KG', true),
        (flight_row_id, 'BUSINESS', 20,  8,  base_price * 2.6, round(base_price * 2.6 * 0.18), '30 KG', true);

      seq := seq + 1;

      -- Evening flight
      insert into flights (flight_number, airline, route_id, departure_date, departure_time,
                            arrival_date, arrival_time, duration, stops, status)
      values ('DX' || seq, 'Demo Express', r.route_id, d, time '18:30',
              d, (time '18:30' + interval '2 hours 25 minutes')::time, '02:25', 0, 'SCHEDULED')
      returning id into flight_row_id;

      insert into flight_inventory (flight_id, cabin_class, total_seats, available_seats, base_fare, taxes, baggage_allowance, refundable)
      values
        (flight_row_id, 'ECONOMY',  150, 12, base_price * 0.95, round(base_price * 0.95 * 0.18), '15 KG', false),
        (flight_row_id, 'BUSINESS', 20,  3,  base_price * 2.4,  round(base_price * 2.4 * 0.18), '30 KG', true);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------
-- SAMPLE BOOKINGS (one confirmed + checked-in, one historical/cancelled)
-- Picks the first DEL->BOM flight found for demo purposes.
-- ---------------------------------------------------------
do $$
declare
  demo_user_id uuid;
  demo_flight_id uuid;
  demo_booking_id uuid;
  demo_passenger_id uuid;
begin
  select id into demo_user_id from users where email = 'puneet.bhargava@example.com';

  select f.id into demo_flight_id
  from flights f
  join routes ro on ro.id = f.route_id
  join airports oa on oa.id = ro.origin_airport_id
  join airports da on da.id = ro.destination_airport_id
  where oa.code = 'DEL' and da.code = 'BOM'
  order by f.departure_date asc
  limit 1;

  if demo_user_id is not null and demo_flight_id is not null then
    insert into bookings (pnr, user_id, flight_id, booking_status, payment_status, cabin_class, total_amount, currency)
    values ('DEMO01', demo_user_id, demo_flight_id, 'CONFIRMED', 'PAID', 'ECONOMY', 5310, 'INR')
    returning id into demo_booking_id;

    insert into passengers (booking_id, first_name, last_name, date_of_birth, gender, email, phone, passport_number)
    values (demo_booking_id, 'Puneet', 'Bhargava', '1990-01-01', 'MALE', 'puneet.bhargava@example.com', '+919999900001', null)
    returning id into demo_passenger_id;

    insert into checkins (booking_id, passenger_id, check_in_status)
    values (demo_booking_id, demo_passenger_id, 'NOT_CHECKED_IN');

    -- reduce inventory to reflect this booking
    update flight_inventory
    set available_seats = available_seats - 1
    where flight_id = demo_flight_id and cabin_class = 'ECONOMY';
  end if;

  -- a second, cancelled, historical booking on a DEL->GOI flight
  select f.id into demo_flight_id
  from flights f
  join routes ro on ro.id = f.route_id
  join airports oa on oa.id = ro.origin_airport_id
  join airports da on da.id = ro.destination_airport_id
  where oa.code = 'DEL' and da.code = 'GOI'
  order by f.departure_date asc
  limit 1;

  if demo_user_id is not null and demo_flight_id is not null then
    insert into bookings (pnr, user_id, flight_id, booking_status, payment_status, cabin_class, total_amount, currency)
    values ('DEMO02', demo_user_id, demo_flight_id, 'CANCELLED', 'REFUNDED', 'ECONOMY', 5664, 'INR');
  end if;
end $$;
