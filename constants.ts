import { CropType, Season, Tool, AnimalType, ResourceType, StructureType, DishType, BuffType, UpgradeType, FertilizerType, NPC, VillageTask } from "./types";

export const INITIAL_MONEY = 600;
export const PLOT_SIZE = 2;
export const GRID_SIZE = 4; // 4x4 grid = 16 farm plots

// Visual Colors
export const COLORS = {
  SOIL_DRY: '#795548',
  SOIL_WET: '#3e2723',
  SOIL_EMPTY: '#8d6e63',
  GRASS: '#689f38',
  SKY_DAY: '#87CEEB',
  TURBAN: '#ff9800',
  KURTA: '#f5f5f5',
  SKIN: '#8d5524',
  CHULHA: '#5d4037',
  FIRE_CORE: '#ffeb3b',
  FIRE_OUTER: '#ff5722',
  ROAD: '#37474f', // Paved asphalt
  ROAD_DIRT: '#a1887f', // Country dirt track
  WATER: '#29b6f6',
  POND_WATER: '#00acc1'
};

export const CROP_DATA: Record<CropType, { 
  nameHi: string;
  growthTime: number; // ticks
  sellPrice: number; 
  seedPrice: number;
  color: string;
  preferredSeason: Season;
  description: string;
  descriptionHi: string;
}> = {
  [CropType.WHEAT]: {
    nameHi: 'गेहूँ (Gehun)',
    growthTime: 120,
    sellPrice: 55,
    seedPrice: 10,
    color: '#F5DEB3',
    preferredSeason: Season.WINTER,
    description: 'Golden winter grain. Used to make rotis and feed cows.',
    descriptionHi: 'शीत ऋतु की सुनहरी फसल। रोटी बनाने और मवेशियों के चारे के काम आती है।'
  },
  [CropType.RICE]: {
    nameHi: 'धान (Dhan/Rice)',
    growthTime: 140,
    sellPrice: 70,
    seedPrice: 15,
    color: '#81c784',
    preferredSeason: Season.MONSOON,
    description: 'Thrives in monsoon rains. Essential for sweet kheer.',
    descriptionHi: 'वर्षा ऋतु में खूब लहलहाती है। स्वादिष्ट खीर बनाने के लिए उत्तम।'
  },
  [CropType.SUGARCANE]: {
    nameHi: 'गन्ना (Ganna)',
    growthTime: 220,
    sellPrice: 140,
    seedPrice: 30,
    color: '#2e7d32',
    preferredSeason: Season.SUMMER,
    description: 'Sweet tall canes. Gives high profit and refreshing juice!',
    descriptionHi: 'मीठा रसीला गन्ना। सबसे अधिक मुनाफा और ताज़ा गन्ने का रस देता है।'
  },
  [CropType.MUSTARD]: {
    nameHi: 'सरसों (Sarson)',
    growthTime: 100,
    sellPrice: 48,
    seedPrice: 8,
    color: '#ffd600',
    preferredSeason: Season.WINTER,
    description: 'Yellow winter flowers. Ingredient for hearty Sarson ka Saag!',
    descriptionHi: 'पीले-पीले सरसों के फूल। स्वादिष्ट और ताकतवर सरसों के साग का मुख्य हिस्सा।'
  }
};

