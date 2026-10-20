import React, { useState } from 'react';
import { GameState, Tool, LandState, CropType, AnimalType, ResourceType, StructureType, DishType, BuffType, UpgradeType, FertilizerType } from '../types';
import { TOOLS, CROP_DATA, ANIMAL_DATA, RESOURCE_PRICES, STRUCTURE_DATA, DISH_DATA, UPGRADE_DATA, FERTILIZER_DATA, FESTIVALS } from '../constants';
import { 
  ShoppingBasket, CloudSun, Moon, Coins, Info, Hammer, Check, X, Flame, 
  Utensils, Zap, ArrowUpCircle, ShieldCheck, Volume2, VolumeX, Languages, 
  Award, Bell, Sparkles, CheckCircle2, FastForward, BookOpen, BedDouble, BatteryCharging, Truck,
  Sun, Compass
} from 'lucide-react';

interface UIOverlayProps {
  gameState: GameState;
  onSelectTool: (tool: Tool) => void;
  onBuySeed: (crop: CropType) => void;
  onSellItem: (item: CropType | ResourceType | DishType, sellAll?: boolean) => void;
  onBuyAnimal: (animal: AnimalType) => void;
  onSellAnimal: (animal: AnimalType) => void;
  onBuyStructure: (structure: StructureType) => void;
  onCancelBuild: () => void;
  onBuyUpgrade: (upgrade: UpgradeType) => void;
  elderAdvice: string;
  onAskElder: () => void;
  activeDialogue: { npcName: string; text: string } | null;
  onCloseDialogue: () => void;
  showCooking: boolean;
  onCloseCooking: () => void;
  onCook: (dish: DishType) => void;
  onEat: (dish: DishType) => void;
  onToggleSound: () => void;
  onToggleLanguage: () => void;
  onToggleTimeSpeed: () => void;
  onClaimTaskReward: (taskId: string) => void;
  onOpenMarket: () => void;
  onOpenTemple: () => void;
  showRules: boolean;
  onToggleRules: () => void;
  onSleep: () => void;
  onCityMandiSellAll: () => void;
  onToggleManualNight: () => void;
  onPlowAll: () => void;
  onPlantAll: () => void;
  onWaterAll: () => void;
  onHarvestAll: () => void;
  onCareAllAnimals: () => void;
  onMoveDpad: (dx: number, dz: number) => void;
  onQuickGoTo: (x: number, z: number, labelHi: string, labelEn: string) => void;
  onBuyFertilizer: (type: FertilizerType, count?: 1 | 5) => void;
  onSelectFertilizer: (type: FertilizerType) => void;
  onFertilizeAll: (preferredType?: FertilizerType) => void;
}

