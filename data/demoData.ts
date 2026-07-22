export type Property = {
  id: string;
  nickname: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: "primary" | "rental" | "vacation" | "investment";
  yearBuilt: string;
  squareFeet: string;
  bedrooms: string;
  bathrooms: string;
  purchasePrice: string;
  estimatedValue: string;
  purchaseDate: string;
  photoUri?: string;
  isSelected: boolean;
};

export type MaintenanceItem = {
  id: string;
  propertyId: string;
  title: string;
  category: string;
  lastCompleted: string;
  nextDue: string;
  status: "Upcoming" | "Due Soon" | "Overdue" | "Completed";
  notes: string;
  recurring: boolean;
  intervalDays?: number;
  priority: "low" | "medium" | "high";
  /** Stored maintenance photo URLs (maintenance_items.photo_urls). */
  photoUris?: string[];
};

export type Repair = {
  id: string;
  propertyId: string;
  title: string;
  date: string;
  cost: string;
  contractor: string;
  category: string;
  notes: string;
  photoUris: string[];
  receiptUri?: string;
  warrantyExpires?: string;
};

export type Appliance = {
  id: string;
  propertyId: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serial: string;
  installDate: string;
  purchasePrice: string;
  expectedLifeYears: number;
  warrantyExpires: string;
  lastService: string;
  nextService: string;
  condition: "Excellent" | "Good" | "Fair" | "Poor" | "Replace Soon";
  notes: string;
  /** Multi-photo URLs (appliances.photo_urls). Prefer this over photoUri. */
  photoUris?: string[];
  /** First photo mirror of photoUris[0] / appliances.photo_url (legacy). */
  photoUri?: string;
  manualUri?: string;
  receiptUri?: string;
};

export type Document = {
  id: string;
  propertyId: string;
  title: string;
  category: "warranty" | "insurance" | "inspection" | "permit" | "receipt" | "contract" | "manual" | "other";
  fileUri?: string;
  /** Original upload file name (UI / storage naming). Not a separate DB column. */
  fileName?: string;
  fileType: "pdf" | "image" | "other";
  fileSize: string;
  uploadDate: string;
  expiresDate?: string;
  notes: string;
  tags: string[];
};

export type PaintColor = {
  id: string;
  propertyId: string;
  room: string;
  brand: string;
  colorName: string;
  colorCode: string;
  finish: string;
  hex: string;
  purchaseDate: string;
  notes: string;
};

export type Contractor = {
  id: string;
  propertyId?: string;
  name: string;
  trade: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
  notes: string;
  lastUsed: string;
  licenseNumber: string;
};

export type PhotoItem = {
  id: string;
  propertyId: string;
  uri: string;
  caption: string;
  date: string;
  category: string;
};

// ── Demo Data ──────────────────────────────────────────────────────

const properties: Property[] = [
  {
    id: "prop1",
    nickname: "Primary Home",
    address: "123 Maple Street",
    city: "Austin",
    state: "TX",
    zip: "78701",
    type: "primary",
    yearBuilt: "2015",
    squareFeet: "2,450",
    bedrooms: "4",
    bathrooms: "3",
    purchasePrice: "485,000",
    estimatedValue: "635,000",
    purchaseDate: "March 2021",
    isSelected: true,
  },
  {
    id: "prop2",
    nickname: "Lake House",
    address: "88 Lakeview Drive",
    city: "Marble Falls",
    state: "TX",
    zip: "78654",
    type: "vacation",
    yearBuilt: "2003",
    squareFeet: "1,800",
    bedrooms: "3",
    bathrooms: "2",
    purchasePrice: "320,000",
    estimatedValue: "415,000",
    purchaseDate: "July 2022",
    isSelected: false,
  },
];