export const ANIMAL_DATA: Record<AnimalType, {
  nameHi: string;
  cost: number;
  produce: ResourceType;
  produceTime: number; // ticks
  color: string;
  scale: number;
  diet: CropType;
  soundText: string;
  soundTextHi: string;
}> = {
  [AnimalType.COW]: {
    nameHi: 'गौ माता (Gaumata / Cow)',
    cost: 320,
    produce: ResourceType.MILK,
    produceTime: 180,
    color: '#ffffff',
    scale: 1.0,
    diet: CropType.WHEAT,
    soundText: 'Mooo~',
    soundTextHi: 'हम्बा हम्बा~'
  },
  [AnimalType.CHICKEN]: {
    nameHi: 'मुर्गी (Murghi / Chicken)',
    cost: 60,
    produce: ResourceType.EGG,
    produceTime: 60,
    color: '#e65100',
    scale: 0.45,
    diet: CropType.RICE,
    soundText: 'Kuk-kud-koo!',
    soundTextHi: 'कुड़कुड़ कुकड़ूँ-कूँ!'
  },
  [AnimalType.GOAT]: {
    nameHi: 'बकरी (Bakri / Goat)',
    cost: 160,
    produce: ResourceType.MILK,
    produceTime: 120,
    color: '#8d6e63',
    scale: 0.7,
    diet: CropType.WHEAT,
    soundText: 'Maaa~',
    soundTextHi: 'मैं मैं~'
  }
};

export const STRUCTURE_DATA: Record<StructureType, {
  nameHi: string;
  cost: number;
  description: string;
  descriptionHi: string;
  bonus: string;
  bonusHi: string;
}> = {
  [StructureType.COWSHED]: {
    nameHi: 'गौशाला (Gaushala)',
    cost: 500,
    description: 'A traditional thatched shelter for cows. Protects cattle and speeds milk production.',
    descriptionHi: 'गायों के लिए सुरक्षित छप्पर। दूध उत्पादन की गति 50% बढ़ा देता है।',
    bonus: 'Milk +50% Speed',
    bonusHi: 'दूध उत्पादन +50% तेज़'
  },
  [StructureType.CHICKEN_COOP]: {
    nameHi: 'दरबा (Darba / Coop)',
    cost: 250,
    description: 'Elevated wooden coop for chickens. Keeps them safe from foxes and increases egg yield.',
    descriptionHi: 'मुर्गियों के लिए सुरक्षित दरबा। अंडे देने की गति 50% बढ़ाता है।',
    bonus: 'Eggs +50% Speed',
    bonusHi: 'अंडे उत्पादन +50% तेज़'
  },
  [StructureType.GRAIN_SILO]: {
    nameHi: 'बखारी (Grain Silo)',
    cost: 650,
    description: 'Traditional mud-brick grain storage. Prevents spoilage and gives +10% crop sell price!',
    descriptionHi: 'अनाज सुरक्षित रखने की मिट्टी की बखारी। मंडी में अनाज के भाव में 10% बढ़ोतरी!',
    bonus: '+10% Crop Market Price',
    bonusHi: 'मंडी में अनाज का भाव +10%'
  }
};

export const UPGRADE_DATA: Record<UpgradeType, {
  nameHi: string;
  cost: number;
  description: string;
  descriptionHi: string;
}> = {
  [UpgradeType.SCARECROW]: {
    nameHi: 'बिजूका (Bijuka / Scarecrow)',
    cost: 200,
    description: 'Traditional earthen pot scarecrow. Protects fields completely from hungry birds.',
    descriptionHi: 'खेतों में हंडिया वाला बिजूका। चिड़ियों और पक्षियों से पूरी फसल की रक्षा करता है।'
  },
  [UpgradeType.IRRIGATION_PUMP]: {
    nameHi: 'ट्यूबवेल / पंप (Tube Well)',
    cost: 850,
    description: 'Diesel irrigation pump connected to the well. Automatically keeps all 16 plots watered!',
    descriptionHi: 'खेत का इंजन ट्यूबवेल। सभी 16 खेतों को हमेशा हरा-भरा और सींचा हुआ रखता है!'
  },
  [UpgradeType.BULLOCK_CART]: {
    nameHi: 'बैलगाड़ी (Bullock Cart)',
    cost: 400,
    description: 'Classic village bullock cart. Unlocks 20% higher selling prices at the weekly Haat.',
    descriptionHi: 'पारंपरिक बैलगाड़ी। मंडी में सामान आसानी से ले जाएं और 20% अधिक भाव पाएं।'
  },
  [UpgradeType.TRACTOR]: {
    nameHi: 'स्वराज ट्रैक्टर (Desi Tractor)',
    cost: 1500,
    description: 'A powerful red village tractor! Automatically plows 4 plots at a time when selected.',
    descriptionHi: 'शानदार लाल ट्रैक्टर! एक साथ 4 खेतों की जुताई करने में मददगार।'
  }
};

