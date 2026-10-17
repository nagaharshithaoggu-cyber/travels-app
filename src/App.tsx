import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, ArrowRight, BadgeCheck, BusFront, CalendarDays, Check, ChevronDown, Clock3, CreditCard,
  Eye, EyeOff, Heart, LifeBuoy, LocateFixed, LogIn, MapPin, Menu, Plane, RefreshCw, Search, ShieldCheck,
  Sparkles, TrainFront, Users, X, Utensils, Pill, Gift,
} from 'lucide-react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDuration as durationLabel, formatMoney as money, validateRouteSearch } from './travel';

type User = { id: string; name: string; email: string | null; role: 'USER' | 'ADMIN'; phone?: string | null };
type Offer = {
  id: string; type: 'TRAIN' | 'BUS' | 'FLIGHT'; provider: string; code: string; origin: string; destination: string;
  departAt: string; arriveAt: string; durationMin: number; priceMinor: number; currency: string; class: string;
  available: number; stops: number; amenities: string; demo: boolean;
  train?: { trainName: string; trainNumber: string; runningDays: string; originStationCode: string; destinationStationCode: string; stops: Array<{ sequence: number; stationCode: string; name: string; city: string; arriveAt?: string; departAt?: string }> } | null;
  bus?: { busName: string; busType: string; airConditioned: boolean; seatLayout: string; boardingPoint: string; droppingPoint: string; cancellationPolicy: string; seats: Array<{ id: string; code: string; seatType: string; available: boolean }> } | null;
  flight?: { flightNumber: string; originAirportCode: string; destinationAirportCode: string; baggageAllowance: string; baseFareMinor: number; taxesMinor: number; refundInfo: string; originAirport: { code: string; name: string; city: string }; destinationAirport: { code: string; name: string; city: string } } | null;
};
type Booking = { id: string; reference: string; status: string; amountMinor: number; currency: string; createdAt: string; offer: Offer; payment?: { status: string }; passengerName: string; giftChoice?: string | null; demo?: boolean };
type AdminUser = { id: string; name: string; email: string; role: 'USER' | 'ADMIN'; createdAt: string };
type PlacePoint = { name: string; displayName: string; lat: number; lon: number };
type NearbyPlace = { id: string; name: string; category: 'Food court' | 'Restaurant' | 'Cafe' | 'Pharmacy' | 'Medical shop'; lat: number; lon: number; distanceMeters: number; address?: string; imageUrl?: string; photoAttribution?: Array<{ displayName: string; uri?: string }>; rating?: number; ratingCount?: number; openNow?: boolean; openingHours?: string[]; mapsUrl?: string };
type NearbyResponse = { places: NearbyPlace[]; source: string; snapshotAt: string | null };

