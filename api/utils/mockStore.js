import bcryptjs from 'bcryptjs';

const mockUsers = new Map();
const mockListings = new Map();
const deletedListingIds = new Set();

// Seed initial mock users, hosts, and guests with names, emails, and phone numbers
const seedUsersData = [
  {
    _id: 'user_joe_001',
    username: 'Joe Patriot',
    displayName: 'Joe Patriot',
    email: 'joepatriot30@gmail.com',
    phone: '+1 202-555-0149',
    phoneNumber: '+1 202-555-0149',
    password: bcryptjs.hashSync('password123', 10),
    role: 'admin',
    isAdmin: true,
    accountType: 'admin',
    verified: true,
    emailVerified: true,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
  {
    _id: 'user_joss_001',
    username: 'Joss Vision',
    displayName: 'Joss Vision',
    email: 'jossvision11@gmail.com',
    phone: '+1 305-555-0182',
    phoneNumber: '+1 305-555-0182',
    password: bcryptjs.hashSync('password123', 10),
    role: 'admin',
    isAdmin: true,
    accountType: 'admin',
    verified: true,
    emailVerified: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-01-05').toISOString(),
    updatedAt: new Date('2024-01-05').toISOString(),
  },
  {
    _id: 'user_sahand_001',
    username: 'Chento Fleet Master',
    displayName: 'Chento Fleet Admin',
    email: 'admin@chento100.com',
    phone: '+1 800-555-0100',
    phoneNumber: '+1 800-555-0100',
    password: bcryptjs.hashSync('password123', 10),
    role: 'admin',
    isAdmin: true,
    accountType: 'admin',
    verified: true,
    emailVerified: true,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-10').toISOString(),
  },
  // HOSTS (Service Providers: Guest House Hosts & Car/Driver Chauffeur Hosts)
  {
    _id: 'host_elena_001',
    username: 'Elena Rostova',
    displayName: 'Elena Rostova',
    email: 'elena.rostova@guesthousehub.com',
    phone: '+1 305-555-8821',
    phoneNumber: '+1 305-555-8821',
    password: bcryptjs.hashSync('password123', 10),
    role: 'host',
    isAdmin: false,
    accountType: 'host',
    hostType: 'guesthouse',
    serviceCategory: 'guesthouse',
    businessName: 'Rostova City Apartments',
    verified: true,
    emailVerified: true,
    listingsCount: 2,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-02-01').toISOString(),
    updatedAt: new Date('2024-02-01').toISOString(),
  },
  {
    _id: 'host_marcus_002',
    username: 'Marcus Vance',
    displayName: 'Marcus Vance',
    email: 'marcus.vance@citychauffeurs.com',
    phone: '+1 305-555-0199',
    phoneNumber: '+1 305-555-0199',
    password: bcryptjs.hashSync('password123', 10),
    role: 'host',
    isAdmin: false,
    accountType: 'host',
    hostType: 'car_service',
    serviceCategory: 'car_service',
    businessName: 'Vance Executive Chauffeur Services',
    verified: true,
    emailVerified: true,
    listingsCount: 1,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-02-10').toISOString(),
    updatedAt: new Date('2024-02-10').toISOString(),
  },
  {
    _id: 'host_amara_003',
    username: 'Amara Diop',
    displayName: 'Amara Diop',
    email: 'amara.diop@urbanstays.com',
    phone: '+1 718-555-3342',
    phoneNumber: '+1 718-555-3342',
    password: bcryptjs.hashSync('password123', 10),
    role: 'host',
    isAdmin: false,
    accountType: 'host',
    hostType: 'guesthouse',
    serviceCategory: 'guesthouse',
    businessName: 'Riverside Modern Lofts',
    verified: true,
    emailVerified: true,
    listingsCount: 1,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-02-20').toISOString(),
    updatedAt: new Date('2024-02-20').toISOString(),
  },
  {
    _id: 'host_james_004',
    username: 'James Wilson',
    displayName: 'James Wilson',
    email: 'james.wilson@metrodrivers.com',
    phone: '+1 718-555-0142',
    phoneNumber: '+1 718-555-0142',
    password: bcryptjs.hashSync('password123', 10),
    role: 'host',
    isAdmin: false,
    accountType: 'host',
    hostType: 'car_service',
    serviceCategory: 'car_service',
    businessName: 'Wilson City Car & Chauffeur',
    verified: true,
    emailVerified: true,
    listingsCount: 1,
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-03-01').toISOString(),
    updatedAt: new Date('2024-03-01').toISOString(),
  },
  {
    _id: 'host_david_005',
    username: 'David Chen',
    displayName: 'David Chen',
    email: 'david.chen@elitechauffeuring.com',
    phone: '+1 415-555-0188',
    phoneNumber: '+1 415-555-0188',
    password: bcryptjs.hashSync('password123', 10),
    role: 'host',
    isAdmin: false,
    accountType: 'host',
    hostType: 'car_service',
    serviceCategory: 'car_service',
    businessName: 'Golden Gate Executive Chauffeur Fleet',
    verified: true,
    emailVerified: true,
    listingsCount: 1,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-03-08').toISOString(),
    updatedAt: new Date('2024-03-08').toISOString(),
  },
  // USERS / GUESTS (Registered Travelers & Ride Clients)
  {
    _id: 'guest_sarah_001',
    username: 'Sarah Jenkins',
    displayName: 'Sarah Jenkins',
    email: 'sarah.jenkins@gmail.com',
    phone: '+1 646-555-0128',
    phoneNumber: '+1 646-555-0128',
    password: bcryptjs.hashSync('password123', 10),
    role: 'user',
    isAdmin: false,
    accountType: 'user',
    hostType: null,
    bookingsCount: 3,
    inquiriesCount: 4,
    verified: true,
    emailVerified: true,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-03-12').toISOString(),
    updatedAt: new Date('2024-03-12').toISOString(),
  },
  {
    _id: 'guest_mateo_002',
    username: 'Mateo Rossi',
    displayName: 'Mateo Rossi',
    email: 'mateo.rossi@outlook.com',
    phone: '+39 06 6987 1234',
    phoneNumber: '+39 06 6987 1234',
    password: bcryptjs.hashSync('password123', 10),
    role: 'user',
    isAdmin: false,
    accountType: 'user',
    hostType: null,
    bookingsCount: 2,
    inquiriesCount: 3,
    verified: true,
    emailVerified: true,
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-03-15').toISOString(),
    updatedAt: new Date('2024-03-15').toISOString(),
  },
  {
    _id: 'guest_chloe_003',
    username: 'Chloe Martin',
    displayName: 'Chloe Martin',
    email: 'chloe.martin@yahoo.fr',
    phone: '+33 6 12 34 56 78',
    phoneNumber: '+33 6 12 34 56 78',
    password: bcryptjs.hashSync('password123', 10),
    role: 'user',
    isAdmin: false,
    accountType: 'user',
    hostType: null,
    bookingsCount: 1,
    inquiriesCount: 2,
    verified: false,
    emailVerified: true,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-03-22').toISOString(),
    updatedAt: new Date('2024-03-22').toISOString(),
  },
  {
    _id: 'guest_lucas_004',
    username: 'Lucas Alvarez',
    displayName: 'Lucas Alvarez',
    email: 'lucas.alvarez@gmail.com',
    phone: '+1 312-555-0176',
    phoneNumber: '+1 312-555-0176',
    password: bcryptjs.hashSync('password123', 10),
    role: 'user',
    isAdmin: false,
    accountType: 'user',
    hostType: null,
    bookingsCount: 4,
    inquiriesCount: 5,
    verified: true,
    emailVerified: false,
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date('2024-03-28').toISOString(),
    updatedAt: new Date('2024-03-28').toISOString(),
  },
];

seedUsersData.forEach((u) => {
  mockUsers.set(u._id, u);
});

const initialUser = mockUsers.get('user_sahand_001');
const jossUser = mockUsers.get('user_joss_001');
const joeUser = mockUsers.get('user_joe_001');

// Seed initial mock guest houses & car rentals with driver (normal Airbnb apartments and regular city cars)
const initialListings = [
  {
    _id: 'listing_001',
    title: 'Modern Downtown Studio Apartment Airbnb',
    name: 'Modern Downtown Studio Apartment Airbnb',
    description: 'Bright and stylish modern studio apartment guest house in the city center. Features an open-concept living space with plush sofa, dedicated work desk, high-speed Wi-Fi, fully equipped kitchen with espresso machine, rainfall shower, and self check-in smart lock.',
    location: '450 Pine St, Downtown City Center',
    address: '450 Pine St, Downtown City Center',
    price: 120,
    regularPrice: 120,
    discountPrice: 95,
    category: 'guesthouse',
    bathrooms: 1,
    bedrooms: 1,
    maxGuests: 2,
    amenities: ['WiFi', 'Kitchen', 'Air Conditioning', 'Workspace'],
    furnished: true,
    parking: true,
    type: 'rent',
    offer: true,
    imageUrls: [
      '/images/airbnb_apartment_living.jpg',
      '/images/airbnb_apartment_bed.jpg',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    ],
    userRef: 'host_elena_001',
    ownerName: 'Elena Rostova',
    ownerEmail: 'elena.rostova@guesthousehub.com',
    contactPhone: '+1 305-555-8821',
    createdAt: new Date('2024-02-15').toISOString(),
    updatedAt: new Date('2024-02-15').toISOString(),
  },
  {
    _id: 'listing_002',
    title: 'Toyota Corolla Modern City Sedan with Private Driver',
    name: 'Toyota Corolla Modern City Sedan with Private Driver',
    description: 'Comfortable and dependable modern Toyota Corolla sedan with a courteous, experienced city driver. Perfect for downtown business commutes, airport pickups, shopping trips, and point-to-point urban travel. Clean air-conditioned interior, phone charging ports, and smooth ride.',
    location: 'City Center & Metro Area Route',
    address: 'City Center & Metro Area Route',
    price: 75,
    regularPrice: 75,
    discountPrice: 65,
    category: 'car_service',
    make: 'Toyota',
    model: 'Corolla Sedan',
    year: 2023,
    transmission: 'automatic',
    seats: 4,
    driverIncluded: true,
    driverName: 'Marcus Vance',
    driverContact: '+1 305-555-0199',
    bathrooms: 4,
    bedrooms: 4,
    furnished: true,
    parking: true,
    type: 'sale',
    offer: true,
    imageUrls: [
      '/images/city_regular_sedan.jpg',
      '/images/city_driver_car.jpg',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1200&q=80',
    ],
    userRef: 'host_marcus_002',
    ownerName: 'Marcus Vance',
    ownerEmail: 'marcus.vance@citychauffeurs.com',
    contactPhone: '+1 305-555-0199',
    createdAt: new Date('2024-03-01').toISOString(),
    updatedAt: new Date('2024-03-01').toISOString(),
  },
  {
    _id: 'listing_003',
    title: 'Cozy 2-Bedroom Urban Loft Airbnb with Balcony',
    name: 'Cozy 2-Bedroom Urban Loft Airbnb with Balcony',
    description: 'Spacious contemporary two-bedroom apartment guest suite with floor-to-ceiling windows and private balcony overlooking the city skyline. Features a Scandinavian-inspired living room, memory-foam queen beds, modern kitchen with dishwasher, smart TV with streaming, and in-unit washer/dryer.',
    location: '128 Riverside Ave, Arts District',
    address: '128 Riverside Ave, Arts District',
    price: 165,
    regularPrice: 165,
    discountPrice: 139,
    category: 'guesthouse',
    bathrooms: 2,
    bedrooms: 2,
    maxGuests: 4,
    amenities: ['WiFi', 'Kitchen', 'Balcony', 'Air Conditioning'],
    furnished: true,
    parking: true,
    type: 'rent',
    offer: true,
    imageUrls: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
      '/images/airbnb_apartment_living.jpg',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
    ],
    userRef: 'host_amara_003',
    ownerName: 'Amara Diop',
    ownerEmail: 'amara.diop@urbanstays.com',
    contactPhone: '+1 718-555-3342',
    createdAt: new Date('2024-03-10').toISOString(),
    updatedAt: new Date('2024-03-10').toISOString(),
  },
  {
    _id: 'listing_004',
    title: 'Honda Civic Clean City Car with Professional Driver',
    name: 'Honda Civic Clean City Car with Professional Driver',
    description: 'Reliable and sleek Honda Civic sedan for seamless daily city transportation. Driven by a friendly, vetted local driver who knows all the fastest urban routes and avoids traffic. Equipped with quiet AC, spotless interior, trunk space for 3 suitcases, and onboard charging.',
    location: 'Grand Central Plaza & Financial District',
    address: 'Grand Central Plaza & Financial District',
    price: 80,
    regularPrice: 80,
    discountPrice: 70,
    category: 'car_service',
    make: 'Honda',
    model: 'Civic Sedan',
    year: 2024,
    transmission: 'automatic',
    seats: 4,
    driverIncluded: true,
    driverName: 'James Wilson',
    driverContact: '+1 718-555-0142',
    bathrooms: 4,
    bedrooms: 4,
    furnished: true,
    parking: true,
    type: 'sale',
    offer: true,
    imageUrls: [
      '/images/city_driver_car.jpg',
      '/images/city_regular_sedan.jpg',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1200&q=80',
    ],
    userRef: 'host_james_004',
    ownerName: 'James Wilson',
    ownerEmail: 'james.wilson@metrodrivers.com',
    contactPhone: '+1 718-555-0142',
    createdAt: new Date('2024-03-15').toISOString(),
    updatedAt: new Date('2024-03-15').toISOString(),
  },
  {
    _id: 'listing_005',
    title: 'Sunlit Minimalist 1-Bedroom Airbnb Flat with Balcony',
    name: 'Sunlit Minimalist 1-Bedroom Airbnb Flat with Balcony',
    description: 'Peaceful and minimalist 1-bedroom apartment guest house located in a quiet residential neighborhood with easy metro access. Fully furnished with natural wood accents, comfortable reading chair, fast Wi-Fi, queen bed, and a breezy balcony for morning coffee.',
    location: '742 Maplewood Blvd, Uptown',
    address: '742 Maplewood Blvd, Uptown',
    price: 110,
    regularPrice: 110,
    discountPrice: 0,
    category: 'guesthouse',
    bathrooms: 1,
    bedrooms: 1,
    maxGuests: 3,
    amenities: ['WiFi', 'Air Conditioning', 'Kitchen'],
    furnished: true,
    parking: true,
    type: 'rent',
    offer: false,
    imageUrls: [
      '/images/airbnb_apartment_bed.jpg',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&w=1200&q=80',
    ],
    userRef: 'host_elena_001',
    ownerName: 'Elena Rostova',
    ownerEmail: 'elena.rostova@guesthousehub.com',
    contactPhone: '+1 305-555-8821',
    createdAt: new Date('2024-03-20').toISOString(),
    updatedAt: new Date('2024-03-20').toISOString(),
  },
  {
    _id: 'listing_006',
    title: 'Toyota Camry Executive City Sedan with Chauffeur',
    name: 'Toyota Camry Executive City Sedan with Chauffeur',
    description: 'Spacious and quiet Toyota Camry sedan with private chauffeur for comfortable city rides, business meetings, or airport transfers. Generous rear legroom, tinted rear windows, plush leather seats, dual-zone climate control, and smooth automatic transmission.',
    location: 'Midtown & Metropolitan Highway Hub',
    address: 'Midtown & Metropolitan Highway Hub',
    price: 95,
    regularPrice: 95,
    discountPrice: 0,
    category: 'car_service',
    make: 'Toyota',
    model: 'Camry Sedan',
    year: 2023,
    transmission: 'automatic',
    seats: 5,
    driverIncluded: true,
    driverName: 'David Chen',
    driverContact: '+1 415-555-0188',
    bathrooms: 4,
    bedrooms: 5,
    furnished: true,
    parking: true,
    type: 'sale',
    offer: false,
    imageUrls: [
      'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1200&q=80',
      '/images/city_regular_sedan.jpg',
      'https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&w=1200&q=80',
    ],
    userRef: 'host_david_005',
    ownerName: 'David Chen',
    ownerEmail: 'david.chen@elitechauffeuring.com',
    contactPhone: '+1 415-555-0188',
    createdAt: new Date('2024-03-25').toISOString(),
    updatedAt: new Date('2024-03-25').toISOString(),
  },
];