export const DISH_DATA: Record<DishType, {
  nameHi: string;
  ingredients: Partial<Record<CropType | ResourceType, number>>;
  sellPrice: number;
  buff: BuffType;
  buffDuration: number;
  description: string;
  descriptionHi: string;
}> = {
  [DishType.ROTI]: {
    nameHi: 'मक्के/गेहूँ की रोटी (Roti)',
    ingredients: { [CropType.WHEAT]: 2 },
    sellPrice: 150,
    buff: BuffType.GROWTH,
    buffDuration: 8,
    description: 'Hot handmade rotis. Gives energy to help crops grow 2x faster.',
    descriptionHi: 'गरमा-गरम चूल्हे की रोटी। फसलें दोगुनी तेजी से बढ़ती हैं।'
  },
  [DishType.KHEER]: {
    nameHi: 'स्वादिष्ट खीर (Rice Kheer)',
    ingredients: { [CropType.RICE]: 2, [ResourceType.MILK]: 2 },
    sellPrice: 320,
    buff: BuffType.WEALTH,
    buffDuration: 10,
    description: 'Rich festive kheer made with cow milk and basmati rice. Increases sell earnings by 25%.',
    descriptionHi: 'दूध और चावल से बनी मीठी खीर। मंडी में सभी सामान 25% अधिक दाम पर बिकते हैं।'
  },
  [DishType.SAAG]: {
    nameHi: 'सरसों का साग (Sarson ka Saag)',
    ingredients: { [CropType.MUSTARD]: 3 },
    sellPrice: 220,
    buff: BuffType.GROWTH,
    buffDuration: 10,
    description: 'Pure desi winter delicacy. Farmers eat this for incredible strength!',
    descriptionHi: 'खालिस देसी सरसों का साग। किसान को असीम ऊर्जा और फुर्ती देता है।'
  },
  [DishType.OMELETTE]: {
    nameHi: 'देसी आमलेट (Masala Omelette)',
    ingredients: { [ResourceType.EGG]: 3 },
    sellPrice: 120,
    buff: BuffType.SPEED,
    buffDuration: 6,
    description: 'Quick protein-packed village snack. Enhances character movement speed.',
    descriptionHi: 'मसालेदार देसी आमलेट। दौड़ने-चलने में तेज़ी लाता है।'
  },
  [DishType.GANNA_JUICE]: {
    nameHi: 'गन्ने का ताज़ा रस (Ganna Juice)',
    ingredients: { [CropType.SUGARCANE]: 2 },
    sellPrice: 200,
    buff: BuffType.WEALTH,
    buffDuration: 8,
    description: 'Chilled sugarcane juice with mint and lemon. High market demand!',
    descriptionHi: 'ताज़ा मीठा गन्ने का रस। गांव और मंडी में सबको बहुत पसंद आता है।'
  },
  [DishType.CHAI]: {
    nameHi: 'मसाला कुल्हड़ चाय (Desi Chai)',
    ingredients: { [ResourceType.MILK]: 1 },
    sellPrice: 80,
    buff: BuffType.SHANTI,
    buffDuration: 8,
    description: 'Steaming clay-cup spiced tea. Brings village harmony and animal peace.',
    descriptionHi: 'कुल्हड़ वाली कड़क चाय। मन को शांति और पशुओं में चुस्ती लाती है।'
  }
};

export const RESOURCE_PRICES: Record<ResourceType, number> = {
  [ResourceType.MILK]: 30,
  [ResourceType.EGG]: 12
};