const maintenanceItems: MaintenanceItem[] = [
  {
    id: "m1",
    propertyId: "prop1",
    title: "HVAC Maintenance",
    category: "HVAC",
    lastCompleted: "Nov 2024",
    nextDue: "Jun 22, 2026",
    status: "Due Soon",
    notes: "Schedule bi-annual service with certified tech. Replace filter monthly.",
    recurring: true,
    intervalDays: 180,
    priority: "high",
  },
  {
    id: "m2",
    propertyId: "prop1",
    title: "Change Air Filter",
    category: "HVAC",
    lastCompleted: "May 1, 2026",
    nextDue: "Jun 27, 2026",
    status: "Due Soon",
    notes: "16x25x1 MERV-11 filter. Buy 6-pack from Amazon.",
    recurring: true,
    intervalDays: 60,
    priority: "medium",
  },
  {
    id: "m3",
    propertyId: "prop1",
    title: "Gutter Cleaning",
    category: "Exterior",
    lastCompleted: "Nov 2025",
    nextDue: "Jun 30, 2026",
    status: "Due Soon",
    notes: "Clean before summer storms. Check downspout extensions.",
    recurring: true,
    intervalDays: 180,
    priority: "medium",
  },
  {
    id: "m4",
    propertyId: "prop1",
    title: "Roof Inspection",
    category: "Roof",
    lastCompleted: "Apr 2026",
    nextDue: "Apr 2027",
    status: "Upcoming",
    notes: "Roof installed 2018. 30-year architectural shingles.",
    recurring: true,
    intervalDays: 365,
    priority: "low",
  },
  {
    id: "m5",
    propertyId: "prop1",
    title: "Water Heater Flush",
    category: "Plumbing",
    lastCompleted: "Jan 2025",
    nextDue: "Jan 2026",
    status: "Overdue",
    notes: "Flush annually to reduce sediment. Water heater is 8 years old.",
    recurring: true,
    intervalDays: 365,
    priority: "high",
  },
  {
    id: "m6",
    propertyId: "prop1",
    title: "Dryer Vent Cleaning",
    category: "Appliances",
    lastCompleted: "Sep 2025",
    nextDue: "Sep 2026",
    status: "Upcoming",
    notes: "Fire prevention. Professional service recommended.",
    recurring: true,
    intervalDays: 365,
    priority: "high",
  },
  {
    id: "m7",
    propertyId: "prop2",
    title: "Dock Inspection",
    category: "Exterior",
    lastCompleted: "Mar 2026",
    nextDue: "Mar 2027",
    status: "Upcoming",
    notes: "Check boards, cleats, and electrical.",
    recurring: true,
    intervalDays: 365,
    priority: "medium",
  },
];

const repairs: Repair[] = [
  {
    id: "r1",
    propertyId: "prop1",
    title: "Roof Repair — Storm Damage",
    date: "May 2, 2024",
    cost: "1,250",
    contractor: "Austin Roofing Pros",
    category: "Roof",
    notes: "Replaced 14 shingles after hail. Filed insurance claim #AUS-2024-0502.",
    photoUris: [],
    warrantyExpires: "May 2026",
  },
  {
    id: "r2",
    propertyId: "prop1",
    title: "AC Service & Refrigerant Recharge",
    date: "Apr 18, 2024",
    cost: "165",
    contractor: "Comfort Zone HVAC",
    category: "HVAC",
    notes: "Annual tune-up + 1lb R-410A added.",
    photoUris: [],
  },
  {
    id: "r3",
    propertyId: "prop1",
    title: "Kitchen Faucet Replacement",
    date: "Apr 10, 2024",
    cost: "180",
    contractor: "Texas Plumbing Co.",
    category: "Plumbing",
    notes: "Replaced Moen 7185 with new Kohler Simplice.",
    photoUris: [],
    warrantyExpires: "Apr 2027",
  },
  {
    id: "r4",
    propertyId: "prop1",
    title: "New Dishwasher Installation",
    date: "Feb 2024",
    cost: "850",
    contractor: "Best Buy Appliances",
    category: "Appliances",
    notes: "Bosch SHPM88Z75N. Haul-away included.",
    photoUris: [],
    warrantyExpires: "Feb 2026",
  },
];

