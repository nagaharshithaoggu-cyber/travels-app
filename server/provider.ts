import { Prisma, TransportType } from '@prisma/client';
import { prisma } from './prisma.js';

export type SearchInput = {
  type: TransportType;
  origin: string;
  destination: string;
  date: Date;
  passengers: number;
};

export type TypedSearchInput = Omit<SearchInput, 'type'> & {
  travelClass?: string;
  operator?: string;
  maxFareMinor?: number;
  maxDurationMin?: number;
  departureAfter?: string;
  departureBefore?: string;
  stops?: number;
  busType?: string;
  amenity?: string;
  returnDate?: string;
};

const includesFor = {
  TRAIN: { train: { include: { stops: { orderBy: { sequence: 'asc' as const } } } } },
  BUS: { bus: { include: { seats: { orderBy: { code: 'asc' as const } } } } },
  FLIGHT: { flight: { include: { originAirport: true, destinationAirport: true } } },
};

export async function searchOffers(input: SearchInput) {
  if (process.env.APP_MODE === 'live') {
    throw Object.assign(new Error('Live provider search is not configured. Configure an authorized provider adapter first.'), {
      status: 503,
      code: 'LIVE_PROVIDER_UNAVAILABLE',
    });
  }

  const nextDay = new Date(input.date);
  nextDay.setDate(nextDay.getDate() + 1);
  return prisma.transportOffer.findMany({
    where: {
      type: input.type,
      origin: { contains: input.origin },
      destination: { contains: input.destination },
      departAt: { gte: input.date, lt: nextDay },
      available: { gte: input.passengers },
    },
    orderBy: [{ priceMinor: 'asc' }, { departAt: 'asc' }],
  });
}

