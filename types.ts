export enum Season {
  SUMMER = 'Summer (Grishma)',
  MONSOON = 'Monsoon (Varsha)',
  WINTER = 'Winter (Shishir)'
}

export enum CropType {
  WHEAT = 'Wheat',
  RICE = 'Rice',
  SUGARCANE = 'Sugarcane',
  MUSTARD = 'Mustard'
}

export enum AnimalType {
  COW = 'Cow',
  CHICKEN = 'Chicken',
  GOAT = 'Goat'
}

export enum ResourceType {
  MILK = 'Milk',
  EGG = 'Egg'
}

export enum StructureType {
  COWSHED = 'Gaushala (Cowshed)',
  CHICKEN_COOP = 'Darba (Coop)',
  GRAIN_SILO = 'Bakhari (Grain Silo)'
}

export enum DishType {
  ROTI = 'Makki di Roti',
  KHEER = 'Kheer',
  SAAG = 'Sarson ka Saag',
  OMELETTE = 'Masala Omelette',
  GANNA_JUICE = 'Ganne ka Ras',
  CHAI = 'Masala Chai'
}

export enum BuffType {
  SPEED = 'Cheetah Speed',
  WEALTH = 'Lakshmi Blessing',
  GROWTH = 'Green Thumb',
  SHANTI = 'Temple Peace'
}

export enum UpgradeType {
  SCARECROW = 'Scarecrow',
  IRRIGATION_PUMP = 'Irrigation Pump',
  BULLOCK_CART = 'Bailgadi (Bullock Cart)',
  TRACTOR = 'Desi Tractor'
}

export enum FertilizerType {
  DESI_GOBAR = 'Desi Gobar Manure',
  VERMI_COMPOST = 'Kechua Vermicompost',
  AMRIT_KHAAD = 'Panchagavya Super Manure'
}

export enum LandState {
  EMPTY = 'EMPTY',
  PLOWED = 'PLOWED',
  SEEDED = 'SEEDED',
  GROWING = 'GROWING',
  RIPE = 'RIPE'
}

export enum Tool {
  HAND = 'Hand',
  HOE = 'Phawra (Hoe)',
  WATER_BUCKET = 'Water Bucket',
  SICKLE = 'Sickle',
  MANURE = 'Manure Bag',
  SEEDS_WHEAT = 'Seeds: Wheat',
  SEEDS_RICE = 'Seeds: Rice',
  SEEDS_SUGARCANE = 'Seeds: Sugarcane',
  SEEDS_MUSTARD = 'Seeds: Mustard'
}

export interface Plot {
  id: number;
  x: number;
  z: number;
  state: LandState;
  cropType: CropType | null;
  growthProgress: number; // 0 to 100
  waterLevel: number; // 0 to 100
  fertilizer?: FertilizerType | null;
  fertilizerMultiplier?: number; // e.g., 2.5x, 4x, 6x hyper growth
}

export type AnimalBehaviorState = 'idle' | 'walking' | 'grazing' | 'pecking' | 'sleeping';

export interface Animal {
  id: string;
  name?: string;
  type: AnimalType;
  x: number;
  z: number;
  rotation: number;
  produceTimer: number; // 0 to 100
  isReady: boolean;
  age: number; // 0 to 100
  hunger: number; // 0 to 100
  loved?: boolean;
  state?: AnimalBehaviorState;
  path?: { x: number; z: number }[];
}

export interface Structure {
  id: string;
  type: StructureType;
  x: number;
  z: number;
  rotation: number;
}

export interface Inventory {
  money: number;
  crops: Record<CropType, number>;
  seeds: Record<CropType, number>;
  resources: Record<ResourceType, number>;
  dishes: Record<DishType, number>;
  fertilizers: Record<FertilizerType, number>;
}

export interface ActiveBuff {
  type: BuffType;
  expiresAt: number;
}

export type FestivalType = 'BAISAKHI' | 'DIWALI' | 'MAKAR_SANKRANTI' | 'HOLI' | null;

export interface VillageTask {
  id: string;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  targetCount: number;
  currentCount: number;
  rewardMoney: number;
  rewardRespect: number;
  completed: boolean;
  claimed: boolean;
  type: 'plow' | 'water' | 'harvest' | 'feed_animal' | 'cook' | 'visit_temple' | 'sell_crop' | 'visit_talab' | 'drink_chai' | 'ride_tempo';
}

export interface GameState {
  day: number;
  timeOfDay: number; // 0 to 24
  timeSpeed: 1 | 2; // Speed toggle (Normal slow vs 2x)
  season: Season;
  plots: Plot[];
  animals: Animal[];
  structures: Structure[];
  inventory: Inventory;
  selectedTool: Tool;
  selectedFertilizer?: FertilizerType;
  weather: 'Sunny' | 'Rainy' | 'Foggy';
  playerPos: { x: number; z: number };
  playerRotation: number;
  placingStructure: StructureType | null;
  activeBuff: ActiveBuff | null;
  upgrades: UpgradeType[];
  villageTasks: VillageTask[];
  respect: number; // 0 to 100 Pratishtha
  currentFestival: FestivalType;
  language: 'hi' | 'en';
  isMuted: boolean;
  templeBlessedToday: boolean;
  stamina: number; // 0 to 100 Kisan Energy
  maxStamina: number;
  bucketWater: number; // 0 to 5 charges in water bucket
  maxBucketWater: number;
  xp: number;
  level: number;
  isManualNight?: boolean;
  smartAutoTool?: boolean;
}

export interface NPC {
  id: number;
  name: string;
  nameHi: string;
  role: 'Sarpanch' | 'Merchant' | 'Pandit' | 'Dadi' | 'Chaiwala' | 'Driver' | 'Balak';
  roleHi: string;
  x: number;
  z: number;
  dialogue: string[];
  dialogueHi: string[];
  color: string;
  turbanColor?: string;
  avatarIcon?: string;
}
