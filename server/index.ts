import 'dotenv/config';
import crypto from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { BookingStatus, Prisma, Role, TransportType } from '@prisma/client';
import { prisma } from './prisma.js';
import { fetchGooglePlacePhoto, geocodePlace, reverseGeocode, searchNearbyPlaces, searchOffers, searchTypedOffers } from './provider.js';
import { isEmailConfigured, sendPasswordResetEmail } from './mailer.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; email: string | null };
    }
  }
}

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters. Copy .env.example to .env and set a secure value.');
}

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false }));

type HttpError = Error & { status?: number; code?: string };
const asyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { void fn(req, res, next).catch(next); };

function sortOffers<T extends { priceMinor: number; departAt: Date; durationMin: number }>(offers: T[], sort: 'price' | 'departure' | 'duration'): T[] {
  const sorted = [...offers];
  if (sort === 'departure') sorted.sort((a, b) => a.departAt.getTime() - b.departAt.getTime());
  else if (sort === 'duration') sorted.sort((a, b) => a.durationMin - b.durationMin);
  else sorted.sort((a, b) => a.priceMinor - b.priceMinor);
  return sorted;
}

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');

function tokenFor(user: { id: string; role: Role; email: string | null }) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, jwtSecret!, { expiresIn: '12h' });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in to continue.', code: 'UNAUTHORIZED' });
  try {
    const claims = jwt.verify(token, jwtSecret!) as jwt.JwtPayload;
    if (typeof claims.sub !== 'string' || !Object.values(Role).includes(claims.role as Role)) throw new Error('Invalid claims');
    req.user = { id: claims.sub, role: claims.role as Role, email: String(claims.email) };
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.', code: 'INVALID_TOKEN' });
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN) return res.status(403).json({ error: 'Administrator access is required.', code: 'FORBIDDEN' });
  return next();
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: process.env.APP_MODE === 'live' ? 'live-unconfigured' : 'demo', timestamp: new Date().toISOString() }));

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(10).max(100),
  phone: z.string().trim().min(7).max(30).optional(),
}).refine((data) => data.email || data.phone, { message: 'Enter an email address or mobile number.', path: ['email'] });
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({ data: { name: data.name, email: data.email?.toLowerCase(), phone: data.phone, passwordHash }, select: { id: true, name: true, email: true, phone: true, role: true } });
  res.status(201).json({ user, token: tokenFor(user) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const data = z.object({ identifier: z.string().trim().min(3).max(254).optional(), email: z.string().trim().min(3).max(254).optional(), password: z.string().min(1).max(100) })
    .refine((value) => value.identifier || value.email, { message: 'Enter your email address or mobile number.' }).parse(req.body);
  const identifier = (data.identifier || data.email!).trim();
  const user = identifier.includes('@')
    ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
    : await prisma.user.findUnique({ where: { phone: identifier } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) return res.status(401).json({ error: 'Account identifier or password is incorrect.', code: 'INVALID_CREDENTIALS' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token: tokenFor(user) });
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true } });
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  return res.json({ user });
}));

app.patch('/api/auth/profile', requireAuth, asyncRoute(async (req, res) => {
  const data = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(30).optional() }).parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data, select: { id: true, name: true, email: true, phone: true, role: true } });
  res.json({ user });
}));

app.post('/api/auth/forgot-password', asyncRoute(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Password reset email delivery is not configured.', code: 'EMAIL_NOT_CONFIGURED' });
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user?.email) {
    const token = crypto.randomBytes(32).toString('hex');
    const digest = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: digest, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
    try {
      await sendPasswordResetEmail(user.email, token);
    } catch {
      console.error('Password reset email delivery failed', { code: 'EMAIL_DELIVERY_FAILED' });
    }
  }
  res.json({ message: 'If the account exists, password reset instructions will be sent.' });
}));