export async function searchTypedOffers(type: TransportType, input: TypedSearchInput, returnTrip = false) {
  if (process.env.APP_MODE === 'live') {
    throw Object.assign(new Error(`${type.toLowerCase()} live provider search is not configured. Configure an authorized provider adapter first.`), {
      status: 503,
      code: 'LIVE_PROVIDER_UNAVAILABLE',
    });
  }

  const start = new Date(`${input.date.toISOString().slice(0, 10)}T00:00:00.000Z`);
  start.setUTCMinutes(start.getUTCMinutes() - 330);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const where: Prisma.TransportOfferWhereInput = {
    type,
    AND: [
      { OR: [
        { origin: { contains: input.origin.trim() } },
        ...(type === TransportType.TRAIN ? [
          { train: { is: { originStationCode: { contains: input.origin.trim() } } } },
        ] : []),
        ...(type === TransportType.FLIGHT ? [
          { flight: { is: { originAirportCode: { contains: input.origin.trim() } } } },
          { flight: { is: { originAirport: { city: { contains: input.origin.trim() } } } } },
        ] : []),
      ] },
      { OR: [
        { destination: { contains: input.destination.trim() } },
        ...(type === TransportType.TRAIN ? [
          { train: { is: { destinationStationCode: { contains: input.destination.trim() } } } },
        ] : []),
        ...(type === TransportType.FLIGHT ? [
          { flight: { is: { destinationAirportCode: { contains: input.destination.trim() } } } },
          { flight: { is: { destinationAirport: { city: { contains: input.destination.trim() } } } } },
        ] : []),
      ] },
    ],
    departAt: { gte: start, lt: end },
    available: { gte: input.passengers },
    ...(input.travelClass ? { class: { contains: input.travelClass } } : {}),
    ...(input.operator ? { provider: { contains: input.operator } } : {}),
    ...(input.maxFareMinor !== undefined ? { priceMinor: { lte: input.maxFareMinor } } : {}),
    ...(input.maxDurationMin !== undefined ? { durationMin: { lte: input.maxDurationMin } } : {}),
    ...(input.stops !== undefined ? { stops: input.stops } : {}),
    ...(input.amenity ? { amenities: { contains: input.amenity } } : {}),
    ...(type === TransportType.TRAIN ? { train: { isNot: null } } : {}),
    ...(type === TransportType.BUS ? { bus: input.busType ? { is: { busType: { contains: input.busType } } } : { isNot: null } } : {}),
    ...(type === TransportType.FLIGHT ? { flight: { isNot: null } } : {}),
  };
  const offers = await prisma.transportOffer.findMany({
    where,
    include: includesFor[type],
    orderBy: [{ priceMinor: 'asc' }, { departAt: 'asc' }],
  });
  const withinTimeRange = (departure: Date, startHour: string | undefined, endHour: string | undefined) => {
    const indiaMinutes = (departure.getUTCHours() * 60 + departure.getUTCMinutes() + 330) % 1440;
    return (startHour === undefined || indiaMinutes >= Number(startHour) * 60) &&
      (endHour === undefined || indiaMinutes < Number(endHour) * 60);
  };
  const filtered = offers.filter((offer) => withinTimeRange(offer.departAt, input.departureAfter, input.departureBefore));

  if (type === TransportType.FLIGHT && returnTrip && input.returnDate) {
    const returnStart = new Date(`${input.returnDate}T00:00:00.000Z`);
    returnStart.setUTCMinutes(returnStart.getUTCMinutes() - 330);
    const returnEnd = new Date(returnStart);
    returnEnd.setUTCDate(returnEnd.getUTCDate() + 1);
    const returns = await prisma.transportOffer.findMany({
      where: {
        type: TransportType.FLIGHT,
        origin: { contains: input.destination.trim() },
        destination: { contains: input.origin.trim() },
        departAt: { gte: returnStart, lt: returnEnd },
        available: { gte: input.passengers },
        ...(input.travelClass ? { class: { contains: input.travelClass } } : {}),
        ...(input.operator ? { provider: { contains: input.operator } } : {}),
        ...(input.maxFareMinor !== undefined ? { priceMinor: { lte: input.maxFareMinor } } : {}),
        ...(input.maxDurationMin !== undefined ? { durationMin: { lte: input.maxDurationMin } } : {}),
        ...(input.stops !== undefined ? { stops: input.stops } : {}),
        flight: { isNot: null },
      },
      include: includesFor.FLIGHT,
      orderBy: [{ priceMinor: 'asc' }, { departAt: 'asc' }],
    });
    return { offers: filtered, returns: returns.filter((offer) => withinTimeRange(offer.departAt, input.departureAfter, input.departureBefore)) };
  }
  return { offers: filtered, returns: [] };
}

let geocodeQueue: Promise<void> = Promise.resolve();
let lastGeocodeRequest = 0;
async function requestGeocoder<T>(url: URL): Promise<T> {
  let releaseQueue!: () => void;
  const previous = geocodeQueue;
  geocodeQueue = new Promise<void>((resolve) => { releaseQueue = resolve; });
  await previous;
  const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeRequest));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  try {
    lastGeocodeRequest = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': process.env.GEOCODING_USER_AGENT || 'TraverseElite/1.0 (location search; configure GEOCODING_USER_AGENT)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Object.assign(new Error('Place lookup is temporarily unavailable. Enter the city or station manually.'), { status: 502, code: 'GEOCODING_UNAVAILABLE' });
    return await response.json() as T;
  } finally {
    releaseQueue();
  }
}

export async function geocodePlace(query: string) {
  const url = new URL('/search', process.env.GEOCODING_API_URL || 'https://nominatim.openstreetmap.org');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');
  return requestGeocoder<Array<{ lat: string; lon: string; display_name: string; address?: Record<string, string> }>>(url);
}

export async function reverseGeocode(lat: number, lon: number) {
  const url = new URL('/reverse', process.env.GEOCODING_API_URL || 'https://nominatim.openstreetmap.org');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '10');
  return requestGeocoder<{ display_name?: string; address?: Record<string, string> }>(url);
}