const appliances: Appliance[] = [
  {
    id: "a1",
    propertyId: "prop1",
    name: "HVAC System",
    category: "HVAC",
    brand: "Lennox",
    model: "XC21-048",
    serial: "LNX2021048XC",
    installDate: "Jun 2021",
    purchasePrice: "5,800",
    expectedLifeYears: 20,
    warrantyExpires: "Jun 2031",
    lastService: "Nov 2024",
    nextService: "Jun 2026",
    condition: "Excellent",
    notes: "5-ton unit. Filter size 16x25x1. Change every 60 days.",
  },
  {
    id: "a2",
    propertyId: "prop1",
    name: "Water Heater",
    category: "Plumbing",
    brand: "Rheem",
    model: "PROG50-40N",
    serial: "RH20180040PG",
    installDate: "Mar 2018",
    purchasePrice: "680",
    expectedLifeYears: 12,
    warrantyExpires: "Mar 2024",
    lastService: "Jan 2025",
    nextService: "Jan 2026",
    condition: "Fair",
    notes: "50-gallon gas. 8 years old — approaching end of life. Budget for replacement.",
  },
  {
    id: "a3",
    propertyId: "prop1",
    name: "Dishwasher",
    category: "Kitchen",
    brand: "Bosch",
    model: "SHPM88Z75N",
    serial: "BSH2024DW01",
    installDate: "Feb 2024",
    purchasePrice: "850",
    expectedLifeYears: 12,
    warrantyExpires: "Feb 2026",
    lastService: "Feb 2024",
    nextService: "Feb 2025",
    condition: "Excellent",
    notes: "New install. Warranty expires Feb 2026.",
  },
  {
    id: "a4",
    propertyId: "prop1",
    name: "Refrigerator",
    category: "Kitchen",
    brand: "Samsung",
    model: "RF28R7351SR",
    serial: "SAM2019RF28",
    installDate: "Jan 2019",
    purchasePrice: "1,400",
    expectedLifeYears: 14,
    warrantyExpires: "Jan 2021",
    lastService: "Jan 2024",
    nextService: "Jan 2026",
    condition: "Good",
    notes: "28 cu ft French door. Clean condenser coils annually.",
  },
  {
    id: "a5",
    propertyId: "prop1",
    name: "Washer",
    category: "Laundry",
    brand: "LG",
    model: "WM4000HWA",
    serial: "LG2020WM40",
    installDate: "Apr 2020",
    purchasePrice: "900",
    expectedLifeYears: 12,
    warrantyExpires: "Apr 2022",
    lastService: "Never",
    nextService: "Apr 2026",
    condition: "Good",
    notes: "Front load, 5.0 cu ft. Run tub clean monthly.",
  },
  {
    id: "a6",
    propertyId: "prop1",
    name: "Garage Door Opener",
    category: "Garage",
    brand: "Chamberlain",
    model: "B4545T",
    serial: "CMB2022GDO",
    installDate: "Aug 2022",
    purchasePrice: "380",
    expectedLifeYears: 15,
    warrantyExpires: "Aug 2025",
    lastService: "Aug 2022",
    nextService: "Aug 2026",
    condition: "Excellent",
    notes: "Smart WiFi opener. Lubricate chain annually.",
  },
];