app.post('/api/auth/reset-password', asyncRoute(async (req, res) => {
  const data = z.object({ token: z.string().min(32).max(200), password: z.string().min(10).max(100) }).parse(req.body);
  const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return res.status(400).json({ error: 'This reset link is invalid or expired.' });
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await bcrypt.hash(data.password, 12) } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);
  res.json({ message: 'Password updated. You can now sign in.' });
}));

app.get('/api/destinations', asyncRoute(async (_req, res) => {
  res.json({ destinations: await prisma.destination.findMany({ orderBy: { featured: 'desc' } }) });
}));

app.get('/api/offers', asyncRoute(async (req, res) => {
  const query = z.object({
    type: z.nativeEnum(TransportType),
    origin: z.string().trim().min(2).max(100),
    destination: z.string().trim().min(2).max(100),
    date: z.string().datetime(),
    passengers: z.coerce.number().int().min(1).max(9).default(1),
    sort: z.enum(['price', 'departure', 'duration']).default('price'),
  }).parse(req.query);
  const offers = await searchOffers({ ...query, date: new Date(query.date) });
  const sorted = query.sort === 'departure' ? offers.sort((a, b) => a.departAt.getTime() - b.departAt.getTime())
    : query.sort === 'duration' ? offers.sort((a, b) => a.durationMin - b.durationMin) : offers;
  res.json({ offers: sorted, mode: process.env.APP_MODE === 'live' ? 'LIVE' : 'DEMO', currency: 'INR' });
}));

app.get('/api/trains/search', asyncRoute(async (req, res) => {
  const query = z.object({
    origin: z.string().trim().min(2).max(100), destination: z.string().trim().min(2).max(100),
    date: dateOnly, passengers: z.coerce.number().int().min(1).max(9).default(1),
    travelClass: z.string().trim().max(60).optional(), operator: z.string().trim().max(100).optional(),
    maxFareMinor: z.coerce.number().int().positive().optional(), maxDurationMin: z.coerce.number().int().positive().optional(),
    departureAfter: z.string().regex(/^(?:[01]\d|2[0-3])$/).optional(), departureBefore: z.string().regex(/^(?:[01]\d|2[0-3])$/).optional(),
    sort: z.enum(['price', 'departure', 'duration']).default('price'),
  }).refine((data) => data.origin.toLocaleLowerCase() !== data.destination.toLocaleLowerCase(), { message: 'Origin and destination must be different.' }).parse(req.query);
  const result = await searchTypedOffers(TransportType.TRAIN, { ...query, date: new Date(`${query.date}T00:00:00.000Z`) });
  res.json({ ...result, offers: sortOffers(result.offers, query.sort), mode: 'DEMO', refreshedAt: new Date().toISOString() });
}));

app.get('/api/buses/search', asyncRoute(async (req, res) => {
  const query = z.object({
    origin: z.string().trim().min(2).max(100), destination: z.string().trim().min(2).max(100),
    date: dateOnly, passengers: z.coerce.number().int().min(1).max(9).default(1),
    travelClass: z.string().trim().max(60).optional(), operator: z.string().trim().max(100).optional(),
    maxFareMinor: z.coerce.number().int().positive().optional(), maxDurationMin: z.coerce.number().int().positive().optional(),
    departureAfter: z.string().regex(/^(?:[01]\d|2[0-3])$/).optional(), departureBefore: z.string().regex(/^(?:[01]\d|2[0-3])$/).optional(),
    busType: z.string().trim().max(60).optional(), amenity: z.string().trim().max(60).optional(),
    sort: z.enum(['price', 'departure', 'duration']).default('price'),
  }).refine((data) => data.origin.toLocaleLowerCase() !== data.destination.toLocaleLowerCase(), { message: 'Origin and destination must be different.' }).parse(req.query);
  const result = await searchTypedOffers(TransportType.BUS, { ...query, date: new Date(`${query.date}T00:00:00.000Z`) });
  res.json({ ...result, offers: sortOffers(result.offers, query.sort), mode: 'DEMO', refreshedAt: new Date().toISOString() });
}));