for (const listing of initialListings) {
  if (listing.category === 'car') {
    listing.category = 'car_service';
  }
  if (!listing.status) {
    listing.status =
      listing._id === 'listing_004' ||
      listing._id === 'listing_005' ||
      listing._id === 'listing_006'
        ? 'pending'
        : 'approved';
  }
  if (listing.isApproved === undefined) {
    listing.isApproved = listing.status === 'approved';
  }
  if (listing.active === undefined) {
    listing.active = true;
  }
  if (listing.isActive === undefined) {
    listing.isActive = listing.active;
  }
  if (!listing.address && listing.location) listing.address = listing.location;
  if (!listing.location && listing.address) listing.location = listing.address;
  if (listing.regularPrice === undefined && listing.price !== undefined) listing.regularPrice = listing.price;
  if (listing.price === undefined && listing.regularPrice !== undefined) listing.price = listing.regularPrice;
  if (!listing.imageURLs && listing.imageUrls) listing.imageURLs = listing.imageUrls;
  if (!listing.imageUrls && listing.imageURLs) listing.imageUrls = listing.imageURLs;
  mockListings.set(listing._id, listing);
}

export const mockStore = {
  users: mockUsers,
  listings: mockListings,

  getAllListings() {
    return Array.from(mockListings.values());
  },

  getListings(query = {}) {
    let list = Array.from(mockListings.values()).filter((item) => !deletedListingIds.has(item._id));

    // Search term
    if (query.searchTerm && typeof query.searchTerm === 'string') {
      const term = query.searchTerm.toLowerCase();
      list = list.filter(
        (item) =>
          (typeof item.name === 'string' && item.name.toLowerCase().includes(term)) ||
          (typeof item.title === 'string' && item.title.toLowerCase().includes(term)) ||
          (typeof item.description === 'string' && item.description.toLowerCase().includes(term)) ||
          (typeof item.address === 'string' && item.address.toLowerCase().includes(term)) ||
          (typeof item.location === 'string' && item.location.toLowerCase().includes(term)) ||
          (typeof item.make === 'string' && item.make.toLowerCase().includes(term)) ||
          (typeof item.model === 'string' && item.model.toLowerCase().includes(term))
      );
    }

    // Category / Type
    let category = query.category;
    if (category === 'car') category = 'car_service';
    if (!category && query.type) {
      if (query.type === 'rent') category = 'guesthouse';
      else if (query.type === 'sale') category = 'car_service';
    }

    if (category && category !== 'all') {
      list = list.filter(
        (item) =>
          item.category === category ||
          (category === 'car_service' && (item.category === 'car' || item.type === 'sale')) ||
          (category === 'guesthouse' && (item.category === 'guesthouse' || item.type === 'rent'))
      );
    }

    // Guesthouse specific filters
    if (query.bedrooms && parseInt(query.bedrooms) > 0) {
      const minBeds = parseInt(query.bedrooms);
      list = list.filter((item) => (item.bedrooms || 0) >= minBeds);
    }
    if (query.bathrooms && parseInt(query.bathrooms) > 0) {
      const minBaths = parseInt(query.bathrooms);
      list = list.filter((item) => (item.bathrooms || 0) >= minBaths);
    }
    if (query.maxGuests && parseInt(query.maxGuests) > 0) {
      const minGuests = parseInt(query.maxGuests);
      list = list.filter((item) => (item.maxGuests || (item.bedrooms ? item.bedrooms * 2 : 2)) >= minGuests);
    }

    const requestedAmenities = [];
    if (query.wifi === 'true') requestedAmenities.push('wifi');
    if (query.kitchen === 'true') requestedAmenities.push('kitchen');
    if (query.airConditioning === 'true') requestedAmenities.push('air');
    if (query.pool === 'true') requestedAmenities.push('pool');
    if (query.amenities && typeof query.amenities === 'string') {
      query.amenities.split(',').forEach((a) => {
        if (a && typeof a === 'string' && a.trim()) requestedAmenities.push(a.trim().toLowerCase());
      });
    }
    if (requestedAmenities.length > 0) {
      list = list.filter((item) => {
        const itemAmenities = Array.isArray(item.amenities)
          ? item.amenities.map((a) => (typeof a === 'string' ? a.toLowerCase() : String(a || '').toLowerCase()))
          : (typeof item.description === 'string' ? item.description.toLowerCase() : '');
        return requestedAmenities.every((reqAmenity) => {
          if (Array.isArray(itemAmenities)) {
            return itemAmenities.some((ia) => ia.includes(reqAmenity));
          }
          return itemAmenities.includes(reqAmenity);
        });
      });
    }

    // Car specific filters
    if (query.transmission && query.transmission !== 'all') {
      list = list.filter((item) => (item.transmission || 'automatic') === query.transmission);
    }
    if (query.driverIncluded === 'true') {
      list = list.filter((item) => item.driverIncluded === true || item.type === 'sale');
    }
    if (query.seats && parseInt(query.seats) > 0) {
      const minSeats = parseInt(query.seats);
      list = list.filter((item) => (item.seats || item.bedrooms || 0) >= minSeats);
    }

    // Sort
    const sortField = query.sort === 'regularPrice' || query.sort === 'price' ? 'regularPrice' : 'createdAt';
    const order = query.order === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const valA = a[sortField] ?? a.price ?? 0;
      const valB = b[sortField] ?? b.price ?? 0;
      if (valA < valB) return -1 * order;
      if (valA > valB) return 1 * order;
      return 0;
    });

    // Pagination
    const startIndex = parseInt(query.startIndex) || 0;
    const limit = parseInt(query.limit) || 9;
    return list.slice(startIndex, startIndex + limit);
  },

  getListing(id) {
    if (deletedListingIds.has(id)) return null;
    return mockListings.get(id) || null;
  },

  createListing(data) {
    const id = data._id || 'listing_' + Date.now();
    deletedListingIds.delete(id);
    const category = data.category === 'car' ? 'car_service' : data.category || 'guesthouse';
    const isApproved =
      data.isApproved !== undefined ? Boolean(data.isApproved) : data.status === 'approved';
    const isActive =
      data.isActive !== undefined
        ? Boolean(data.isActive)
        : data.active !== undefined
        ? Boolean(data.active)
        : true;
    const status = isApproved ? 'approved' : data.status || 'pending';
    const active = isActive;

    const newListing = {
      ...data,
      _id: id,
      category,
      isApproved,
      isActive,
      status,
      active,
      regularPrice: data.regularPrice !== undefined ? data.regularPrice : data.price,
      price: data.price !== undefined ? data.price : data.regularPrice,
      address: data.address || data.location,
      location: data.location || data.address,
      title: data.title || data.name,
      name: data.name || data.title,
      imageURLs: data.imageURLs || data.imageUrls || [],
      imageUrls: data.imageUrls || data.imageURLs || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockListings.set(id, newListing);
    return newListing;
  },

  updateListing(id, data) {
    const existing = mockListings.get(id);
    if (!existing) return null;

    const category =
      data.category === 'car'
        ? 'car_service'
        : data.category !== undefined
        ? data.category
        : existing.category;

    let isApproved = existing.isApproved;
    if (data.isApproved !== undefined) {
      isApproved = Boolean(data.isApproved);
    } else if (data.status !== undefined) {
      isApproved = data.status === 'approved';
    }

    let isActive = existing.isActive;
    if (data.isActive !== undefined) {
      isActive = Boolean(data.isActive);
    } else if (data.active !== undefined) {
      isActive = Boolean(data.active);
    }

    const updated = {
      ...existing,
      ...data,
      category,
      isApproved,
      isActive,
      status: data.status !== undefined ? data.status : isApproved ? 'approved' : 'pending',
      active: isActive,
      updatedAt: new Date().toISOString(),
    };
    mockListings.set(id, updated);
    return updated;
  },

  deleteListing(id) {
    deletedListingIds.add(id);
    return mockListings.delete(id);
  },

  getUserListings(userRef) {
    return Array.from(mockListings.values()).filter(
      (item) => item.userRef === userRef
    );
  },

  getPendingListings() {
    return Array.from(mockListings.values()).filter(
      (item) => item.status === 'pending'
    );
  },

  findUserByEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const target = email.toLowerCase();
    for (const user of mockUsers.values()) {
      if (user && user.email && typeof user.email === 'string' && user.email.toLowerCase() === target) {
        return user;
      }
    }
    return null;
  },

  findUserById(id) {
    return mockUsers.get(id) || null;
  },

  createUser(data) {
    const id = 'user_' + Date.now();
    const isSpecialAdmin =
      data &&
      data.email &&
      typeof data.email === 'string' &&
      (data.email.toLowerCase() === 'jossvision11@gmail.com' ||
        data.email.toLowerCase() === 'admin@chento100.com' ||
        data.email.toLowerCase().includes('admin'));
    const isAdmin = isSpecialAdmin ? true : (data.isAdmin !== undefined ? Boolean(data.isAdmin) : data.role === 'admin');
    const role = isAdmin ? 'admin' : (data.role || 'user');
    const newUser = {
      _id: id,
      ...data,
      isAdmin,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockUsers.set(id, newUser);
    return newUser;
  },

  updateUser(id, data) {
    const user = mockUsers.get(id);
    if (!user) return null;
    const updated = { ...user, ...data, updatedAt: new Date().toISOString() };
    mockUsers.set(id, updated);
    return updated;
  },

  getAllUsers() {
    return Array.from(mockUsers.values());
  },

  deleteUser(id) {
    return mockUsers.delete(id);
  },

  // Enquiries / Concierge Requests
  getEnquiries() {
    return [
      {
        id: 'enquiry_001',
        _id: 'enquiry_001',
        listingId: 'listing_001',
        listingTitle: 'Modern Downtown Studio Apartment Airbnb',
        category: 'guesthouse',
        guestName: 'Sarah Jenkins',
        guestEmail: 'sarah.jenkins@gmail.com',
        guestPhone: '+1 646-555-0128',
        hostName: 'Elena Rostova',
        hostEmail: 'elena.rostova@guesthousehub.com',
        hostPhone: '+1 305-555-8821',
        dates: 'Next Weekend (3 Nights)',
        guestsCount: 2,
        notes: 'Inquiring about late check-in at 9 PM and high speed wifi stability for remote work.',
        status: 'new', // 'new' | 'contacted' | 'confirmed' | 'cancelled'
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'enquiry_002',
        _id: 'enquiry_002',
        listingId: 'listing_002',
        listingTitle: 'Toyota Corolla Modern City Sedan with Private Driver',
        category: 'car_service',
        guestName: 'Mateo Rossi',
        guestEmail: 'mateo.rossi@outlook.com',
        guestPhone: '+39 06 6987 1234',
        hostName: 'Marcus Vance',
        hostEmail: 'marcus.vance@citychauffeurs.com',
        hostPhone: '+1 305-555-0199',
        driverName: 'Marcus Vance',
        driverPhone: '+1 305-555-0199',
        dates: 'Tomorrow 08:30 AM',
        serviceType: 'Airport Pickup & Full Day City Commute',
        notes: 'Needs pickup from International Terminal 2 with 2 large luggage bags.',
        status: 'contacted',
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: 'enquiry_003',
        _id: 'enquiry_003',
        listingId: 'listing_006',
        listingTitle: 'Toyota Camry Executive City Sedan with Chauffeur',
        category: 'car_service',
        guestName: 'Lucas Alvarez',
        guestEmail: 'lucas.alvarez@gmail.com',
        guestPhone: '+1 312-555-0176',
        hostName: 'David Chen',
        hostEmail: 'david.chen@elitechauffeuring.com',
        hostPhone: '+1 415-555-0188',
        driverName: 'David Chen',
        driverPhone: '+1 415-555-0188',
        dates: 'Friday 6:00 PM - Midnight',
        serviceType: 'Corporate Dinner Transfers',
        notes: 'Roundtrip transportation for 4 executives between Midtown and Financial District.',
        status: 'confirmed',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: 'enquiry_004',
        _id: 'enquiry_004',
        listingId: 'listing_003',
        listingTitle: 'Cozy 2-Bedroom Urban Loft Airbnb with Balcony',
        category: 'guesthouse',
        guestName: 'Chloe Martin',
        guestEmail: 'chloe.martin@yahoo.fr',
        guestPhone: '+33 6 12 34 56 78',
        hostName: 'Amara Diop',
        hostEmail: 'amara.diop@urbanstays.com',
        hostPhone: '+1 718-555-3342',
        dates: 'Nov 12 - Nov 16 (4 Nights)',
        guestsCount: 4,
        notes: 'Family vacation stay, requests baby crib if available.',
        status: 'new',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ];
  },
};