const documents: Document[] = [
  {
    id: "d1",
    propertyId: "prop1",
    title: "Home Inspection Report",
    category: "inspection",
    fileType: "pdf",
    fileSize: "4.2 MB",
    uploadDate: "May 3, 2024",
    notes: "Full inspection by Austin Home Inspectors LLC.",
    tags: ["inspection", "2024"],
  },
  {
    id: "d2",
    propertyId: "prop1",
    title: "Homeowner's Insurance Policy",
    category: "insurance",
    fileType: "pdf",
    fileSize: "1.3 MB",
    uploadDate: "Apr 15, 2024",
    expiresDate: "Apr 15, 2026",
    notes: "State Farm policy #TX-48203-A.",
    tags: ["insurance", "state-farm"],
  },
  {
    id: "d3",
    propertyId: "prop1",
    title: "HVAC Warranty",
    category: "warranty",
    fileType: "pdf",
    fileSize: "820 KB",
    uploadDate: "Mar 28, 2024",
    expiresDate: "Jun 2031",
    notes: "Lennox 10-year parts warranty.",
    tags: ["hvac", "warranty", "lennox"],
  },
  {
    id: "d4",
    propertyId: "prop1",
    title: "Roof Repair Invoice",
    category: "receipt",
    fileType: "pdf",
    fileSize: "340 KB",
    uploadDate: "May 5, 2024",
    notes: "Austin Roofing Pros — storm damage repair.",
    tags: ["roof", "receipt", "2024"],
  },
  {
    id: "d5",
    propertyId: "prop1",
    title: "Survey / Plat Map",
    category: "other",
    fileType: "pdf",
    fileSize: "2.1 MB",
    uploadDate: "Mar 2021",
    notes: "Boundary survey from purchase.",
    tags: ["survey", "legal"],
  },
];

const paintColors: PaintColor[] = [
  {
    id: "p1",
    propertyId: "prop1",
    room: "Living Room",
    brand: "Sherwin-Williams",
    colorName: "Accessible Beige",
    colorCode: "SW 7036",
    finish: "Eggshell",
    hex: "#CFC4AE",
    purchaseDate: "Aug 2021",
    notes: "Main walls. Two coats on 5-gallon.",
  },
  {
    id: "p2",
    propertyId: "prop1",
    room: "Master Bedroom",
    brand: "Sherwin-Williams",
    colorName: "Naval",
    colorCode: "SW 6244",
    finish: "Eggshell",
    hex: "#2C3E50",
    purchaseDate: "Sep 2021",
    notes: "Accent wall behind bed.",
  },
  {
    id: "p3",
    propertyId: "prop1",
    room: "Kitchen Cabinets",
    brand: "Behr",
    colorName: "Ultra Pure White",
    colorCode: "UPW",
    finish: "Semi-gloss",
    hex: "#F9F9F9",
    purchaseDate: "Oct 2021",
    notes: "Touch-up color. Cabinet refresh 2023.",
  },
  {
    id: "p4",
    propertyId: "prop1",
    room: "Exterior",
    brand: "Sherwin-Williams",
    colorName: "Alabaster",
    colorCode: "SW 7008",
    finish: "Satin",
    hex: "#EEEBE2",
    purchaseDate: "Jun 2023",
    notes: "Full exterior repaint summer 2023.",
  },
];

const contractors: Contractor[] = [
  {
    id: "c1",
    name: "Comfort Zone HVAC",
    trade: "HVAC",
    phone: "512-555-0140",
    email: "service@comfortzonehvac.com",
    website: "comfortzonehvac.com",
    rating: 5,
    notes: "Always on time. Ask for Mike.",
    lastUsed: "Apr 2024",
    licenseNumber: "TX-HVAC-29041",
  },
  {
    id: "c2",
    name: "Texas Plumbing Co.",
    trade: "Plumbing",
    phone: "512-555-0188",
    email: "contact@texasplumbing.com",
    website: "texasplumbing.com",
    rating: 4,
    notes: "Good pricing. Runs a bit late.",
    lastUsed: "Apr 2024",
    licenseNumber: "TX-PLM-14822",
  },
  {
    id: "c3",
    name: "Austin Roofing Pros",
    trade: "Roofing",
    phone: "512-555-0201",
    email: "quotes@austinroofing.com",
    website: "austinroofingpros.com",
    rating: 5,
    notes: "Excellent storm damage work. Very communicative.",
    lastUsed: "May 2024",
    licenseNumber: "TX-ROOF-88201",
  },
];

export const demoData = {
  properties,
  maintenanceItems,
  repairs,
  appliances,
  documents,
  paintColors,
  contractors,
  photos: [] as PhotoItem[],
  selectedPropertyId: "prop1",
};
