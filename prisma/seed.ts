import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, TransportType } from '@prisma/client';

const prisma = new PrismaClient();

const offers = [
  { type: TransportType.TRAIN, provider: 'Vande Bharat Express · Demo', code: 'VB-22436', origin: 'Mumbai', destination: 'Pune', days: 3, hour: 6, duration: 210, price: 145000, class: 'Executive Chair', capacity: 40, available: 24, stops: 2, amenities: 'Wi-Fi,Meals,Power outlets', train: ['MMCT', 'PUNE', 'Vande Bharat Express', 'VB-22436', 'Daily', 'Lonavala'] },
  { type: TransportType.TRAIN, provider: 'Deccan Queen · Demo', code: 'DQ-12123', origin: 'Mumbai', destination: 'Pune', days: 3, hour: 7, duration: 225, price: 78000, class: 'AC Chair Car', capacity: 60, available: 18, stops: 3, amenities: 'Pantry,Power outlets', train: ['MMCT', 'PUNE', 'Deccan Queen', 'DQ-12123', 'Daily', 'Khandala'] },
  { type: TransportType.TRAIN, provider: 'Shatabdi Express · Demo', code: 'SH-12009', origin: 'Delhi', destination: 'Jaipur', days: 4, hour: 6, duration: 300, price: 125000, class: 'AC Chair Car', capacity: 50, available: 21, stops: 4, amenities: 'Meals,Wi-Fi', train: ['NDLS', 'JP', 'Shatabdi Express', 'SH-12009', 'Daily', 'Alwar'] },
  { type: TransportType.TRAIN, provider: 'Karnataka Express · Demo', code: 'KE-12627', origin: 'Bengaluru', destination: 'Chennai', days: 5, hour: 22, duration: 360, price: 98000, class: 'AC 2 Tier', capacity: 48, available: 14, stops: 5, amenities: 'Sleeper,Pantry', train: ['SBC', 'MAS', 'Karnataka Express', 'KE-12627', 'Daily', 'Katpadi'] },
  { type: TransportType.TRAIN, provider: 'Telangana Link · Demo', code: 'TL-17001', origin: 'Hyderabad', destination: 'Vijayawada', days: 3, hour: 6, duration: 330, price: 84000, class: 'AC Chair Car', capacity: 55, available: 32, stops: 3, amenities: 'Pantry,Charging', train: ['SC', 'BZA', 'Telangana Link', 'TL-17001', 'Daily', 'Khammam'] },
  { type: TransportType.TRAIN, provider: 'Coromandel Connect · Demo', code: 'CC-12851', origin: 'Vijayawada', destination: 'Chennai', days: 4, hour: 7, duration: 390, price: 97000, class: 'Sleeper', capacity: 70, available: 28, stops: 4, amenities: 'Pantry,Sleeper', train: ['BZA', 'MAS', 'Coromandel Connect', 'CC-12851', 'Daily', 'Ongole'] },
  { type: TransportType.TRAIN, provider: 'Deccan Link · Demo', code: 'DL-12785', origin: 'Bengaluru', destination: 'Hyderabad', days: 5, hour: 20, duration: 570, price: 118000, class: 'AC 2 Tier', capacity: 48, available: 17, stops: 6, amenities: 'Sleeper,Pantry', train: ['SBC', 'SC', 'Deccan Link', 'DL-12785', 'Daily', 'Guntakal'] },
  { type: TransportType.TRAIN, provider: 'Dakshin Express · Demo', code: 'DE-12975', origin: 'Delhi', destination: 'Mumbai', days: 6, hour: 16, duration: 960, price: 145000, class: 'AC 3 Tier', capacity: 64, available: 21, stops: 8, amenities: 'Sleeper,Pantry', train: ['NDLS', 'MMCT', 'Dakshin Express', 'DE-12975', 'Daily', 'Kota'] },
  { type: TransportType.TRAIN, provider: 'Eastern Coast Link · Demo', code: 'EC-12839', origin: 'Chennai', destination: 'Visakhapatnam', days: 7, hour: 19, duration: 780, price: 134000, class: 'AC 2 Tier', capacity: 52, available: 25, stops: 7, amenities: 'Sleeper,Meals', train: ['MAS', 'VSKP', 'Eastern Coast Link', 'EC-12839', 'Daily', 'Vijayawada'] },
  { type: TransportType.BUS, provider: 'Coastal Cruiser · Demo', code: 'CC-401', origin: 'Mumbai', destination: 'Goa', days: 3, hour: 20, duration: 720, price: 165000, class: 'AC Sleeper', capacity: 32, available: 12, stops: 1, amenities: 'Blanket,USB,Water', bus: ['Coastal Cruiser', 'AC Sleeper', 'Mumbai Central', 'Panjim Bus Stand', 'Free cancellation until 24 hours before departure'] },
  { type: TransportType.BUS, provider: 'Royal Roadways · Demo', code: 'RR-118', origin: 'Delhi', destination: 'Jaipur', days: 4, hour: 8, duration: 330, price: 89000, class: 'AC Seater', capacity: 40, available: 22, stops: 2, amenities: 'Wi-Fi,USB,Water', bus: ['Royal Roadways', 'AC Seater', 'Kashmere Gate', 'Sindhi Camp', 'Free cancellation until 12 hours before departure'] },
  { type: TransportType.BUS, provider: 'Blue Fern Travels · Demo', code: 'BF-725', origin: 'Bengaluru', destination: 'Chennai', days: 5, hour: 21, duration: 390, price: 110000, class: 'AC Sleeper', capacity: 30, available: 8, stops: 1, amenities: 'Blanket,Charging,Water', bus: ['Blue Fern Travels', 'AC Sleeper', 'Madiwala', 'Koyambedu', 'Free cancellation until 12 hours before departure'] },
  { type: TransportType.BUS, provider: 'Himalayan Connect · Demo', code: 'HC-812', origin: 'Delhi', destination: 'Agra', days: 6, hour: 7, duration: 240, price: 52000, class: 'AC Seater', capacity: 36, available: 19, stops: 0, amenities: 'Wi-Fi,Water', bus: ['Himalayan Connect', 'AC Seater', 'Sarai Kale Khan', 'Idgah Bus Stand', 'Free cancellation until 6 hours before departure'] },
  { type: TransportType.BUS, provider: 'Krishna Valley Coach · Demo', code: 'KV-202', origin: 'Vijayawada', destination: 'Hyderabad', days: 3, hour: 21, duration: 360, price: 79000, class: 'AC Semi-sleeper', capacity: 36, available: 20, stops: 2, amenities: 'Wi-Fi,USB,Water', bus: ['Krishna Valley Coach', 'AC Semi-sleeper', 'Benz Circle', 'MGBS', 'Free cancellation until 12 hours before departure'] },
  { type: TransportType.BUS, provider: 'Guntur Express · Demo', code: 'GE-413', origin: 'Guntur', destination: 'Bengaluru', days: 4, hour: 18, duration: 630, price: 125000, class: 'AC Sleeper', capacity: 32, available: 15, stops: 3, amenities: 'Blanket,Charging,Water', bus: ['Guntur Express', 'AC Sleeper', 'Guntur RTC Complex', 'Madiwala', 'Free cancellation until 12 hours before departure'] },
  { type: TransportType.BUS, provider: 'Southern Star Coach · Demo', code: 'SS-530', origin: 'Hyderabad', destination: 'Chennai', days: 5, hour: 19, duration: 660, price: 138000, class: 'AC Sleeper', capacity: 30, available: 18, stops: 2, amenities: 'Blanket,Wi-Fi,USB', bus: ['Southern Star Coach', 'AC Sleeper', 'MGBS', 'Koyambedu', 'Free cancellation until 12 hours before departure'] },
  { type: TransportType.BUS, provider: 'Eastern Bay Travels · Demo', code: 'EB-609', origin: 'Visakhapatnam', destination: 'Vijayawada', days: 6, hour: 20, duration: 390, price: 92000, class: 'Non-AC Seater', capacity: 40, available: 23, stops: 2, amenities: 'USB,Water', bus: ['Eastern Bay Travels', 'Non-AC Seater', 'Dwarka Bus Station', 'Benz Circle', 'Free cancellation until 6 hours before departure'] },
  { type: TransportType.BUS, provider: 'Mysore Roadlines · Demo', code: 'MR-711', origin: 'Bengaluru', destination: 'Tirupati', days: 7, hour: 22, duration: 360, price: 87000, class: 'AC Semi-sleeper', capacity: 36, available: 24, stops: 1, amenities: 'Wi-Fi,Charging,Water', bus: ['Mysore Roadlines', 'AC Semi-sleeper', 'Majestic', 'Tirupati Central Bus Station', 'Free cancellation until 12 hours before departure'] },
  { type: TransportType.FLIGHT, provider: 'IndiGo · Demo', code: '6E-204', origin: 'Mumbai', destination: 'Delhi', days: 3, hour: 9, duration: 130, price: 599900, class: 'Economy', capacity: 180, available: 42, stops: 0, amenities: 'Cabin baggage,In-flight purchase', flight: ['6E-204', 'BOM', 'DEL', '15 kg check-in', '599900', '18', 'Non-refundable demo fare'] },
  { type: TransportType.FLIGHT, provider: 'Air India · Demo', code: 'AI-864', origin: 'Delhi', destination: 'Jaipur', days: 4, hour: 11, duration: 65, price: 429900, class: 'Economy', capacity: 150, available: 30, stops: 0, amenities: 'Cabin baggage,Refreshments', flight: ['AI-864', 'DEL', 'JAI', '15 kg check-in', '429900', '18', 'Demo fare; change fee may apply'] },
  { type: TransportType.FLIGHT, provider: 'Vistara · Demo', code: 'UK-813', origin: 'Bengaluru', destination: 'Mumbai', days: 5, hour: 14, duration: 105, price: 685000, class: 'Premium Economy', capacity: 140, available: 28, stops: 0, amenities: 'Meal,Priority boarding', flight: ['UK-813', 'BLR', 'BOM', '15 kg check-in', '685000', '18', 'Demo fare; change fee may apply'] },
  { type: TransportType.FLIGHT, provider: 'Akasa Air · Demo', code: 'QP-1302', origin: 'Mumbai', destination: 'Goa', days: 6, hour: 16, duration: 75, price: 369900, class: 'Economy', capacity: 170, available: 35, stops: 0, amenities: 'Cabin baggage,In-flight purchase', flight: ['QP-1302', 'BOM', 'GOI', '15 kg check-in', '369900', '18', 'Non-refundable demo fare'] },
  { type: TransportType.FLIGHT, provider: 'IndiGo · Demo', code: '6E-441', origin: 'Hyderabad', destination: 'Delhi', days: 3, hour: 10, duration: 145, price: 574900, class: 'Economy', capacity: 170, available: 38, stops: 0, amenities: 'Cabin baggage,In-flight purchase', flight: ['6E-441', 'HYD', 'DEL', '15 kg check-in', '574900', '18', 'Non-refundable demo fare'] },
  { type: TransportType.FLIGHT, provider: 'Air India · Demo', code: 'AI-562', origin: 'Chennai', destination: 'Bengaluru', days: 4, hour: 9, duration: 65, price: 389900, class: 'Economy', capacity: 150, available: 28, stops: 0, amenities: 'Cabin baggage,Refreshments', flight: ['AI-562', 'MAA', 'BLR', '15 kg check-in', '389900', '18', 'Demo fare; change fee may apply'] },
  { type: TransportType.FLIGHT, provider: 'IndiGo · Demo', code: '6E-821', origin: 'Delhi', destination: 'Kolkata', days: 5, hour: 12, duration: 125, price: 624900, class: 'Economy', capacity: 180, available: 40, stops: 0, amenities: 'Cabin baggage,In-flight purchase', flight: ['6E-821', 'DEL', 'CCU', '15 kg check-in', '624900', '18', 'Non-refundable demo fare'] },
];

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@traverse.test').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'TraverseAdmin!2026';
  if (adminPassword.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters.');
  const adminHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: 'ADMIN' },
    create: { email: adminEmail, passwordHash: adminHash, name: 'Traverse Administrator', role: 'ADMIN' },
  });
  const demoHash = await bcrypt.hash('TraverseDemo!2026', 12);
  await prisma.user.upsert({
    where: { email: 'traveler@traverse.test' },
    update: { passwordHash: demoHash },
    create: { email: 'traveler@traverse.test', passwordHash: demoHash, name: 'Alex Morgan', phone: '+91 98765 43210' },
  });

  const destinations = [
    { name: 'Udaipur', country: 'India', description: 'Palaces, quiet lakes and golden-hour boat rides.', imageUrl: 'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=1000&q=85' },
    { name: 'Goa', country: 'India', description: 'Slow mornings, coastal roads and a little more ocean.', imageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1000&q=85' },
    { name: 'Jaipur', country: 'India', description: 'Rose-coloured streets, remarkable craft and royal history.', imageUrl: 'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=1000&q=85' },
    { name: 'Munnar', country: 'India', description: 'Misty tea gardens and winding paths through the hills.', imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=85' },
  ];
  for (const item of destinations) {
    const existing = await prisma.destination.findFirst({ where: { name: item.name } });
    if (existing) await prisma.destination.update({ where: { id: existing.id }, data: { ...item, featured: true } });
    else await prisma.destination.create({ data: { ...item, featured: true } });
  }
  for (const type of Object.values(TransportType)) {
    const name = type === 'TRAIN' ? 'Traverse Rail Demo' : type === 'BUS' ? 'Traverse Coach Demo' : 'Traverse Air Demo';
    await prisma.provider.upsert({ where: { id: `demo-${type.toLowerCase()}` }, update: { name, active: true }, create: { id: `demo-${type.toLowerCase()}`, name, type, mode: 'DEMO' } });
  }
  const now = new Date();
  const stations = [
    ['MMCT', 'Mumbai Central', 'Mumbai'], ['PUNE', 'Pune Junction', 'Pune'], ['NDLS', 'New Delhi', 'Delhi'],
    ['JP', 'Jaipur Junction', 'Jaipur'], ['SBC', 'KSR Bengaluru', 'Bengaluru'], ['MAS', 'Chennai Central', 'Chennai'],
    ['SC', 'Secunderabad Junction', 'Hyderabad'], ['BZA', 'Vijayawada Junction', 'Vijayawada'],
    ['VSKP', 'Visakhapatnam Junction', 'Visakhapatnam'], ['LNL', 'Lonavala', 'Lonavala'], ['KAD', 'Khandala', 'Khandala'],
    ['AWR', 'Alwar Junction', 'Alwar'], ['KPD', 'Katpadi Junction', 'Katpadi'], ['KMT', 'Khammam', 'Khammam'],
    ['OGL', 'Ongole', 'Ongole'], ['GTL', 'Guntakal Junction', 'Guntakal'], ['KOTA', 'Kota Junction', 'Kota'],
  ] as const;
  for (const [code, name, city] of stations) {
    await prisma.station.upsert({ where: { code }, update: { name, city }, create: { code, name, city } });
  }
  const airports = [
    ['BOM', 'Chhatrapati Shivaji Maharaj International Airport', 'Mumbai'],
    ['DEL', 'Indira Gandhi International Airport', 'Delhi'],
    ['BLR', 'Kempegowda International Airport', 'Bengaluru'],
    ['MAA', 'Chennai International Airport', 'Chennai'],
    ['HYD', 'Rajiv Gandhi International Airport', 'Hyderabad'],
    ['JAI', 'Jaipur International Airport', 'Jaipur'],
    ['CCU', 'Netaji Subhas Chandra Bose International Airport', 'Kolkata'],
    ['GOI', 'Dabolim Airport', 'Goa'],
  ] as const;
  for (const [code, name, city] of airports) {
    await prisma.airport.upsert({ where: { code }, update: { name, city }, create: { code, name, city } });
  }
  for (const item of offers) {
    const departAt = new Date(now);
    departAt.setDate(now.getDate() + item.days);
    departAt.setHours(item.hour, 0, 0, 0);
    const arriveAt = new Date(departAt.getTime() + item.duration * 60_000);
    const offer = await prisma.transportOffer.upsert({
      where: { type_code_departAt: { type: item.type, code: item.code, departAt } },
      update: { available: item.available, priceMinor: item.price, demo: true },
      create: {
        type: item.type, provider: item.provider, code: item.code, origin: item.origin, destination: item.destination,
        departAt, arriveAt, durationMin: item.duration, priceMinor: item.price, class: item.class, capacity: item.capacity,
        available: item.available, stops: item.stops, amenities: item.amenities, demo: true,
      },
    });
    if (item.type === TransportType.TRAIN) {
      const [originStationCode, destinationStationCode, trainName, trainNumber, runningDays, middleStations] = item.train!;
      const schedule = await prisma.trainSchedule.upsert({
        where: { offerId: offer.id },
        update: { trainName, trainNumber, originStationCode, destinationStationCode, runningDays },
        create: { offerId: offer.id, trainName, trainNumber, originStationCode, destinationStationCode, runningDays },
      });
      await prisma.trainStop.deleteMany({ where: { trainId: schedule.id } });
      const intermediate = middleStations.split('|');
      const stopData = [
        { stationCode: originStationCode, name: stations.find(([code]) => code === originStationCode)![1], city: item.origin, sequence: 0, departAt },
        ...intermediate.map((city, index) => {
          const station = stations.find(([, , stationCity]) => stationCity.toLowerCase() === city.toLowerCase());
          if (!station) throw new Error(`Missing seeded station for ${city}.`);
          return { stationCode: station[0], name: station[1], city: station[2], sequence: index + 1, arriveAt: new Date(departAt.getTime() + Math.floor(item.duration * (index + 1) / (intermediate.length + 1)) * 60000), departAt: new Date(departAt.getTime() + Math.floor(item.duration * (index + 1) / (intermediate.length + 1)) * 60000 + 3 * 60000) };
        }),
        { stationCode: destinationStationCode, name: stations.find(([code]) => code === destinationStationCode)![1], city: item.destination, sequence: intermediate.length + 1, arriveAt },
      ];
      await prisma.trainStop.createMany({ data: stopData.map((stop) => ({ ...stop, trainId: schedule.id })) });
    } else if (item.type === TransportType.BUS) {
      const [busName, busType, boardingPoint, droppingPoint, cancellationPolicy] = item.bus!;
      const schedule = await prisma.busSchedule.upsert({
        where: { offerId: offer.id },
        update: { busName, busType, airConditioned: busType.startsWith('AC'), boardingPoint, droppingPoint, cancellationPolicy, seatLayout: '2x2' },
        create: { offerId: offer.id, busName, busType, airConditioned: busType.startsWith('AC'), boardingPoint, droppingPoint, cancellationPolicy, seatLayout: '2x2' },
      });
      await prisma.busSeat.deleteMany({ where: { busId: schedule.id } });
      await prisma.busSeat.createMany({ data: Array.from({ length: item.capacity }, (_, index) => ({
        busId: schedule.id,
        code: `${String.fromCharCode(65 + Math.floor(index / 4))}${index % 4 + 1}`,
        seatType: index % 4 < 2 ? (index % 2 === 0 ? 'Window' : 'Aisle') : (index % 2 === 0 ? 'Aisle' : 'Window'),
        available: index < item.available,
      })) });
    } else {
      const [flightNumber, originAirportCode, destinationAirportCode, baggageAllowance, baseFare, taxPercent, refundInfo] = item.flight!;
      const taxesMinor = Math.round(Number(baseFare) * Number(taxPercent) / 100);
      await prisma.flightSchedule.upsert({
        where: { offerId: offer.id },
        update: { flightNumber, originAirportCode, destinationAirportCode, baggageAllowance, baseFareMinor: Number(baseFare) - taxesMinor, taxesMinor, refundInfo },
        create: { offerId: offer.id, flightNumber, originAirportCode, destinationAirportCode, baggageAllowance, baseFareMinor: Number(baseFare) - taxesMinor, taxesMinor, refundInfo },
      });
    }
  }
  await prisma.coupon.upsert({ where: { code: 'WELCOME10' }, update: {}, create: { code: 'WELCOME10', description: 'A little something for your first journey', discountPct: 10 } });
  console.info(`Seeded demo data. Admin: ${adminEmail}; traveler: traveler@traverse.test`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