export const getKisanRankTitle = (level: number, isHi: boolean): string => {
  if (level <= 1) return isHi ? 'नया किसान' : 'Apprentice Kisan';
  if (level === 2) return isHi ? 'मेहनती किसान' : 'Hardworking Kisan';
  if (level === 3) return isHi ? 'आदर्श पशुपालक' : 'Master Herdsman';
  if (level === 4) return isHi ? 'समृद्ध ज़मींदार' : 'Prosperous Zamindar';
  return isHi ? 'गाँव रत्न (प्रधान)' : 'Gaon Ratna (Village Pride)';
};

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, 
  onSelectTool, 
  onBuySeed,
  onSellItem,
  onBuyAnimal,
  onSellAnimal,
  onBuyStructure,
  onCancelBuild,
  onBuyUpgrade,
  elderAdvice,
  onAskElder,
  activeDialogue,
  onCloseDialogue,
  showCooking,
  onCloseCooking,
  onCook,
  onEat,
  onToggleSound,
  onToggleLanguage,
  onToggleTimeSpeed,
  onClaimTaskReward,
  onOpenTemple,
  showRules,
  onToggleRules,
  onSleep,
  onCityMandiSellAll,
  onToggleManualNight,
  onPlowAll,
  onPlantAll,
  onWaterAll,
  onHarvestAll,
  onCareAllAnimals,
  onMoveDpad,
  onQuickGoTo,
  onBuyFertilizer,
  onSelectFertilizer,
  onFertilizeAll
}) => {
  const [showMarket, setShowMarket] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [rulesTab, setRulesTab] = useState<'farming' | 'animals' | 'energy' | 'progression' | 'controls'>('farming');

  const isHi = gameState.language === 'hi';
  const isNight = Boolean(gameState.isManualNight);

  const unclaimedTasksCount = gameState.villageTasks.filter(t => t.completed && !t.claimed).length;
  const stamina = gameState.stamina ?? 100;
  const maxStamina = gameState.maxStamina ?? 100;
  const bucketWater = gameState.bucketWater ?? 5;
  const maxBucketWater = gameState.maxBucketWater ?? 5;
  const level = gameState.level ?? 1;
  const xp = gameState.xp ?? 0;
  const xpForNextLevel = level * 100;
  const hasIrrigation = gameState.upgrades.includes(UpgradeType.IRRIGATION_PUMP);

  const totalCropsCount = (Object.values(gameState.inventory.crops) as number[]).reduce((a, b) => a + b, 0);
  const totalResourcesCount = (Object.values(gameState.inventory.resources) as number[]).reduce((a, b) => a + b, 0);
  const totalSeedsCount = (Object.values(gameState.inventory.seeds) as number[]).reduce((a, b) => a + b, 0);
  const fertilizersInv = gameState.inventory.fertilizers || {
    [FertilizerType.DESI_GOBAR]: 0,
    [FertilizerType.VERMI_COMPOST]: 0,
    [FertilizerType.AMRIT_KHAAD]: 0
  };
  const totalFertilizerCount = (Object.values(fertilizersInv) as number[]).reduce((a, b) => a + b, 0);

  // Farm state counts for live Step-by-Step Kisan Coach
  const emptyPlotsCount = gameState.plots.filter(p => p.state === LandState.EMPTY).length;
  const plowedPlotsCount = gameState.plots.filter(p => p.state === LandState.PLOWED).length;
  const growingPlotsCount = gameState.plots.filter(p => p.state === LandState.GROWING || p.state === LandState.SEEDED).length;
  const unfertilizedGrowingCount = gameState.plots.filter(p => (p.state === LandState.GROWING || p.state === LandState.SEEDED) && !p.fertilizer).length;
  const dryPlotsCount = gameState.plots.filter(p => (p.state === LandState.GROWING || p.state === LandState.SEEDED) && p.waterLevel < 50).length;
  const ripePlotsCount = gameState.plots.filter(p => p.state === LandState.RIPE).length;
  const readyAnimalsCount = gameState.animals.filter(a => a.isReady).length;

  // Dynamic Step-by-Step Coach Recommendation
  const getNextStepGuide = (): { title: string; btnLabel: string; onAction: () => void; colorClass: string } => {
    if (ripePlotsCount > 0) {
      return {
        title: isHi
          ? `🎉 ${ripePlotsCount} खेत में फसल पक कर तैयार है! खेत पर टैप करें या अभी काटें:`
          : `🎉 ${ripePlotsCount} plot(s) are ripe for harvest! Tap the plot or harvest all:`,
        btnLabel: isHi ? `🌾 सब काटें (${ripePlotsCount})` : `🌾 Harvest All (${ripePlotsCount})`,
        onAction: onHarvestAll,
        colorClass: 'from-amber-600 to-yellow-600 border-yellow-300'
      };
    }
    if (readyAnimalsCount > 0) {
      return {
        title: isHi
          ? `🥛 ${readyAnimalsCount} पशु से ताज़ा दूध/अंडा तैयार है! पशु पर टैप करें या इकट्ठा करें:`
          : `🥛 ${readyAnimalsCount} animal(s) have fresh milk/eggs ready!`,
        btnLabel: isHi ? `🐄 दूध/अंडे लें (${readyAnimalsCount})` : `🐄 Collect (${readyAnimalsCount})`,
        onAction: onCareAllAnimals,
        colorClass: 'from-blue-600 to-cyan-600 border-cyan-300'
      };
    }
    if (plowedPlotsCount > 0 && totalSeedsCount > 0) {
      return {
        title: isHi
          ? `🌱 कदम 2: ${plowedPlotsCount} जुते हुए खेत तैयार हैं! खेत पर टैप करें या बीज बोएं:`
          : `🌱 Step 2: ${plowedPlotsCount} plowed plot(s) ready! Tap plot or plant seeds:`,
        btnLabel: isHi ? `🌱 सब में बीज बोएं` : `🌱 Plant All`,
        onAction: onPlantAll,
        colorClass: 'from-emerald-600 to-green-600 border-emerald-300'
      };
    }
    if (plowedPlotsCount > 0 && totalSeedsCount === 0) {
      return {
        title: isHi
          ? `🏪 आपके पास बीज खत्म हो गए हैं! मंडी से नए बीज खरीदें:`
          : `🏪 You are out of seeds! Buy seeds from the Mandi:`,
        btnLabel: isHi ? `🏪 मंडी खोलें` : `🏪 Open Mandi`,
        onAction: () => setShowMarket(true),
        colorClass: 'from-amber-700 to-orange-600 border-amber-300'
      };
    }
    if (emptyPlotsCount > 0) {
      return {
        title: isHi
          ? `⛏️ कदम 1: किसी भी खाली खेत पर टैप करके जुताई करें या 1 क्लिक में सब जोतें:`
          : `⛏️ Step 1: Tap any empty farm plot to plow, or plow all in 1 click:`,
        btnLabel: isHi ? `🚜 सब खेत जोतें (${emptyPlotsCount})` : `🚜 Plow All (${emptyPlotsCount})`,
        onAction: onPlowAll,
        colorClass: 'from-amber-700 to-yellow-700 border-amber-300'
      };
    }
    if (dryPlotsCount > 0) {
      return {
        title: isHi
          ? `💧 कदम 3: ${dryPlotsCount} खेतों में पानी कम है! खेत पर टैप करें या सब सींचें:`
          : `💧 Step 3: ${dryPlotsCount} plot(s) need water! Tap plot or water all:`,
        btnLabel: isHi ? `💧 सब खेत सींचें` : `💧 Water All`,
        onAction: onWaterAll,
        colorClass: 'from-cyan-600 to-blue-600 border-cyan-300'
      };
    }
    if (growingPlotsCount > 0) {
      return {
        title: isHi
          ? `🌿 ${growingPlotsCount} खेतों में फसल उग रही है! तुरंत पकाने के लिए विश्राम करें:`
          : `🌿 ${growingPlotsCount} crops are growing! Rest on Charpai to advance growth:`,
        btnLabel: isHi ? `🛏️ विश्राम करें (+फसल बढ़ाएं)` : `🛏️ Rest (+Grow Crops)`,
        onAction: onSleep,
        colorClass: 'from-indigo-600 to-purple-600 border-indigo-300'
      };
    }
    return {
      title: isHi
        ? `💰 अपनी उपज मंडी में बेचकर मुनाफा कमाएं!`
        : `💰 Sell your harvest in the Mandi for profit!`,
      btnLabel: isHi ? `🏪 मंडी खोलें` : `🏪 Open Mandi`,
      onAction: () => setShowMarket(true),
      colorClass: 'from-emerald-700 to-teal-700 border-emerald-300'
    };
  };

  const nextStep = getNextStepGuide();

  if (gameState.placingStructure) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-10 pointer-events-none z-50">
        <div className="bg-stone-900/95 text-white px-6 py-4 rounded-2xl backdrop-blur flex flex-col items-center gap-2 pointer-events-auto shadow-2xl border-2 border-emerald-500 animate-bounce-subtle">
          <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
            <Hammer /> {isHi ? 'निर्माण मोड' : 'Build Mode'}
          </h2>
          <p className="text-sm text-stone-300">
            {isHi 
              ? `जमीन पर कहीं भी क्लिक करके ${gameState.placingStructure} स्थापित करें` 
              : `Click anywhere on the ground to place the ${gameState.placingStructure}`}
          </p>
          <button 
            onClick={onCancelBuild}
            className="mt-2 flex items-center gap-2 bg-red-600 hover:bg-red-700 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95"
          >
            <X size={16} /> {isHi ? 'रद्द करें' : 'Cancel'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between select-none">
      {/* --- Top Bar: Village Info, Stamina, Level & Controls --- */}
      <div className="bg-gradient-to-b from-black/90 via-black/50 to-transparent p-3 md:p-4 text-white flex flex-wrap justify-between items-start pointer-events-auto gap-2">
        
        {/* Left: Time, Season, Stamina & Kisan Level */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-2xl font-black text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide">
              <span>🌾 {isHi ? 'गाँव' : 'GAON'}</span>
            </div>
            <span className="text-[11px] bg-amber-500/20 text-amber-200 px-2.5 py-0.5 rounded-full border border-amber-500/40 font-bold">
              🎖️ {isHi ? `स्तर ${level}: ${getKisanRankTitle(level, true)}` : `Lvl ${level}: ${getKisanRankTitle(level, false)}`}
            </span>
          </div>

          {/* Clock, Weather, Manual Day/Night Toggle & Speed Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs bg-black/65 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
            {isNight ? <Moon size={15} className="text-indigo-300 animate-pulse"/> : <Sun size={15} className="text-yellow-400"/>}
            <span className="font-semibold">{isHi ? `दिन ${gameState.day}` : `Day ${gameState.day}`}</span>
            <span className="w-px h-3.5 bg-white/20"></span>
            <span className="font-bold text-amber-200">
              {isNight ? (isHi ? '🌙 रात' : '🌙 Night') : (isHi ? '☀️ उजाला (दिन)' : '☀️ Bright Day')}
            </span>
            <span className="w-px h-3.5 bg-white/20"></span>
            {/* Manual Day / Night Toggle Button */}
            <button
              onClick={onToggleManualNight}
              className={`text-[10px] font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full border transition-all active:scale-95 ${
                isNight
                  ? 'bg-amber-500 text-stone-950 border-yellow-200 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                  : 'bg-indigo-950/90 text-indigo-200 border-indigo-500/60 hover:bg-indigo-800'
              }`}
              title={isHi ? 'मैनुअल दिन/रात बदलें' : 'Toggle Manual Day/Night'}
            >
              {isNight ? <Sun size={11} /> : <Moon size={11} />}
              <span>{isNight ? (isHi ? '☀️ दिन करें' : '☀️ Make Day') : (isHi ? '🌙 रात करें' : '🌙 Make Night')}</span>
            </button>
            <span className="w-px h-3.5 bg-white/20"></span>
            <button 
              onClick={onToggleTimeSpeed} 
              className="text-[10px] font-bold text-cyan-300 hover:text-cyan-100 flex items-center gap-1 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-700/50"
              title="Click to toggle time speed"
            >
              <FastForward size={11} />
              <span>{gameState.timeSpeed === 1 ? (isHi ? '1x' : '1x') : (isHi ? '2x' : '2x')}</span>
            </button>
          </div>

          {/* Stamina Bar + XP Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-md">
            {/* Energy / Stamina */}
            <div className="flex items-center gap-1.5">
              <BatteryCharging size={14} className={stamina > 30 ? 'text-lime-400' : 'text-red-400 animate-bounce'} />
              <div className="w-20 bg-stone-800 h-2.5 rounded-full overflow-hidden border border-stone-700">
                <div 
                  className={`h-full transition-all duration-300 ${
                    stamina > 50 ? 'bg-lime-500' : stamina > 25 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, (stamina / maxStamina) * 100))}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-stone-200">
                {Math.round(stamina)}/{maxStamina}
              </span>
            </div>

            <span className="w-px h-3 bg-white/15"></span>

            {/* XP Progress */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-amber-300 font-bold">XP</span>
              <div className="w-16 bg-stone-800 h-2 rounded-full overflow-hidden border border-stone-700">
                <div 
                  className="bg-amber-400 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (xp / xpForNextLevel) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-stone-300">{xp}/{xpForNextLevel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-[11px] text-emerald-200 font-semibold tracking-wide bg-emerald-950/70 px-2.5 py-0.5 rounded-full border border-emerald-700/60 shadow">
              {gameState.season}
            </div>

            <div className="flex items-center gap-1 text-[11px] bg-amber-950/70 px-2.5 py-0.5 rounded-full border border-amber-600/60 text-amber-200 shadow">
              <Award size={12} className="text-amber-400" />
              <span>{isHi ? 'प्रतिष्ठा:' : 'Honor:'} {gameState.respect}★</span>
            </div>

            {gameState.activeBuff && (
              <div className="flex items-center gap-1 text-[11px] bg-purple-900/80 px-2.5 py-0.5 rounded-full border border-purple-500 text-purple-200 animate-pulse shadow">
                <Zap size={12} /> {gameState.activeBuff.type}
              </div>
            )}
          </div>

          {gameState.currentFestival && (
            <div className="mt-0.5 flex items-center gap-1.5 bg-gradient-to-r from-orange-600/90 to-amber-600/90 text-white px-3 py-1 rounded-lg text-xs font-bold border border-yellow-300 shadow-md animate-pulse">
              <Sparkles size={14} className="text-yellow-200" />
              <span>
                {isHi ? FESTIVALS[gameState.currentFestival]?.nameHi : FESTIVALS[gameState.currentFestival]?.name}
              </span>
            </div>
          )}
        </div>

        {/* Center: Interactive Step-by-Step Kisan Guide + Sarpanch Advice + Inventory */}
        <div className="flex flex-col items-center gap-1.5 max-w-lg w-full lg:w-auto mx-auto">
          {/* Interactive Step-by-Step Coach Banner (Always visible so user knows what to do!) */}
          <div className="w-full bg-stone-900/95 border-2 border-amber-400/90 text-white px-3.5 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold leading-snug">
              <span className="bg-amber-500 text-stone-950 font-black px-2 py-0.5 rounded-md text-[10px] shrink-0 uppercase">
                {isHi ? 'अगला काम' : 'NEXT STEP'}
              </span>
              <span className="text-amber-100">{nextStep.title}</span>
            </div>
            <button
              onClick={nextStep.onAction}
              className={`shrink-0 bg-gradient-to-r ${nextStep.colorClass} text-white font-bold text-xs px-3.5 py-1.5 rounded-xl border shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer`}
            >
              {nextStep.btnLabel}
            </button>
          </div>

          {elderAdvice && !activeDialogue && !showCooking && !showRules && (
            <div className="hidden md:flex w-full bg-stone-900/85 border border-amber-600/70 text-amber-100 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md text-[11px] gap-2 items-center">
              <span className="text-base shrink-0">👴🏽</span>
              <p className="leading-snug text-stone-200 truncate">{elderAdvice}</p>
            </div>
          )}

          {/* Quick Inventory Bar (Crops, Resources & Manure at a Glance) */}
          <div className="flex flex-wrap items-center justify-center gap-2 bg-black/65 px-3 py-1 rounded-full border border-white/10 text-[11px] text-stone-200">
            <span title="Wheat">🌾 {gameState.inventory.crops[CropType.WHEAT] || 0}</span>
            <span title="Rice">🍚 {gameState.inventory.crops[CropType.RICE] || 0}</span>
            <span title="Sugarcane">🎋 {gameState.inventory.crops[CropType.SUGARCANE] || 0}</span>
            <span title="Mustard">🌼 {gameState.inventory.crops[CropType.MUSTARD] || 0}</span>
            <span className="w-px h-3 bg-white/20"></span>
            <span title="Milk">🥛 {gameState.inventory.resources[ResourceType.MILK] || 0}</span>
            <span title="Eggs">🥚 {gameState.inventory.resources[ResourceType.EGG] || 0}</span>
            <span className="w-px h-3 bg-white/20"></span>
            <button
              onClick={() => setShowMarket(true)}
              className="text-lime-300 hover:text-lime-200 font-bold flex items-center gap-0.5 cursor-pointer"
              title={isHi ? 'देसी खाद भंडार खोलें' : 'Open Fertilizer Shop in Mandi'}
            >
              🧪 {isHi ? 'खाद:' : 'Manure:'} {totalFertilizerCount}
            </button>
          </div>
        </div>

        {/* Right: Money, Rules, Sleep, Quests & Village Toggles */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 bg-gradient-to-r from-amber-900/90 to-yellow-900/90 px-3.5 py-1.5 rounded-xl border border-yellow-500 shadow-lg backdrop-blur-md">
            <Coins className="text-yellow-400 w-5 h-5 animate-spin-slow" />
            <span className="font-mono font-bold text-lg md:text-xl text-yellow-100">₹{gameState.inventory.money}</span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {/* Game Rules & Guidebook Button */}
            <button 
              onClick={onToggleRules}
              className="flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 rounded-xl shadow-md transition-all text-xs font-bold border border-indigo-400 active:scale-95"
              title={isHi ? 'खेल के नियम और गाइड' : 'Game Rules & Guide'}
            >
              <BookOpen size={15} />
              <span>{isHi ? 'नियम (Rules)' : 'Rules'}</span>
            </button>

            {/* Sleep / Rest on Charpai Button */}
            <button 
              onClick={onSleep}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-md transition-all text-xs font-bold border active:scale-95 ${
                isNight || stamina < 35
                  ? 'bg-purple-700 hover:bg-purple-600 border-purple-400 text-white animate-pulse'
                  : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-200'
              }`}
              title={isHi ? 'खाट पर सोएं (ऊर्जा 100% करें व सुबह करें)' : 'Sleep on Charpai (Restore 100% Energy & Advance to Morning)'}
            >
              <BedDouble size={15} />
              <span>{isHi ? 'सोएं (Rest)' : 'Sleep'}</span>
            </button>

            {/* Daily Tasks Button */}
            <button 
              onClick={() => setShowTasks(!showTasks)}
              className="relative flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 px-3 py-1.5 rounded-xl shadow-md transition-all text-xs font-bold border border-amber-500 active:scale-95"
            >
              <CheckCircle2 size={15} />
              <span>{isHi ? 'गाँव के काम' : 'Tasks'}</span>
              {unclaimedTasksCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black animate-pulse">
                  {unclaimedTasksCount}
                </span>
              )}
            </button>

            {/* Mandi Toggle */}
            <button 
              onClick={() => setShowMarket(!showMarket)}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 rounded-xl shadow-md transition-all text-xs font-bold border border-emerald-500 active:scale-95"
            >
              <ShoppingBasket size={15} />
              <span>{showMarket ? (isHi ? 'बंद करें' : 'Close') : (isHi ? 'मंडी' : 'Mandi')}</span>
            </button>

            {/* Temple Button */}
            <button 
              onClick={onOpenTemple}
              className="flex items-center gap-1 bg-orange-700 hover:bg-orange-600 px-2.5 py-1.5 rounded-xl shadow-md transition-all text-xs font-bold border border-orange-500 active:scale-95"
              title={isHi ? 'गाँव मंदिर' : 'Village Temple'}
            >
              <Bell size={14} />
            </button>

            {/* Audio Toggle */}
            <button 
              onClick={onToggleSound}
              className={`p-1.5 rounded-xl shadow-md transition-all border active:scale-95 ${
                gameState.isMuted 
                  ? 'bg-stone-800 text-stone-400 border-stone-700' 
                  : 'bg-indigo-800 text-indigo-200 border-indigo-600'
              }`}
              title={gameState.isMuted ? 'Unmute' : 'Mute'}
            >
              {gameState.isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            {/* Language Toggle */}
            <button 
              onClick={onToggleLanguage}
              className="flex items-center gap-1 bg-stone-800 hover:bg-stone-700 px-2.5 py-1.5 rounded-xl shadow-md transition-all text-xs font-bold border border-stone-600 active:scale-95 text-stone-200"
              title="Toggle Hindi / English"
            >
              <Languages size={14} />
              <span>{isHi ? 'EN' : 'हिन्दी'}</span>
            </button>
          </div>

          <button 
            onClick={onAskElder}
            className="flex items-center gap-1 bg-amber-950/80 hover:bg-amber-900 px-2.5 py-1 rounded-lg transition-all text-[11px] font-semibold border border-amber-700/60 text-amber-200 active:scale-95"
          >
            <Info size={13} />
            <span>{isHi ? 'सरपंच जी से सलाह लें' : 'Ask Village Elder'}</span>
          </button>
        </div>
      </div>

      {/* --- GAME RULES & VILLAGE HANDBOOK MODAL ("गाँव के नियम और खेल गाइड") --- */}
      {showRules && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/70 backdrop-blur-sm z-50 p-4">
          <div className="bg-stone-900 text-stone-100 p-6 rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-indigo-500 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b border-stone-700 pb-3">
              <div className="flex items-center gap-2.5">
                <BookOpen className="text-amber-400 w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold text-amber-300">
                    {isHi ? '📜 गाँव के नियम और खेल गाइड (Game Rules)' : '📜 Village Rules & How to Play Guide'}
                  </h2>
                  <p className="text-xs text-stone-400">
                    {isHi ? 'आदर्श किसान और गाँव रत्न बनने के सभी नियम यहाँ पढ़ें' : 'Master farming, animal care, energy management & village life'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onToggleRules} 
                className="text-stone-400 hover:text-white hover:bg-stone-800 p-1.5 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1.5 mb-4 border-b border-stone-800 pb-3">
              {[
                { id: 'farming', labelHi: '🌾 खेती व पानी नियम', labelEn: '🌾 Farming & Water' },
                { id: 'animals', labelHi: '🐄 पशुपालन व रात्रि', labelEn: '🐄 Animals & Night' },
                { id: 'energy', labelHi: '⚡ ऊर्जा, रसोई व नींद', labelEn: '⚡ Energy & Sleep' },
                { id: 'progression', labelHi: '🏆 लेवल व शहर मंडी', labelEn: '🏆 Ranks & City Bus' },
                { id: 'controls', labelHi: '🎮 कंट्रोल्स', labelEn: '🎮 Controls' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRulesTab(tab.id as typeof rulesTab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    rulesTab === tab.id
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {isHi ? tab.labelHi : tab.labelEn}
                </button>
              ))}
            </div>

            {/* Rules Content Body */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm leading-relaxed">
              {rulesTab === 'farming' && (
                <div className="space-y-3">
                  <div className="bg-stone-950/80 p-4 rounded-2xl border border-emerald-800/60">
                    <h3 className="font-bold text-emerald-400 mb-2">
                      {isHi ? '1. खेती के 4 चरण (4 Steps of Farming)' : '1. The 4 Steps of Farming'}
                    </h3>
                    <ul className="space-y-1.5 text-xs text-stone-200 list-disc pl-4">
                      <li>
                        <strong>{isHi ? 'जुताई (Plowing):' : 'Plowing:'}</strong>{' '}
                        {isHi
                          ? 'औज़ार #2 "फावड़ा (Hoe)" चुनें और खाली ज़मीन पर क्लिक करके खेत जोतें। (ट्रैक्टर अपग्रेड होने पर एक साथ 5 खेत जुतते हैं!)'
                          : 'Select Tool #2 "Phawra (Hoe)" and click an empty plot to plow. (Owning the Desi Tractor plows 5 plots at once!)'}
                      </li>
                      <li>
                        <strong>{isHi ? 'बुवाई (Planting):' : 'Seeding:'}</strong>{' '}
                        {isHi
                          ? 'औज़ार #5 से #8 (गेहूँ, धान, गन्ना या सरसों के बीज) चुनें और जुते हुए खेत पर बोएं।'
                          : 'Select Tools #5–#8 (Wheat, Rice, Sugarcane, or Mustard seeds) and click a plowed plot.'}
                      </li>
                      <li>
                        <strong>{isHi ? 'सिंचाई व कुएं का नियम (Watering Rule):' : 'Water Bucket Rule:'}</strong>{' '}
                        {isHi
                          ? 'बाल्टी (#3) में एक बार में 5 बार पानी आता है (💧 5/5)। पानी खत्म होने पर "गाँव के कुएं" या "तालाब" पर क्लिक करके बाल्टी फिर से भरें।'
                          : 'Your Water Bucket (#3) holds 5 charges (💧 5/5). Click the Village Well or Pond (Talab) anytime to refill it.'}
                      </li>
                      <li>
                        <strong>{isHi ? 'कटाई (Harvesting):' : 'Harvesting:'}</strong>{' '}
                        {isHi
                          ? 'जब फसल पककर सुनहरी (100%) हो जाए, तो औज़ार #4 "दरांती (Sickle)" से फसल काटें।'
                          : 'When crops reach 100% ripeness, select Tool #4 "Sickle" to harvest.'}
                      </li>
                    </ul>
                  </div>

                  <div className="bg-stone-950/80 p-4 rounded-2xl border border-amber-800/60">
                    <h3 className="font-bold text-amber-400 mb-2">
                      {isHi ? '2. मौसम के अनुसार फसल नियम (Seasonal Crop Bonus)' : '2. Seasonal Crop Rules (2x Speed!)'}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-stone-900 p-2.5 rounded-xl border border-stone-800">
                        <span className="font-bold text-yellow-300">🌾 {isHi ? 'गेहूँ व सरसों:' : 'Wheat & Mustard:'}</span>
                        <p className="text-stone-400">{isHi ? 'सर्दी (Shishir) में दोगुनी तेज़ी से उगते हैं।' : 'Grow 2x faster in Winter (Shishir).'}</p>
                      </div>
                      <div className="bg-stone-900 p-2.5 rounded-xl border border-stone-800">
                        <span className="font-bold text-cyan-300">🍚 {isHi ? 'धान (Rice):' : 'Rice (Dhan):'}</span>
                        <p className="text-stone-400">{isHi ? 'मानसून (Varsha) और बारिश में सबसे तेज़।' : 'Grows 2x faster in Monsoon & Rain.'}</p>
                      </div>
                      <div className="bg-stone-900 p-2.5 rounded-xl border border-stone-800">
                        <span className="font-bold text-lime-300">🎋 {isHi ? 'गन्ना (Sugarcane):' : 'Sugarcane:'}</span>
                        <p className="text-stone-400">{isHi ? 'गर्मी (Grishma) में सबसे ज़्यादा मुनाफा देता है।' : 'Thrives in Summer (Grishma) with high value.'}</p>
                      </div>
                      <div className="bg-stone-900 p-2.5 rounded-xl border border-stone-800">
                        <span className="font-bold text-orange-300">🦅 {isHi ? 'पक्षियों से बचाव:' : 'Bird Protection:'}</span>
                        <p className="text-stone-400">{isHi ? 'बिजूका (Scarecrow) खरीदने या मंदिर पूजा से चिड़ियाँ फसल नहीं खातीं।' : 'Buy a Scarecrow or do Temple Puja to protect crops from birds.'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {rulesTab === 'animals' && (
                <div className="space-y-3">
                  <div className="bg-stone-950/80 p-4 rounded-2xl border border-cyan-800/60">
                    <h3 className="font-bold text-cyan-400 mb-2">
                      {isHi ? '1. पशुओं का चारा और उत्पादन (Animal Diet & Produce)' : '1. Livestock Diet & Produce Rules'}
                    </h3>
                    <ul className="space-y-2 text-xs text-stone-200 list-disc pl-4">
                      <li>
                        <strong>🐄 {isHi ? 'देसी गिर गाय (Cow):' : 'Desi Gir Cow:'}</strong>{' '}
                        {isHi ? 'इसे "हाथ (#1)" चुनकर गेहूँ (Wheat) खिलाएं। यह ताज़ा दूध (Milk) देती है।' : 'Feed Wheat using Tool #1 (Hand). Produces fresh Milk.'}
                      </li>
                      <li>
                        <strong>🐔 {isHi ? 'देसी मुर्गी (Chicken):' : 'Desi Hen:'}</strong>{' '}
                        {isHi ? 'इसे धान (Rice) खिलाएं। यह अंडे (Eggs) देती है और दिन भर दाना चुगती है।' : 'Feed Rice using Tool #1 (Hand). Produces Eggs.'}
                      </li>
                      <li>
                        <strong>🐐 {isHi ? 'बकरी (Goat):' : 'Desi Goat:'}</strong>{' '}
                        {isHi ? 'इसे गन्ना (Sugarcane) खिलाएं। यह जल्दी दूध देती है।' : 'Feed Sugarcane using Tool #1 (Hand). Produces Milk quickly.'}
                      </li>
                    </ul>
                  </div>

                  <div className="bg-stone-950/80 p-4 rounded-2xl border border-indigo-800/60">
                    <h3 className="font-bold text-indigo-300 mb-2">
                      {isHi ? '2. दिन में चरना और रात में सोना (Day Grazing & Night Sleeping)' : '2. Daytime Grazing & Night Sleeping State'}
                    </h3>
                    <p className="text-xs text-stone-300">
                      {isHi
                        ? 'दिन के समय गाय और बकरी हरी घास चरती हैं (Grazing) और मुर्गी ज़मीन से दाना चुगती है (Pecking)। रात 7:00 बजे से सुबह 5:00 बजे तक सभी जानवर ज़मीन पर बैठकर सो जाते हैं (💤 Sleeping State) और उनकी भूख बहुत कम घटती है।'
                        : 'During the day, cows and goats graze on grass while chickens peck for seeds. From 7:00 PM to 5:00 AM at night, all animals lie down in a peaceful Sleeping State (💤 Zzz) and consume much less hunger.'}
                    </p>
                  </div>
                </div>
              )}

              {rulesTab === 'energy' && (
                <div className="space-y-3">
                  <div className="bg-stone-950/80 p-4 rounded-2xl border border-lime-800/60">
                    <h3 className="font-bold text-lime-400 mb-2">
                      {isHi ? '1. किसान की ऊर्जा (Stamina / Energy नियम)' : '1. Kisan Stamina & Energy Rules'}
                    </h3>
                    <p className="text-xs text-stone-300 mb-2">
                      {isHi
                        ? 'खेत जोतने, पानी देने और फसल काटने में किसान की ऊर्जा (⚡ Stamina) खर्च होती है। ऊर्जा खत्म होने पर किसान थक जाता है।'
                        : 'Plowing, watering, planting, and harvesting use Kisan Stamina (⚡). When stamina runs low, you must restore energy.'}
                    </p>
                    <ul className="space-y-1.5 text-xs text-stone-200 list-disc pl-4">
                      <li>
                        <strong>🛏️ {isHi ? 'खाट / चारपाई पर सोना (Sleep):' : 'Sleep on Charpai:'}</strong>{' '}
                        {isHi
                          ? 'घर के बाहर रखी चारपाई या ऊपर "सोएं (Rest)" बटन पर क्लिक करने से ऊर्जा 100% हो जाती है और रात होने पर सीधे सुबह 6:00 बजे सवेरा हो जाता है!'
                          : 'Click the Courtyard Charpai bed or the top "Sleep" button to restore 100% Stamina and advance night to 6:00 AM dawn!'}
                      </li>
                      <li>
                        <strong>🔥 {isHi ? 'देसी चूल्हा रसोई:' : 'Desi Chulha Cooking:'}</strong>{' '}
                        {isHi
                          ? 'चूल्हे पर रोटी, खीर, सरसों का साग या गन्ने का रस बनाकर खाने से ऊर्जा भी मिलती है और विशेष शक्तियाँ (Buffs) भी!'
                          : 'Cook and eat Makki di Roti, Kheer, Sarson ka Saag, or Ganna Juice at the Chulha to restore stamina and gain powerful buffs!'}
                      </li>
                      <li>
                        <strong>☕ {isHi ? 'राजू की चाय व तालाब:' : 'Raju’s Chai & Village Pond:'}</strong>{' '}
                        {isHi
                          ? 'राजू की टपरी पर चाय पीने से +30 ऊर्जा व तेज़ चाल मिलती है, और तालाब में नहाने से +20 ताज़गी मिलती है।'
                          : 'Drink hot chai at Raju’s Tapri for +30 Stamina & Speed, or refresh at the Village Talab for +20 Stamina.'}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {rulesTab === 'progression' && (
                <div className="space-y-3">
                  <div className="bg-stone-950/80 p-4 rounded-2xl border border-amber-700/60">
                    <h3 className="font-bold text-amber-300 mb-2">
                      {isHi ? '1. किसान लेवल और पंचायत पद (Kisan Ranks & XP)' : '1. Kisan Levels & Panchayat Titles'}
                    </h3>
                    <p className="text-xs text-stone-300 mb-2">
                      {isHi
                        ? 'खेती, पशुपालन और गाँव के काम पूरे करने पर XP मिलता है। हर नए लेवल पर नकद इनाम (₹150 × लेवल) और गाँव में सम्मान (★) बढ़ता है:'
                        : 'Earn XP from farming, caring for animals, and completing village tasks. Every level-up awards a Cash Bonus (₹150 × Level) and Village Honor:'}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-xs text-stone-200">
                      <div className="bg-stone-900 p-2 rounded-lg">🎖️ Lvl 1: {isHi ? 'नया किसान' : 'Apprentice Kisan'}</div>
                      <div className="bg-stone-900 p-2 rounded-lg">🎖️ Lvl 2: {isHi ? 'मेहनती किसान' : 'Hardworking Kisan'}</div>
                      <div className="bg-stone-900 p-2 rounded-lg">🎖️ Lvl 3: {isHi ? 'आदर्श पशुपालक' : 'Master Herdsman'}</div>
                      <div className="bg-stone-900 p-2 rounded-lg">🎖️ Lvl 4+: {isHi ? 'गाँव रत्न (प्रधान)' : 'Gaon Ratna (Village Pride)'}</div>
                    </div>
                  </div>

                  <div className="bg-stone-950/80 p-4 rounded-2xl border border-orange-700/60">
                    <h3 className="font-bold text-orange-300 mb-2">
                      {isHi ? '2. शहर मंडी एक्सप्रेस (City Bus & Tempo Bonus)' : '2. City Market Express Bonus (+20%)'}
                    </h3>
                    <p className="text-xs text-stone-300">
                      {isHi
                        ? 'सड़क पर खड़ी रोडवेज बस या देसी टेम्पो (या मंडी में "शहर मंडी एक्सप्रेस" बटन) से अपनी सारी फसल व दूध-अंडे एक साथ शहर भेजने पर +20% अधिक दाम मिलता है (किराया मात्र ₹15)!'
                        : 'Use the Roadways Bus / Tempo (or the City Mandi Express button in the market) to sell all crops & produce in the city for a +20% price bonus (Ticket: ₹15)!'}
                    </p>
                  </div>
                </div>
              )}

              {rulesTab === 'controls' && (
                <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-700 space-y-2 text-xs text-stone-200">
                  <p>⌨️ <strong>WASD / Arrow Keys:</strong> {isHi ? 'किसान को गाँव में चारों तरफ चलाएं' : 'Walk around the 3D village'}</p>
                  <p>🖱️ <strong>Left Click:</strong> {isHi ? 'खेत जोतने, बीज बोने, जानवरों को खिलाने और ग्रामीणों से बात करने के लिए क्लिक करें' : 'Click plots, animals, villagers, well, pond, temple, or vehicles'}</p>
                  <p>🔄 <strong>Mouse Drag & Scroll:</strong> {isHi ? 'कैमरा घुमाएं और ज़ूम इन/आउट करें' : 'Rotate 3D camera and zoom in/out'}</p>
                  <p>🔢 <strong>Keys 1 – 8:</strong> {isHi ? 'नीचे दिए गए औज़ार और बीज तुरंत चुनें' : 'Quickly switch tools and seeds'}</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800 flex justify-end">
              <button
                onClick={onToggleRules}
                className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95"
              >
                {isHi ? 'समझ गया, चलो खेती करें! 🌾' : 'Got it, Let’s Farm! 🌾'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Dialogue Modal (Interactive NPCs) --- */}
      {activeDialogue && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="bg-gradient-to-b from-stone-900 to-stone-950 text-white p-6 rounded-3xl max-w-md w-full shadow-2xl border-4 border-amber-600 animate-scale-up">
            <div className="flex items-center gap-3 mb-3 border-b border-stone-700 pb-3">
              <div className="w-12 h-12 rounded-full bg-amber-900/60 border border-amber-500 flex items-center justify-center text-2xl">
                🙏
              </div>
              <div>
                <h2 className="text-xl font-bold text-amber-400">{activeDialogue.npcName}</h2>
                <span className="text-xs text-amber-200/70 font-semibold">{isHi ? 'गाँव निवासी' : 'Gaon Resident'}</span>
              </div>
            </div>

            <p className="text-base mb-6 leading-relaxed text-stone-200 bg-stone-900/80 p-3.5 rounded-2xl border border-stone-800 italic">
              "{activeDialogue.text}"
            </p>

            <div className="flex justify-end gap-2">
              <button 
                onClick={onCloseDialogue} 
                className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>{isHi ? 'राम राम 🙏' : 'Namaste 🙏'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Daily Tasks ("गाँव के काम") Modal --- */}
      {showTasks && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="bg-stone-900 text-stone-100 p-6 rounded-3xl max-w-lg w-full shadow-2xl border-2 border-amber-500 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b border-stone-700 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-amber-400 w-6 h-6" />
                <h2 className="text-xl font-bold text-amber-300">
                  {isHi ? 'गाँव के काम (Daily Tasks)' : 'Daily Village Tasks'}
                </h2>
              </div>
              <button 
                onClick={() => setShowTasks(false)} 
                className="text-stone-400 hover:text-white hover:bg-stone-800 p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {gameState.villageTasks.map((task) => (
                <div 
                  key={task.id} 
                  className={`p-4 rounded-2xl border transition-all ${
                    task.claimed 
                      ? 'bg-stone-950/60 border-stone-800 opacity-60' 
                      : task.completed 
                      ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md' 
                      : 'bg-stone-800/80 border-stone-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-sm text-amber-100">
                      {isHi ? task.titleHi : task.title}
                    </h3>
                    <div className="flex items-center gap-1 text-xs font-mono text-yellow-400 bg-black/40 px-2 py-0.5 rounded-md border border-white/5">
                      <Coins size={12} /> ₹{task.rewardMoney} + {task.rewardRespect}★
                    </div>
                  </div>
                  
                  <p className="text-xs text-stone-400 mb-2">
                    {isHi ? task.descriptionHi : task.description}
                  </p>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                        <span>{isHi ? 'प्रगति' : 'Progress'}</span>
                        <span className="font-mono">{Math.min(task.currentCount, task.targetCount)}/{task.targetCount}</span>
                      </div>
                      <div className="w-full bg-stone-950 rounded-full h-2 overflow-hidden border border-stone-800">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (task.currentCount / task.targetCount) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {task.completed && !task.claimed ? (
                      <button 
                        onClick={() => onClaimTaskReward(task.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-xl font-bold transition-all shadow-md active:scale-95 shrink-0"
                      >
                        {isHi ? 'इनाम लें' : 'Claim'}
                      </button>
                    ) : task.claimed ? (
                      <span className="text-[11px] text-stone-500 font-semibold shrink-0">
                        ✓ {isHi ? 'प्राप्त हुआ' : 'Claimed'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-400/80 font-semibold shrink-0">
                        {isHi ? 'प्रगति पर...' : 'In Progress'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- Cooking Modal (Chulha) --- */}
      {showCooking && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="bg-stone-900 text-stone-100 p-6 rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-orange-500 flex flex-col h-[75vh]">
            <div className="flex justify-between items-center mb-4 border-b border-stone-700 pb-3">
              <h2 className="text-2xl font-bold text-orange-400 flex items-center gap-2">
                <Flame className="text-orange-500" /> {isHi ? 'देसी चूल्हा (रसोई - ऊर्जा व शक्ति)' : 'Desi Chulha (Cooking & Energy)'}
              </h2>
              <button 
                onClick={onCloseCooking} 
                className="text-stone-400 hover:text-white hover:bg-stone-700 rounded-lg p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 pr-1">
              {(Object.keys(DISH_DATA) as DishType[]).map((dish) => {
                const data = DISH_DATA[dish];
                const hasIngredients = Object.entries(data.ingredients).every(([item, qty]) => {
                  const type = item as CropType | ResourceType;
                  const invQty = (gameState.inventory.crops[type as CropType] || 0) + (gameState.inventory.resources[type as ResourceType] || 0);
                  return invQty >= (qty || 0);
                });
                const ownedCount = gameState.inventory.dishes[dish] || 0;

                return (
                  <div key={dish} className="bg-stone-950 p-4 rounded-2xl border border-stone-800 flex flex-col justify-between hover:border-amber-600/50 transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-base text-amber-200">
                          {isHi ? data.nameHi : dish}
                        </h3>
                        <span className="text-xs bg-stone-800 px-2 py-0.5 rounded-full text-stone-400 border border-stone-700">
                          {isHi ? 'उपलब्ध:' : 'Have:'} {ownedCount}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 italic mb-2.5">
                        {isHi ? data.descriptionHi : data.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {Object.entries(data.ingredients).map(([item, qty]) => {
                          const type = item as CropType | ResourceType;
                          const currentQty = (gameState.inventory.crops[type as CropType] || 0) + (gameState.inventory.resources[type as ResourceType] || 0);
                          const isMet = currentQty >= (qty || 0);
                          return (
                            <span 
                              key={item} 
                              className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${ 
                                isMet 
                                  ? 'bg-emerald-950/70 border-emerald-700 text-emerald-200' 
                                  : 'bg-red-950/70 border-red-800 text-red-200' 
                              }`}
                            >
                              {item} x{qty} ({currentQty})
                            </span>
                          );
                        })}
                      </div>
                      
                      <div className="text-[11px] text-purple-300 flex items-center justify-between gap-1 mb-2 bg-purple-950/40 p-1.5 rounded-lg border border-purple-800/40">
                        <span className="flex items-center gap-1">
                          <Zap size={12} /> {data.buff} ({data.buffDuration}h)
                        </span>
                        <span className="text-lime-300 font-bold">+60 ⚡</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => onCook(dish)}
                        disabled={!hasIngredients}
                        className="flex-1 bg-orange-700 hover:bg-orange-600 disabled:bg-stone-800 disabled:text-stone-600 text-xs py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow"
                      >
                        <Flame size={14} /> {isHi ? 'पकाएं' : 'Cook'}
                      </button>
                      <button 
                        onClick={() => onEat(dish)}
                        disabled={ownedCount <= 0}
                        className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-800 disabled:text-stone-600 text-xs py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow"
                      >
                        <Utensils size={14} /> {isHi ? 'खाएं (+60⚡)' : 'Eat (+60⚡)'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- Village Mandi (Market) Modal --- */}
      {showMarket && (
        <div className="absolute right-3 md:right-5 top-20 md:top-24 bg-stone-900/95 text-stone-100 p-5 rounded-3xl border-2 border-emerald-600/80 w-84 md:w-96 pointer-events-auto shadow-2xl backdrop-blur-md max-h-[75vh] overflow-y-auto z-40">
          <div className="flex justify-between items-center mb-3 border-b border-stone-700 pb-2.5 sticky top-0 bg-stone-900/95 py-1 z-10">
            <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
              <ShoppingBasket /> {isHi ? 'गाँव की मंडी (Mandi)' : 'Village Mandi'}
            </h2>
            <button onClick={() => setShowMarket(false)} className="text-stone-400 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>

          {/* City Mandi Express Wholesale Feature */}
          <div className="mb-4 bg-gradient-to-r from-orange-950/90 to-amber-950/90 p-3 rounded-2xl border border-orange-500/60 shadow-inner">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                <Truck size={14} /> {isHi ? 'शहर मंडी एक्सप्रेस (+20% भाव)' : 'City Mandi Express (+20% Bonus)'}
              </span>
              <span className="text-[10px] bg-orange-900/80 text-orange-200 px-2 py-0.5 rounded-full">
                {isHi ? 'किराया ₹15' : 'Fare ₹15'}
              </span>
            </div>
            <p className="text-[11px] text-stone-300 mb-2">
              {isHi
                ? 'बस/टेम्पो से सारी फसल और दूध-अंडे एक साथ शहर की बड़ी मंडी में +20% बोनस दाम पर बेचें!'
                : 'Take the Roadways Bus/Tempo to sell all crops & produce in the city for a +20% bonus!'}
            </p>
            <button
              onClick={onCityMandiSellAll}
              disabled={(totalCropsCount + totalResourcesCount === 0) || gameState.inventory.money < 15}
              className="w-full py-1.5 bg-orange-600 hover:bg-orange-500 disabled:bg-stone-800 disabled:text-stone-500 text-white text-xs rounded-xl font-bold transition-all shadow active:scale-95"
            >
              {isHi ? '🚌 शहर मंडी में सब बेचें (+20% बोनस)' : '🚌 Sell All in City Mandi (+20%)'}
            </button>
          </div>

          {/* NEW: Fertilizer & Manure Shop (देसी खाद भंडार - Speeds up crop growth beyond standard limits!) */}
          <div className="mb-5 bg-gradient-to-b from-lime-950/85 to-emerald-950/80 p-3.5 rounded-2xl border-2 border-lime-500/70 shadow-lg">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-extrabold text-lime-300 flex items-center gap-1.5">
                🧪 {isHi ? 'देसी खाद भंडार (Fertilizer Shop)' : 'Fertilizer & Manure Shop'}
              </h3>
              <span className="text-[10px] bg-lime-900/90 text-lime-200 px-2 py-0.5 rounded-full border border-lime-500/40 font-bold">
                {isHi ? `कुल बोरी: ${totalFertilizerCount}` : `Bags: ${totalFertilizerCount}`}
              </span>
            </div>
            <p className="text-[11px] text-lime-100/80 mb-3 leading-snug">
              {isHi
                ? 'खेतों में देसी गोबर व पंचगव्य खाद डालकर फसल पकने की रफ़्तार को सामान्य सीमा से 2.5x से 6x तक तेज़ करें!'
                : 'Buy organic manure to supercharge crop growth rates 2.5x to 6x beyond standard limits!'}
            </p>

            <div className="space-y-2.5 mb-3">
              {(Object.keys(FERTILIZER_DATA) as FertilizerType[]).map((fertType) => {
                const fData = FERTILIZER_DATA[fertType];
                const ownedBags = fertilizersInv[fertType] || 0;
                const isSelectedFert = (gameState.selectedFertilizer || FertilizerType.DESI_GOBAR) === fertType;

                return (
                  <div
                    key={fertType}
                    onClick={() => onSelectFertilizer(fertType)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelectedFert
                        ? 'bg-stone-900/95 border-lime-400 shadow-[0_0_12px_rgba(163,230,53,0.25)]'
                        : 'bg-stone-900/75 border-stone-700 hover:border-lime-600/60'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{fData.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-amber-100 flex items-center gap-1.5">
                            <span>{isHi ? fData.nameHi : fertType}</span>
                          </div>
                          <span className="inline-block text-[10px] font-extrabold text-lime-300 bg-lime-950/90 px-1.5 py-0.2 rounded border border-lime-600/50 mt-0.5">
                            ⚡ {isHi ? fData.badgeTextHi : fData.badgeText}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-stone-800 px-2 py-0.5 rounded-md text-lime-200 border border-stone-600 shrink-0">
                        x{ownedBags}
                      </span>
                    </div>

                    <p className="text-[10px] text-stone-300 leading-tight mb-2">
                      {isHi ? fData.descriptionHi : fData.description}
                    </p>

                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onBuyFertilizer(fertType, 1)}
                        disabled={gameState.inventory.money < fData.cost}
                        className="flex-1 py-1.5 bg-lime-700 hover:bg-lime-600 disabled:bg-stone-800 disabled:text-stone-500 text-white text-[11px] rounded-lg font-bold transition-all shadow active:scale-95"
                      >
                        +1 {isHi ? 'बोरी' : 'Bag'} (₹{fData.cost})
                      </button>
                      <button
                        onClick={() => onBuyFertilizer(fertType, 5)}
                        disabled={gameState.inventory.money < fData.pack5Cost}
                        className="flex-1 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-800 disabled:text-stone-500 text-white text-[11px] rounded-lg font-bold transition-all shadow active:scale-95"
                      >
                        +5 {isHi ? 'पैक' : 'Pack'} (₹{fData.pack5Cost})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => onFertilizeAll()}
              disabled={totalFertilizerCount <= 0 || (growingPlotsCount + plowedPlotsCount === 0)}
              className="w-full py-2 bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-500 hover:to-emerald-500 disabled:from-stone-800 disabled:to-stone-800 disabled:text-stone-500 text-white text-xs rounded-xl font-extrabold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 border border-lime-300/40"
            >
              🧪 {isHi ? `सभी खेतों में खाद डालें (${totalFertilizerCount} उपलब्ध)` : `Apply Manure to All Fields (${totalFertilizerCount} left)`}
            </button>
          </div>
          
          {/* Sell Harvest */}
          <div className="mb-5">
            <h3 className="text-xs font-bold text-stone-400 mb-2 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpCircle size={13} /> {isHi ? 'उपज बेचें (Sell Harvest)' : 'Sell Harvest'}
            </h3>
            <div className="space-y-1.5">
              {(Object.keys(CROP_DATA) as CropType[]).map((crop) => {
                const amount = gameState.inventory.crops[crop] || 0;
                let price = CROP_DATA[crop].sellPrice;
                if (gameState.activeBuff?.type === BuffType.WEALTH) price = Math.floor(price * 1.25);
                if (gameState.currentFestival === 'BAISAKHI') price = Math.floor(price * 1.3);

                return (
                  <div key={crop} className="flex justify-between items-center bg-stone-800/90 p-2 rounded-xl border border-stone-700">
                    <span className="text-xs text-stone-200">
                      {isHi ? CROP_DATA[crop].nameHi : crop} (x{amount})
                    </span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => onSellItem(crop)}
                        disabled={amount <= 0}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-800 disabled:text-stone-600 text-xs rounded-lg transition-all font-bold"
                      >
                        ₹{price}
                      </button>
                      <button 
                        onClick={() => onSellItem(crop, true)}
                        disabled={amount <= 1}
                        className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 disabled:bg-stone-800 disabled:text-stone-600 text-xs rounded-lg transition-all font-bold"
                      >
                        {isHi ? 'सब' : 'All'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {(Object.keys(RESOURCE_PRICES) as ResourceType[]).map((res) => {
                const amount = gameState.inventory.resources[res] || 0;
                let price = RESOURCE_PRICES[res];
                if (gameState.activeBuff?.type === BuffType.WEALTH) price = Math.floor(price * 1.25);

                return (
                  <div key={res} className="flex justify-between items-center bg-stone-800/90 p-2 rounded-xl border border-stone-700">
                    <span className="text-xs text-stone-200">
                      {res === ResourceType.MILK ? (isHi ? 'दूध (Milk)' : 'Milk') : (isHi ? 'अंडे (Eggs)' : 'Eggs')} (x{amount})
                    </span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => onSellItem(res)}
                        disabled={amount <= 0}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-800 disabled:text-stone-600 text-xs rounded-lg transition-all font-bold"
                      >
                        ₹{price}
                      </button>
                      <button 
                        onClick={() => onSellItem(res, true)}
                        disabled={amount <= 1}
                        className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 disabled:bg-stone-800 disabled:text-stone-600 text-xs rounded-lg transition-all font-bold"
                      >
                        {isHi ? 'सब' : 'All'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buy Seeds */}
          <div className="mb-5">
            <h3 className="text-xs font-bold text-stone-400 mb-2 uppercase tracking-wider">
              {isHi ? 'बीज खरीदें (Buy Seeds)' : 'Buy Seeds'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CROP_DATA) as CropType[]).map((crop) => (
                <button 
                  key={`seed-${crop}`}
                  onClick={() => onBuySeed(crop)}
                  disabled={gameState.inventory.money < CROP_DATA[crop].seedPrice}
                  className="flex flex-col items-center justify-center bg-stone-800 p-2.5 rounded-xl border border-stone-700 hover:border-amber-500 disabled:opacity-40 transition-all"
                >
                  <span className="text-xs font-bold text-stone-200">
                    {isHi ? CROP_DATA[crop].nameHi.split(' ')[0] : crop}
                  </span>
                  <span className="text-[11px] text-amber-400 font-mono">₹{CROP_DATA[crop].seedPrice}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Livestock */}
          <div className="mb-5">
            <h3 className="text-xs font-bold text-stone-400 mb-2 uppercase tracking-wider">
              {isHi ? 'पशुधन (Livestock)' : 'Livestock'}
            </h3>
            <div className="space-y-2">
              {(Object.keys(ANIMAL_DATA) as AnimalType[]).map((animal) => {
                const owned = gameState.animals.filter(a => a.type === animal).length;
                return (
                  <div key={`animal-${animal}`} className="bg-stone-800 p-2.5 rounded-xl border border-stone-700">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-amber-100">
                        {isHi ? ANIMAL_DATA[animal].nameHi : animal}
                      </span>
                      <span className="text-[10px] bg-stone-900 px-2 py-0.5 rounded-md text-stone-400">
                        {isHi ? 'संख्या:' : 'Own:'} {owned}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => onBuyAnimal(animal)}
                        disabled={gameState.inventory.money < ANIMAL_DATA[animal].cost}
                        className="flex-1 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-stone-800 disabled:text-stone-600 text-xs rounded-lg font-bold transition-all shadow"
                      >
                        {isHi ? 'खरीदें' : 'Buy'} ₹{ANIMAL_DATA[animal].cost}
                      </button>
                      <button 
                        onClick={() => onSellAnimal(animal)}
                        disabled={owned === 0}
                        className="flex-1 py-1.5 bg-red-900/80 hover:bg-red-800 disabled:bg-stone-800 disabled:text-stone-600 text-xs rounded-lg font-bold transition-all"
                      >
                        {isHi ? 'बेचें' : 'Sell'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Farm Upgrades */}
          <div className="mb-5">
            <h3 className="text-xs font-bold text-stone-400 mb-2 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck size={13} /> {isHi ? 'खेत अपग्रेड' : 'Farm Upgrades'}
            </h3>
            <div className="space-y-2">
              {(Object.keys(UPGRADE_DATA) as UpgradeType[]).map((upgrade) => {
                const owned = gameState.upgrades.includes(upgrade);
                return (
                  <div key={`upgrade-${upgrade}`} className={`p-2.5 rounded-xl border ${owned ? 'bg-emerald-950/30 border-emerald-700' : 'bg-stone-800 border-stone-700'}`}>
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="text-xs font-bold text-cyan-200">
                        {isHi ? UPGRADE_DATA[upgrade].nameHi : upgrade}
                      </span>
                      {owned && <Check size={14} className="text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-stone-400 leading-tight mb-2">
                      {isHi ? UPGRADE_DATA[upgrade].descriptionHi : UPGRADE_DATA[upgrade].description}
                    </p>
                    {!owned && (
                      <button 
                        onClick={() => onBuyUpgrade(upgrade)}
                        disabled={gameState.inventory.money < UPGRADE_DATA[upgrade].cost}
                        className="w-full py-1.5 bg-cyan-800 hover:bg-cyan-700 disabled:bg-stone-800 disabled:text-stone-600 text-xs rounded-lg font-bold transition-all shadow"
                      >
                        {isHi ? 'खरीदें' : 'Buy'} ₹{UPGRADE_DATA[upgrade].cost}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Structures */}
          <div>
            <h3 className="text-xs font-bold text-stone-400 mb-2 uppercase tracking-wider">
              {isHi ? 'गाँव के भवन' : 'Village Structures'}
            </h3>
            <div className="space-y-2">
              {(Object.keys(STRUCTURE_DATA) as StructureType[]).map((struct) => (
                <div key={`struct-${struct}`} className="bg-stone-800 p-2.5 rounded-xl border border-stone-700">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-amber-200">
                      {isHi ? STRUCTURE_DATA[struct].nameHi : struct}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400 leading-tight mb-2">
                    {isHi ? STRUCTURE_DATA[struct].descriptionHi : STRUCTURE_DATA[struct].description}
                  </p>
                  <button 
                    onClick={() => {
                      setShowMarket(false);
                      onBuyStructure(struct);
                    }}
                    disabled={gameState.inventory.money < STRUCTURE_DATA[struct].cost}
                    className="w-full py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:bg-stone-800 disabled:text-stone-600 text-xs rounded-lg font-bold flex items-center justify-center gap-1 transition-all shadow"
                  >
                    <Hammer size={12} /> {isHi ? 'निर्माण करें' : 'Build'} ₹{STRUCTURE_DATA[struct].cost}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- Bottom Area: On-Screen D-Pad, 1-Click Kisan Helper Bar, Quick Village Go-To & Tools --- */}
      <div className="p-3 md:p-5 flex flex-col items-center pointer-events-auto pb-4 gap-2 relative">
        
        {/* Left Floating On-Screen Touch/Mouse D-Pad for Smooth Walking */}
        <div className="hidden sm:flex flex-col items-center gap-1 bg-stone-900/85 p-2 rounded-2xl border border-stone-700/80 shadow-xl backdrop-blur-md absolute left-4 bottom-5 z-20">
          <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider">
            {isHi ? '🕹️ किसान चलाएं' : '🕹️ Walk'}
          </span>
          <button
            onClick={() => onMoveDpad(0, -1)}
            className="w-8 h-8 bg-stone-800 hover:bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold shadow active:scale-90 transition-all"
            title="Walk North (W)"
          >
            ⬆️
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => onMoveDpad(-1, 0)}
              className="w-8 h-8 bg-stone-800 hover:bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold shadow active:scale-90 transition-all"
              title="Walk West (A)"
            >
              ⬅️
            </button>
            <button
              onClick={() => onQuickGoTo(0, 2.2, 'खेत (Farm)', 'Farm')}
              className="w-8 h-8 bg-amber-700/80 hover:bg-amber-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow active:scale-90 transition-all"
              title={isHi ? 'खेत के पास आएं' : 'Center at Farm'}
            >
              🌾
            </button>
            <button
              onClick={() => onMoveDpad(1, 0)}
              className="w-8 h-8 bg-stone-800 hover:bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold shadow active:scale-90 transition-all"
              title="Walk East (D)"
            >
              ➡️
            </button>
          </div>
          <button
            onClick={() => onMoveDpad(0, 1)}
            className="w-8 h-8 bg-stone-800 hover:bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold shadow active:scale-90 transition-all"
            title="Walk South (S)"
          >
            ⬇️
          </button>
        </div>

        {/* 1-Click Kisan Helper Actions + Quick Village Navigation Bar */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 bg-stone-900/90 px-3 py-1.5 rounded-2xl backdrop-blur-md border border-amber-500/40 shadow-xl">
          <span className="text-[10px] font-bold text-amber-400 mr-1 flex items-center gap-1">
            ⚡ {isHi ? 'तेज़ काम:' : '1-Click:'}
          </span>

          <button
            onClick={onPlowAll}
            className="bg-amber-800 hover:bg-amber-700 text-amber-100 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-amber-600/60 transition-all active:scale-95 flex items-center gap-1"
          >
            🚜 {isHi ? 'सब जोतें' : 'Plow All'}
          </button>

          <button
            onClick={onPlantAll}
            className="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-600/60 transition-all active:scale-95 flex items-center gap-1"
          >
            🌱 {isHi ? 'सब बोएं' : 'Plant All'}
          </button>

          <button
            onClick={onWaterAll}
            className="bg-cyan-800 hover:bg-cyan-700 text-cyan-100 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-cyan-600/60 transition-all active:scale-95 flex items-center gap-1"
          >
            💧 {isHi ? 'सब सींचें' : 'Water All'}
          </button>

          <button
            onClick={() => onFertilizeAll()}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95 flex items-center gap-1 ${
              unfertilizedGrowingCount > 0 && totalFertilizerCount > 0
                ? 'bg-lime-700 hover:bg-lime-600 text-lime-100 border-lime-400 shadow-md'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-600'
            }`}
            title={isHi ? 'सभी खेतों में देसी खाद डालें (2.5x - 6x रफ़्तार)' : 'Apply Manure to all plots (2.5x - 6x speed)'}
          >
            🧪 {isHi ? `सब में खाद (${totalFertilizerCount})` : `Fertilize All (${totalFertilizerCount})`}
          </button>

          <button
            onClick={onHarvestAll}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95 flex items-center gap-1 ${
              ripePlotsCount > 0
                ? 'bg-yellow-500 hover:bg-yellow-400 text-stone-950 border-white animate-pulse shadow-md'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-600'
            }`}
          >
            🌾 {isHi ? `सब काटें${ripePlotsCount > 0 ? ` (${ripePlotsCount})` : ''}` : `Harvest All${ripePlotsCount > 0 ? ` (${ripePlotsCount})` : ''}`}
          </button>

          <button
            onClick={onCareAllAnimals}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95 flex items-center gap-1 ${
              readyAnimalsCount > 0
                ? 'bg-pink-600 hover:bg-pink-500 text-white border-pink-300 animate-pulse'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-600'
            }`}
          >
            🐄 {isHi ? 'पशु सेवा / दूध' : 'Animal Care'}
          </button>

          <span className="hidden md:inline-block w-px h-4 bg-white/20 mx-1"></span>

          {/* Quick Go-To Landmarks */}
          <div className="hidden md:flex items-center gap-1">
            <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
              <Compass size={11} /> {isHi ? 'चलें:' : 'Go:'}
            </span>
            <button
              onClick={() => onQuickGoTo(4.2, -5.2, 'कुआँ (Well)', 'Village Well')}
              className="bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] px-2 py-0.5 rounded border border-stone-600"
            >
              💧 {isHi ? 'कुआँ' : 'Well'}
            </button>
            <button
              onClick={() => onQuickGoTo(-7.5, 8.5, 'तालाब (Pond)', 'Village Pond')}
              className="bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] px-2 py-0.5 rounded border border-stone-600"
            >
              🌊 {isHi ? 'तालाब' : 'Pond'}
            </button>
            <button
              onClick={() => onQuickGoTo(0, -10.5, 'मंदिर (Temple)', 'Temple')}
              className="bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] px-2 py-0.5 rounded border border-stone-600"
            >
              🕉️ {isHi ? 'मंदिर' : 'Temple'}
            </button>
            <button
              onClick={() => onQuickGoTo(11.8, 2.8, 'चाय टपरी (Chai)', 'Chai Stall')}
              className="bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] px-2 py-0.5 rounded border border-stone-600"
            >
              ☕ {isHi ? 'चाय' : 'Chai'}
            </button>
          </div>
        </div>

        {/* Tools Toolbar with Smart Auto-Tool Badge */}
        <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 bg-black/85 p-2 rounded-2xl md:rounded-3xl backdrop-blur-md border border-white/15 shadow-2xl">
          {TOOLS.map((tool, index) => {
            const isSelected = gameState.selectedTool === tool.id;
            let seedCount: number | null = null;
            if (tool.id === Tool.SEEDS_WHEAT) seedCount = gameState.inventory.seeds[CropType.WHEAT] || 0;
            if (tool.id === Tool.SEEDS_RICE) seedCount = gameState.inventory.seeds[CropType.RICE] || 0;
            if (tool.id === Tool.SEEDS_SUGARCANE) seedCount = gameState.inventory.seeds[CropType.SUGARCANE] || 0;
            if (tool.id === Tool.SEEDS_MUSTARD) seedCount = gameState.inventory.seeds[CropType.MUSTARD] || 0;

            const isWaterBucket = tool.id === Tool.WATER_BUCKET;
            const isManureTool = tool.id === Tool.MANURE;

            return (
              <button
                key={tool.id}
                onClick={() => onSelectTool(tool.id)}
                className={`
                  relative group flex flex-col items-center justify-center w-12 h-12 md:w-15 md:h-15 rounded-xl md:rounded-2xl transition-all duration-200
                  ${isSelected 
                    ? 'bg-gradient-to-t from-amber-600 to-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.6)] -translate-y-1.5 scale-105 border-2 border-amber-300' 
                    : 'bg-stone-800/90 text-stone-300 hover:bg-stone-700 hover:text-white hover:-translate-y-0.5 border border-stone-700/60'
                  }
                `}
              >
                <span className="absolute top-1 left-1.5 text-[9px] font-mono text-stone-400 group-hover:text-amber-300 font-bold">
                  {index + 1}
                </span>

                {seedCount !== null && (
                  <span className={`absolute top-1 right-1 text-[9px] font-mono px-1 rounded font-bold ${
                    seedCount > 0 ? 'bg-emerald-900/90 text-emerald-300' : 'bg-red-900/90 text-red-300'
                  }`}>
                    x{seedCount}
                  </span>
                )}

                {isManureTool && (
                  <span className={`absolute top-1 right-1 text-[9px] font-mono px-1 rounded font-bold ${
                    totalFertilizerCount > 0 ? 'bg-lime-900/90 text-lime-300' : 'bg-red-900/90 text-red-300'
                  }`}>
                    x{totalFertilizerCount}
                  </span>
                )}

                {isWaterBucket && (
                  <span className={`absolute top-1 right-1 text-[9px] font-mono px-1 rounded font-bold ${
                    hasIrrigation || bucketWater > 0 ? 'bg-cyan-900/90 text-cyan-200' : 'bg-red-900/90 text-red-300 animate-pulse'
                  }`}>
                    {hasIrrigation ? '∞' : `${bucketWater}/${maxBucketWater}`}
                  </span>
                )}

                <span className="text-xl md:text-2xl mt-1 drop-shadow-md">{tool.icon}</span>
                <span className="text-[9px] md:text-[10px] font-semibold leading-tight mt-0.5 truncate max-w-[50px]">
                  {isHi ? tool.labelHi.split(' ')[0] : tool.label.split(' ')[0]}
                </span>
                
                <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-amber-200 text-xs px-2.5 py-1 rounded-lg whitespace-nowrap pointer-events-none border border-amber-500/40 shadow-xl z-50">
                  {isHi ? tool.labelHi : tool.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;
