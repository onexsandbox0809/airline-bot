import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Domestic MVP destinations (per spec section 3) + international demo routes
// (per spec section 5 pricing examples). Airports table is designed so more
// can be added later with a single insert.
const AIRPORTS = [
  { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India' },
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India' },
  { code: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India' },
  { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bangalore', country: 'India' },
  { code: 'PNQ', name: 'Pune Airport', city: 'Pune', country: 'India' },
  { code: 'CCU', name: 'Netaji Subhas Chandra Bose International Airport', city: 'Kolkata', country: 'India' },
  { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'UAE' },
  { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore' },
];

const AIRLINES = ['Demo Airways', 'IndiGo Express', 'SkyBridge Air'];

// Base fare (INR) per route pair; used as anchor, with per-flight variance
// applied so search results show multiple price points (per spec section 5).
const BASE_FARES: Record<string, number> = {
  'DEL-BOM': 5200, 'BOM-DEL': 5400,
  'DEL-MAA': 6100, 'MAA-DEL': 6300,
  'DEL-BLR': 5800, 'BLR-DEL': 5900,
  'DEL-PNQ': 5000, 'PNQ-DEL': 5100,
  'DEL-CCU': 5600, 'CCU-DEL': 5700,
  'BOM-MAA': 4800, 'MAA-BOM': 4900,
  'BOM-BLR': 4200, 'BLR-BOM': 4300,
  'BOM-PNQ': 2200, 'PNQ-BOM': 2300,
  'BOM-CCU': 6200, 'CCU-BOM': 6300,
  'MAA-BLR': 3400, 'BLR-MAA': 3500,
  'MAA-PNQ': 5500, 'PNQ-MAA': 5600,
  'MAA-CCU': 6600, 'CCU-MAA': 6700,
  'BLR-PNQ': 4100, 'PNQ-BLR': 4200,
  'BLR-CCU': 6400, 'CCU-BLR': 6500,
  'PNQ-CCU': 6800, 'CCU-PNQ': 6900,
  'DEL-DXB': 18500, 'DXB-DEL': 19200,
  'DEL-SIN': 24500, 'SIN-DEL': 25200,
  'BOM-DXB': 16800, 'DXB-BOM': 17400,
  'BOM-SIN': 21500, 'SIN-BOM': 22100,
  'MAA-DXB': 17200, 'DXB-MAA': 17800,
  'MAA-SIN': 15600, 'SIN-MAA': 16100,
  'BLR-DXB': 16900, 'DXB-BLR': 17500,
  'BLR-SIN': 14800, 'SIN-BLR': 15300,
  'DXB-SIN': 27500, 'SIN-DXB': 28200,
};

function pairKey(o: string, d: string) {
  return `${o}-${d}`;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('Seeding airports...');
  for (const a of AIRPORTS) {
    await prisma.airport.upsert({
      where: { code: a.code },
      update: { name: a.name, city: a.city, country: a.country, active: true },
      create: a,
    });
  }

  console.log('Seeding demo user...');
  const passwordHash = await bcrypt.hash('Passw0rd!', 10);
  await prisma.user.upsert({
    where: { email: 'demo@airlinebot.dev' },
    update: {},
    create: { name: 'Demo User', email: 'demo@airlinebot.dev', phone: '+919999999999', passwordHash },
  });

  console.log('Clearing existing flights (idempotent reseed)...');
  await prisma.checkin.deleteMany();
  await prisma.passenger.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.flight.deleteMany();

  console.log('Seeding flights for the next 60 days across all route combinations...');
  const codes = AIRPORTS.map((a) => a.code);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const flightsToCreate: any[] = [];
  let flightCounter = 1000;

  for (const origin of codes) {
    for (const destination of codes) {
      if (origin === destination) continue;
      const base = BASE_FARES[pairKey(origin, destination)];
      if (!base) continue; // only seed defined route pairs

      // 2-3 flights/day for a handful of sampled days across the next 60 days
      // (every day for all ~56 pairs would be excessive volume for an MVP seed;
      // sampling every 3rd day still gives realistic search results for testing).
      for (let dayOffset = 0; dayOffset < 60; dayOffset += 3) {
        const day = new Date(today);
        day.setDate(day.getDate() + dayOffset);

        const flightsPerDay = randInt(2, 3);
        const departureHours = [6, 10, 14, 18, 21];

        for (let i = 0; i < flightsPerDay; i++) {
          const hour = departureHours[randInt(0, departureHours.length - 1)];
          const departureTime = new Date(day);
          departureTime.setHours(hour, [0, 15, 30, 45][randInt(0, 3)], 0, 0);

          const isInternational = ['DXB', 'SIN'].includes(origin) || ['DXB', 'SIN'].includes(destination);
          const durationMinutes = isInternational ? randInt(180, 480) : randInt(75, 180);
          const arrivalTime = new Date(departureTime.getTime() + durationMinutes * 60000);

          const priceVariance = 1 + (randInt(-8, 25) / 100); // -8% to +25% around base
          const price = Math.round((base * priceVariance) / 50) * 50; // round to nearest 50

          const totalSeats = 150;
          const availableSeats = randInt(4, totalSeats);

          flightCounter += 1;
          flightsToCreate.push({
            flightNumber: `${AIRLINES[randInt(0, AIRLINES.length - 1)] === 'Demo Airways' ? 'DA' : AIRLINES[randInt(0, AIRLINES.length - 1)] === 'IndiGo Express' ? 'IX' : 'SB'}${flightCounter}`,
            airline: AIRLINES[randInt(0, AIRLINES.length - 1)],
            originCode: origin,
            destinationCode: destination,
            departureTime,
            arrivalTime,
            durationMinutes,
            basePrice: price,
            currency: 'INR',
            cabinClass: 'ECONOMY' as const,
            totalSeats,
            availableSeats,
            status: 'ACTIVE' as const,
          });
        }
      }
    }
  }

  console.log(`Inserting ${flightsToCreate.length} flights...`);
  const chunkSize = 500;
  for (let i = 0; i < flightsToCreate.length; i += chunkSize) {
    const chunk = flightsToCreate.slice(i, i + chunkSize);
    await prisma.flight.createMany({ data: chunk });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