const giftHampers = [
  { id: 'welcome', name: 'The Welcome Edit', description: 'A thoughtful arrival-day assortment.', imageUrl: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=700&q=80' },
  { id: 'trail', name: 'The Trail Companion', description: 'A demo preview for the curious traveller.', imageUrl: 'https://images.unsplash.com/photo-1513883049090-d0b7439799bf?auto=format&fit=crop&w=700&q=80' },
  { id: 'celebration', name: 'The Celebration Box', description: 'A little something for a special trip.', imageUrl: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=700&q=80' },
] as const;
type Destination = { id: string; name: string; country: string; description: string; category: 'Culture' | 'Coast' | 'Nature' | 'City'; imageUrl: string };

const destinations: Destination[] = [
  { id: 'jaipur', name: 'Jaipur', country: 'India', description: 'Rose-hued palaces and lively old-city lanes.', category: 'Culture', imageUrl: 'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=1000&q=85' },
  { id: 'goa', name: 'Goa', country: 'India', description: 'Slow mornings, salt air and a softer pace.', category: 'Coast', imageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1000&q=85' },
  { id: 'udaipur', name: 'Udaipur', country: 'India', description: 'Lake light, courtyard dinners and quiet rooftops.', category: 'Culture', imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=85' },
  { id: 'kerala', name: 'Kerala Backwaters', country: 'India', description: 'Drift past palm-lined waterways and village life.', category: 'Nature', imageUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1000&q=85' },
  { id: 'agra', name: 'Agra', country: 'India', description: 'A marble masterpiece at first light.', category: 'Culture', imageUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1000&q=85' },
  { id: 'varanasi', name: 'Varanasi', country: 'India', description: 'Ancient river rituals and timeless ghats.', category: 'Culture', imageUrl: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=1000&q=85' },
  { id: 'munnar', name: 'Munnar', country: 'India', description: 'A cool, green escape among tea-covered hills.', category: 'Nature', imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=85' },
  { id: 'ladakh', name: 'Ladakh', country: 'India', description: 'High passes, open skies and stark mountain beauty.', category: 'Nature', imageUrl: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1000&q=85' },
  { id: 'jodhpur', name: 'Jodhpur', country: 'India', description: 'Blue lanes beneath the fort on the hill.', category: 'Culture', imageUrl: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1000&q=85' },
  { id: 'darjeeling', name: 'Darjeeling', country: 'India', description: 'Tea gardens and mountain mornings in the east.', category: 'Nature', imageUrl: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=85' },
  { id: 'andaman', name: 'Andaman Islands', country: 'India', description: 'Clear water, quiet coves and island time.', category: 'Coast', imageUrl: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1000&q=85' },
  { id: 'amritsar', name: 'Amritsar', country: 'India', description: 'Golden reflections and generous Punjabi tables.', category: 'Culture', imageUrl: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&w=1000&q=85' },
  { id: 'kolkata', name: 'Kolkata', country: 'India', description: 'Grand architecture, bookshops and cafe culture.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1558431382-27e303142255?auto=format&fit=crop&w=1000&q=85' },
  { id: 'mumbai', name: 'Mumbai', country: 'India', description: 'Sea-facing promenades and big-city energy.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1000&q=85' },
  { id: 'hampi', name: 'Hampi', country: 'India', description: 'Boulder country and the echoes of an empire.', category: 'Culture', imageUrl: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1000&q=85' },
  { id: 'rishikesh', name: 'Rishikesh', country: 'India', description: 'River air, forest trails and foothill calm.', category: 'Nature', imageUrl: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1000&q=85' },
  { id: 'paris', name: 'Paris', country: 'France', description: 'Long lunches, little museums and evening walks.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1000&q=85' },
  { id: 'rome', name: 'Rome', country: 'Italy', description: 'Layered history best explored one piazza at a time.', category: 'Culture', imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1000&q=85' },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', description: 'Neon nights and peaceful gardens, side by side.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1000&q=85' },
  { id: 'bali', name: 'Bali', country: 'Indonesia', description: 'Temple visits, lush terraces and island sunsets.', category: 'Nature', imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1000&q=85' },
  { id: 'london', name: 'London', country: 'United Kingdom', description: 'Neighbourhood markets and a different view around each corner.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1000&q=85' },
  { id: 'new-york', name: 'New York', country: 'United States', description: 'An ever-changing skyline with a borough for every mood.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=1000&q=85' },
  { id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', description: 'Design-forward city days and desert horizons.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1000&q=85' },
  { id: 'santorini', name: 'Santorini', country: 'Greece', description: 'Whitewashed villages above the deep-blue Aegean.', category: 'Coast', imageUrl: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=1000&q=85' },
  { id: 'swiss-alps', name: 'Swiss Alps', country: 'Switzerland', description: 'Mountain railways, fresh air and alpine views.', category: 'Nature', imageUrl: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1000&q=85' },
  { id: 'iceland', name: 'Iceland', country: 'Iceland', description: 'Waterfalls, volcanic coastlines and wide-open roads.', category: 'Nature', imageUrl: 'https://images.unsplash.com/photo-1476610182048-b716b8518aae?auto=format&fit=crop&w=1000&q=85' },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', description: 'Garden city walks and a remarkable food scene.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1000&q=85' },
  { id: 'bangkok', name: 'Bangkok', country: 'Thailand', description: 'Canal-side temples, night markets and bright flavours.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1000&q=85' },
  { id: 'cape-town', name: 'Cape Town', country: 'South Africa', description: 'Mountain paths above a lively oceanfront city.', category: 'Nature', imageUrl: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1000&q=85' },
  { id: 'machu-picchu', name: 'Machu Picchu', country: 'Peru', description: 'Cloud forest trails to an extraordinary ancient city.', category: 'Culture', imageUrl: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1000&q=85' },
  { id: 'sydney', name: 'Sydney', country: 'Australia', description: 'Harbour mornings, coastal walks and easy-going city life.', category: 'Coast', imageUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1000&q=85' },
  { id: 'lisbon', name: 'Lisbon', country: 'Portugal', description: 'Tram rides, tiled facades and golden-hour viewpoints.', category: 'City', imageUrl: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1000&q=85' },
];

const getToken = () => localStorage.getItem('traverse_token') || '';
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (getToken()) headers.set('Authorization', `Bearer ${getToken()}`);
  const response = await fetch(`/api${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body as T;
}
const dateLabel = (value: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...options }).format(new Date(value));
const iconFor = (type: string, size = 20) => type === 'TRAIN' ? <TrainFront size={size} /> : type === 'BUS' ? <BusFront size={size} /> : <Plane size={size} />;
const typePath = (type: SearchData['type']) => `/${type === 'TRAIN' ? 'trains' : type === 'BUS' ? 'buses' : 'flights'}`;
const dateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!getToken()) return;
    api<{ user: User }>('/auth/me').then((data) => setUser(data.user)).catch(() => {
      localStorage.removeItem('traverse_token');
      setUser(null);
    });
  }, []);

  useEffect(() => { window.scrollTo(0, 0); setMobileOpen(false); }, [location.pathname]);
  const signOut = () => { localStorage.removeItem('traverse_token'); setUser(null); };
  const authProps = { user, setUser };

  return <div className="app-shell">
    <header className="topbar">
      <div className="nav-wrap">
        <Link className="brand" to="/" aria-label="Traverse Elite home"><span className="brand-mark">T</span><span>TRAVERSE <b>ELITE</b></span></Link>
        <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">{mobileOpen ? <X /> : <Menu />}</button>
        <nav className={mobileOpen ? 'nav-links open' : 'nav-links'}>
          <Link to="/trains/search">Trains</Link><Link to="/buses/search">Buses</Link><Link to="/flights/search">Flights</Link><Link to="/nearby">Nearby</Link><Link to="/destinations">Discover</Link>
          {user ? <><Link to="/bookings">My journeys</Link><div className="user-menu"><Link to="/profile" className="nav-user"><span className="avatar">{user.name[0]?.toUpperCase()}</span>{user.name.split(' ')[0]}<ChevronDown size={14} /></Link>
            <div className="user-dropdown"><Link to="/profile">Your profile</Link><Link to="/bookings">Bookings</Link>{user.role === 'ADMIN' && <Link to="/admin">Admin console</Link>}<button onClick={signOut}>Sign out</button></div></div></>
            : <><Link className="nav-login" to="/login"><LogIn size={16} /> Sign in</Link><Link className="button button-small button-gold" to="/register">Sign Up</Link></>}
        </nav>
      </div>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/trains/search" element={<SearchResults initialType="TRAIN" />} />
        <Route path="/buses/search" element={<SearchResults initialType="BUS" />} />
        <Route path="/flights/search" element={<SearchResults initialType="FLIGHT" />} />
        <Route path="/nearby" element={<NearbyEssentials />} />
        <Route path="/trains/:id" element={<OfferDetails />} />
        <Route path="/buses/:id" element={<OfferDetails />} />
        <Route path="/flights/:id" element={<OfferDetails />} />
        <Route path="/offer/:id" element={<OfferDetails />} />
        <Route path="/checkout/:id" element={user ? <Checkout user={user} /> : <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />} />
        <Route path="/confirmation/:reference" element={user ? <Confirmation /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthPage mode="login" {...authProps} />} />
        <Route path="/register" element={<AuthPage mode="register" {...authProps} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/bookings" element={user ? <Bookings /> : <Navigate to="/login?next=%2Fbookings" replace />} />
        <Route path="/bookings/:reference" element={user ? <BookingDetails /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={user ? <Profile user={user} setUser={setUser} /> : <Navigate to="/login" replace />} />
        <Route path="/destinations" element={<Destinations />} />
        <Route path="/help" element={<Help />} />
        <Route path="/admin" element={user?.role === 'ADMIN' ? <Admin /> : <Navigate to="/login?next=%2Fadmin" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <Footer />
  </div>;
}

type SearchData = { type: 'TRAIN' | 'BUS' | 'FLIGHT'; origin: string; destination: string; date: string; passengers: number };
function MapClickHandler({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (event) => onClick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function SearchWidget({ initialType = 'TRAIN', compact = false }: { initialType?: SearchData['type']; compact?: boolean }) {
  const navigate = useNavigate();
  const [currentParams] = useSearchParams();
  const future = new Date(); future.setDate(future.getDate() + 3);
  const defaults: Record<SearchData['type'], [string, string]> = { TRAIN: ['Hyderabad', 'Vijayawada'], BUS: ['Vijayawada', 'Hyderabad'], FLIGHT: ['Hyderabad', 'Delhi'] };
  const [type, setType] = useState<SearchData['type']>(initialType);
  const [origin, setOrigin] = useState(currentParams.get('origin') || defaults[initialType][0]);
  const [destination, setDestination] = useState(currentParams.get('destination') || defaults[initialType][1]);
  const [date, setDate] = useState(currentParams.get('date') || dateInput(future));
  const [returnDate, setReturnDate] = useState(currentParams.get('returnDate') || dateInput(new Date(future.getTime() + 7 * 86400000)));
  const [tripType, setTripType] = useState(currentParams.has('returnDate') ? 'round-trip' : 'one-way');
  const [passengers, setPassengers] = useState(Number(currentParams.get('passengers') || 1));
  const [travelClass, setTravelClass] = useState(currentParams.get('travelClass') || '');
  const [busType, setBusType] = useState(currentParams.get('busType') || '');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<'origin' | 'destination'>('destination');
  const [point, setPoint] = useState<PlacePoint | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [places, setPlaces] = useState<PlacePoint[]>([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [error, setError] = useState('');
  const choosePlace = (place: PlacePoint) => {
    setPoint(place);
    if (mapTarget === 'origin') setOrigin(place.name);
    else setDestination(place.name);
    setPlaces([]);
    setPlaceQuery('');
    setLocationMessage(`${place.name} selected as ${mapTarget}.`);
  };
  const reverseName = async (lat: number, lon: number): Promise<PlacePoint> => {
    try { return await api<PlacePoint>(`/locations/reverse?lat=${lat}&lon=${lon}`); }
    catch { return { name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, displayName: 'Map coordinates (place lookup unavailable)', lat, lon }; }
  };
  const useCurrentLocation = () => {
    setLocationMessage('');
    if (!window.isSecureContext && window.location.hostname !== 'localhost') { setLocationMessage('Location access requires HTTPS. Enter your city manually or use the map.'); return; }
    if (!navigator.geolocation) { setLocationMessage('This browser does not provide location services. Enter your city manually or use the map.'); return; }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const value = await reverseName(coords.latitude, coords.longitude);
      setPoint(value); setOrigin(value.name); setMapTarget('destination'); setMapOpen(true);
      setLocationMessage(value.displayName.includes('unavailable') ? 'Current coordinates are shown; place naming is unavailable. You can edit the origin.' : `Current location: ${value.name}`);
      setLocationBusy(false);
    }, (geoError) => {
      setLocationMessage(geoError.code === geoError.PERMISSION_DENIED
        ? 'Location permission was denied. Allow it in browser settings, use the map, or enter a city manually.'
        : geoError.code === geoError.POSITION_UNAVAILABLE
          ? 'Your location is unavailable right now. Use the map or enter a city manually.'
          : 'Location took too long. Try again, use the map, or enter a city manually.');
      setLocationBusy(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  };
  const searchPlace = async () => {
    if (placeQuery.trim().length < 2) { setLocationMessage('Enter at least two characters to search for a place.'); return; }
    setPlaceBusy(true); setLocationMessage('');
    try {
      const response = await api<{ places: PlacePoint[] }>(`/locations/search?q=${encodeURIComponent(placeQuery)}`);
      setPlaces(response.places);
      if (!response.places.length) setLocationMessage('No places found. Try a nearby city or type the location manually.');
    } catch (e) { setLocationMessage((e as Error).message); }
    finally { setPlaceBusy(false); }
  };
  const reverseMapPoint = async (lat: number, lon: number) => {
    setLocationMessage('Finding this place…');
    const place = await reverseName(lat, lon);
    setPoint(place);
    setLocationMessage(place.displayName.includes('unavailable')
      ? 'Place lookup failed. This map point is still selected; edit the city field if needed.'
      : `${place.name} selected. Choose Use this place to apply it.`);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateRouteSearch(origin, destination, date);
    if (validationError) { setError(validationError); return; }
    if (type === 'FLIGHT' && tripType === 'round-trip' && returnDate < date) { setError('Return date must be on or after departure.'); return; }
    setError('');
    const values: Record<string, string> = { type, origin: origin.trim(), destination: destination.trim(), date, passengers: String(passengers) };
    if (travelClass) values.travelClass = travelClass;
    if (type === 'BUS' && busType) values.busType = busType;
    if (type === 'FLIGHT' && tripType === 'round-trip') values.returnDate = returnDate;
    navigate(`${typePath(type)}/search?${new URLSearchParams(values)}`);
  };
  return <form className={`search-box ${compact ? 'search-compact' : ''}`} onSubmit={submit}>
    {!compact && <div className="trip-tabs">{type === 'FLIGHT' ? <><button type="button" className={tripType === 'one-way' ? 'active' : ''} onClick={() => setTripType('one-way')}>One way</button><button type="button" className={tripType === 'round-trip' ? 'active' : ''} onClick={() => setTripType('round-trip')}>Round trip</button></> : <span className="trip-mode-label">{type === 'TRAIN' ? 'TRAIN JOURNEY' : 'BUS JOURNEY'}</span>}</div>}
    {!compact && <div className="transport-tabs">{(['TRAIN', 'BUS', 'FLIGHT'] as const).map((item) => <button type="button" key={item} className={type === item ? 'active' : ''} onClick={() => { setType(item); setOrigin(defaults[item][0]); setDestination(defaults[item][1]); setTravelClass(''); }}>{iconFor(item, 17)} {item.charAt(0) + item.slice(1).toLowerCase()}</button>)}</div>}
    <div className="search-fields">
      <label className="field location-field"><span>{type === 'TRAIN' ? 'FROM STATION / CITY' : type === 'BUS' ? 'FROM CITY' : 'FROM AIRPORT / CITY'}</span><MapPin size={17} /><input value={origin} onChange={(e) => setOrigin(e.target.value)} required minLength={2} aria-label="Origin station or city" /><small>{type === 'FLIGHT' ? 'Airport city or IATA code' : type === 'TRAIN' ? 'Station city or station name' : 'Bus departure city'}</small></label>
      <button className="swap-button" type="button" aria-label="Swap origin and destination" onClick={() => { setOrigin(destination); setDestination(origin); }}><ArrowLeftRight size={16} /></button>
      <label className="field location-field"><span>{type === 'TRAIN' ? 'TO STATION / CITY' : type === 'BUS' ? 'TO CITY' : 'TO AIRPORT / CITY'}</span><MapPin size={17} /><input value={destination} onChange={(e) => setDestination(e.target.value)} required minLength={2} aria-label="Destination station or city" /><small>{type === 'FLIGHT' ? 'Airport city or IATA code' : type === 'TRAIN' ? 'Station city or station name' : 'Bus arrival city'}</small></label>
      <label className="field date-field"><span>DEPARTURE</span><CalendarDays size={17} /><input type="date" value={date} min={dateInput(new Date())} onChange={(e) => setDate(e.target.value)} required /><small>Choose your date</small></label>
      {type === 'FLIGHT' && tripType === 'round-trip' && <label className="field date-field return-field"><span>RETURN</span><CalendarDays size={17} /><input type="date" value={returnDate} min={date} onChange={(e) => setReturnDate(e.target.value)} required /><small>Choose your return date</small></label>}
      <label className="field passenger-field"><span>TRAVELLERS</span><Users size={17} /><select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'traveller' : 'travellers'}</option>)}</select><small>Up to 9 travellers</small></label>
      {type !== 'BUS' && <label className="field class-field"><span>{type === 'TRAIN' ? 'TRAIN CLASS' : 'CABIN CLASS'}</span><BadgeCheck size={17} /><select value={travelClass} onChange={(e) => setTravelClass(e.target.value)}><option value="">Any class</option>{(type === 'TRAIN' ? ['AC Chair Car', 'Executive Chair', 'Sleeper', 'AC 2 Tier', 'AC 3 Tier'] : ['Economy', 'Premium Economy', 'Business', 'First']).map((value) => <option key={value}>{value}</option>)}</select><small>{type === 'TRAIN' ? 'Available classes' : 'Available cabins'}</small></label>}
      {type === 'BUS' && <label className="field class-field"><span>BUS TYPE</span><BusFront size={17} /><select value={busType} onChange={(e) => setBusType(e.target.value)}><option value="">Any bus</option>{['AC Sleeper', 'AC Semi-sleeper', 'AC Seater', 'Non-AC Seater'].map((value) => <option key={value}>{value}</option>)}</select><small>AC, sleeper or seater</small></label>}
      <button className="button button-navy search-submit" type="submit">Find journeys <ArrowRight size={17} /></button>
    </div>
    <div className="location-actions"><button className="location-button" type="button" onClick={useCurrentLocation} disabled={locationBusy}><LocateFixed size={15} /> {locationBusy ? 'Finding your location…' : 'Use My Current Location'}</button><button className="location-button" type="button" onClick={() => setMapOpen(!mapOpen)}><MapPin size={15} /> Search places or choose on map</button></div>
    {locationMessage && <p className="location-message" role="status">{locationMessage}</p>}
    {mapOpen && <div className="location-panel"><div className="location-panel-head"><strong>Choose a place for this {type.toLowerCase()} search</strong><button type="button" aria-label="Close location map" onClick={() => setMapOpen(false)}><X size={17} /></button></div><div className="map-targets"><button type="button" className={mapTarget === 'origin' ? 'active' : ''} onClick={() => setMapTarget('origin')}>Set origin</button><button type="button" className={mapTarget === 'destination' ? 'active' : ''} onClick={() => setMapTarget('destination')}>Set destination</button><button type="button" onClick={useCurrentLocation}><LocateFixed size={14} /> Use My Location</button></div><div className="place-search"><input value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder="Search a city, station or place" aria-label="Search a place" minLength={2} /><button className="button button-navy button-small" type="button" onClick={() => void searchPlace()} disabled={placeBusy}><Search size={14} /> {placeBusy ? 'Searching…' : 'Search'}</button></div>{places.length > 0 && <div className="place-suggestions">{places.map((place) => <button type="button" key={`${place.lat}-${place.lon}`} onClick={() => choosePlace(place)}><MapPin size={14} /><span><strong>{place.name}</strong><small>{place.displayName}</small></span></button>)}</div>}<p className="map-instructions">Select a map point, then choose “Use this place”. Your coordinates stay in this browser session and aren’t saved.</p><MapContainer center={point ? [point.lat, point.lon] : [20.5937, 78.9629]} zoom={point ? 11 : 5} scrollWheelZoom={false} className="location-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapClickHandler onClick={(lat, lon) => { void reverseMapPoint(lat, lon); }} />{point && <CircleMarker center={[point.lat, point.lon]} radius={8} pathOptions={{ color: '#b88943', fillColor: '#e4c991', fillOpacity: .8 }} />}</MapContainer>{point && <div className="map-selection"><span>{point.name}<small>{point.displayName}</small></span><button className="button button-gold button-small" type="button" onClick={() => choosePlace(point)}>Use this place</button></div>}</div>}
    {error && <p className="form-error">{error}</p>}
    {!compact && <div className="trust-line"><ShieldCheck size={15} /> Your journey, thoughtfully handled <span>·</span> Transparent prices <span>·</span> Secure checkout</div>}
  </form>;
}

function Home() {
  return <>
    <section className="hero">
      <div className="hero-image" />
      <div className="hero-content page-wrap">
        <div className="eyebrow"><Sparkles size={14} /> THE JOURNEY IS YOURS</div>
        <h1>Find your<br /><em>somewhere.</em></h1>
        <p>Good trips begin long before you arrive. Find a way there that feels just right.</p>
        <div className="hero-proof"><span><BadgeCheck size={16} /> Carefully curated journeys</span><span><ShieldCheck size={16} /> Book with confidence</span></div>
      </div>
      <div className="hero-search page-wrap"><SearchWidget /></div>
      <span className="image-credit">The world, a little closer.</span>
    </section>
    <section className="section page-wrap intro-row"><div><p className="eyebrow gold-text">TRAVEL, CONSIDERED</p><h2>More than getting<br />from here to there.</h2></div><p className="intro-copy">We bring the details together, so you can focus on the stories you’ll bring home. Compare trains, buses and flights — all in one thoughtful place.</p></section>
    <section className="section destinations-section"><div className="page-wrap"><div className="section-heading"><div><p className="eyebrow gold-text">A LITTLE INSPIRATION</p><h2>Somewhere good<br />is closer than you think.</h2></div><Link className="text-link" to="/destinations">Explore destinations <ArrowRight size={16} /></Link></div><DestinationCards /></div></section>
    <section className="section page-wrap service-strip"><div className="service-copy"><p className="eyebrow gold-text">A BETTER WAY TO WANDER</p><h2>The small details<br />make the whole trip.</h2><p>Clear choices, straightforward booking and support when you need it. That’s the Traverse way.</p><Link to="/help" className="button button-outline">How it works <ArrowRight size={16} /></Link></div><div className="service-features"><Feature icon={<Heart />} title="Thoughtfully chosen" text="Compare options with the details that matter, all in one place."/><Feature icon={<ShieldCheck />} title="Clear from the start" text="Know what you’re booking, what it costs and what comes next."/><Feature icon={<LifeBuoy />} title="Here when you need us" text="Our help centre makes answers easy to find." /></div></section>
    <section className="cta-band"><div className="page-wrap cta-inner"><div><p className="eyebrow">THE NEXT CHAPTER STARTS HERE</p><h2>Where will the road take you?</h2></div><Link className="button button-gold" to="/search?type=TRAIN">Start exploring <ArrowRight size={17} /></Link></div></section>
  </>;
}
function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="feature"><span className="feature-icon">{icon}</span><div><h3>{title}</h3><p>{text}</p></div></div>; }
function DestinationCards({ items = destinations.slice(0, 4) }: { items?: Destination[] }) {
  return <div className="destination-grid">{items.map((item, index) => {
    const type = item.country === 'India' ? 'TRAIN' : 'FLIGHT';
    return <Link to={`/search?type=${type}&origin=Mumbai&destination=${encodeURIComponent(item.name)}&date=${dateInput(new Date(Date.now() + 3 * 86400000))}&passengers=1`} className={`destination-card destination-${index}`} key={item.id}>
      <img className="destination-photo" src={item.imageUrl} alt={`${item.name}, ${item.country}`} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
      <span className="destination-category">{item.category}</span><span className="destination-country">{item.country}</span>
      <div className="destination-copy"><h3>{item.name}</h3><p>{item.description}</p></div><span className="card-arrow"><ArrowRight size={17} /></span>
    </Link>;
  })}</div>;
}

function SearchResults({ initialType }: { initialType?: SearchData['type'] } = {}) {
  const [params] = useSearchParams();
  const requestedType = initialType || params.get('type');
  const type: SearchData['type'] = requestedType === 'BUS' || requestedType === 'FLIGHT' ? requestedType : 'TRAIN';
  const defaultRoute = type === 'TRAIN' ? ['Hyderabad', 'Vijayawada'] : type === 'BUS' ? ['Vijayawada', 'Hyderabad'] : ['Hyderabad', 'Delhi'];
  const origin = params.get('origin') || defaultRoute[0];
  const destination = params.get('destination') || defaultRoute[1];
  const date = params.get('date') || dateInput(new Date(Date.now() + 3 * 86400000));
  const returnDate = params.get('returnDate') || undefined;
  const passengers = Number(params.get('passengers') || 1);
  const travelClass = params.get('travelClass') || '';
  const busType = params.get('busType') || '';
  const [offers, setOffers] = useState<Offer[]>([]);
  const [returns, setReturns] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('price');
  const [filter, setFilter] = useState('all');
  const [operator, setOperator] = useState('');
  const [amenity, setAmenity] = useState('');
  const [maxFare, setMaxFare] = useState('');
  const [refreshedAt, setRefreshedAt] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  useEffect(() => {
    setLoading(true); setError('');
    const values: Record<string, string> = { origin, destination, date, passengers: String(passengers), sort };
    if (travelClass) values.travelClass = travelClass;
    if (busType) values.busType = busType;
    if (operator) values.operator = operator;
    if (amenity) values.amenity = amenity;
    if (maxFare && Number(maxFare) > 0) values.maxFareMinor = String(Math.round(Number(maxFare) * 100));
    if (filter === 'nonstop' && type === 'FLIGHT') values.stops = '0';
    if (filter === 'morning') { values.departureAfter = '05'; values.departureBefore = '12'; }
    if (filter === 'afternoon') { values.departureAfter = '12'; values.departureBefore = '18'; }
    if (filter === 'evening') values.departureAfter = '18';
    if (returnDate) values.returnDate = returnDate;
    const endpoint = type === 'TRAIN' ? '/trains/search' : type === 'BUS' ? '/buses/search' : '/flights/search';
    api<{ offers: Offer[]; returns: Offer[]; mode: string; refreshedAt: string }>(`${endpoint}?${new URLSearchParams(values)}`)
      .then((data) => { setOffers(data.offers); setReturns(data.returns); setRefreshedAt(data.refreshedAt); })
      .catch((e: Error) => { setError(e.message); setOffers([]); setReturns([]); }).finally(() => setLoading(false));
  }, [type, origin, destination, date, returnDate, passengers, travelClass, busType, sort, filter, operator, amenity, maxFare, refreshNonce]);
  const visibleOffers = useMemo(() => offers.filter((item) =>
    filter === 'all' || filter === 'morning' || filter === 'afternoon' || filter === 'evening' ||
    (filter === 'nonstop' ? item.stops === 0 : item.class.toLowerCase().includes(filter)),
  ), [offers, filter]);
  const label = type.charAt(0) + type.slice(1).toLowerCase();
  const transportVisual = {
    TRAIN: { image: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1800&q=85', message: 'The pleasure is in the passing scenery.' },
    BUS: { image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1800&q=85', message: 'Take the scenic route, at your own pace.' },
    FLIGHT: { image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1800&q=85', message: 'A little closer to somewhere new.' },
  }[type];
  return <div className={`page-wrap content-page results-page results-${type.toLowerCase()}`}><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>{label} search</span></div><div className="transport-banner"><img src={transportVisual.image} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /><span>{iconFor(type, 20)}</span><p>{transportVisual.message}<small>Thoughtfully planned journeys · Demo schedules only</small></p></div><div className="results-top"><div><p className="eyebrow gold-text">{iconFor(type, 14)} {label.toUpperCase()} · {passengers} {passengers === 1 ? 'TRAVELLER' : 'TRAVELLERS'}</p><h1>{origin} <span className="muted-arrow">→</span> {destination}</h1><p className="muted">{dateLabel(`${date}T00:00:00`)} {returnDate && <><span>·</span> Return {dateLabel(`${returnDate}T00:00:00`)}</>}<span>·</span> {loading ? 'Finding your options…' : `${visibleOffers.length} ${type.toLowerCase()} options`}</p></div><div className="results-actions"><button className="button button-outline button-small" onClick={() => setRefreshNonce((value) => value + 1)} disabled={loading}><RefreshCw size={14} /> Refresh</button><details className="edit-search"><summary><span>Change search</span><ChevronDown size={16} /></summary><SearchWidget initialType={type} compact /></details></div></div>
    <div className="results-toolbar"><div className="filter-buttons"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All {label.toLowerCase()}</button>{type === 'FLIGHT' && <button className={filter === 'nonstop' ? 'selected' : ''} onClick={() => setFilter('nonstop')}>Non-stop</button>}{['morning', 'afternoon', 'evening'].map((time) => <button key={time} className={filter === time ? 'selected' : ''} onClick={() => setFilter(filter === time ? 'all' : time)}>{time.charAt(0).toUpperCase() + time.slice(1)}</button>)}</div><label className="sort-select">Sort by <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="price">Cheapest first</option><option value="departure">Departure</option><option value="duration">Duration</option></select></label></div>
    <div className="search-filters"><label>Operator<input placeholder={`Filter ${type === 'FLIGHT' ? 'airline' : 'operator'}`} value={operator} onChange={(e) => setOperator(e.target.value)} /></label><label>Maximum fare (₹)<input type="number" min="1" value={maxFare} onChange={(e) => setMaxFare(e.target.value)} placeholder="Any fare" /></label>{type === 'BUS' && <label>Amenity<input placeholder="e.g. Wi-Fi" value={amenity} onChange={(e) => setAmenity(e.target.value)} /></label>}</div>
    {error && <div className="notice error-notice">{error}<p>Live availability is only shown when an authorized provider is configured.</p></div>}
    {loading ? <div className="loading-card"><span className="spinner" /> Finding your way there…</div> : visibleOffers.length ? <><div className="offers-list">{visibleOffers.map((offer) => <OfferCard key={offer.id} offer={offer} passengers={passengers} />)}</div>{returns.length > 0 && <><h2 className="return-heading">Your return options</h2><div className="offers-list">{returns.map((offer) => <OfferCard key={offer.id} offer={offer} passengers={passengers} />)}</div></>}{returnDate && returns.length === 0 && <div className="notice demo-notice">No demo return flights match this route and date. Search again or change your return date.</div>}</> : !error && <div className="empty-state"><div className="empty-icon">{iconFor(type, 25)}</div><h2>No {type.toLowerCase()} journeys found</h2><p>There are no matching {type.toLowerCase()} demo schedules for {origin} to {destination} on {dateLabel(`${date}T00:00:00`)}. Try a different route or date.</p><Link className="button button-navy" to="/">Search another route</Link></div>}
    {refreshedAt && <p className="refresh-time">Updated {dateLabel(refreshedAt, { hour: '2-digit', minute: '2-digit', hour12: false })} local time · {type === 'FLIGHT' ? 'DEMO FLIGHTS' : `DEMO ${type}S`}</p>}
    <p className="demo-note"><span>DEMO DATA</span> Sample journey times, fares and availability are illustrative only and are not live or guaranteed.</p>
  </div>;
}

function NearbyEssentials() {
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [source, setSource] = useState('');
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [radius, setRadius] = useState(3000);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'nearest' | 'furthest'>('nearest');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationMatches, setLocationMatches] = useState<PlacePoint[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const filters = ['All', 'Food courts', 'Restaurants', 'Cafes', 'Pharmacies', 'Medical shops'];
  const categoryFilters: Record<string, NearbyPlace['category'] | null> = {
    All: null,
    'Food courts': 'Food court',
    Restaurants: 'Restaurant',
    Cafes: 'Cafe',
    Pharmacies: 'Pharmacy',
    'Medical shops': 'Medical shop',
  };
  const visiblePlaces = places
    .filter((place) => filter === 'All' || place.category === categoryFilters[filter])
    .filter((place) => `${place.name} ${place.category} ${place.address || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((first, second) => sortOrder === 'nearest' ? first.distanceMeters - second.distanceMeters : second.distanceMeters - first.distanceMeters);
  const googleProvider = source === 'Google Places';
  useEffect(() => {
    if (!position) return;
    let active = true;
    setLoading(true);
    setError('');
    setPlaces([]);
    setSource('');
    setSnapshotAt(null);
    api<NearbyResponse>(`/locations/nearby?lat=${position.lat}&lon=${position.lon}&radius=${radius}`)
      .then((data) => {
        if (!Array.isArray(data.places) || typeof data.source !== 'string') {
          throw new Error('The nearby places service returned an invalid response. Please try again.');
        }
        if (active) { setPlaces(data.places); setSnapshotAt(data.snapshotAt); setSource(data.source); }
      })
      .catch((e: Error) => {
        if (active) {
          setError(e instanceof TypeError
            ? 'Could not reach the nearby places service. Check your connection and try again.'
            : e.message);
          setPlaces([]);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [position, radius]);
  const searchManualLocation = async (event: FormEvent) => {
    event.preventDefault();
    if (locationQuery.trim().length < 2) { setError('Enter at least two characters to search for a city or address.'); return; }
    setSearchingLocation(true);
    setError('');
    setLocationMatches([]);
    try {
      const data = await api<{ places: PlacePoint[] }>(`/locations/search?q=${encodeURIComponent(locationQuery.trim())}`);
      setLocationMatches(data.places);
      if (!data.places.length) setError('No matching locations found. Try a city name or nearby landmark.');
    } catch (e) { setError((e as Error).message); }
    finally { setSearchingLocation(false); }
  };
  const chooseManualLocation = (place: PlacePoint) => {
    setPosition({ lat: place.lat, lon: place.lon });
    setLocationLabel(place.displayName);
    setLocationMatches([]);
    setPlaces([]);
    setSource('');
    setSnapshotAt(null);
    setSearch('');
  };
  const locate = () => {
    setError('');
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setError('Location access requires HTTPS. Use the manual location search below, or open this app over HTTPS.');
      return;
    }
    if (!navigator.geolocation) { setError('This browser does not provide location services. Use the manual location search below.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setPosition({ lat: coords.latitude, lon: coords.longitude }); setLocationLabel('Current location'); setLocating(false); },
      (geoError) => {
        setError(geoError.code === geoError.PERMISSION_DENIED
          ? 'Location permission was denied. Search a city, address or landmark below to find nearby essentials.'
          : geoError.code === geoError.POSITION_UNAVAILABLE
            ? 'Your location is unavailable right now. Search a city, address or landmark below instead.'
            : 'Location took too long. Check your connection or search for a location below.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };
  const directionsUrl = (place: NearbyPlace) => place.mapsUrl || (googleProvider
    ? `https://www.google.com/maps/dir/?api=1&origin=${position?.lat},${position?.lon}&destination=${place.lat},${place.lon}`
    : `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${position?.lat},${position?.lon};${place.lat},${place.lon}`);
  const categoryIcon = (category: NearbyPlace['category']) =>
    category === 'Pharmacy' || category === 'Medical shop' ? <Pill size={19} /> : <Utensils size={19} />;
  return <div className="page-wrap content-page nearby-page">
    <p className="eyebrow gold-text">A LITTLE CLOSER TO WHAT YOU NEED</p><h1>Good things,<br /><em>right around you.</em></h1>
    <p className="muted nearby-intro">Discover nearby places to eat and local pharmacies. Share your location or search for a city, address or landmark.</p>
    <div className="nearby-location-panel">
      <div className="nearby-location-actions"><button className="button button-navy" type="button" onClick={locate} disabled={locating}><LocateFixed size={17} />{locating ? 'Finding your location…' : position && locationLabel === 'Current location' ? 'Refresh my location' : 'Use my current location'}</button>
        <form className="nearby-location-search" onSubmit={searchManualLocation}><label className="sr-only" htmlFor="nearby-location-query">Search city, address or landmark</label><MapPin size={17} /><input id="nearby-location-query" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Search a city, address or landmark" minLength={2} /><button className="button button-outline button-small" type="submit" disabled={searchingLocation}><Search size={15} />{searchingLocation ? 'Searching…' : 'Search location'}</button></form>
      </div>
      {locationMatches.length > 0 && <div className="nearby-location-matches" aria-label="Location search results">{locationMatches.map((place) => <button type="button" key={`${place.lat}-${place.lon}`} onClick={() => chooseManualLocation(place)}><MapPin size={15} /><span><strong>{place.name}</strong><small>{place.displayName}</small></span></button>)}</div>}
      <div className="nearby-filters" aria-label="Filter nearby places">{filters.map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <div className="nearby-results-tools"><label className="nearby-place-search"><Search size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nearby places" aria-label="Search nearby places" /></label>
        <label className="nearby-sort">Sort<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'nearest' | 'furthest')}><option value="nearest">Nearest first</option><option value="furthest">Furthest first</option></select></label>
        <label className="nearby-radius">Radius<select value={radius} onChange={(event) => setRadius(Number(event.target.value))}><option value={1000}>1 km</option><option value={3000}>3 km</option><option value={5000}>5 km</option><option value={10000}>10 km</option></select></label>
      </div>
    </div>
    <div className="notice demo-notice nearby-disclosure"><strong>Nearby place data{source ? ` · ${googleProvider ? 'Google Maps · Google Places' : source}` : ''}</strong><span>Your location is shared with the selected location provider only when you request a lookup and is not saved by Traverse. Photos, ratings, review counts, and opening status appear only when the provider publishes them. Medicine stock is not provided.</span></div>
    {error && <div className="notice error-notice" role="alert">{error}</div>}
    {!position ? <div className="nearby-empty"><MapPin size={25} /><h2>Find essentials near you</h2><p>Use your current location or search for a place above. Location permission is optional.</p></div> :
      <>{googleProvider ? <div className="nearby-provider-map-note"><MapPin size={19} /><span>Google Places details are shown in the list below. Map directions open in Google Maps.</span></div> : <div className="nearby-map-wrap">{loading && <div className="map-loading"><span className="spinner" /> Updating nearby map…</div>}<MapContainer key={`${position.lat}-${position.lon}`} center={[position.lat, position.lon]} zoom={14} scrollWheelZoom={false} className="nearby-map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <CircleMarker center={[position.lat, position.lon]} radius={9} pathOptions={{ color: '#14243b', fillColor: '#d8ba83', fillOpacity: .95 }}><Popup>{locationLabel || 'Selected location'} (kept in this browser session)</Popup></CircleMarker>
        {visiblePlaces.map((place) => <CircleMarker key={place.id} center={[place.lat, place.lon]} radius={7} pathOptions={{ color: place.category === 'Pharmacy' || place.category === 'Medical shop' ? '#4b8165' : '#a9844b', fillColor: place.category === 'Pharmacy' || place.category === 'Medical shop' ? '#a8d0b4' : '#e2c99f', fillOpacity: .9 }}><Popup><strong>{place.name}</strong><br />{place.category} · {place.distanceMeters < 1000 ? `${place.distanceMeters} m` : `${(place.distanceMeters / 1000).toFixed(1)} km`}</Popup></CircleMarker>)}
      </MapContainer></div>}
      <div className="nearby-list-heading"><div><p className="eyebrow gold-text">{locationLabel || 'AROUND YOU'}</p><h2>{loading ? 'Finding nearby places…' : error ? 'Nearby places unavailable' : `${visiblePlaces.length} nearby ${visiblePlaces.length === 1 ? 'place' : 'places'}`}</h2></div><span>within {(radius / 1000).toFixed(radius % 1000 ? 1 : 0)} km</span></div>
      {!loading && !error && visiblePlaces.length === 0 && <div className="nearby-empty"><MapPin size={25} /><h2>{places.length === 0 ? 'No mapped places found nearby' : 'No places match your filters'}</h2><p>{places.length === 0 ? `The selected provider returned no mapped listings within ${(radius / 1000).toFixed(radius % 1000 ? 1 : 0)} km. OpenStreetMap coverage varies by area; try a wider radius or another location.` : 'Try another category or change your search term.'}</p></div>}
      <div className="nearby-place-grid">{visiblePlaces.map((place) => <article className="nearby-place-card" key={place.id}>
        <div className="nearby-place-photo"><div className="nearby-photo-fallback">{categoryIcon(place.category)}</div>{place.imageUrl && <img src={place.imageUrl} alt={`${place.name}`} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}<span>{place.category}</span>
          {place.photoAttribution?.map((attribution, index) => <small className="nearby-photo-attribution" key={`${attribution.displayName}-${index}`}>{attribution.uri ? <a href={attribution.uri} target="_blank" rel="noreferrer">{attribution.displayName}</a> : attribution.displayName}</small>)}
        </div>
        <div className="nearby-place-copy"><h3>{place.name}</h3><p>{place.address || 'Address not provided by the place listing'}</p><div className="nearby-facts"><span>{place.distanceMeters < 1000 ? `${place.distanceMeters} m away` : `${(place.distanceMeters / 1000).toFixed(1)} km away`}</span>
          {typeof place.rating === 'number' ? <span className="nearby-rating" aria-label={`${place.rating.toFixed(1)} out of 5${place.ratingCount ? ` from ${place.ratingCount} reviews` : ''}`}>★ {place.rating.toFixed(1)}{place.ratingCount ? ` · ${place.ratingCount.toLocaleString()} reviews` : ''}</span> : <span>Rating unavailable</span>}
        </div>
        {typeof place.openNow === 'boolean' ? <p className={`nearby-open-status ${place.openNow ? 'is-open' : 'is-closed'}`}>{place.openNow ? 'Open now' : 'Closed now'}</p> : place.openingHours?.[0] ? <details className="nearby-hours"><summary>Opening hours</summary><span>{place.openingHours.map((line) => line.replace(/;/g, ' · ')).join(' · ')}</span></details> : <span className="nearby-hours-missing">Opening status unavailable</span>}
          {(place.category === 'Pharmacy' || place.category === 'Medical shop') && <small className="medicine-note">Medicine stock information is not available.</small>}
          <a className="button button-outline button-small nearby-directions" href={directionsUrl(place)} target="_blank" rel="noreferrer">Get Directions <ArrowRight size={15} /></a>
        </div>
      </article>)}</div>
      <p className="nearby-source">Source: {source || 'Configured nearby places provider'}{snapshotAt ? ` · Map data snapshot ${dateLabel(snapshotAt, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}. Place coverage and listing details depend on the selected provider.</p></>}
  </div>;
}

function OfferCard({ offer, passengers }: { offer: Offer; passengers: number }) {
  const navigate = useNavigate();
  const details = offer.train ? `${offer.train.trainName} · ${offer.train.trainNumber} · ${offer.train.runningDays}` : offer.bus ? `${offer.bus.busName} · ${offer.bus.busType}` : offer.flight ? `${offer.provider} · ${offer.flight.flightNumber} · ${offer.class}` : `${offer.code} · ${offer.class}`;
  const routeFrom = offer.type === 'TRAIN' && offer.train ? `${offer.origin} · ${offer.train.originStationCode}` : offer.type === 'FLIGHT' && offer.flight ? `${offer.origin} · ${offer.flight.originAirportCode}` : offer.origin;
  const routeTo = offer.type === 'TRAIN' && offer.train ? `${offer.destination} · ${offer.train.destinationStationCode}` : offer.type === 'FLIGHT' && offer.flight ? `${offer.destination} · ${offer.flight.destinationAirportCode}` : offer.destination;
  return <article className={`offer-card offer-${offer.type.toLowerCase()}`}><div className="offer-brand"><span className="operator-icon">{iconFor(offer.type, 19)}</span><div><strong>{offer.type === 'TRAIN' && offer.train ? offer.train.trainName : offer.type === 'BUS' && offer.bus ? offer.bus.busName : offer.provider}</strong><span>{details}</span></div></div><div className="journey-times"><div><strong>{dateLabel(offer.departAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</strong><span>{routeFrom}</span></div><div className="journey-track"><small>{durationLabel(offer.durationMin)}</small><i /><span>{offer.stops === 0 ? 'Direct' : `${offer.stops} stops`}</span></div><div><strong>{dateLabel(offer.arriveAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</strong><span>{routeTo}</span></div></div><div className="offer-price"><span>{passengers > 1 ? `${passengers} travellers` : 'from'}</span><strong>{money(offer.priceMinor * passengers)}</strong><small>{money(offer.priceMinor)} each · taxes included</small><button className="button button-navy button-small" onClick={() => navigate(`${typePath(offer.type)}/${offer.id}?passengers=${passengers}`)}>View {offer.type.toLowerCase()} <ArrowRight size={15} /></button></div><div className="offer-foot"><span>{offer.available} {offer.demo ? 'demo places' : 'places reported'}</span><span>{offer.type === 'BUS' && offer.bus ? `${offer.bus.boardingPoint} → ${offer.bus.droppingPoint}` : offer.type === 'FLIGHT' && offer.flight ? `${offer.flight.baggageAllowance} · fare taxes ${money(offer.flight.taxesMinor)}` : offer.type === 'TRAIN' && offer.train ? `${offer.train.stops.length} stations · ${offer.train.runningDays}` : offer.amenities.split(',').slice(0, 2).join(' · ')}</span><span className="review-unavailable">Ratings and reviews unavailable</span><span className="demo-badge">{offer.demo ? 'DEMO DATA' : 'PROVIDER DATA'}</span></div></article>;
}

function OfferDetails() {
  const { id = '' } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const passengers = Math.max(1, Math.min(9, Number(params.get('passengers') || 1)));
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const apiPath = location.pathname.startsWith('/trains/') ? `/trains/${id}` : location.pathname.startsWith('/buses/') ? `/buses/${id}` : location.pathname.startsWith('/flights/') ? `/flights/${id}` : `/offers/${id}`;
    api<{ offer: Offer }>(apiPath).then((data) => setOffer(data.offer)).catch((e: Error) => setError(e.message));
  }, [id, location.pathname]);
  if (error) return <div className="page-wrap content-page"><div className="notice error-notice">{error}</div></div>;
  if (!offer) return <div className="page-wrap content-page"><div className="loading-card"><span className="spinner" /> Loading journey…</div></div>;
  return <div className="page-wrap content-page narrow-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to={`${typePath(offer.type)}/search?origin=${encodeURIComponent(offer.origin)}&destination=${encodeURIComponent(offer.destination)}&date=${dateInput(new Date(offer.departAt))}&passengers=${passengers}`}>{offer.type.toLowerCase()} options</Link><span>/</span><span>Details</span></div><p className="eyebrow gold-text">{offer.type} · DEMO DATA</p><h1>Your journey,<br /><em>beautifully planned.</em></h1><div className="detail-card"><div className="detail-operator">{iconFor(offer.type, 24)}<span><strong>{offer.train?.trainName || offer.bus?.busName || offer.provider}</strong><small>{offer.train?.trainNumber || offer.flight?.flightNumber || offer.code} · DEMO DATA</small></span></div><div className="detail-route"><div><strong>{dateLabel(offer.departAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</strong><span>{offer.origin}{offer.train ? ` · ${offer.train.originStationCode}` : offer.flight ? ` · ${offer.flight.originAirportCode}` : ''}</span><small>{dateLabel(offer.departAt)}</small></div><div className="detail-line"><span>{durationLabel(offer.durationMin)}</span><i /><small>{offer.stops === 0 ? 'Direct journey' : `${offer.stops} stops`}</small></div><div><strong>{dateLabel(offer.arriveAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</strong><span>{offer.destination}{offer.train ? ` · ${offer.train.destinationStationCode}` : offer.flight ? ` · ${offer.flight.destinationAirportCode}` : ''}</span><small>{dateLabel(offer.arriveAt)}</small></div></div><div className="detail-meta"><span>{offer.class}</span><span>{offer.available} demo places in sample inventory</span><span>{offer.amenities.split(',').join(' · ')}</span></div>{offer.train && <div className="transport-detail"><h3>Stations & running days</h3><p>Runs {offer.train.runningDays}</p><ol>{offer.train.stops.map((stop) => <li key={`${stop.stationCode}-${stop.sequence}`}><strong>{stop.name}</strong><span>{stop.city} · {stop.stationCode}</span>{stop.arriveAt && <small>Arrive {dateLabel(stop.arriveAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</small>}{stop.departAt && stop.sequence === 0 && <small>Depart {dateLabel(stop.departAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</small>}</li>)}</ol></div>}{offer.bus && <div className="transport-detail"><h3>Bus details</h3><p>{offer.bus.busType} · {offer.bus.airConditioned ? 'Air conditioned' : 'Non-AC'} · {offer.bus.seatLayout} seats</p><p>Board {offer.bus.boardingPoint} · Drop {offer.bus.droppingPoint}</p><p>{offer.bus.cancellationPolicy}</p></div>}{offer.flight && <div className="transport-detail"><h3>Flight & fare details</h3><p>{offer.flight.originAirport.name} ({offer.flight.originAirport.code}) → {offer.flight.destinationAirport.name} ({offer.flight.destinationAirport.code})</p><p>{offer.flight.baggageAllowance} · {offer.stops === 0 ? 'Non-stop' : `${offer.stops} stop(s)`}</p><div className="fare-breakdown"><span>Base fare × {passengers}<strong>{money(offer.flight.baseFareMinor * passengers)}</strong></span><span>Taxes × {passengers}<strong>{money(offer.flight.taxesMinor * passengers)}</strong></span><span>Total ({passengers} travellers)<strong>{money(offer.priceMinor * passengers)}</strong></span></div><p>{offer.flight.refundInfo}</p></div>}<div className="notice demo-notice">Demo schedule and fare for preview only. This is not a live provider reservation.</div><div className="detail-book"><div><span>Fare · {passengers} traveller{passengers === 1 ? '' : 's'}</span><strong>{money(offer.priceMinor * passengers)}</strong></div><Link className="button button-gold" to={`/checkout/${offer.id}?passengers=${passengers}`}>Continue to passengers <ArrowRight size={17} /></Link></div></div><Link className="back-link" to={`${typePath(offer.type)}/search?origin=${encodeURIComponent(offer.origin)}&destination=${encodeURIComponent(offer.destination)}&date=${dateInput(new Date(offer.departAt))}&passengers=${passengers}`}><ArrowRight className="back-arrow" size={15} /> Back to options</Link></div>;
}

function Checkout({ user }: { user: User }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const passengerCount = Math.max(1, Math.min(9, Number(params.get('passengers') || 1)));
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [passengerNames, setPassengerNames] = useState<string[]>(() => [user.name, ...Array.from({ length: passengerCount - 1 }, () => '')]);
  const [seatCodes, setSeatCodes] = useState<string[]>([]);
  const [key] = useState(() => crypto.randomUUID());
  useEffect(() => {
    const path = location.pathname.startsWith('/trains/') ? `/trains/${id}` : location.pathname.startsWith('/buses/') ? `/buses/${id}` : location.pathname.startsWith('/flights/') ? `/flights/${id}` : `/offers/${id}`;
    api<{ offer: Offer }>(path).then((data) => setOffer(data.offer)).catch((e: Error) => setError(e.message));
  }, [id, location.pathname]);
  const createBooking = async (event: FormEvent) => {
    event.preventDefault(); if (!offer) return;
    if (offer.type === 'BUS' && seatCodes.length !== passengerCount) { setError(`Choose ${passengerCount === 1 ? 'a seat' : `${passengerCount} seats`} for your passengers.`); return; }
    setBusy(true); setError('');
    try {
      const result = await api<{ booking: Booking }>('/bookings', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ offerId: offer.id, passengerName: name, passengerEmail: email, passengerPhone: phone || undefined, seatCodes: seatCodes.length ? seatCodes : undefined, passengers: passengerNames.map((passengerName) => ({ name: passengerName })) }) });
      navigate(`/confirmation/${result.booking.reference}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  if (!offer) return <div className="page-wrap content-page">{error ? <div className="notice error-notice">{error}</div> : <div className="loading-card"><span className="spinner" /> Preparing checkout…</div>}</div>;
  return <div className="page-wrap content-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to={`${typePath(offer.type)}/${offer.id}?passengers=${passengerCount}`}>Journey</Link><span>/</span><span>Passenger details</span></div><p className="eyebrow gold-text">ALMOST THERE</p><h1>Let’s get the<br /><em>details right.</em></h1><div className="checkout-layout"><form className="panel checkout-form" onSubmit={createBooking}><div className="panel-title"><span className="step-number">01</span><div><h2>Passenger details</h2><p>{passengerCount} traveller{passengerCount === 1 ? '' : 's'} · Booking confirmation goes to the lead traveller</p></div></div>{passengerNames.map((passengerName, index) => <label className="input-label" key={index}>{index === 0 ? 'Lead traveller name' : `Passenger ${index + 1} name`}<input value={passengerName} onChange={(e) => { const next = [...passengerNames]; next[index] = e.target.value; setPassengerNames(next); if (index === 0) setName(e.target.value); }} required minLength={2} maxLength={100} autoComplete={index === 0 ? 'name' : 'off'} /></label>)}<label className="input-label">Lead traveller email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label className="input-label">Phone number <span className="optional">Optional</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>{offer.type === 'BUS' && offer.bus && <div className="bus-seat-picker"><strong>Choose {passengerCount === 1 ? 'a seat' : `${passengerCount} seats`}</strong><span>Available demo seats · {offer.bus.busType}</span><div className="bus-seat-grid">{offer.bus.seats.map((seat) => <button key={seat.id} type="button" disabled={!seat.available || (!seatCodes.includes(seat.code) && seatCodes.length >= passengerCount)} className={`seat-button ${seatCodes.includes(seat.code) ? 'selected' : ''}`} aria-pressed={seatCodes.includes(seat.code)} onClick={() => setSeatCodes((selected) => selected.includes(seat.code) ? selected.filter((code) => code !== seat.code) : [...selected, seat.code])}>{seat.code}<small>{seat.seatType}</small></button>)}</div><small>{seatCodes.length} of {passengerCount} selected</small></div>}
        <div className="payment-demo"><div className="payment-icon"><CreditCard size={19} /></div><div><strong>Safe demo checkout</strong><span>No card details needed. Continue to confirm a simulated test payment.</span></div><span className="demo-badge">TEST</span></div>
        {error && <div className="form-error">{error}</div>}<button className="button button-navy button-wide" disabled={busy}>{busy ? 'Creating secure booking…' : <>Create booking <ArrowRight size={16} /></>}</button><p className="fineprint"><ShieldCheck size={13} /> Your details are protected and only used for this booking.</p>
      </form><aside className="panel summary-panel"><p className="eyebrow gold-text">JOURNEY SUMMARY</p><div className="summary-operator">{iconFor(offer.type, 20)}<div><strong>{offer.train?.trainName || offer.bus?.busName || offer.provider}</strong><span>{offer.train?.trainNumber || offer.flight?.flightNumber || offer.code} · DEMO</span></div></div><div className="summary-line"><span>{offer.origin}</span><i /><span>{offer.destination}</span></div><div className="summary-row"><span>Departure</span><strong>{dateLabel(offer.departAt, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong></div><div className="summary-row"><span>Travel class</span><strong>{offer.class}</strong></div><div className="summary-row"><span>Lead traveller</span><strong>{name || 'Add traveller name'}</strong></div><div className="summary-row"><span>Bus seats</span><strong>{seatCodes.join(', ') || (offer.type === 'BUS' ? 'Select seats' : 'Assigned by provider')}</strong></div><div className="summary-total"><span>Total · {passengerCount} traveller{passengerCount === 1 ? '' : 's'}</span><strong>{money(offer.priceMinor * passengerCount)}</strong></div>{offer.flight && <p className="summary-includes">Base {money(offer.flight.baseFareMinor * passengerCount)} · Taxes {money(offer.flight.taxesMinor * passengerCount)}</p>}<p className="summary-includes">Indicative demo fare · Taxes included</p></aside></div></div>;
}

function Confirmation() {
  const { reference = '' } = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [paid, setPaid] = useState(false);
  const load = () => api<{ booking: Booking }>(`/bookings/${reference}`).then((data) => { setBooking(data.booking); if (data.booking.status === 'CONFIRMED') setPaid(true); }).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, [reference]);
  const pay = async () => {
    setBusy(true); setError('');
    try { await api(`/bookings/${reference}/demo-payment`, { method: 'POST', body: '{}' }); setPaid(true); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const chooseGift = async (giftChoice: typeof giftHampers[number]['id']) => {
    setGiftBusy(true); setError(''); setGiftMessage('');
    try {
      const result = await api<{ booking: Booking }>(`/bookings/${reference}/gift`, { method: 'POST', body: JSON.stringify({ giftChoice }) });
      setBooking(result.booking);
      setGiftMessage('Your demo hamper choice is saved with this booking.');
    } catch (e) { setError((e as Error).message); }
    finally { setGiftBusy(false); }
  };
  if (!booking) return <div className="page-wrap content-page">{error ? <div className="notice error-notice">{error}</div> : <div className="loading-card"><span className="spinner" /> Loading booking…</div>}</div>;
  const giftEligible = booking.status === 'CONFIRMED' && booking.payment?.status === 'VERIFIED' && booking.demo && new Date(booking.offer.departAt).getTime() > Date.now();
  return <div className="page-wrap content-page confirmation-page"><div className={paid ? 'confirmation-mark paid' : 'confirmation-mark'}>{paid ? <Check size={32} /> : <Clock3 size={32} />}</div><p className="eyebrow gold-text">{paid ? 'YOUR JOURNEY IS CONFIRMED' : 'BOOKING RESERVED'}</p><h1>{paid ? <>It’s official.<br /><em>Happy travels.</em></> : <>One last step.<br /><em>Make it yours.</em></>}</h1><p className="confirmation-copy">{paid ? 'Your demo booking is confirmed. This test journey is not a real ticket or transport reservation.' : 'Your place is held in this demo while you complete the simulated payment.'}</p><div className="panel confirmation-ticket"><div className="ticket-top"><div><span>BOOKING REFERENCE</span><strong>{booking.reference}</strong></div><span className="demo-badge">DEMO BOOKING</span></div><div className="ticket-route"><div>{iconFor(booking.offer.type, 20)}<span>{booking.offer.provider} · {booking.offer.code}</span></div><div className="summary-line"><strong>{booking.offer.origin}</strong><i /><strong>{booking.offer.destination}</strong></div><span>{dateLabel(booking.offer.departAt, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span></div><div className="ticket-bottom"><span>{booking.passengerName}</span><strong>{money(booking.amountMinor)}</strong></div></div>
    <section className="gift-section"><div className="gift-heading"><span className="gift-icon"><Gift size={19} /></span><div><p className="eyebrow gold-text">A LITTLE EXTRA</p><h2>Choose a travel hamper</h2></div></div>
      <p className="gift-eligibility">Eligible for confirmed, payment-verified demo bookings before departure. Select a preview option below; real-world fulfilment and delivery are not connected.</p>
      {giftEligible ? <div className="gift-options">{giftHampers.map((hamper) => <article className={`gift-option ${booking.giftChoice === hamper.id ? 'selected' : ''}`} key={hamper.id}>
        <div className="gift-photo"><img src={hamper.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /><Gift size={24} /></div>
        <div className="gift-option-copy"><h3>{hamper.name}</h3><p>{hamper.description}</p><button className={`button ${booking.giftChoice === hamper.id ? 'button-gold' : 'button-outline'} button-small`} type="button" disabled={giftBusy} aria-pressed={booking.giftChoice === hamper.id} onClick={() => void chooseGift(hamper.id)}>{booking.giftChoice === hamper.id ? 'Selected' : 'Choose hamper'}</button></div>
      </article>)}</div> : <p className="gift-ineligible">{booking.status === 'PENDING' ? 'Complete the demo payment to confirm this booking and unlock hamper previews.' : booking.status === 'CONFIRMED' ? 'This booking is not eligible because it has departed or is not a paid demo booking.' : 'Gift previews are available only while a booking is confirmed and before departure.'}</p>}
      {giftMessage && <p className="success-message" role="status">{giftMessage}</p>}
      <p className="gift-disclaimer">Illustrative hamper photos and options only. Selection is saved to this demo booking; no products are sold, packed or shipped.</p>
    </section>
    {error && <div className="notice error-notice">{error}</div>}{!paid && <button className="button button-gold button-wide" onClick={pay} disabled={busy}>{busy ? 'Verifying test payment…' : <>Complete demo payment <ArrowRight size={16} /></>}</button>}<p className="demo-disclaimer">Demo mode only · No real payment has been processed and no real-world ticket has been issued.</p><div className="confirmation-actions"><Link className="button button-navy" to="/bookings">View my journeys</Link><button className="button button-outline" onClick={() => window.print()}>Print confirmation</button></div></div>;
}

function AuthPage({ mode, user, setUser }: { mode: 'login' | 'register'; user: User | null; setUser: (user: User) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={params.get('next') || '/'} replace />;
  const isRegister = mode === 'register';
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (isRegister && password !== confirmPassword) { setError('Your passwords do not match.'); return; }
    const value = contact.trim();
    const email = value.includes('@') ? value : '';
    const phone = email ? '' : value;
    if (isRegister && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address or use your mobile number.'); return; }
    if (isRegister && !email && (!/^[+()\d\s-]{7,30}$/.test(phone) || phone.replace(/\D/g, '').length < 7)) { setError('Enter a valid mobile number or use your email address.'); return; }
    setBusy(true);
    try {
      const result = await api<{ user: User; token: string }>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(isRegister
        ? { name, email: email.trim() || undefined, phone: phone.trim() || undefined, password }
        : { identifier, password }) });
      if (isRegister) {
        setIdentifier(value);
        setPassword('');
        setConfirmPassword('');
        navigate('/login', { replace: true, state: { registrationSuccess: true } });
        return;
      }
      localStorage.setItem('traverse_token', result.token); setUser(result.user); navigate(params.get('next') || '/');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const registrationSuccess = (location.state as { registrationSuccess?: boolean } | null)?.registrationSuccess === true;
  return <div className="auth-layout"><div className="auth-visual"><div><span className="eyebrow">A WORLD OF YOUR OWN</span><h2>Every great<br />story starts<br /><em>somewhere.</em></h2></div><p>Find your way there with Traverse Elite.</p></div><div className="auth-content"><div className="auth-card"><Link to="/" className="back-link"><ArrowRight className="back-arrow" size={15} /> Back to home</Link><p className="eyebrow gold-text">{isRegister ? 'YOUR JOURNEY BEGINS' : 'GOOD TO HAVE YOU BACK'}</p><h1>{isRegister ? 'Make room for more.' : 'Welcome back.'}</h1><p className="muted">{isRegister ? 'Create an account to keep every journey in one place.' : 'Sign in to pick up where your next adventure begins.'}</p>{!isRegister && registrationSuccess && <p className="success-message auth-success" role="status">Your account has been created. Sign in to continue.</p>}<form onSubmit={submit}>{isRegister ? <><label className="input-label">Your name<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" /></label><label className="input-label">Email address or mobile number<input type="text" value={contact} onChange={(e) => setContact(e.target.value)} required autoComplete="username" aria-describedby="contact-help" placeholder="you@example.com or mobile number" /><small id="contact-help">Use one contact method. Email or mobile is required.</small></label></> : <label className="input-label">Email address or mobile number<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" /></label>}<label className="input-label">Password<span className="password-input"><input type={passwordVisible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isRegister ? 10 : 1} maxLength={100} autoComplete={isRegister ? 'new-password' : 'current-password'} /><button type="button" aria-label={passwordVisible ? 'Hide password' : 'Show password'} onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{isRegister && <small>Use at least 10 characters.</small>}</label>{isRegister && <label className="input-label">Confirm password<input type={passwordVisible ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={10} maxLength={100} autoComplete="new-password" /></label>}{!isRegister && <Link className="forgot-link" to="/forgot-password">Forgot password?</Link>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-navy button-wide" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button></form><p className="auth-switch">{isRegister ? 'Already have an account?' : "Don't have an account?"} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Sign Up'}</Link></p>{!isRegister && <div className="demo-login"><span>DEMO ACCESS</span><p>Traveler: traveler@traverse.test<br />Password: TraverseDemo!2026</p></div>}</div></div></div>;
}

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); setError(''); try { const r = await api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setMessage(r.message); } catch (err) { setError((err as Error).message); } };
  return <div className="auth-simple"><p className="eyebrow gold-text">ACCOUNT RECOVERY</p><h1>A fresh start.</h1><p>Enter your account email. If we find it, we’ll help you reset your password.</p><form onSubmit={submit}><label className="input-label">Email address<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>{error && <p className="form-error">{error}</p>}{message && <p className="success-message">{message}</p>}<button className="button button-navy button-wide">Send reset instructions</button></form><Link className="text-link" to="/login">Back to sign in</Link></div>;
}
function ResetPassword() {
  const [params] = useSearchParams(); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); try { const result = await api<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: params.get('token'), password }) }); setMessage(result.message); } catch (err) { setError((err as Error).message); } };
  return <div className="auth-simple"><p className="eyebrow gold-text">NEW PASSWORD</p><h1>Start fresh.</h1><form onSubmit={submit}><label className="input-label">New password<input type="password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="form-error">{error}</p>}{message && <p className="success-message">{message}</p>}<button className="button button-navy button-wide">Update password</button></form></div>;
}

function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { api<{ bookings: Booking[] }>('/bookings').then((data) => setBookings(data.bookings)).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <div className="page-wrap content-page"><p className="eyebrow gold-text">YOUR TRAVEL JOURNAL</p><h1>My journeys.</h1><p className="muted">Every confirmation, all in one place.</p>{error && <div className="notice error-notice">{error}</div>}{loading ? <div className="loading-card"><span className="spinner" /> Gathering your journeys…</div> : bookings.length ? <div className="booking-list">{bookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)}</div> : <div className="empty-state"><div className="empty-icon"><Plane /></div><h2>Your next journey is waiting.</h2><p>Once you book, you’ll find all the details right here.</p><Link className="button button-navy" to="/">Find a journey</Link></div>}</div>;
}
function BookingCard({ booking }: { booking: Booking }) { return <Link className="booking-card" to={`/bookings/${booking.reference}`}><div className="booking-icon">{iconFor(booking.offer.type, 21)}</div><div className="booking-main"><strong>{booking.offer.origin} <span>→</span> {booking.offer.destination}</strong><span>{booking.offer.provider} · {dateLabel(booking.offer.departAt, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div><span className={`status-pill status-${booking.status.toLowerCase()}`}>{booking.status}</span><div className="booking-price"><strong>{money(booking.amountMinor)}</strong><span>{booking.reference}</span></div><ArrowRight className="booking-arrow" size={17} /></Link>; }
function BookingDetails() {
  const { reference = '' } = useParams(); const [booking, setBooking] = useState<Booking | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => api<{ booking: Booking }>(`/bookings/${reference}`).then((data) => setBooking(data.booking)).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, [reference]);
  const cancel = async () => { if (!window.confirm('Cancel this booking? The demo booking will be released and eligible payments refunded in demo mode.')) return; setBusy(true); try { await api(`/bookings/${reference}/cancel`, { method: 'POST', body: '{}' }); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <div className="page-wrap content-page narrow-page"><div className="breadcrumbs"><Link to="/bookings">My journeys</Link><span>/</span><span>{reference}</span></div>{error && <div className="notice error-notice">{error}</div>}{!booking ? <div className="loading-card"><span className="spinner" /> Loading booking…</div> : <><p className="eyebrow gold-text">BOOKING DETAILS</p><h1>{booking.offer.origin} <span className="muted-arrow">→</span> {booking.offer.destination}</h1><div className="panel detail-card"><div className="ticket-top"><div><span>BOOKING REFERENCE</span><strong>{booking.reference}</strong></div><span className={`status-pill status-${booking.status.toLowerCase()}`}>{booking.status}</span></div><div className="detail-route"><div><strong>{dateLabel(booking.offer.departAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</strong><span>{booking.offer.origin}</span><small>{dateLabel(booking.offer.departAt)}</small></div><div className="detail-line"><span>{durationLabel(booking.offer.durationMin)}</span><i /><small>{booking.offer.stops === 0 ? 'Direct journey' : `${booking.offer.stops} stops`}</small></div><div><strong>{dateLabel(booking.offer.arriveAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</strong><span>{booking.offer.destination}</span><small>{dateLabel(booking.offer.arriveAt)}</small></div></div><div className="summary-row"><span>Traveller</span><strong>{booking.passengerName}</strong></div><div className="summary-row"><span>Provider</span><strong>{booking.offer.provider} · {booking.offer.code}</strong></div><div className="summary-total"><span>Demo fare</span><strong>{money(booking.amountMinor)}</strong></div><div className="notice demo-notice">DEMO BOOKING — this is not a real ticket or provider confirmation.</div>{['CONFIRMED', 'PENDING'].includes(booking.status) && <button className="button button-outline danger-button" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel booking'}</button>}<button className="button button-outline" onClick={() => window.print()}>Print receipt</button></div></>}</div>;
}

function Profile({ user, setUser }: { user: User; setUser: (user: User) => void }) {
  const [name, setName] = useState(user.name); const [phone, setPhone] = useState(user.phone || ''); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); setMessage(''); setError(''); try { const r = await api<{ user: User }>('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name, phone: phone || undefined }) }); setUser(r.user); setMessage('Your profile has been updated.'); } catch (err) { setError((err as Error).message); } };
  return <div className="page-wrap content-page narrow-page"><p className="eyebrow gold-text">YOUR ACCOUNT</p><h1>Make yourself<br /><em>at home.</em></h1><div className="panel"><form onSubmit={submit}><label className="input-label">Full name<input value={name} onChange={(e) => setName(e.target.value)} minLength={2} required /></label><label className="input-label">Email address<input value={user.email || ''} disabled /></label><label className="input-label">Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>{error && <p className="form-error">{error}</p>}{message && <p className="success-message">{message}</p>}<button className="button button-navy">Save changes</button></form><Link className="text-link" to="/bookings">View your bookings <ArrowRight size={15} /></Link></div></div>;
}

function Destinations() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = ['All', 'Culture', 'Coast', 'Nature', 'City'];
  const visibleDestinations = destinations.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    const searchText = `${item.name} ${item.country} ${item.description} ${item.category}`.toLowerCase();
    return matchesCategory && searchText.includes(query.trim().toLowerCase());
  });
  return <div className="page-wrap content-page destinations-page"><p className="eyebrow gold-text">TAKE THE SCENIC ROUTE</p><h1>Places with a<br /><em>story to tell.</em></h1><p className="muted">Thirty-two ideas, from close-to-home escapes to faraway favourites. Browse by mood or find a place by name.</p>
    <div className="destination-tools"><label className="destination-search"><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destinations, countries or experiences" aria-label="Search destinations" /></label>
      <div className="destination-filters" aria-label="Filter destinations by category">{categories.map((item) => <button key={item} type="button" className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    </div>
    <p className="destination-count" aria-live="polite">{visibleDestinations.length} {visibleDestinations.length === 1 ? 'destination' : 'destinations'} to inspire your next journey</p>
    {visibleDestinations.length ? <div className="discover-grid"><DestinationCards items={visibleDestinations} /></div> : <div className="empty-state destination-empty"><div className="empty-icon"><Search size={24} /></div><h2>No places found</h2><p>Try another destination name or choose a different category.</p><button className="button button-outline" type="button" onClick={() => { setQuery(''); setCategory('All'); }}>Clear filters</button></div>}
  </div>;
}
function Help() { return <div className="page-wrap content-page narrow-page"><p className="eyebrow gold-text">HERE TO HELP</p><h1>A few good<br /><em>answers.</em></h1><div className="help-list">{[
  ['Are these real tickets?', 'No. This app is currently in DEMO mode. Sample routes, prices, seats and bookings are for product demonstration only. No real transport provider or payment service is connected.'],
  ['How do demo payments work?', 'After you reserve a demo journey, choose “Complete demo payment”. Our server marks the test payment as verified and confirms a clearly labelled demo booking. No card details or real money are involved.'],
  ['Can I cancel a booking?', 'You can cancel a pending or confirmed demo booking before its departure. Eligible demo payments are marked as demo-refunded. This is not an actual transfer of funds.'],
  ['When will live transport be available?', 'Live searches and bookings require authorized provider contracts and server-side adapters. Configure a provider integration only after obtaining credentials and permission.'],
].map(([q, a]) => <details className="faq-item" key={q}><summary>{q}<ChevronDown size={18} /></summary><p>{a}</p></details>)}</div><div className="notice demo-notice">Need help? Contact <a href="mailto:hello@traverse.example">hello@traverse.example</a> (demo contact).</div></div>; }

function Admin() {
  const [stats, setStats] = useState<{ users: number; bookings: number; verifiedRevenueMinor: number; recentBookings: Array<Booking & { user: { name: string; email: string } }>; statuses: Array<{ status: string; _count: { _all: number } }>; mode: string } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([
      api<NonNullable<typeof stats>>('/admin/stats'),
      api<{ users: typeof users }>('/admin/users'),
      api<{ offers: Offer[] }>('/admin/offers'),
    ]).then(([summary, accountData, offerData]) => {
      setStats(summary); setUsers(accountData.users); setOffers(offerData.offers);
    }).catch((e: Error) => setError(e.message));
  }, []);
  return <div className="page-wrap content-page"><div className="admin-heading"><div><p className="eyebrow gold-text">TRAVERSE OPERATIONS</p><h1>A clear view<br /><em>of the journey.</em></h1></div><span className="mode-tag">ADMIN · {stats?.mode.toUpperCase() || 'DEMO'} MODE</span></div>{error && <div className="notice error-notice">{error}</div>}{!stats ? <div className="loading-card"><span className="spinner" /> Gathering your overview…</div> : <><div className="stats-grid"><Stat title="Total travellers" value={stats.users} icon={<Users />} /><Stat title="Demo bookings" value={stats.bookings} icon={<Plane />} /><Stat title="Verified demo payments" value={money(stats.verifiedRevenueMinor)} icon={<CreditCard />} /><Stat title="Booking statuses" value={stats.statuses.length} icon={<BadgeCheck />} /></div><div className="status-breakdown">{stats.statuses.map((item) => <span key={item.status}><b>{item._count._all}</b> {item.status.toLowerCase()}</span>)}</div><div className="admin-columns"><section className="panel"><div className="panel-title"><div><h2>Recent bookings</h2><p>Latest booking activity</p></div><Link to="/bookings" className="text-link">View all <ArrowRight size={15} /></Link></div>{stats.recentBookings.length ? <div className="admin-table">{stats.recentBookings.map((booking) => <div className="admin-row" key={booking.id}><div><strong>{booking.user.name}</strong><span>{booking.user.email}</span></div><div><strong>{booking.offer.origin} → {booking.offer.destination}</strong><span>{booking.reference}</span></div><span className={`status-pill status-${booking.status.toLowerCase()}`}>{booking.status}</span></div>)}</div> : <p className="muted">Your first demo booking will show up here.</p>}</section><section className="panel"><div className="panel-title"><div><h2>Provider status</h2><p>Connected service overview</p></div></div>{['Trains', 'Buses', 'Flights', 'Payments'].map((item) => <div className="provider-row" key={item}><span>{item}</span><span className="provider-status"><i /> Demo only</span></div>)}<p className="fineprint">No live transport or payment providers are configured. Admin tools cannot invent provider confirmations.</p><Link to="/help" className="text-link">Integration notes <ArrowRight size={15} /></Link></section></div><AdminUsers users={users} onUpdate={(updated) => setUsers((old) => old.map((item) => item.id === updated.id ? updated : item))} /><AdminOffers offers={offers} onUpdate={(updated) => setOffers((old) => old.map((item) => item.id === updated.id ? updated : item))} onCreate={(created) => setOffers((old) => [created, ...old])} /></>}</div>;
}
function Stat({ title, value, icon }: { title: string; value: React.ReactNode; icon: React.ReactNode }) { return <div className="stat-card"><span className="stat-icon">{icon}</span><p>{title}</p><strong>{value}</strong></div>; }
function AdminUsers({ users, onUpdate }: { users: AdminUser[]; onUpdate: (user: AdminUser) => void }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const updateRole = async (user: AdminUser) => {
    setBusyId(user.id); setError('');
    try { const result = await api<{ user: AdminUser }>(`/admin/users/${user.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' }) }); onUpdate(result.user); }
    catch (e) { setError((e as Error).message); } finally { setBusyId(''); }
  };
  return <section className="panel admin-management"><div className="panel-title"><div><h2>Account access</h2><p>Manage roles enforced by the API</p></div></div>{error && <p className="form-error">{error}</p>}<div className="admin-table">{users.map((user) => <div className="admin-row" key={user.id}><div><strong>{user.name}</strong><span>{user.email}</span></div><div><span>Joined {dateLabel(user.createdAt)}</span></div><button className="button button-outline button-small" onClick={() => updateRole(user)} disabled={busyId === user.id}>{busyId === user.id ? 'Saving…' : user.role === 'ADMIN' ? 'Make traveller' : 'Make admin'}</button></div>)}</div></section>;
}
function AdminOffers({ offers, onUpdate, onCreate }: { offers: Offer[]; onUpdate: (offer: Offer) => void; onCreate: (offer: Offer) => void }) {
  const [drafts, setDrafts] = useState<Record<string, { priceMinor: string; available: string; class: string }>>({});
  const [newOffer, setNewOffer] = useState({ type: 'TRAIN', provider: '', code: '', origin: '', destination: '', departAt: '', arriveAt: '', durationMin: '180', priceMinor: '100000', class: 'Standard', capacity: '40', available: '40', stops: '0', amenities: '' });
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const create = async (event: FormEvent) => {
    event.preventDefault(); setMessage(''); setError('');
    try {
      const result = await api<{ offer: Offer }>('/admin/offers', { method: 'POST', body: JSON.stringify({
        ...newOffer, durationMin: Number(newOffer.durationMin), priceMinor: Number(newOffer.priceMinor),
        capacity: Number(newOffer.capacity), available: Number(newOffer.available), stops: Number(newOffer.stops),
        departAt: new Date(newOffer.departAt).toISOString(), arriveAt: new Date(newOffer.arriveAt).toISOString(), currency: 'INR',
      }) });
      onCreate(result.offer); setMessage(`${result.offer.code} added to the demo catalogue.`);
      setNewOffer((old) => ({ ...old, provider: '', code: '', origin: '', destination: '', departAt: '', arriveAt: '', amenities: '' }));
    } catch (e) { setError((e as Error).message); }
  };
  const save = async (offer: Offer) => {
    const draft = drafts[offer.id] || { priceMinor: String(offer.priceMinor), available: String(offer.available), class: offer.class };
    setBusyId(offer.id); setMessage(''); setError('');
    try {
      const result = await api<{ offer: Offer }>(`/admin/offers/${offer.id}`, { method: 'PATCH', body: JSON.stringify({ priceMinor: Number(draft.priceMinor), available: Number(draft.available), class: draft.class }) });
      onUpdate(result.offer); setMessage(`${offer.code} updated.`);
    } catch (e) { setError((e as Error).message); } finally { setBusyId(''); }
  };
  return <section className="panel admin-management"><div className="panel-title"><div><h2>Demo travel inventory</h2><p>Adjust illustrative fare, class and available places</p></div><span className="demo-badge">DEMO ONLY</span></div>{error && <p className="form-error">{error}</p>}{message && <p className="success-message">{message}</p>}<details className="admin-create"><summary>Add demo travel option <ChevronDown size={16} /></summary><form className="admin-create-grid" onSubmit={create}><label>Type<select value={newOffer.type} onChange={(e) => setNewOffer({ ...newOffer, type: e.target.value })}><option value="TRAIN">Train</option><option value="BUS">Bus</option><option value="FLIGHT">Flight</option></select></label><label>Provider<input required minLength={2} value={newOffer.provider} onChange={(e) => setNewOffer({ ...newOffer, provider: e.target.value })} /></label><label>Code<input required minLength={2} value={newOffer.code} onChange={(e) => setNewOffer({ ...newOffer, code: e.target.value })} /></label><label>Origin<input required minLength={2} value={newOffer.origin} onChange={(e) => setNewOffer({ ...newOffer, origin: e.target.value })} /></label><label>Destination<input required minLength={2} value={newOffer.destination} onChange={(e) => setNewOffer({ ...newOffer, destination: e.target.value })} /></label><label>Departure<input type="datetime-local" required value={newOffer.departAt} onChange={(e) => setNewOffer({ ...newOffer, departAt: e.target.value })} /></label><label>Arrival<input type="datetime-local" required value={newOffer.arriveAt} onChange={(e) => setNewOffer({ ...newOffer, arriveAt: e.target.value })} /></label><label>Duration (minutes)<input type="number" min="1" required value={newOffer.durationMin} onChange={(e) => setNewOffer({ ...newOffer, durationMin: e.target.value })} /></label><label>Fare (paise)<input type="number" min="1" required value={newOffer.priceMinor} onChange={(e) => setNewOffer({ ...newOffer, priceMinor: e.target.value })} /></label><label>Class<input required minLength={2} value={newOffer.class} onChange={(e) => setNewOffer({ ...newOffer, class: e.target.value })} /></label><label>Capacity<input type="number" min="1" required value={newOffer.capacity} onChange={(e) => setNewOffer({ ...newOffer, capacity: e.target.value })} /></label><label>Available<input type="number" min="0" required value={newOffer.available} onChange={(e) => setNewOffer({ ...newOffer, available: e.target.value })} /></label><label>Stops<input type="number" min="0" value={newOffer.stops} onChange={(e) => setNewOffer({ ...newOffer, stops: e.target.value })} /></label><label>Amenities<input value={newOffer.amenities} onChange={(e) => setNewOffer({ ...newOffer, amenities: e.target.value })} placeholder="Wi-Fi,Water" /></label><button className="button button-navy button-small">Add demo option</button></form></details><div className="admin-table">{offers.map((offer) => {
    const draft = drafts[offer.id] || { priceMinor: String(offer.priceMinor), available: String(offer.available), class: offer.class };
    const change = (field: keyof typeof draft, value: string) => setDrafts((old) => ({ ...old, [offer.id]: { ...draft, [field]: value } }));
    return <div className="admin-offer-row" key={offer.id}><div className="admin-offer-title"><strong>{offer.provider} · {offer.code}</strong><span>{offer.origin} → {offer.destination} · {offer.type}</span></div><label>Fare (paise)<input type="number" min="1" value={draft.priceMinor} onChange={(e) => change('priceMinor', e.target.value)} /></label><label>Places<input type="number" min="0" max="1000" value={draft.available} onChange={(e) => change('available', e.target.value)} /></label><label>Class<input value={draft.class} onChange={(e) => change('class', e.target.value)} /></label><button className="button button-navy button-small" onClick={() => save(offer)} disabled={busyId === offer.id}>{busyId === offer.id ? 'Saving…' : 'Save'}</button></div>;
  })}</div><p className="fineprint">Admin changes only affect the local demo catalogue. Live-provider listings are protected from manual confirmation or editing.</p></section>;
}

function NotFound() { return <div className="auth-simple not-found"><span className="eyebrow gold-text">NOT QUITE THE RIGHT TURN</span><h1>We can’t find<br />that place.</h1><p>The page may have moved. Let’s get you back on your way.</p><Link className="button button-navy" to="/">Back to the beginning <ArrowRight size={16} /></Link></div>; }
function Footer() { return <footer className="footer"><div className="page-wrap footer-main"><div><Link className="brand footer-brand" to="/"><span className="brand-mark">T</span><span>TRAVERSE <b>ELITE</b></span></Link><p>Thoughtful journeys.<br />Stories that stay with you.</p></div><div className="footer-links"><div><strong>Explore</strong><Link to="/trains/search">Trains</Link><Link to="/buses/search">Buses</Link><Link to="/flights/search">Flights</Link><Link to="/nearby">Nearby essentials</Link><Link to="/destinations">Destinations</Link></div><div><strong>Your Traverse</strong><Link to="/bookings">My journeys</Link><Link to="/profile">Your account</Link><Link to="/help">Help & FAQs</Link></div><div><strong>Our promise</strong><span>Thoughtful travel</span><span>Clear choices</span><span>Here to help</span></div></div></div><div className="page-wrap footer-bottom"><span>© 2026 Traverse Elite. Made for the joy of getting there.</span><span className="footer-demo">Demo experience · Sample data only</span><Link to="/help">Privacy & help</Link></div></footer>; }