export const FERTILIZER_DATA: Record<FertilizerType, {
  nameHi: string;
  cost: number;
  pack5Cost: number;
  growthMultiplier: number;
  instantBoost: number; // immediate % added to growthProgress
  bonusYield: boolean;
  icon: string;
  color: string;
  description: string;
  descriptionHi: string;
  badgeText: string;
  badgeTextHi: string;
}> = {
  [FertilizerType.DESI_GOBAR]: {
    nameHi: 'देसी गोबर खाद (Gobar Manure)',
    cost: 18,
    pack5Cost: 75,
    growthMultiplier: 2.5,
    instantBoost: 18,
    bonusYield: false,
    icon: '💩',
    color: '#6d4c41',
    description: 'Pure organic cow-dung manure. Speeds up crop growth by 2.5x and adds +18% instant growth!',
    descriptionHi: 'शुद्ध देसी गोबर खाद। फसल बढ़ने की रफ़्तार 2.5 गुना (2.5x) तेज़ करती है और तुरंत +18% बढ़त देती है!',
    badgeText: '2.5x Speed +18% Boost',
    badgeTextHi: '2.5x रफ़्तार +18% तुरंत बढ़त'
  },
  [FertilizerType.VERMI_COMPOST]: {
    nameHi: 'केंचुआ जैविक खाद (Vermicompost)',
    cost: 38,
    pack5Cost: 165,
    growthMultiplier: 4.0,
    instantBoost: 35,
    bonusYield: false,
    icon: '🪱',
    color: '#2e7d32',
    description: 'Rich earthworm bio-compost. Supercharges crop growth to 4x speed, +35% instant boost & retains soil moisture!',
    descriptionHi: 'केंचुआ जैविक खाद। सामान्य सीमा से पार 4 गुना (4x) तेज़ वृद्धि, तुरंत +35% बढ़त और मिट्टी में नमी बनाए रखे!',
    badgeText: '4x Hyper Speed +35% Boost',
    badgeTextHi: '4x सुपर रफ़्तार +35% तुरंत बढ़त'
  },
  [FertilizerType.AMRIT_KHAAD]: {
    nameHi: 'पंचगव्य अमृत खाद (Super Manure)',
    cost: 65,
    pack5Cost: 280,
    growthMultiplier: 6.0,
    instantBoost: 55,
    bonusYield: true,
    icon: '🧪',
    color: '#ffd600',
    description: 'Ancient Panchagavya bio-elixir! Breaks standard limits with 6x Ultra Growth, +55% instant growth & Double Harvest Yield (2x)!',
    descriptionHi: 'पंचगव्य अमृत महा-खाद! सभी सीमाओं से पार 6 गुना (6x) अल्ट्रा रफ़्तार, तुरंत +55% बढ़त और कटाई पर दोगुनी उपज (2x फसल)!',
    badgeText: '6x Ultra Speed + 2x Yield!',
    badgeTextHi: '6x अल्ट्रा रफ़्तार + दोगुनी फसल!'
  }
};

export const TOOLS = [
  { id: Tool.HAND, icon: '🙏', label: 'Namaste/Interact', labelHi: 'नमस्ते/संवाद' },
  { id: Tool.HOE, icon: '⛏️', label: 'Phawra (Plow)', labelHi: 'फावड़ा (जुताई)' },
  { id: Tool.WATER_BUCKET, icon: '💧', label: 'Water Bucket', labelHi: 'बाल्टी (सिंचाई)' },
  { id: Tool.SICKLE, icon: '🌾', label: 'Danti (Harvest)', labelHi: 'दरांती (कटाई)' },
  { id: Tool.MANURE, icon: '🧪', label: 'Desi Manure (Boost)', labelHi: 'देसी खाद (तेज़ फसल)' },
  { id: Tool.SEEDS_WHEAT, icon: '🌱', label: 'Sow Wheat', labelHi: 'गेहूँ बीज' },
  { id: Tool.SEEDS_RICE, icon: '🌿', label: 'Sow Rice', labelHi: 'धान बीज' },
  { id: Tool.SEEDS_SUGARCANE, icon: '🎋', label: 'Sow Sugarcane', labelHi: 'गन्ना बीज' },
  { id: Tool.SEEDS_MUSTARD, icon: '🌼', label: 'Sow Mustard', labelHi: 'सरसों बीज' },
];