export type NearbyPlace = {
  id: string;
  name: string;
  category: 'Food court' | 'Restaurant' | 'Cafe' | 'Pharmacy' | 'Medical shop';
  lat: number;
  lon: number;
  distanceMeters: number;
  address?: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
  openNow?: boolean;
  openingHours?: string[];
  mapsUrl?: string;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const distanceBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export async function searchNearbyPlaces(lat: number, lon: number, radius: number) {
  const googleKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (googleKey) {
    let response: Response;
    try {
      response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.currentOpeningHours.weekdayDescriptions,places.photos.name,places.photos.authorAttributions,places.googleMapsUri,places.primaryType,places.types',
        },
        body: JSON.stringify({
          includedTypes: ['food_court', 'restaurant', 'cafe', 'pharmacy', 'drugstore'],
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: { circle: { center: { latitude: lat, longitude: lon }, radius } },
        }),
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      if (error instanceof Error) throw Object.assign(new Error('Google Places is temporarily unreachable. Try again shortly.'), { status: 502, code: 'NEARBY_PLACES_UNAVAILABLE', cause: error });
      throw error;
    }
    if (!response.ok) throw Object.assign(new Error('Google Places could not return nearby results. Check the configured Places API key and billing.'), { status: 502, code: 'NEARBY_PLACES_UNAVAILABLE' });
    let result: {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        rating?: number;
        userRatingCount?: number;
        currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
        photos?: Array<{ name?: string; authorAttributions?: Array<{ displayName?: string; uri?: string }> }>;
        googleMapsUri?: string;
        primaryType?: string;
        types?: string[];
      }>;
    };
    try {
      result = await response.json() as typeof result;
    } catch (error) {
      throw Object.assign(new Error('Google Places returned an unreadable response.'), { status: 502, code: 'NEARBY_PLACES_UNAVAILABLE', cause: error });
    }
    if (result.places !== undefined && !Array.isArray(result.places)) throw Object.assign(new Error('Google Places returned an invalid response.'), { status: 502, code: 'NEARBY_PLACES_UNAVAILABLE' });
    const places = (result.places || []).flatMap((place): NearbyPlace[] => {
      const placeLat = place.location?.latitude;
      const placeLon = place.location?.longitude;
      const name = place.displayName?.text;
      const placeTypes = ['food_court', 'restaurant', 'fast_food_restaurant', 'cafe', 'pharmacy', 'drugstore'];
      const type = placeTypes.includes(place.primaryType || '')
        ? place.primaryType
        : place.types?.find((value) => placeTypes.includes(value));
      const category: NearbyPlace['category'] | null = type === 'food_court' ? 'Food court' :
        type === 'restaurant' || type === 'fast_food_restaurant' ? 'Restaurant' : type === 'cafe' ? 'Cafe' :
          type === 'pharmacy' ? 'Pharmacy' : type === 'drugstore' ? 'Medical shop' : null;
      if (!place.id || !name || placeLat === undefined || placeLon === undefined || !category) return [];
      const distanceMeters = distanceBetween(lat, lon, placeLat, placeLon);
      if (!Number.isFinite(distanceMeters) || distanceMeters > radius) return [];
      const photo = place.photos?.[0];
      const photoName = photo?.name;
      return [{
        id: place.id,
        name,
        category,
        lat: placeLat,
        lon: placeLon,
        distanceMeters: Math.round(distanceMeters),
        ...(place.formattedAddress ? { address: place.formattedAddress } : {}),
        ...(typeof place.rating === 'number' ? { rating: place.rating } : {}),
        ...(typeof place.userRatingCount === 'number' ? { ratingCount: place.userRatingCount } : {}),
        ...(typeof place.currentOpeningHours?.openNow === 'boolean' ? { openNow: place.currentOpeningHours.openNow } : {}),
        ...(place.currentOpeningHours?.weekdayDescriptions ? { openingHours: place.currentOpeningHours.weekdayDescriptions } : {}),
        ...(photoName ? { imageUrl: `/api/locations/photo?name=${encodeURIComponent(photoName)}` } : {}),
        ...(photo?.authorAttributions?.length ? { photoAttribution: photo.authorAttributions.flatMap((attribution) => {
          if (!attribution.displayName) return [];
          if (!attribution.uri) return [{ displayName: attribution.displayName }];
          try {
            const uri = new URL(attribution.uri);
            return uri.protocol === 'https:' ? [{ displayName: attribution.displayName, uri: uri.toString() }] : [];
          } catch { return []; }
        }) } : {}),
        ...(place.googleMapsUri ? { mapsUrl: place.googleMapsUri } : {}),
      }];
    });
    return { places: places.sort((first, second) => first.distanceMeters - second.distanceMeters), source: 'Google Places', snapshotAt: null };
  }

  const query = `[out:json][timeout:20];(nwr(around:${radius},${lat},${lon})[amenity=food_court];nwr(around:${radius},${lat},${lon})[amenity=restaurant];nwr(around:${radius},${lat},${lon})[amenity=cafe];nwr(around:${radius},${lat},${lon})[amenity=pharmacy];nwr(around:${radius},${lat},${lon})[amenity=fast_food];nwr(around:${radius},${lat},${lon})[shop=chemist];nwr(around:${radius},${lat},${lon})[shop=pharmacy];);out center tags qt;`;
  const endpoints = [...new Set([
    process.env.NEARBY_API_URL?.trim() || 'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ])];
  let result: { elements?: OverpassElement[]; osm3s?: { timestamp_osm_base?: string }; remark?: string } | undefined;
  let successfulHost = '';
  let sawBusyEndpoint = false;
  let sawTimeout = false;
  for (const endpoint of endpoints) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': process.env.GEOCODING_USER_AGENT || 'TraverseElite/1.0 (OpenStreetMap nearby places)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      if (timedOut) sawTimeout = true;
      console.warn('Nearby Overpass endpoint request failed', {
        host: new URL(endpoint).host,
        failure: timedOut ? 'timeout' : 'unavailable',
      });
      continue;
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 180);
      if (response.status === 408 || response.status === 504) sawTimeout = true;
      if (response.status === 429 || response.status === 502 || response.status === 503) sawBusyEndpoint = true;
      console.warn('Nearby Overpass endpoint returned an error', {
        host: new URL(endpoint).host,
        status: response.status,
        detail,
      });
      continue;
    }
    try {
      const parsed = await response.json() as typeof result;
      if (!parsed || (parsed.elements !== undefined && !Array.isArray(parsed.elements))) {
        console.warn('Nearby Overpass endpoint returned an invalid response', { host: new URL(endpoint).host });
        continue;
      }
      if (parsed.remark) {
        sawTimeout = true;
        console.warn('Nearby Overpass query was rejected', {
          host: new URL(endpoint).host,
          detail: parsed.remark.slice(0, 180),
        });
        continue;
      }
      result = parsed;
      successfulHost = new URL(endpoint).host;
      break;
    } catch {
      console.warn('Nearby Overpass endpoint returned unreadable JSON', { host: new URL(endpoint).host });
    }
  }
  if (!result) {
    if (sawTimeout) throw Object.assign(new Error('Nearby OpenStreetMap searches timed out. Try a smaller radius or try again shortly.'), { status: 504, code: 'NEARBY_PLACES_TIMEOUT' });
    if (sawBusyEndpoint) throw Object.assign(new Error('Nearby OpenStreetMap services are busy right now. Please try again shortly.'), { status: 503, code: 'NEARBY_PLACES_BUSY' });
    throw Object.assign(new Error('Nearby OpenStreetMap services are temporarily unreachable. Please try again shortly.'), { status: 502, code: 'NEARBY_PLACES_UNAVAILABLE' });
  }
  const byCategory = (tags: Record<string, string>): NearbyPlace['category'] | null => {
    if (tags.shop === 'chemist') return 'Medical shop';
    if (tags.amenity === 'pharmacy' || tags.shop === 'pharmacy') return 'Pharmacy';
    if (tags.amenity === 'food_court') return 'Food court';
    if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'Restaurant';
    if (tags.amenity === 'cafe') return 'Cafe';
    return null;
  };
  const places = (result.elements || []).flatMap((element): NearbyPlace[] => {
    const tags = element.tags || {};
    const category = byCategory(tags);
    const point = element.center || (element.lat !== undefined && element.lon !== undefined ? { lat: element.lat, lon: element.lon } : null);
    const name = tags.name || tags['name:en'] || tags.brand || tags.operator;
    if (!category || !point || !name) return [];
    const address = [
      tags['addr:housenumber'], tags['addr:street'] || tags['addr:place'],
      tags['addr:suburb'] || tags['addr:neighbourhood'],
      tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
      tags['addr:postcode'],
    ].filter(Boolean).join(' ');
    const distanceMeters = distanceBetween(lat, lon, point.lat, point.lon);
    if (!Number.isFinite(distanceMeters) || distanceMeters > radius) return [];
    const rawRating = tags.stars || tags.rating;
    const ratingValue = rawRating ? Number(rawRating) : Number.NaN;
    const rawImage = tags.image || tags.wikimedia_commons;
    let imageUrl: string | undefined;
    if (rawImage) {
      try {
        const commonsFile = rawImage.startsWith('File:')
          ? rawImage.slice(5)
          : rawImage.match(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:(.+)$/)?.[1];
        const parsed = new URL(commonsFile
          ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(commonsFile))}`
          : rawImage);
        if (parsed.protocol === 'https:') imageUrl = parsed.toString();
      } catch { /* Ignore malformed community image tags. */ }
    }
    return [{
      id: `${element.type}/${element.id}`, name, category, lat: point.lat, lon: point.lon,
      distanceMeters: Math.round(distanceMeters),
      ...(address ? { address } : {}),
      ...(Number.isFinite(ratingValue) && ratingValue >= 0 && ratingValue <= 5 ? { rating: ratingValue } : {}),
      ...(tags.opening_hours ? { openingHours: [tags.opening_hours] } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      mapsUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    }];
  });
  const uniquePlaces = [...new Map(places.map((place) => [place.id, place])).values()]
    .sort((first, second) => first.distanceMeters - second.distanceMeters)
    .slice(0, 100);
  console.info('Nearby Overpass search succeeded', {
    host: successfulHost,
    returnedElements: result.elements?.length || 0,
    matchedPlaces: uniquePlaces.length,
  });
  return { places: uniquePlaces.sort((first, second) => first.distanceMeters - second.distanceMeters), source: 'OpenStreetMap contributors', snapshotAt: result.osm3s?.timestamp_osm_base || null };
}

export async function fetchGooglePlacePhoto(name: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) throw Object.assign(new Error('Google Places photos are not configured.'), { status: 503, code: 'PLACES_PHOTOS_UNAVAILABLE' });
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) {
    throw Object.assign(new Error('Invalid place photo reference.'), { status: 400, code: 'INVALID_PHOTO_REFERENCE' });
  }
  const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
  url.searchParams.set('maxWidthPx', '800');
  url.searchParams.set('key', key);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch (error) {
    if (error instanceof Error) throw Object.assign(new Error('This place photo is temporarily unavailable.'), { status: 502, code: 'PLACES_PHOTOS_UNAVAILABLE', cause: error });
    throw error;
  }
  if (!response.ok) throw Object.assign(new Error('This place photo is temporarily unavailable.'), { status: 502, code: 'PLACES_PHOTOS_UNAVAILABLE' });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw Object.assign(new Error('The place photo provider returned an unsupported response.'), { status: 502, code: 'PLACES_PHOTOS_UNAVAILABLE' });
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 5_000_000) throw Object.assign(new Error('The place photo is too large to display.'), { status: 502, code: 'PLACES_PHOTOS_UNAVAILABLE' });
  let photo: Buffer;
  try {
    photo = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof Error) throw Object.assign(new Error('This place photo could not be read.'), { status: 502, code: 'PLACES_PHOTOS_UNAVAILABLE', cause: error });
    throw error;
  }
  if (photo.byteLength > 5_000_000) throw Object.assign(new Error('The place photo is too large to display.'), { status: 502, code: 'PLACES_PHOTOS_UNAVAILABLE' });
  return { photo, contentType };
}