app.get('/api/flights/search', asyncRoute(async (req, res) => {
  const query = z.object({
    origin: z.string().trim().min(2).max(100), destination: z.string().trim().min(2).max(100),
    date: dateOnly, passengers: z.coerce.number().int().min(1).max(9).default(1),
    travelClass: z.string().trim().max(60).optional(), operator: z.string().trim().max(100).optional(),
    maxFareMinor: z.coerce.number().int().positive().optional(), maxDurationMin: z.coerce.number().int().positive().optional(),
    departureAfter: z.string().regex(/^(?:[01]\d|2[0-3])$/).optional(), departureBefore: z.string().regex(/^(?:[01]\d|2[0-3])$/).optional(),
    stops: z.coerce.number().int().min(0).max(10).optional(), returnDate: dateOnly.optional(),
    sort: z.enum(['price', 'departure', 'duration']).default('price'),
  }).refine((data) => data.origin.toLocaleLowerCase() !== data.destination.toLocaleLowerCase(), { message: 'Origin and destination must be different.' })
    .refine((data) => !data.returnDate || data.returnDate >= data.date, { message: 'Return date must be on or after departure.' }).parse(req.query);
  const result = await searchTypedOffers(TransportType.FLIGHT, { ...query, date: new Date(`${query.date}T00:00:00.000Z`) }, Boolean(query.returnDate));
  res.json({ ...result, offers: sortOffers(result.offers, query.sort), returns: sortOffers(result.returns, query.sort), mode: 'DEMO', refreshedAt: new Date().toISOString() });
}));

app.get('/api/trains/:id', asyncRoute(async (req, res) => {
  const offer = await prisma.transportOffer.findFirst({ where: { id: req.params.id, type: TransportType.TRAIN }, include: { train: { include: { stops: { orderBy: { sequence: 'asc' } } } } } });
  if (!offer) return res.status(404).json({ error: 'Train option not found.' });
  return res.json({ offer, mode: 'DEMO' });
}));
app.get('/api/buses/:id', asyncRoute(async (req, res) => {
  const offer = await prisma.transportOffer.findFirst({ where: { id: req.params.id, type: TransportType.BUS }, include: { bus: { include: { seats: { orderBy: { code: 'asc' } } } } } });
  if (!offer) return res.status(404).json({ error: 'Bus option not found.' });
  return res.json({ offer, mode: 'DEMO' });
}));
app.get('/api/flights/:id', asyncRoute(async (req, res) => {
  const offer = await prisma.transportOffer.findFirst({ where: { id: req.params.id, type: TransportType.FLIGHT }, include: { flight: { include: { originAirport: true, destinationAirport: true } } } });
  if (!offer) return res.status(404).json({ error: 'Flight option not found.' });
  return res.json({ offer, mode: 'DEMO' });
}));

const geocodeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
app.get('/api/locations/search', geocodeLimiter, asyncRoute(async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(2).max(150) }).parse(req.query);
  const places = await geocodePlace(q);
  res.json({ places: places.map((place) => ({
    name: place.address?.city || place.address?.town || place.address?.village || place.address?.county || place.display_name.split(',')[0],
    displayName: place.display_name, lat: Number(place.lat), lon: Number(place.lon),
  })) });
}));
app.get('/api/locations/reverse', geocodeLimiter, asyncRoute(async (req, res) => {
  const { lat, lon } = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) }).parse(req.query);
  const place = await reverseGeocode(lat, lon);
  const address = place.address || {};
  res.json({ name: address.city || address.town || address.village || address.county || address.state || place.display_name?.split(',')[0] || 'Selected map point', displayName: place.display_name || '', lat, lon });
}));
const nearbyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
app.get('/api/locations/nearby', nearbyLimiter, asyncRoute(async (req, res) => {
  const query = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().int().min(500).max(10000).default(3000),
  }).parse(req.query);
  res.json(await searchNearbyPlaces(query.lat, query.lon, query.radius));
}));
const placePhotoLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false });
app.get('/api/locations/photo', placePhotoLimiter, asyncRoute(async (req, res) => {
  const { name } = z.object({ name: z.string().min(10).max(500) }).parse(req.query);
  const { photo, contentType } = await fetchGooglePlacePhoto(name);
  res.set({ 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(photo);
}));

app.get('/api/offers/:id', asyncRoute(async (req, res) => {
  const offer = await prisma.transportOffer.findUnique({ where: { id: req.params.id }, include: { train: { include: { stops: { orderBy: { sequence: 'asc' } } } }, bus: { include: { seats: { orderBy: { code: 'asc' } } } }, flight: { include: { originAirport: true, destinationAirport: true } } } });
  if (!offer) return res.status(404).json({ error: 'Travel option not found.' });
  return res.json({ offer, mode: offer.demo ? 'DEMO' : 'LIVE' });
}));

const bookingInput = z.object({
  offerId: z.string().min(1),
  passengerName: z.string().trim().min(2).max(100),
  passengerEmail: z.string().email().max(254),
  passengerPhone: z.string().trim().max(30).optional(),
  seatCode: z.string().trim().max(20).optional(),
  seatCodes: z.array(z.string().trim().min(1).max(20)).max(9).optional(),
  passengers: z.array(z.object({ name: z.string().trim().min(2).max(100), age: z.number().int().min(0).max(120).optional() })).min(1).max(9),
});
app.post('/api/bookings', requireAuth, asyncRoute(async (req, res) => {
  const input = bookingInput.parse(req.body);
  const idempotencyKey = String(req.headers['idempotency-key'] || '');
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) return res.status(400).json({ error: 'A valid Idempotency-Key header is required.' });
  const existing = await prisma.booking.findUnique({ where: { userId_idempotencyKey: { userId: req.user!.id, idempotencyKey } }, include: { offer: true, payment: true } });
  if (existing) return res.status(200).json({ booking: existing, idempotentReplay: true });

  const reference = `TRV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const offer = await prisma.transportOffer.findUnique({ where: { id: input.offerId } });
  if (!offer || offer.departAt <= new Date()) return res.status(404).json({ error: 'This travel option is no longer available.' });
  if (process.env.APP_MODE === 'live') return res.status(503).json({ error: 'Live booking is not enabled because no authorized provider booking adapter is configured.' });
  if (input.passengers.length > offer.available) return res.status(409).json({ error: 'Not enough seats are available for this party.' });
  const seatCodes = input.seatCodes || (input.seatCode ? [input.seatCode] : []);
  if (offer.type === TransportType.BUS && seatCodes.length !== input.passengers.length) {
    return res.status(400).json({ error: 'Choose one available bus seat for each passenger.' });
  }
  if (new Set(seatCodes).size !== seatCodes.length) return res.status(400).json({ error: 'Choose a different seat for each passenger.' });

  try {
    const booking = await prisma.$transaction(async (tx) => {
      let busSeatIds: string[] = [];
      if (offer.type === TransportType.BUS) {
        const schedule = await tx.busSchedule.findUnique({ where: { offerId: offer.id } });
        if (!schedule) throw Object.assign(new Error('Bus seat inventory is unavailable.'), { status: 409, code: 'SEAT_INVENTORY_UNAVAILABLE' });
        const selectedSeats = await tx.busSeat.findMany({ where: { busId: schedule.id, code: { in: seatCodes }, available: true } });
        if (selectedSeats.length !== seatCodes.length) throw Object.assign(new Error('One or more seats were just booked. Please choose again.'), { status: 409, code: 'SEAT_UNAVAILABLE' });
        busSeatIds = selectedSeats.map((seat) => seat.id);
        const reserved = await tx.busSeat.updateMany({ where: { id: { in: busSeatIds }, available: true }, data: { available: false } });
        if (reserved.count !== busSeatIds.length) throw Object.assign(new Error('One or more seats were just booked. Please choose again.'), { status: 409, code: 'SEAT_UNAVAILABLE' });
      }
      const inventory = await tx.transportOffer.updateMany({ where: { id: offer.id, available: { gte: input.passengers.length } }, data: { available: { decrement: input.passengers.length } } });
      if (inventory.count !== 1) throw Object.assign(new Error('Availability changed. Search again and choose another option.'), { status: 409, code: 'INVENTORY_CHANGED' });
      return tx.booking.create({
        data: {
          reference, userId: req.user!.id, offerId: offer.id, amountMinor: offer.priceMinor * input.passengers.length,
          currency: offer.currency, idempotencyKey, passengerName: input.passengerName,
          passengerEmail: input.passengerEmail.toLowerCase(), passengerPhone: input.passengerPhone,
          seatCode: seatCodes[0], demo: true,
          passengers: { create: input.passengers.map((p) => ({ ...p })) },
          ...(busSeatIds.length ? { seatAssignments: { create: busSeatIds.map((busSeatId) => ({ busSeatId })) } } : {}),
          payment: { create: { amountMinor: offer.priceMinor * input.passengers.length } },
        },
        include: { offer: true, passengers: true, payment: true },
      });
    });
    await prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'BOOKING_CREATED', entity: 'Booking', entityId: booking.id } });
    return res.status(201).json({ booking });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replay = await prisma.booking.findUnique({ where: { userId_idempotencyKey: { userId: req.user!.id, idempotencyKey } }, include: { offer: true, payment: true } });
      if (replay) return res.status(200).json({ booking: replay, idempotentReplay: true });
      return res.status(409).json({ error: 'This seat is no longer available.' });
    }
    throw error;
  }
}));

app.get('/api/bookings', requireAuth, asyncRoute(async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const bookings = await prisma.booking.findMany({
    where: req.user!.role === Role.ADMIN ? undefined : { userId: req.user!.id },
    include: { offer: true, payment: true, passengers: true, cancellation: true },
    orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20,
  });
  res.json({ bookings, page, pageSize: 20 });
}));

app.get('/api/bookings/:reference', requireAuth, asyncRoute(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { reference: req.params.reference }, include: { offer: true, payment: true, passengers: true, cancellation: true } });
  if (!booking || (booking.userId !== req.user!.id && req.user!.role !== Role.ADMIN)) return res.status(404).json({ error: 'Booking not found.' });
  res.json({ booking });
}));

app.post('/api/bookings/:reference/gift', requireAuth, asyncRoute(async (req, res) => {
  const { giftChoice } = z.object({ giftChoice: z.enum(['welcome', 'trail', 'celebration']) }).parse(req.body);
  const booking = await prisma.booking.findUnique({ where: { reference: req.params.reference }, include: { payment: true, offer: true } });
  if (!booking || booking.userId !== req.user!.id) return res.status(404).json({ error: 'Booking not found.' });
  if (process.env.APP_MODE === 'live' || !booking.demo) return res.status(503).json({ error: 'Gift fulfilment is unavailable until an approved fulfilment provider is configured.' });
  if (booking.status !== BookingStatus.CONFIRMED || booking.payment?.status !== 'VERIFIED' || booking.offer.departAt <= new Date()) {
    return res.status(409).json({ error: 'Gift hampers are available only for confirmed, paid demo bookings before departure.' });
  }
  const updated = await prisma.booking.updateMany({
    where: { id: booking.id, status: BookingStatus.CONFIRMED, demo: true },
    data: { giftChoice },
  });
  if (!updated.count) return res.status(409).json({ error: 'This booking is no longer eligible for a gift hamper.' });
  const savedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { offer: true, payment: true } });
  res.json({ booking: savedBooking, demo: true });
}));

app.post('/api/bookings/:reference/demo-payment', requireAuth, asyncRoute(async (req, res) => {
  if (process.env.APP_MODE === 'live') return res.status(503).json({ error: 'Demo payments are disabled in live mode. Configure a signed payment-provider adapter.' });
  const booking = await prisma.booking.findUnique({ where: { reference: req.params.reference }, include: { payment: true } });
  if (!booking || booking.userId !== req.user!.id) return res.status(404).json({ error: 'Booking not found.' });
  if (booking.status === BookingStatus.CONFIRMED && booking.payment?.status === 'VERIFIED') return res.json({ booking, alreadyPaid: true });
  if (!booking.payment || booking.status !== BookingStatus.PENDING) return res.status(409).json({ error: 'This booking cannot be paid.' });
  const confirmed = await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { bookingId: booking.id }, data: { status: 'VERIFIED', verifiedAt: new Date(), providerReference: `DEMO-${crypto.randomBytes(5).toString('hex').toUpperCase()}` } });
    return tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CONFIRMED }, include: { offer: true, payment: true, passengers: true } });
  });
  await prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'DEMO_PAYMENT_VERIFIED', entity: 'Booking', entityId: booking.id } });
  res.json({ booking: confirmed, demo: true });
}));

app.post('/api/bookings/:reference/cancel', requireAuth, asyncRoute(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { reference: req.params.reference }, include: { offer: true, payment: true } });
  if (!booking || (booking.userId !== req.user!.id && req.user!.role !== Role.ADMIN)) return res.status(404).json({ error: 'Booking not found.' });
  if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) return res.status(409).json({ error: 'This booking can no longer be cancelled.' });
  if (booking.offer.departAt <= new Date()) return res.status(409).json({ error: 'Travel that has already departed cannot be cancelled.' });
  const refundMinor = booking.payment?.status === 'VERIFIED' ? booking.amountMinor : 0;
  const updated = await prisma.$transaction(async (tx) => {
    const status = refundMinor > 0 ? BookingStatus.REFUNDED : BookingStatus.CANCELLED;
    const result = await tx.booking.update({ where: { id: booking.id }, data: { status, seatCode: null }, include: { offer: true, payment: true } });
    await tx.cancellation.create({ data: { bookingId: booking.id, reason: 'Customer requested cancellation', refundMinor } });
    const assignments = await tx.bookingSeat.findMany({ where: { bookingId: booking.id }, select: { busSeatId: true } });
    if (assignments.length) {
      await tx.busSeat.updateMany({ where: { id: { in: assignments.map(({ busSeatId }) => busSeatId) } }, data: { available: true } });
      await tx.bookingSeat.deleteMany({ where: { bookingId: booking.id } });
    }
    await tx.transportOffer.update({ where: { id: booking.offerId }, data: { available: { increment: await tx.bookingPassenger.count({ where: { bookingId: booking.id } }) } } });
    if (refundMinor > 0) {
      await tx.payment.update({ where: { bookingId: booking.id }, data: { status: 'REFUNDED' } });
      await tx.refund.create({ data: { bookingId: booking.id, amountMinor: refundMinor, status: process.env.APP_MODE === 'demo' ? 'DEMO_REFUNDED' : 'PENDING' } });
    }
    return result;
  });
  await prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'BOOKING_CANCELLED', entity: 'Booking', entityId: booking.id } });
  res.json({ booking: updated, refundMinor, demo: booking.demo });
}));

app.post('/api/reviews', requireAuth, asyncRoute(async (req, res) => {
  const data = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().min(5).max(1000) }).parse(req.body);
  const review = await prisma.review.create({ data: { ...data, userId: req.user!.id } });
  res.status(201).json({ review });
}));

app.get('/api/admin/stats', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  const [users, bookings, recentBookings, statuses, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.booking.count(),
    prisma.booking.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } }, offer: true } }),
    prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.payment.aggregate({ where: { status: 'VERIFIED' }, _sum: { amountMinor: true } }),
  ]);
  res.json({ users, bookings, recentBookings, statuses, verifiedRevenueMinor: revenue._sum.amountMinor || 0, mode: process.env.APP_MODE || 'demo' });
}));

app.get('/api/admin/users', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 });
  res.json({ users, page });
}));

app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const { role } = z.object({ role: z.nativeEnum(Role) }).parse(req.body);
  if (req.params.id === req.user!.id && role !== Role.ADMIN) return res.status(400).json({ error: 'You cannot remove your own administrator role.' });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role }, select: { id: true, name: true, email: true, role: true } });
  await prisma.auditLog.create({ data: { actorId: req.user!.id, action: `ROLE_SET_${role}`, entity: 'User', entityId: user.id } });
  res.json({ user });
}));

app.get('/api/admin/providers', requireAuth, requireAdmin, asyncRoute(async (_req, res) => {
  res.json({ mode: process.env.APP_MODE || 'demo', providers: await prisma.provider.findMany() });
}));

app.get('/api/admin/offers', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const offers = await prisma.transportOffer.findMany({ orderBy: [{ departAt: 'asc' }, { type: 'asc' }], skip: (page - 1) * 50, take: 50 });
  res.json({ offers, page, pageSize: 50 });
}));

const adminOfferSchema = z.object({
  type: z.nativeEnum(TransportType),
  provider: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(30),
  origin: z.string().trim().min(2).max(100),
  destination: z.string().trim().min(2).max(100),
  departAt: z.string().datetime(),
  arriveAt: z.string().datetime(),
  durationMin: z.number().int().positive().max(10080),
  priceMinor: z.number().int().positive(),
  currency: z.string().length(3).default('INR'),
  class: z.string().trim().min(2).max(60),
  capacity: z.number().int().positive().max(1000),
  available: z.number().int().min(0).max(1000),
  stops: z.number().int().min(0).max(30).default(0),
  amenities: z.string().max(500).default(''),
}).refine((data) => new Date(data.arriveAt) > new Date(data.departAt), { message: 'Arrival must follow departure.', path: ['arriveAt'] })
  .refine((data) => new Date(data.departAt) > new Date(), { message: 'Departure must be in the future.', path: ['departAt'] })
  .refine((data) => data.available <= data.capacity, { message: 'Available places cannot exceed capacity.', path: ['available'] });

app.post('/api/admin/offers', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (process.env.APP_MODE === 'live') return res.status(403).json({ error: 'Admin-created listings are limited to demo mode; live confirmation must come from a provider.', code: 'LIVE_PROVIDER_PROTECTED' });
  const data = adminOfferSchema.parse(req.body);
  const offer = await prisma.transportOffer.create({ data: { ...data, departAt: new Date(data.departAt), arriveAt: new Date(data.arriveAt), demo: true } });
  await prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'DEMO_OFFER_CREATED', entity: 'TransportOffer', entityId: offer.id } });
  res.status(201).json({ offer });
}));

app.patch('/api/admin/offers/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (process.env.APP_MODE === 'live') return res.status(403).json({ error: 'Live provider data cannot be changed through the demo admin tools.', code: 'LIVE_PROVIDER_PROTECTED' });
  const data = z.object({
    priceMinor: z.number().int().positive().optional(),
    available: z.number().int().min(0).max(1000).optional(),
    class: z.string().trim().min(2).max(60).optional(),
  }).refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update.' }).parse(req.body);
  const current = await prisma.transportOffer.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: 'Demo travel option not found.' });
  if (data.available !== undefined && data.available > current.capacity) return res.status(400).json({ error: 'Available places cannot exceed capacity.' });
  const offer = await prisma.transportOffer.update({ where: { id: current.id }, data });
  await prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'DEMO_OFFER_UPDATED', entity: 'TransportOffer', entityId: offer.id } });
  res.json({ offer });
}));

app.use((error: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Please check the submitted information.', code: 'VALIDATION_ERROR', details: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'This information is already in use.', code: 'CONFLICT' });
  const status = error.status || 500;
  if (status >= 500) console.error('API error', { code: error.code || 'INTERNAL_ERROR', errorType: error.name });
  const safeProviderMessage = error.code?.startsWith('NEARBY_PLACES_') ? error.message : null;
  return res.status(status).json({ error: status >= 500 && !safeProviderMessage ? 'Something went wrong. Please try again.' : error.message, code: error.code || 'REQUEST_FAILED' });
});

const server = app.listen(port, () => console.info(`Traverse Elite API listening on http://localhost:${port}`));
const shutdown = async () => { server.close(); await prisma.$disconnect(); };
process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