export const NPC_DATA: NPC[] = [
  { 
    id: 1, 
    name: "Ramu Kaka (Sarpanch)", 
    nameHi: "रामू काका (सरपंच)",
    role: "Sarpanch", 
    roleHi: "ग्राम प्रधान / सरपंच",
    x: -8, 
    z: 2, 
    dialogue: [
      "Ram Ram beta! Our Gaon's soil is pure gold. Work hard on the fields!",
      "Always feed your cattle on time. A happy cow brings Lakshmi to the home.",
      "Check the season before sowing! Wheat loves Winter, Rice loves Monsoon.",
      "Come sit at the Chaupal under the Banyan tree whenever you need guidance."
    ],
    dialogueHi: [
      "राम राम बेटा! हमारे गांव की मिट्टी सोना उगलती है, बस लगन से मेहनत करो!",
      "मवेशियों को समय पर चारा-पानी दो। गौ माता खुश रहेंगी तो घर में बरकत आएगी।",
      "मौसम देखकर बीज बोना! ठंड में गेहूँ और सरसों, बरसात में धान खूब फलता है।",
      "जब भी कोई उलझन हो, बरगद के चबूतरे पर आ जाना, सब हल निकाल लेंगे।"
    ],
    color: "#ffffff", 
    turbanColor: "#ff9800",
    avatarIcon: "👴🏽"
  },
  { 
    id: 2, 
    name: "Lala Ji (Baniya)", 
    nameHi: "लाला जी (दुकानदार)",
    role: "Merchant", 
    roleHi: "मंडी आढ़ती / व्यापारी",
    x: 9, 
    z: 1, 
    dialogue: [
      "Namaste Seth ji! Best rates in the entire district, guaranteed by Lala!",
      "Bring me fresh milk and harvested crops! Cash in hand, no credit!",
      "Festival days bring 25% higher profit. Stock your harvest wisely!",
      "Have you tried making Kheer or Makki di Roti? They fetch a fortune at the Haat!"
    ],
    dialogueHi: [
      "नमस्ते सेठ जी! पूरे जिले में सबसे खरा भाव लाला की दुकान पर ही मिलेगा!",
      "ताज़ा दूध, सरसों और गेहूँ लाओ! हाथो-हाथ नकद भुगतान, उधार बिल्कुल बंद!",
      "त्यौहार के दिनों में फसल का भाव 25% बढ़ जाता है, समझदारी से बेचना!",
      "चूल्हे पर स्वादिष्ट खीर या मक्के की रोटी बनाई? मंडी में खूब बिकेगी!"
    ],
    color: "#ffca28", 
    turbanColor: "#e91e63",
    avatarIcon: "👳🏽"
  },
  { 
    id: 3, 
    name: "Pandit Ji (Pujari)", 
    nameHi: "पंडित जी (पुजारी)",
    role: "Pandit", 
    roleHi: "मंदिर पुजारी",
    x: 0, 
    z: -12, 
    dialogue: [
      "Om Namah Shivaya! Ring the temple bell and take daily blessings.",
      "Daily prayer brings peace and protects your village from pests and storms.",
      "Karma is like a seed; what you sow with love, you reap in abundance.",
      "The morning Aarti begins at 6 AM. Welcome to the Gaon Mandir."
    ],
    dialogueHi: [
      "ॐ नमः शिवाय! मंदिर का घंटा बजाओ और रोज़ सुबह प्रभु का आशीर्वाद लो।",
      "ईश्वर की कृपा से गांव में खुशहाली रहती है और फसलें रोग-कीट से बची रहती हैं।",
      "कर्म ही बीज है; जैसा भाव रखोगे, वैसा ही मीठा फल पाओगे बेटा।",
      "प्रातः आरती 6 बजे होती है। गांव के मंदिर में तुम्हारा सदा स्वागत है।"
    ],
    color: "#ff7043", 
    turbanColor: "#ffffff",
    avatarIcon: "🕉️"
  },
  {
    id: 4,
    name: "Shanti Dadi",
    nameHi: "शांति दादी",
    role: "Dadi",
    roleHi: "बुज़ुर्ग दादी",
    x: -3,
    z: -6,
    dialogue: [
      "Jeete raho beta! Did you light the chulha today?",
      "Nothing warms the soul like Sarson ka Saag and hot Rotis on a winter day.",
      "Our well water is sweet and pure. Keep your crops refreshed!",
      "May our Gaon always flourish with laughing children and full silos."
    ],
    dialogueHi: [
      "जीते रहो बेटा! आज चूल्हा जलाया कि नहीं?",
      "ठंड के दिनों में सरसों के साग और गरमा-गरम रोटी का कोई मुकाबला नहीं!",
      "हमारे कुएं का पानी गंगा जैसा मीठा है, खेतों को खूब सींचो बेटा।",
      "भगवान करे हमारे गांव की कोठियां सदा अनाज से भरी रहें।"
    ],
    color: "#43a047", 
    turbanColor: "#c8e6c9",
    avatarIcon: "👵🏽"
  },
  {
    id: 5,
    name: "Raju Chaiwala",
    nameHi: "राजू चायवाला",
    role: "Chaiwala",
    roleHi: "चाय की टपरी",
    x: 13,
    z: 2,
    dialogue: [
      "Garam garam kadak adrak chai ready hai bhai! Ek cutting ho jaye?",
      "Morning tea gives the best kick before heading to the fields!",
      "All village gossip happens right here at my tea stall!"
    ],
    dialogueHi: [
      "गरमा-गरम कड़क अदरक वाली कुल्हड़ चाय तैयार है भाई! एक कटिंग हो जाए?",
      "खेत में जाने से पहले राजू की चाय पी लो, पूरा दिन थकान नहीं होगी!",
      "गाँव की सारी ताज़ा खबरें और पंचायत मेरी ही चाय की टपरी पर होती हैं!"
    ],
    color: "#0288d1",
    turbanColor: "#d32f2f",
    avatarIcon: "☕"
  },
  {
    id: 6,
    name: "Driver Babu",
    nameHi: "ड्राइवर बाबू",
    role: "Driver",
    roleHi: "टेम्पो व बस चालक",
    x: 6,
    z: 14,
    dialogue: [
      "Horn OK Please! Gaon se Nagar seedha 15 minute me! Chalo baitho!",
      "Loading fresh vegetables and milk in the tempo to sell at the big city market!",
      "State Roadways bus arrives every morning and evening at the Stand!"
    ],
    dialogueHi: [
      "हॉर्न ओके प्लीज! गाँव से शहर सीधे 15 मिनट में! चलो बैठो बाबू!",
      "टेम्पो में गाँव की ताज़ा सब्ज़ियाँ और दूध लोड करके शहर की बड़ी मंडी ले जा रहा हूँ!",
      "गाँव के बस स्टैंड पर सुबह-शाम सरकारी रोडवेज बस आती है!"
    ],
    color: "#5d4037",
    turbanColor: "#78909c",
    avatarIcon: "🚌"
  },
  {
    id: 7,
    name: "Chhotu",
    nameHi: "छोटू (गाँव का बालक)",
    role: "Balak",
    roleHi: "गाँव का शरारती बच्चा",
    x: -12,
    z: 11,
    dialogue: [
      "Bhaiya! Look at the big fish and lotus flowers in our village talab!",
      "I love watching the buffaloes take bath in the pond on hot afternoons!",
      "School is over, now it's time to play gilli-danda by the fields!"
    ],
    dialogueHi: [
      "भैया! हमारे गाँव के तालाब में रंग-बिरंगे कमल के फूल और बत्तखें देखो!",
      "दोपहर में जब भैंसें तालाब में नहाती हैं, तो कितना मज़ा आता है!",
      "स्कूल की छुट्टी हो गई! अब खेतों की मेड़ पर गिल्ली-डंडा खेलेंगे!"
    ],
    color: "#ffb300",
    turbanColor: "#00acc1",
    avatarIcon: "👦🏽"
  }
];

export const generateDailyTasks = (day: number): VillageTask[] => {
  const taskPool: Omit<VillageTask, 'id' | 'completed' | 'claimed' | 'currentCount'>[] = [
    {
      title: "Plow 3 Plots with Hoe",
      titleHi: "फावड़े से 3 खेतों की जुताई करो",
      description: "Prepare fields for fresh seasonal seeds.",
      descriptionHi: "नई फसल के लिए जमीन तैयार करो।",
      targetCount: 3,
      rewardMoney: 120,
      rewardRespect: 10,
      type: 'plow'
    },
    {
      title: "Water 4 Dry Fields",
      titleHi: "4 सूखे खेतों में पानी सींचो",
      description: "Keep the crops hydrated and healthy.",
      descriptionHi: "फसलों को हरा-भरा रखने के लिए बाल्टी से पानी दो।",
      targetCount: 4,
      rewardMoney: 100,
      rewardRespect: 10,
      type: 'water'
    },
    {
      title: "Harvest 2 Ripe Crops",
      titleHi: "2 पकी हुई फसलों की कटाई करो",
      description: "Use the sickle (Danti) to reap your harvest.",
      descriptionHi: "दरांती से पकी फसल काटो।",
      targetCount: 2,
      rewardMoney: 150,
      rewardRespect: 15,
      type: 'harvest'
    },
    {
      title: "Feed Animals on the Farm",
      titleHi: "गौ माता या पशुओं को चारा खिलाओ",
      description: "Show love to hungry livestock with harvested grains.",
      descriptionHi: "भूखे पशुओं को गेहूँ या चावल खिलाओ।",
      targetCount: 1,
      rewardMoney: 100,
      rewardRespect: 15,
      type: 'feed_animal'
    },
    {
      title: "Cook a Desi Meal on Chulha",
      titleHi: "चूल्हे पर स्वादिष्ट भोजन बनाओ",
      description: "Use harvested ingredients to prepare authentic food.",
      descriptionHi: "खेत की उपज से रोटी, साग या खीर पकाओ।",
      targetCount: 1,
      rewardMoney: 130,
      rewardRespect: 12,
      type: 'cook'
    },
    {
      title: "Visit Mandir for Morning Puja",
      titleHi: "गांव के मंदिर में दर्शन और पूजा करो",
      description: "Ring the temple bell and seek Pandit Ji's blessings.",
      descriptionHi: "मंदिर का घंटा बजाकर पंडित जी का आशीर्वाद लो।",
      targetCount: 1,
      rewardMoney: 80,
      rewardRespect: 20,
      type: 'visit_temple'
    },
    {
      title: "Visit Village Pond (Talab)",
      titleHi: "गाँव के तालाब पर जाओ और शीतलता लो",
      description: "Visit the scenic pond with lotus flowers and water buffaloes.",
      descriptionHi: "कमल के फूलों और बत्तखों वाले सुंदर तालाब के दर्शन करो।",
      targetCount: 1,
      rewardMoney: 90,
      rewardRespect: 10,
      type: 'visit_talab'
    },
    {
      title: "Drink Desi Chai at Raju's Stall",
      titleHi: "राजू की टपरी पर कड़क कुल्हड़ चाय पियो",
      description: "Refresh yourself with hot ginger tea at the bazaar.",
      descriptionHi: "बाज़ार में राजू चायवाले से कड़क चाय की चुस्की लो।",
      targetCount: 1,
      rewardMoney: 90,
      rewardRespect: 10,
      type: 'drink_chai'
    },
    {
      title: "Ride or Honk Village Tempo",
      titleHi: "गाँव के टेम्पो या बस स्टैंड की सैर करो",
      description: "Check out the transport hub connecting village to the city.",
      descriptionHi: "शहर जाने वाले टेम्पो और बस स्टैंड पर ड्राइवर से मिलो।",
      targetCount: 1,
      rewardMoney: 100,
      rewardRespect: 10,
      type: 'ride_tempo'
    },
    {
      title: "Sell ₹200 Harvest at Mandi",
      titleHi: "मंडी में लाला जी को ₹200 का माल बेचो",
      description: "Trade your fresh crops, milk or eggs for cash.",
      descriptionHi: "फसल या दूध बेचकर गांव की अर्थव्यवस्था बढ़ाओ।",
      targetCount: 200,
      rewardMoney: 160,
      rewardRespect: 15,
      type: 'sell_crop'
    }
  ];

  const t1 = taskPool[(day * 2) % taskPool.length];
  const t2 = taskPool[(day * 3 + 1) % taskPool.length];
  const t3 = taskPool[(day * 5 + 3) % taskPool.length];

  return [
    { ...t1, id: `task-${day}-1`, completed: false, claimed: false, currentCount: 0 },
    { ...t2, id: `task-${day}-2`, completed: false, claimed: false, currentCount: 0 },
    { ...t3, id: `task-${day}-3`, completed: false, claimed: false, currentCount: 0 },
  ];
};

export const FESTIVALS: Record<string, {
  name: string;
  nameHi: string;
  bonus: string;
  bonusHi: string;
  description: string;
  descriptionHi: string;
}> = {
  BAISAKHI: {
    name: 'Baisakhi (Harvest Festival)',
    nameHi: 'बैसाखी (फसल उत्सव)',
    bonus: '+30% Crop Selling Prices',
    bonusHi: 'फसल बिक्री पर 30% अधिक दाम',
    description: 'The village rejoices with dhol and bhangra as golden wheat ripens!',
    descriptionHi: 'खेतों में पकी सुनहरी फसल को देखकर पूरा गांव ढोल की थाप पर झूम रहा है!'
  },
  DIWALI: {
    name: 'Diwali (Deepotsav)',
    nameHi: 'दीपावली (दीपोत्सव)',
    bonus: 'Double Lakshmi Blessing & Free Temple Sweets',
    bonusHi: 'दोगुनी लक्ष्मी कृपा और मंदिर से प्रसाद',
    description: 'Every village hut shines with oil diyas and marigold flowers!',
    descriptionHi: 'हर घर और खेत मिट्टी के दीयों और गेंदे के फूलों से जगमगा रहा है!'
  },
  MAKAR_SANKRANTI: {
    name: 'Makar Sankranti (Khichdi Parv)',
    nameHi: 'मकर संक्रांति (खिचड़ी पर्व)',
    bonus: '+50% Sugarcane & Rice Value',
    bonusHi: 'गन्ने और चावल पर 50% बोनस मूल्य',
    description: 'Colorful kites fill the azure sky as the sun moves northward!',
    descriptionHi: 'नीले आकाश में रंग-बिरंगी पतंगें और नए धान-तिल की खुशबू फैली है!'
  },
  HOLI: {
    name: 'Holi (Festival of Colors)',
    nameHi: 'होली (रंगोत्सव)',
    bonus: 'Villagers Gift Free Seeds & Animal Joy',
    bonusHi: 'मुफ्त बीज उपहार और पशुओं में उल्लास',
    description: 'Gulal and abeer colors dance in the air with folk songs!',
    descriptionHi: 'गांव की गलियों में ढोल-मंजीरे और गुलाल-अबीर के रंग उड़ रहे हैं!'
  }
};
