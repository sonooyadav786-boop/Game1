import React, { useState, useEffect, useCallback } from 'react';
import GameScene from './components/World/GameScene';
import UIOverlay from './components/UIOverlay';
import { 
  GameState, Season, Tool, LandState, Plot, CropType, AnimalType, Animal,
  ResourceType, StructureType, DishType, BuffType, UpgradeType, FertilizerType,
  FestivalType, VillageTask 
} from './types';
import { 
  INITIAL_MONEY, GRID_SIZE, PLOT_SIZE, CROP_DATA, ANIMAL_DATA, 
  RESOURCE_PRICES, NPC_DATA, STRUCTURE_DATA, DISH_DATA, UPGRADE_DATA, FERTILIZER_DATA,
  generateDailyTasks, TOOLS 
} from './constants';
import { getVillageElderAdvice } from './services/geminiService';
import { villageAudio } from './services/audioService';
import {
  findPathAroundStructures,
  findNearestWalkablePoint,
  getAllObstacles,
  resolveObstacleCollision
} from './services/pathfindingService';
import * as THREE from 'three';

const SAVE_KEY = 'gaon_game_save_v2';

const generatePlots = (): Plot[] => {
  const plots: Plot[] = [];
  const offset = (GRID_SIZE * PLOT_SIZE) / 2 - PLOT_SIZE / 2;
  
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      plots.push({
        id: x * GRID_SIZE + z,
        x: x * PLOT_SIZE - offset,
        z: z * PLOT_SIZE - offset,
        state: LandState.EMPTY,
        cropType: null,
        growthProgress: 0,
        waterLevel: 0,
        fertilizer: null,
        fertilizerMultiplier: 1
      });
    }
  }
  return plots;
};

const getFestivalForDay = (day: number): FestivalType => {
  if (day % 20 === 5) return 'BAISAKHI';
  if (day % 20 === 10) return 'DIWALI';
  if (day % 20 === 15) return 'MAKAR_SANKRANTI';
  if (day % 20 === 0) return 'HOLI';
  return null;
};

const getInitialGameState = (): GameState => {
  const defaultState: GameState = {
    day: 1,
    timeOfDay: 6, // 6 AM dawn start
    timeSpeed: 1, // Calm 1x speed by default (as requested by user)
    season: Season.SUMMER,
    plots: generatePlots(),
    animals: [
      {
        id: 'initial-cow',
        name: 'Gauri (गौरी)',
        type: AnimalType.COW,
        x: -4.5,
        z: 4.5,
        rotation: 0.4,
        produceTimer: 0,
        isReady: false,
        age: 100,
        hunger: 90,
        state: 'grazing'
      },
      {
        id: 'initial-chicken',
        name: 'Sundari (सुंदरी)',
        type: AnimalType.CHICKEN,
        x: -2.2,
        z: -4.2,
        rotation: -0.6,
        produceTimer: 0,
        isReady: false,
        age: 100,
        hunger: 95,
        state: 'pecking'
      },
      {
        id: 'initial-goat',
        name: 'Champa (चंपा)',
        type: AnimalType.GOAT,
        x: 4.2,
        z: 4.8,
        rotation: -1.1,
        produceTimer: 0,
        isReady: false,
        age: 100,
        hunger: 90,
        state: 'grazing'
      }
    ],
    structures: [],
    inventory: {
      money: INITIAL_MONEY,
      crops: {
        [CropType.WHEAT]: 0,
        [CropType.RICE]: 0,
        [CropType.SUGARCANE]: 0,
        [CropType.MUSTARD]: 0
      },
      seeds: {
        [CropType.WHEAT]: 3,
        [CropType.RICE]: 2,
        [CropType.SUGARCANE]: 1,
        [CropType.MUSTARD]: 2
      },
      resources: {
        [ResourceType.MILK]: 1,
        [ResourceType.EGG]: 0
      },
      dishes: {
        [DishType.ROTI]: 0,
        [DishType.KHEER]: 0,
        [DishType.SAAG]: 0,
        [DishType.OMELETTE]: 0,
        [DishType.GANNA_JUICE]: 0,
        [DishType.CHAI]: 0
      },
      fertilizers: {
        [FertilizerType.DESI_GOBAR]: 3,
        [FertilizerType.VERMI_COMPOST]: 1,
        [FertilizerType.AMRIT_KHAAD]: 0
      }
    },
    selectedTool: Tool.HAND,
    selectedFertilizer: FertilizerType.DESI_GOBAR,
    weather: 'Sunny',
    playerPos: { x: -3, z: -3 },
    playerRotation: 0,
    placingStructure: null,
    activeBuff: null,
    upgrades: [],
    villageTasks: generateDailyTasks(1),
    respect: 15,
    currentFestival: null,
    language: 'hi',
    isMuted: false,
    templeBlessedToday: false,
    stamina: 100,
    maxStamina: 100,
    bucketWater: 5,
    maxBucketWater: 5,
    xp: 0,
    level: 1,
    isManualNight: false,
    smartAutoTool: true
  };

  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = {
        ...defaultState,
        ...parsed,
        inventory: {
          ...defaultState.inventory,
          ...(parsed.inventory || {}),
          fertilizers: {
            ...defaultState.inventory.fertilizers,
            ...(parsed.inventory?.fertilizers || {})
          }
        },
        selectedFertilizer: parsed.selectedFertilizer || FertilizerType.DESI_GOBAR,
        timeOfDay: parsed.isManualNight ? 21 : Math.max(8, Math.min(16, parsed.timeOfDay || 9)),
        stamina: parsed.stamina ?? 100,
        maxStamina: parsed.maxStamina ?? 100,
        bucketWater: parsed.bucketWater ?? 5,
        maxBucketWater: parsed.maxBucketWater ?? 5,
        xp: parsed.xp ?? 0,
        level: parsed.level ?? 1,
        isManualNight: false,
        smartAutoTool: parsed.smartAutoTool ?? true
      };
      if (Array.isArray(merged.animals) && merged.animals.length === 1 && merged.animals[0].id === 'initial-cow') {
        merged.animals = defaultState.animals;
      }
      return merged;
    }
  } catch (e) {
    console.warn("Could not load save, starting fresh village:", e);
  }

  return defaultState;
};

const applyXpGain = (
  state: GameState,
  gainedXp: number,
  onLevelUpMessage?: (newLevel: number) => void
): { xp: number; level: number; moneyBonus: number; respectBonus: number } => {
  let xp = (state.xp ?? 0) + gainedXp;
  let level = state.level ?? 1;
  let moneyBonus = 0;
  let respectBonus = 0;

  while (xp >= level * 100) {
    xp -= level * 100;
    level += 1;
    moneyBonus += level * 150;
    respectBonus += 10;
    if (onLevelUpMessage) onLevelUpMessage(level);
  }

  return { xp, level, moneyBonus, respectBonus };
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(getInitialGameState);
  const [elderAdvice, setElderAdvice] = useState<string>(
    "राम राम बेटा! गाँव में तुम्हारा स्वागत है। खेत जोतो, बीज बोओ, तालाब की सैर करो और गौ माता की सेवा करो।"
  );
  const [activeDialogue, setActiveDialogue] = useState<{ npcName: string; text: string } | null>(null);
  const [showCooking, setShowCooking] = useState<boolean>(false);
  const [showRules, setShowRules] = useState<boolean>(false);

  // Debounced auto-save to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
      } catch (err) {
        console.error("Save error:", err);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [gameState]);

  // Helper to update daily task progress
  const updateTaskProgress = useCallback((type: VillageTask['type'], amount: number = 1) => {
    setGameState(prev => {
      let updatedAny = false;
      const updatedTasks = prev.villageTasks.map(t => {
        if (t.type === type && !t.completed) {
          const newCount = t.currentCount + amount;
          const isDone = newCount >= t.targetCount;
          if (isDone) updatedAny = true;
          return {
            ...t,
            currentCount: newCount,
            completed: isDone
          };
        }
        return t;
      });

      if (updatedAny) {
        villageAudio.playFluteNote(660);
      }

      return { ...prev, villageTasks: updatedTasks };
    });
  }, []);

  // --- Keyboard Movement (WASD / Arrows) & Hotkeys (1-8) ---
  useEffect(() => {
    const keysPressed = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      keysPressed.add(e.key.toLowerCase());

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= TOOLS.length) {
        setGameState(prev => ({ ...prev, selectedTool: TOOLS[num - 1].id }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const moveInterval = setInterval(() => {
      if (keysPressed.size === 0) return;

      let dx = 0;
      let dz = 0;

      if (keysPressed.has('w') || keysPressed.has('arrowup')) dz -= 1;
      if (keysPressed.has('s') || keysPressed.has('arrowdown')) dz += 1;
      if (keysPressed.has('a') || keysPressed.has('arrowleft')) dx -= 1;
      if (keysPressed.has('d') || keysPressed.has('arrowright')) dx += 1;

      if (dx !== 0 || dz !== 0) {
        setGameState(prev => {
          const speed = prev.activeBuff?.type === BuffType.SPEED ? 0.35 : 0.22;
          const len = Math.hypot(dx, dz);
          const normX = (dx / len) * speed;
          const normZ = (dz / len) * speed;

          const desiredX = Math.max(-22, Math.min(22, prev.playerPos.x + normX));
          const desiredZ = Math.max(-22, Math.min(22, prev.playerPos.z + normZ));
          const safePos = resolveObstacleCollision(
            prev.playerPos,
            { x: desiredX, z: desiredZ },
            prev.structures,
            prev.upgrades,
            0.4
          );
          const angle = Math.atan2(normX, normZ);

          return {
            ...prev,
            playerPos: safePos,
            playerRotation: angle
          };
        });
      }
    }, 30);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(moveInterval);
    };
  }, []);

  // --- Main Game Loop: Relaxed Slower Timing ---
  useEffect(() => {
    const TICK_RATE = 1000;

    const loop = setInterval(() => {
      setGameState(prev => {
        // Keep bright daytime (8:00 AM to 4:00 PM) unless user manually toggles Night Mode
        const TIME_INCREMENT = prev.timeSpeed === 1 ? 0.04 : 0.1;
        let newTime = prev.timeOfDay + TIME_INCREMENT;
        let newDay = prev.day;
        let newSeason = prev.season;
        let newWeather = prev.weather;
        let newBuff = prev.activeBuff;
        let newTasks = prev.villageTasks;
        let newBlessed = prev.templeBlessedToday;

        const hasIrrigation = prev.upgrades.includes(UpgradeType.IRRIGATION_PUMP);
        const hasScarecrow = prev.upgrades.includes(UpgradeType.SCARECROW);

        if (prev.isManualNight) {
          newTime = 21; // Stay in starry night until user switches back to Day or Sleeps
        } else if (newTime >= 16.5 || newTime < 7) {
          // Wrap daytime cycle smoothly at 4:30 PM back to 8:00 AM so it NEVER turns dark automatically
          if (newTime >= 16.5) {
            newDay += 1;
            newBlessed = false;
            newTasks = generateDailyTasks(newDay);
            if (newDay % 5 === 0) {
              if (prev.season === Season.SUMMER) newSeason = Season.MONSOON;
              else if (prev.season === Season.MONSOON) newSeason = Season.WINTER;
              else newSeason = Season.SUMMER;
            }
          }
          newTime = 8;
        }

        // Active Buff Expiry
        if (newBuff) {
          const currentTimeAbs = newDay * 24 + newTime;
          if (currentTimeAbs >= newBuff.expiresAt) {
            newBuff = null;
          }
        }

        // Weather Dynamics
        if (Math.floor(newTime) !== Math.floor(prev.timeOfDay)) {
          const isMonsoon = newSeason === Season.MONSOON;
          const rainChance = isMonsoon ? 0.45 : 0.08;
          if (prev.weather === 'Rainy') {
            if (Math.random() > 0.45) newWeather = 'Sunny';
          } else {
            if (Math.random() < rainChance) newWeather = 'Rainy';
          }
        }

        // Crop Growth & Water Level
        const newPlots = prev.plots.map(plot => {
          let waterChange = -1;
          if (hasIrrigation) {
            waterChange = 12;
          } else {
            if (newWeather === 'Rainy') {
              waterChange = 6;
            } else if (newWeather === 'Sunny') {
              waterChange = -2;
            }
          }

          if (plot.state === LandState.GROWING) {
            waterChange -= 1;
          }
          // Organic manure helps soil retain moisture longer
          if (plot.fertilizer && waterChange < 0) {
            waterChange = waterChange * 0.45;
          }

          const newWater = Math.min(100, Math.max(0, plot.waterLevel + waterChange));

          // Bird attacks if no scarecrow (fertilized plots are also more resilient)
          if (
            !hasScarecrow && 
            !plot.fertilizer &&
            newBuff?.type !== BuffType.SHANTI && 
            (plot.state === LandState.GROWING || plot.state === LandState.SEEDED)
          ) {
            if (Math.random() < 0.0003) {
              return { ...plot, state: LandState.EMPTY, cropType: null, growthProgress: 0, waterLevel: newWater, fertilizer: null, fertilizerMultiplier: 1 };
            }
          }

          if (plot.state === LandState.GROWING && plot.cropType) {
            const cropInfo = CROP_DATA[plot.cropType];
            let growthRate = 1;
            if (newWater > 0) growthRate *= 1.5;
            if (prev.season === cropInfo.preferredSeason) growthRate *= 2;
            if (newWeather === 'Rainy') growthRate *= 1.2;
            if (newBuff?.type === BuffType.GROWTH) growthRate *= 2.2;
            // Manure / Fertilizer speed multiplier breaks standard crop growth limits (2.5x, 4x, or 6x!)
            if (plot.fertilizer && plot.fertilizerMultiplier && plot.fertilizerMultiplier > 1) {
              growthRate *= plot.fertilizerMultiplier;
            }

            const newProgress = plot.growthProgress + (growthRate * (100 / cropInfo.growthTime));

            if (newProgress >= 100) {
              return { ...plot, growthProgress: 100, state: LandState.RIPE, waterLevel: newWater };
            }
            return { ...plot, growthProgress: newProgress, waterLevel: newWater };
          }

          return { ...plot, waterLevel: newWater };
        });

        // Animal Update
        const hasCowshed = prev.structures.some(s => s.type === StructureType.COWSHED);
        const hasCoop = prev.structures.some(s => s.type === StructureType.CHICKEN_COOP);
        const isNightNow = Boolean(prev.isManualNight);

        const newAnimals = prev.animals.map(animal => {
          const animalData = ANIMAL_DATA[animal.type];
          let newHunger = Math.max(0, animal.hunger - (isNightNow ? 0.1 : 0.35));
          const isStarving = newHunger < 30;

          let newAge = animal.age;
          if (newAge < 100 && !isStarving) {
            newAge += 0.5;
          }

          let newProduceTimer = animal.produceTimer;
          let newIsReady = animal.isReady;

          if (newAge >= 100 && !animal.isReady && !isStarving) {
            let speed = 1;
            if (animal.type === AnimalType.COW && hasCowshed) speed = 1.5;
            if (animal.type === AnimalType.CHICKEN && hasCoop) speed = 1.5;
            if (newBuff?.type === BuffType.SHANTI) speed *= 1.3;

            newProduceTimer += speed;
            if (newProduceTimer >= animalData.produceTime) {
              newIsReady = true;
              newProduceTimer = 0;
            }
          }

          let newX = animal.x;
          let newZ = animal.z;
          let newRot = animal.rotation;
          let newState: Animal['state'] = animal.state || 'idle';
          let newPath: { x: number; z: number }[] | undefined = animal.path;

          const obstacles = getAllObstacles(prev.structures, prev.upgrades);
          const clearance = animal.type === AnimalType.CHICKEN ? 0.35 : 0.5;

          if (isNightNow) {
            // At night (7 PM to 5 AM), all animals enter a peaceful sleeping state
            newState = 'sleeping';
            newPath = undefined;
          } else {
            // Daytime behavior: alternate between walking around structures, grazing/pecking, and alert idle
            const roll = Math.random();
            if (roll > (isStarving ? 0.85 : 0.72)) {
              const moveDist = animal.type === AnimalType.CHICKEN ? 2.2 : 3.2;
              const angle = Math.random() * Math.PI * 2;
              const rawDest = {
                x: Math.max(-13, Math.min(13, animal.x + Math.cos(angle) * moveDist)),
                z: Math.max(-13, Math.min(13, animal.z + Math.sin(angle) * moveDist))
              };
              const safeDest = findNearestWalkablePoint(rawDest, obstacles, clearance);
              const computedPath = findPathAroundStructures(
                { x: animal.x, z: animal.z },
                safeDest,
                prev.structures,
                prev.upgrades,
                clearance
              );
              const firstStep = computedPath[0] || safeDest;
              newX = safeDest.x;
              newZ = safeDest.z;
              newRot = Math.atan2(firstStep.x - animal.x, firstStep.z - animal.z);
              newState = 'walking';
              newPath = computedPath;
            } else if (roll > 0.22) {
              newState = animal.type === AnimalType.CHICKEN ? 'pecking' : 'grazing';
            } else {
              newState = 'idle';
            }
          }

          return {
            ...animal,
            x: newX,
            z: newZ,
            rotation: newRot,
            produceTimer: newProduceTimer,
            isReady: newIsReady,
            hunger: newHunger,
            age: newAge,
            loved: animal.loved,
            state: newState,
            path: newPath
          };
        });

        return {
          ...prev,
          day: newDay,
          timeOfDay: newTime,
          season: newSeason,
          weather: newWeather,
          plots: newPlots,
          animals: newAnimals,
          activeBuff: newBuff,
          villageTasks: newTasks,
          currentFestival: getFestivalForDay(newDay),
          templeBlessedToday: newBlessed
        };
      });
    }, TICK_RATE);

    return () => clearInterval(loop);
  }, []);

  // --- Plot Click Interactions (With Smart Auto-Tool, Stamina, Water Bucket & XP Rules) ---
  const handlePlotClick = (plotId: number) => {
    if (gameState.placingStructure) return;

    setGameState(prev => {
      const currentStamina = prev.stamina ?? 100;
      if (currentStamina < 3) {
        setElderAdvice(
          prev.language === 'hi'
            ? "बेटा, तुम थक गए हो (ऊर्जा कम है)! ऊपर '🛏️ सोएं (Rest)' बटन दबाएं या राजू की चाय पिएं।"
            : "You are tired (Low Stamina)! Click the '🛏️ Sleep' button at the top or drink Raju's Chai."
        );
        return prev;
      }

      const newPlots = [...prev.plots];
      const plotIndex = newPlots.findIndex(p => p.id === plotId);
      const plot = newPlots[plotIndex];
      const newInventory = { 
        ...prev.inventory, 
        crops: { ...prev.inventory.crops }, 
        seeds: { ...prev.inventory.seeds },
        fertilizers: { ...(prev.inventory.fertilizers || {
          [FertilizerType.DESI_GOBAR]: 0,
          [FertilizerType.VERMI_COMPOST]: 0,
          [FertilizerType.AMRIT_KHAAD]: 0
        }) }
      };

      if (!plot) return prev;
      const obstacles = getAllObstacles(prev.structures, prev.upgrades);
      const newPlayerPos = findNearestWalkablePoint({ x: plot.x, z: plot.z + 0.75 }, obstacles, 0.4);
      let plowedCount = 0;
      let wateredCount = 0;
      let harvestedCount = 0;
      let staminaUsed = 0;
      let gainedXp = 0;
      let nextBucketWater = prev.bucketWater ?? 5;
      let nextSelectedTool = prev.selectedTool;

      const hasTractor = prev.upgrades.includes(UpgradeType.TRACTOR);
      const hasIrrigation = prev.upgrades.includes(UpgradeType.IRRIGATION_PUMP);
      const useSmart = (prev.smartAutoTool !== false || prev.selectedTool === Tool.HAND) && prev.selectedTool !== Tool.MANURE;

      const totalManureBags =
        (newInventory.fertilizers[FertilizerType.DESI_GOBAR] || 0) +
        (newInventory.fertilizers[FertilizerType.VERMI_COMPOST] || 0) +
        (newInventory.fertilizers[FertilizerType.AMRIT_KHAAD] || 0);

      // Determine effective tool to use on this plot
      let effectiveTool = prev.selectedTool;
      if (useSmart) {
        if (plot.state === LandState.EMPTY) {
          effectiveTool = Tool.HOE;
        } else if (plot.state === LandState.RIPE) {
          effectiveTool = Tool.SICKLE;
        } else if (plot.state === LandState.PLOWED) {
          const isSeedTool = [Tool.SEEDS_WHEAT, Tool.SEEDS_RICE, Tool.SEEDS_SUGARCANE, Tool.SEEDS_MUSTARD].includes(prev.selectedTool);
          if (!isSeedTool) {
            const preferredOrder: { crop: CropType; tool: Tool }[] = [
              { crop: CropType.WHEAT, tool: Tool.SEEDS_WHEAT },
              { crop: CropType.RICE, tool: Tool.SEEDS_RICE },
              { crop: CropType.MUSTARD, tool: Tool.SEEDS_MUSTARD },
              { crop: CropType.SUGARCANE, tool: Tool.SEEDS_SUGARCANE }
            ];
            const available = preferredOrder.find(item => (newInventory.seeds[item.crop] || 0) > 0);
            effectiveTool = available ? available.tool : Tool.SEEDS_WHEAT;
          }
        } else if (plot.state === LandState.SEEDED || plot.state === LandState.GROWING) {
          // If plot already has sufficient water (> 65%) and isn't fertilized yet, and player has manure, apply manure automatically!
          if (plot.waterLevel >= 65 && !plot.fertilizer && totalManureBags > 0) {
            effectiveTool = Tool.MANURE;
          } else {
            effectiveTool = Tool.WATER_BUCKET;
          }
        }
      }

      switch (effectiveTool) {
        case Tool.HOE: {
          if (plot.state === LandState.EMPTY || plot.state === LandState.RIPE) {
            villageAudio.playDig();
            nextSelectedTool = Tool.HOE;
            newPlots[plotIndex] = { ...plot, state: LandState.PLOWED, cropType: null, growthProgress: 0 };
            plowedCount += 1;
            staminaUsed = 4;
            gainedXp += 10;

            if (hasTractor) {
              const adjacent = [plotId - 1, plotId + 1, plotId - GRID_SIZE, plotId + GRID_SIZE];
              adjacent.forEach(adjId => {
                const adjIdx = newPlots.findIndex(p => p.id === adjId);
                if (adjIdx !== -1 && (newPlots[adjIdx].state === LandState.EMPTY || newPlots[adjIdx].state === LandState.RIPE)) {
                  newPlots[adjIdx] = { ...newPlots[adjIdx], state: LandState.PLOWED, cropType: null, growthProgress: 0 };
                  plowedCount += 1;
                  gainedXp += 5;
                }
              });
            }
            setElderAdvice(
              prev.language === 'hi'
                ? "शाबाश! खेत की जुताई हो गई (⛏️)। अब इसी खेत पर दोबारा टैप करके बीज बोएं (🌱)!"
                : "Great! Plot plowed (⛏️). Tap this plot again to plant seeds (🌱)!"
            );
          }
          break;
        }

        case Tool.WATER_BUCKET: {
          if (!hasIrrigation && nextBucketWater <= 0) {
            setElderAdvice(
              prev.language === 'hi'
                ? "बाल्टी में पानी खत्म हो गया है (💧 0/5)! कुएं (Well) या तालाब पर टैप करें या ऊपर '💧 सब सींचें' बटन दबाएं।"
                : "Your water bucket is empty (💧 0/5)! Click the Village Well or Pond to refill it."
            );
            return { ...prev, playerPos: newPlayerPos };
          }
          villageAudio.playWater();
          nextSelectedTool = Tool.WATER_BUCKET;
          newPlots[plotIndex] = { ...plot, waterLevel: 100 };
          wateredCount += 1;
          staminaUsed = 2;
          gainedXp += 10;
          if (!hasIrrigation) {
            nextBucketWater = Math.max(0, nextBucketWater - 1);
          }
          setElderAdvice(
            prev.language === 'hi'
              ? `खेत की सिंचाई हो गई (💧 100%)! अब खाद (🧪) डालने के लिए दोबारा टैप करें या मंडी के खाद भंडार से देसी खाद खरीदें।`
              : `Plot watered (💧 100%)! Tap again to apply Manure (🧪) for supercharged growth.`
          );
          break;
        }

        case Tool.MANURE: {
          // Pick selected fertilizer if in stock, otherwise highest tier available
          const prefFert = prev.selectedFertilizer || FertilizerType.DESI_GOBAR;
          const fertOrder: FertilizerType[] = [
            prefFert,
            FertilizerType.AMRIT_KHAAD,
            FertilizerType.VERMI_COMPOST,
            FertilizerType.DESI_GOBAR
          ];
          const chosenFert = fertOrder.find(f => (newInventory.fertilizers[f] || 0) > 0);

          if (!chosenFert) {
            setElderAdvice(
              prev.language === 'hi'
                ? "🧪 आपके पास देसी खाद खत्म हो गई है! ऊपर '🏪 मंडी (Mandi)' खोलकर 'देसी खाद भंडार (Fertilizer Shop)' से गोबर खाद या पंचगव्य अमृत खाद खरीदें।"
                : "🧪 You are out of Manure! Open the '🏪 Mandi' and visit the 'Fertilizer Shop' to buy manure."
            );
            break;
          }

          if (plot.state === LandState.EMPTY) {
            setElderAdvice(
              prev.language === 'hi'
                ? "खेत में खाद डालने से पहले ज़मीन जोतें या बीज बोएं!"
                : "Plow the plot or plant seeds before applying manure!"
            );
            break;
          }

          if (plot.state === LandState.RIPE) {
            setElderAdvice(
              prev.language === 'hi'
                ? "यह फसल पहले ही पक चुकी है! इसे काटने के लिए हँसिया (🌾) चलाएं।"
                : "This crop is already ripe! Harvest it with the Sickle."
            );
            break;
          }

          const fertInfo = FERTILIZER_DATA[chosenFert];
          villageAudio.playDig();
          villageAudio.playFluteNote(587);
          nextSelectedTool = Tool.MANURE;
          newInventory.fertilizers[chosenFert] -= 1;

          const boostedProgress =
            plot.state === LandState.GROWING
              ? Math.min(100, plot.growthProgress + fertInfo.instantBoost)
              : plot.growthProgress;
          const becameRipe = plot.state === LandState.GROWING && boostedProgress >= 100;

          newPlots[plotIndex] = {
            ...plot,
            fertilizer: chosenFert,
            fertilizerMultiplier: fertInfo.growthMultiplier,
            growthProgress: boostedProgress,
            state: becameRipe ? LandState.RIPE : plot.state,
            waterLevel: Math.min(100, plot.waterLevel + 20)
          };
          staminaUsed = 2;
          gainedXp += 18;

          setElderAdvice(
            prev.language === 'hi'
              ? `${fertInfo.icon} कमाल! खेत में ${fertInfo.nameHi} डाल दी गई! अब यह फसल सामान्य सीमा से ${fertInfo.growthMultiplier} गुना (${fertInfo.growthMultiplier}x) तेज़ बढ़ेगी${becameRipe ? ' और तुरंत पक कर तैयार हो गई!' : ` (+${fertInfo.instantBoost}% तुरंत बढ़त)!`}`
              : `${fertInfo.icon} Applied ${chosenFert}! Crop growth rate boosted to ${fertInfo.growthMultiplier}x speed (+${fertInfo.instantBoost}% instant growth)!`
          );
          break;
        }

        case Tool.SEEDS_WHEAT:
        case Tool.SEEDS_RICE:
        case Tool.SEEDS_SUGARCANE:
        case Tool.SEEDS_MUSTARD: {
          let cropToPlant = CropType.WHEAT;
          if (effectiveTool === Tool.SEEDS_RICE) cropToPlant = CropType.RICE;
          if (effectiveTool === Tool.SEEDS_SUGARCANE) cropToPlant = CropType.SUGARCANE;
          if (effectiveTool === Tool.SEEDS_MUSTARD) cropToPlant = CropType.MUSTARD;

          if ((newInventory.seeds[cropToPlant] || 0) <= 0 && useSmart) {
            const fallbackCrop = (Object.keys(CROP_DATA) as CropType[]).find(c => (newInventory.seeds[c] || 0) > 0);
            if (fallbackCrop) cropToPlant = fallbackCrop;
          }

          if (plot.state === LandState.PLOWED && (newInventory.seeds[cropToPlant] || 0) > 0) {
            villageAudio.playDig();
            nextSelectedTool = effectiveTool;
            const autoWater = hasIrrigation || nextBucketWater > 0 ? 85 : plot.waterLevel;
            const initialBoost = plot.fertilizer ? FERTILIZER_DATA[plot.fertilizer].instantBoost : 5;
            newPlots[plotIndex] = {
              ...plot,
              state: LandState.GROWING,
              cropType: cropToPlant,
              growthProgress: Math.min(95, initialBoost),
              waterLevel: Math.max(plot.waterLevel, autoWater)
            };
            newInventory.seeds[cropToPlant] -= 1;
            staminaUsed = 3;
            gainedXp += 12;
            setElderAdvice(
              prev.language === 'hi'
                ? `बहुत बढ़िया! आपने ${CROP_DATA[cropToPlant].nameHi} के बीज बो दिए (🌱) और सिंचाई भी हो गई!`
                : `Wonderful! You planted ${cropToPlant} seeds (🌱) and watered the soil!`
            );
          } else if ((newInventory.seeds[cropToPlant] || 0) <= 0) {
            setElderAdvice(
              prev.language === 'hi'
                ? "आपके पास बीज खत्म हो गए हैं! ऊपर '🏪 मंडी (Mandi)' बटन दबाकर नए बीज खरीदें।"
                : "You are out of seeds! Click the '🏪 Mandi' button at the top to buy seeds."
            );
          } else if (plot.state !== LandState.PLOWED) {
            setElderAdvice(
              prev.language === 'hi'
                ? "बीज बोने से पहले खेत पर टैप करके जुताई करें!"
                : "Plow the plot first before planting seeds!"
            );
          }
          break;
        }

        case Tool.SICKLE: {
          if (plot.state === LandState.RIPE && plot.cropType) {
            villageAudio.playHarvest();
            villageAudio.playCoins();
            nextSelectedTool = Tool.SICKLE;
            const harvestedCrop = plot.cropType;
            const isPreferredSeason = prev.season === CROP_DATA[harvestedCrop].preferredSeason;
            const yieldCount = plot.fertilizer && FERTILIZER_DATA[plot.fertilizer]?.bonusYield ? 2 : 1;
            newInventory.crops[harvestedCrop] = (newInventory.crops[harvestedCrop] || 0) + yieldCount;
            newPlots[plotIndex] = {
              ...plot,
              state: LandState.EMPTY,
              cropType: null,
              growthProgress: 0,
              fertilizer: null,
              fertilizerMultiplier: 1
            };
            harvestedCount += 1;
            staminaUsed = 3;
            gainedXp += isPreferredSeason ? 30 : 20;
            setElderAdvice(
              prev.language === 'hi'
                ? `बधाई हो! आपने पकी हुई ${CROP_DATA[harvestedCrop].nameHi} काट ली (🌾 x${yieldCount})! इसे मंडी में बेचें या पशुओं को खिलाएं।`
                : `Harvested ripe ${harvestedCrop} (🌾 x${yieldCount})! Sell it in the Mandi or feed your animals.`
            );
          }
          break;
        }

        default:
          break;
      }

      if (plowedCount > 0) setTimeout(() => updateTaskProgress('plow', plowedCount), 0);
      if (wateredCount > 0) setTimeout(() => updateTaskProgress('water', wateredCount), 0);
      if (harvestedCount > 0) setTimeout(() => updateTaskProgress('harvest', harvestedCount), 0);

      const { xp, level, moneyBonus, respectBonus } = applyXpGain(prev, gainedXp, (newLvl) => {
        villageAudio.playFluteNote(784);
        setElderAdvice(
          prev.language === 'hi'
            ? `बधाई हो! आप किसान स्तर ${newLvl} पर पहुँच गए! पंचायत ने आपको ₹${newLvl * 150} का पुरस्कार दिया!`
            : `Congratulations! You reached Kisan Level ${newLvl}! The Panchayat awarded you ₹${newLvl * 150}!`
        );
      });

      newInventory.money += moneyBonus;

      return {
        ...prev,
        plots: newPlots,
        inventory: newInventory,
        playerPos: newPlayerPos,
        selectedTool: nextSelectedTool,
        stamina: Math.max(0, currentStamina - staminaUsed),
        bucketWater: nextBucketWater,
        xp,
        level,
        respect: Math.min(100, prev.respect + respectBonus)
      };
    });
  };

  // --- Animal Interactions (Works regardless of selected tool!) ---
  const handleAnimalClick = (animalId: string) => {
    if (gameState.placingStructure) return;

    setGameState(prev => {
      const animalIndex = prev.animals.findIndex(a => a.id === animalId);
      if (animalIndex === -1) return prev;

      const animal = prev.animals[animalIndex];
      const data = ANIMAL_DATA[animal.type];
      const obstacles = getAllObstacles(prev.structures, prev.upgrades);
      const newPlayerPos = findNearestWalkablePoint({ x: animal.x - 0.7, z: animal.z + 0.7 }, obstacles, 0.4);
      const newInventory = { 
        ...prev.inventory, 
        resources: { ...prev.inventory.resources }, 
        crops: { ...prev.inventory.crops } 
      };
      const newAnimals = [...prev.animals];

      if (animal.isReady) {
        villageAudio.playCoins();
        newInventory.resources[data.produce] = (newInventory.resources[data.produce] || 0) + 1;
        newAnimals[animalIndex] = { ...animal, isReady: false, produceTimer: 0, loved: true };
        setElderAdvice(
          prev.language === 'hi' 
            ? `बहुत बढ़िया! आपने ${animal.name || animal.type} से ताज़ा ${data.produce === ResourceType.MILK ? 'दूध (🥛)' : 'अंडा (🥚)'} प्राप्त किया।`
            : `Wonderful! You collected fresh ${data.produce} from ${animal.name || animal.type}.`
        );
      } else if (animal.hunger < 90) {
        const food = data.diet;
        if (newInventory.crops[food] > 0) {
          newInventory.crops[food] -= 1;
          newAnimals[animalIndex] = { ...animal, hunger: 100, loved: true };
          setTimeout(() => updateTaskProgress('feed_animal', 1), 0);
          setElderAdvice(
            prev.language === 'hi'
              ? `आपने ${animal.name || animal.type} को ताज़ा ${CROP_DATA[food].nameHi} खिलाया। पशु बहुत खुश है!`
              : `You fed ${animal.name || animal.type} fresh ${food}. It looks happy and healthy!`
          );
        } else {
          newAnimals[animalIndex] = { ...animal, loved: true };
          setElderAdvice(
            prev.language === 'hi'
              ? `आपने ${animal.name || animal.type} को प्यार किया (❤️)! दुग्ध/अंडा उत्पादन के लिए इसे ${CROP_DATA[food].nameHi} खिलाएं।`
              : `You petted ${animal.name || animal.type} (❤️)! Feed it ${food} to boost production.`
          );
        }
      } else {
        newAnimals[animalIndex] = { ...animal, loved: true };
        setElderAdvice(
          prev.language === 'hi'
            ? `${animal.name || animal.type} स्वस्थ और संतुष्ट है (❤️ उत्पादन: ${Math.round((animal.produceTimer / data.produceTime) * 100)}%)!`
            : `${animal.name || animal.type} is healthy and happy (❤️ Progress: ${Math.round((animal.produceTimer / data.produceTime) * 100)}%)!`
        );
      }

      return { ...prev, playerPos: newPlayerPos, inventory: newInventory, animals: newAnimals };
    });

    setTimeout(() => {
      setGameState(curr => {
        const idx = curr.animals.findIndex(a => a.id === animalId);
        if (idx === -1) return curr;
        const updated = [...curr.animals];
        updated[idx] = { ...updated[idx], loved: false };
        return { ...curr, animals: updated };
      });
    }, 1200);
  };

  // --- NPC Interaction ---
  const handleNPCClick = (npcId: number) => {
    if (gameState.placingStructure) return;
    const npc = NPC_DATA.find(n => n.id === npcId) || NPC_DATA[0];
    const pool = gameState.language === 'hi' ? npc.dialogueHi : npc.dialogue;
    const randomLine = pool[Math.floor(Math.random() * pool.length)];
    setActiveDialogue({
      npcName: gameState.language === 'hi' ? npc.nameHi : npc.name,
      text: randomLine
    });
  };

  // --- Mandir Visit ---
  const handleTempleClick = () => {
    villageAudio.playTempleBell();
    setGameState(prev => {
      if (!prev.templeBlessedToday) {
        updateTaskProgress('visit_temple', 1);
        const currentAbsTime = prev.day * 24 + prev.timeOfDay;
        setElderAdvice(
          prev.language === 'hi'
            ? "हर हर महादेव! मंदिर में पूजा संपन्न हुई। भगवान का आशीर्वाद आप पर सदा बना रहे।"
            : "Har Har Mahadev! You received the sacred temple blessing. Peace surrounds your village!"
        );
        return {
          ...prev,
          respect: Math.min(100, prev.respect + 15),
          templeBlessedToday: true,
          activeBuff: {
            type: BuffType.SHANTI,
            expiresAt: currentAbsTime + 8
          }
        };
      } else {
        setElderAdvice(
          prev.language === 'hi'
            ? "पंडित जी: 'बेटा, आज का आशीर्वाद आपको मिल चुका है। श्रद्धा से कर्म करो।'"
            : "Pandit Ji: 'Beta, you have already received today's blessing. Do your duties with devotion.'"
        );
        return prev;
      }
    });
  };

  // --- Well (Kuan) Water Refill ---
  const handleWellClick = () => {
    villageAudio.playWater();
    setGameState(prev => {
      const updatedPlots = prev.plots.map(p => ({
        ...p,
        waterLevel: Math.min(100, p.waterLevel + 25)
      }));
      setElderAdvice(
        prev.language === 'hi'
          ? "गाँव के मीठे कुएं से ताज़ा पानी भरा! बाल्टी 5/5 भर गई और पास के खेत भी सींचे गए।"
          : "Fresh sweet water drawn from the village well! Your water bucket is refilled (5/5)."
      );
      return {
        ...prev,
        plots: updatedPlots,
        bucketWater: prev.maxBucketWater ?? 5,
        stamina: Math.min(prev.maxStamina ?? 100, (prev.stamina ?? 100) + 10),
        selectedTool: Tool.WATER_BUCKET
      };
    });
  };

  // --- Talab (Village Pond) Visit ---
  const handleTalabClick = () => {
    villageAudio.playPondSplash();
    updateTaskProgress('visit_talab', 1);
    setGameState(prev => ({
      ...prev,
      bucketWater: prev.maxBucketWater ?? 5,
      stamina: Math.min(prev.maxStamina ?? 100, (prev.stamina ?? 100) + 20)
    }));
    setElderAdvice(
      gameState.language === 'hi'
        ? "गाँव के शीतल तालाब में हाथ-मुँह धोकर +20 ऊर्जा मिली और बाल्टी भी भर गई!"
        : "Refreshed at the serene village pond! Restored +20 Stamina and refilled your water bucket."
    );
  };

  // --- Raju ki Chai Tapri ---
  const handleChaiClick = () => {
    villageAudio.playChaiSip();
    updateTaskProgress('drink_chai', 1);
    const currentAbsTime = gameState.day * 24 + gameState.timeOfDay;
    setGameState(prev => ({
      ...prev,
      stamina: Math.min(prev.maxStamina ?? 100, (prev.stamina ?? 100) + 30),
      activeBuff: {
        type: BuffType.SPEED,
        expiresAt: currentAbsTime + 4
      }
    }));
    setElderAdvice(
      gameState.language === 'hi'
        ? "अहा! राजू की कड़क अदरक वाली कुल्हड़ चाय पीकर +30 ऊर्जा और तेज़ चाल मिली!"
        : "Aha! Hot ginger tea at Raju's stall restored +30 Stamina and boosted your speed!"
    );
  };

  // --- Charpai Sleep / Rest Mechanic (Always restores bright Day & 100% Stamina) ---
  const handleSleep = () => {
    villageAudio.playRooster();
    setGameState(prev => {
      const nextDay = prev.day + 1;

      // Advance crops overnight when sleeping
      const updatedPlots = prev.plots.map(p => {
        if ((p.state === LandState.GROWING || p.state === LandState.SEEDED) && p.cropType) {
          const nextProg = Math.min(100, p.growthProgress + 45);
          return {
            ...p,
            growthProgress: nextProg,
            waterLevel: Math.max(60, p.waterLevel),
            state: nextProg >= 100 ? LandState.RIPE : LandState.GROWING
          };
        }
        return p;
      });

      const updatedAnimals = prev.animals.map(a => ({
        ...a,
        state: (a.type === AnimalType.CHICKEN ? 'pecking' : 'grazing') as Animal['state']
      }));

      setElderAdvice(
        prev.language === 'hi'
          ? `सुप्रभात! खाट पर विश्राम के बाद दिन ${nextDay} की चमकीली सुबह हुई। आपकी ऊर्जा 100% हो गई और फसलें भी बढ़ गईं!`
          : `Good morning! After resting on the Charpai, bright Day ${nextDay} begins with 100% Stamina and grown crops!`
      );

      return {
        ...prev,
        day: nextDay,
        timeOfDay: 8,
        isManualNight: false,
        stamina: prev.maxStamina ?? 100,
        bucketWater: prev.maxBucketWater ?? 5,
        plots: updatedPlots,
        animals: updatedAnimals,
        templeBlessedToday: false,
        villageTasks: generateDailyTasks(nextDay)
      };
    });
  };

  // --- Manual Day / Night Toggle (Stays Day unless manually switched to Night!) ---
  const handleToggleManualNight = () => {
    setGameState(prev => {
      const nextNight = !prev.isManualNight;
      const updatedAnimals = prev.animals.map(a => ({
        ...a,
        state: (nextNight ? 'sleeping' : a.type === AnimalType.CHICKEN ? 'pecking' : 'grazing') as Animal['state'],
        path: nextNight ? undefined : a.path
      }));
      setElderAdvice(
        prev.language === 'hi'
          ? nextNight
            ? "🌙 आपने मैनुअल रात मोड चालू किया। सभी पशु अब सो रहे हैं (💤)। वापस दिन करने के लिए '☀️ दिन करें' दबाएं!"
            : "☀️ उजाला हो गया! अब हमेशा दिन रहेगा जब तक आप खुद रात मोड चालू न करें।"
          : nextNight
          ? "🌙 Switched to Manual Night mode. Animals are sleeping (💤). Click '☀️ Day Mode' anytime for daylight!"
          : "☀️ Switched to bright Daytime! It will stay Day until you manually toggle Night."
      );
      return {
        ...prev,
        isManualNight: nextNight,
        timeOfDay: nextNight ? 21 : 9,
        animals: updatedAnimals
      };
    });
  };

  // --- 1-Click Kisan Helper Batch Actions (To make gameplay effortless & fun) ---
  const handlePlowAll = () => {
    villageAudio.playDig();
    setGameState(prev => {
      let count = 0;
      const newPlots = prev.plots.map(p => {
        if (p.state === LandState.EMPTY) {
          count += 1;
          return { ...p, state: LandState.PLOWED, cropType: null, growthProgress: 0 };
        }
        return p;
      });
      if (count === 0) {
        setElderAdvice(prev.language === 'hi' ? "सभी खाली खेत पहले से जुते हुए हैं! अब '🌱 सब बोएं' दबाएं।" : "All empty plots are already plowed! Click '🌱 Plant All' next.");
        return prev;
      }
      setTimeout(() => updateTaskProgress('plow', count), 0);
      const { xp, level, moneyBonus, respectBonus } = applyXpGain(prev, count * 8);
      setElderAdvice(
        prev.language === 'hi'
          ? `🚜 शानदार! एक साथ ${count} खेत जोत दिए गए! अब '🌱 सब बोएं' दबाकर बीज बोएं।`
          : `🚜 Plowed ${count} plots at once! Now click '🌱 Plant All' to sow seeds.`
      );
      return {
        ...prev,
        plots: newPlots,
        selectedTool: Tool.HOE,
        playerPos: { x: 0, z: 2.2 },
        inventory: { ...prev.inventory, money: prev.inventory.money + moneyBonus },
        xp,
        level,
        respect: Math.min(100, prev.respect + respectBonus)
      };
    });
  };

  const handlePlantAll = () => {
    setGameState(prev => {
      const newSeeds = { ...prev.inventory.seeds };
      let plantedCount = 0;

      const newPlots = prev.plots.map(p => {
        if (p.state === LandState.PLOWED) {
          const availableCrop = (Object.keys(CROP_DATA) as CropType[]).find(c => (newSeeds[c] || 0) > 0);
          if (availableCrop) {
            newSeeds[availableCrop] -= 1;
            plantedCount += 1;
            return {
              ...p,
              state: LandState.GROWING,
              cropType: availableCrop,
              growthProgress: 10,
              waterLevel: 90
            };
          }
        }
        return p;
      });

      if (plantedCount === 0) {
        const hasPlowed = prev.plots.some(p => p.state === LandState.PLOWED);
        setElderAdvice(
          prev.language === 'hi'
            ? hasPlowed
              ? "बीज खत्म हो गए हैं! मंडी (🏪) से नए बीज खरीदें।"
              : "पहले '🚜 सब जोतें' दबाकर खाली खेत जोतें, फिर बीज बोएं!"
            : hasPlowed
            ? "Out of seeds! Buy more seeds from the Mandi (🏪)."
            : "Plow empty plots first using '🚜 Plow All' before planting!"
        );
        return prev;
      }

      villageAudio.playDig();
      villageAudio.playWater();
      const { xp, level, moneyBonus, respectBonus } = applyXpGain(prev, plantedCount * 12);
      setElderAdvice(
        prev.language === 'hi'
          ? `🌱 बहुत बढ़िया! ${plantedCount} खेतों में बीज बो दिए गए और सिंचाई भी हो गई!`
          : `🌱 Planted and watered ${plantedCount} plots!`
      );

      return {
        ...prev,
        plots: newPlots,
        playerPos: { x: 0, z: 2.2 },
        inventory: {
          ...prev.inventory,
          seeds: newSeeds,
          money: prev.inventory.money + moneyBonus
        },
        xp,
        level,
        respect: Math.min(100, prev.respect + respectBonus)
      };
    });
  };

  const handleWaterAll = () => {
    villageAudio.playWater();
    setGameState(prev => {
      let watered = 0;
      const newPlots = prev.plots.map(p => {
        if (p.waterLevel < 100) {
          watered += 1;
          return { ...p, waterLevel: 100 };
        }
        return p;
      });
      setTimeout(() => updateTaskProgress('water', Math.max(1, watered)), 0);
      const { xp, level, moneyBonus, respectBonus } = applyXpGain(prev, watered * 5);
      setElderAdvice(
        prev.language === 'hi'
          ? "💧 सभी 9 खेतों की 100% सिंचाई हो गई और पानी की बाल्टी भी 5/5 भर गई!"
          : "💧 All 9 plots watered to 100% and water bucket refilled (5/5)!"
      );
      return {
        ...prev,
        plots: newPlots,
        bucketWater: prev.maxBucketWater ?? 5,
        selectedTool: Tool.WATER_BUCKET,
        inventory: { ...prev.inventory, money: prev.inventory.money + moneyBonus },
        xp,
        level,
        respect: Math.min(100, prev.respect + respectBonus)
      };
    });
  };

  const handleHarvestAll = () => {
    setGameState(prev => {
      let harvested = 0;
      const newCrops = { ...prev.inventory.crops };
      const newPlots = prev.plots.map(p => {
        if (p.state === LandState.RIPE && p.cropType) {
          const yieldCount = p.fertilizer && FERTILIZER_DATA[p.fertilizer]?.bonusYield ? 2 : 1;
          harvested += yieldCount;
          newCrops[p.cropType] = (newCrops[p.cropType] || 0) + yieldCount;
          return { ...p, state: LandState.EMPTY, cropType: null, growthProgress: 0, fertilizer: null, fertilizerMultiplier: 1 };
        }
        return p;
      });

      if (harvested === 0) {
        setElderAdvice(
          prev.language === 'hi'
            ? "अभी कोई फसल पूरी तरह पकी (100%) नहीं है। थोड़ा इंतज़ार करें या '🛏️ सोएं' दबाकर अगली सुबह करें!"
            : "No crops are ripe (100%) yet! Wait a moment or click '🛏️ Sleep' to advance to morning."
        );
        return prev;
      }

      villageAudio.playHarvest();
      villageAudio.playCoins();
      setTimeout(() => updateTaskProgress('harvest', harvested), 0);
      const { xp, level, moneyBonus, respectBonus } = applyXpGain(prev, harvested * 25);
      setElderAdvice(
        prev.language === 'hi'
          ? `🌾 बधाई हो! एक साथ ${harvested} पकी फसलें काट ली गईं! अब मंडी (🏪) में बेचकर मुनाफा कमाएं।`
          : `🌾 Harvested ${harvested} ripe crops! Sell them in the Mandi (🏪) for profit.`
      );

      return {
        ...prev,
        plots: newPlots,
        selectedTool: Tool.SICKLE,
        inventory: {
          ...prev.inventory,
          crops: newCrops,
          money: prev.inventory.money + moneyBonus
        },
        xp,
        level,
        respect: Math.min(100, prev.respect + respectBonus)
      };
    });
  };

  const handleCareAllAnimals = () => {
    setGameState(prev => {
      let collected = 0;
      let fed = 0;
      const newRes = { ...prev.inventory.resources };
      const newCrops = { ...prev.inventory.crops };

      const newAnimals = prev.animals.map(a => {
        const data = ANIMAL_DATA[a.type];
        let isReady = a.isReady;
        let produceTimer = a.produceTimer;
        let hunger = a.hunger;

        if (isReady) {
          newRes[data.produce] = (newRes[data.produce] || 0) + 1;
          isReady = false;
          produceTimer = 0;
          collected += 1;
        }
        if (hunger < 95 && (newCrops[data.diet] || 0) > 0) {
          newCrops[data.diet] -= 1;
          hunger = 100;
          fed += 1;
        }
        return { ...a, isReady, produceTimer, hunger, loved: true };
      });

      if (collected > 0) villageAudio.playCoins();
      else villageAudio.playCow();

      if (fed > 0) setTimeout(() => updateTaskProgress('feed_animal', fed), 0);
      const { xp, level, moneyBonus, respectBonus } = applyXpGain(prev, (collected + fed) * 15 + 5);

      setElderAdvice(
        prev.language === 'hi'
          ? `🐄 पशु सेवा संपन्न! ${collected > 0 ? `${collected} उत्पाद (दूध/अंडे) इकट्ठे किए` : 'सभी पशुओं को दुलार किया'}${fed > 0 ? ` और ${fed} पशुओं को चारा खिलाया!` : '!'}`
          : `🐄 Animal care complete! Collected ${collected} produce and fed ${fed} animals!`
      );

      return {
        ...prev,
        animals: newAnimals,
        inventory: {
          ...prev.inventory,
          resources: newRes,
          crops: newCrops,
          money: prev.inventory.money + moneyBonus
        },
        xp,
        level,
        respect: Math.min(100, prev.respect + respectBonus)
      };
    });
  };

  // --- On-screen D-Pad & Quick Village Landmark Walk ---
  const handleMoveDpad = (dx: number, dz: number) => {
    setGameState(prev => {
      const step = 1.6;
      const desiredX = Math.max(-22, Math.min(22, prev.playerPos.x + dx * step));
      const desiredZ = Math.max(-22, Math.min(22, prev.playerPos.z + dz * step));
      const obstacles = getAllObstacles(prev.structures, prev.upgrades);
      const safeTarget = findNearestWalkablePoint({ x: desiredX, z: desiredZ }, obstacles, 0.42);
      const angle = Math.atan2(dx, dz);
      return {
        ...prev,
        playerPos: safeTarget,
        playerRotation: angle
      };
    });
  };

  const handleQuickGoTo = (x: number, z: number, labelHi: string, labelEn: string) => {
    setGameState(prev => {
      const obstacles = getAllObstacles(prev.structures, prev.upgrades);
      const safeTarget = findNearestWalkablePoint({ x, z }, obstacles, 0.42);
      setElderAdvice(
        prev.language === 'hi'
          ? `🚶 किसान अब ${labelHi} की ओर चल रहा है...`
          : `🚶 Walking to ${labelEn}...`
      );
      return {
        ...prev,
        playerPos: safeTarget
      };
    });
  };

  // --- City Mandi Wholesale Express Trip (+20% Bonus) ---
  const handleCityMandiSellAll = () => {
    setGameState(prev => {
      if (prev.inventory.money < 15) return prev;

      const newInv = {
        ...prev.inventory,
        crops: { ...prev.inventory.crops },
        resources: { ...prev.inventory.resources }
      };

      let totalValue = 0;
      (Object.keys(CROP_DATA) as CropType[]).forEach(crop => {
        const qty = newInv.crops[crop] || 0;
        if (qty > 0) {
          totalValue += qty * CROP_DATA[crop].sellPrice;
          newInv.crops[crop] = 0;
        }
      });

      (Object.keys(RESOURCE_PRICES) as ResourceType[]).forEach(res => {
        const qty = newInv.resources[res] || 0;
        if (qty > 0) {
          totalValue += qty * RESOURCE_PRICES[res];
          newInv.resources[res] = 0;
        }
      });

      if (totalValue === 0) return prev;

      const cityBonusTotal = Math.floor(totalValue * 1.2) - 15;
      newInv.money += cityBonusTotal;
      villageAudio.playHorn();
      villageAudio.playCoins();

      setTimeout(() => {
        updateTaskProgress('ride_tempo', 1);
        updateTaskProgress('sell_crop', cityBonusTotal);
      }, 0);

      const { xp, level, moneyBonus, respectBonus } = applyXpGain(prev, 35);
      newInv.money += moneyBonus;

      setElderAdvice(
        prev.language === 'hi'
          ? `शहर मंडी एक्सप्रेस से आपकी सारी उपज +20% बोनस भाव पर बिकी! कुल मुनाफा: ₹${cityBonusTotal}`
          : `Sold all harvest at the City Mandi with a +20% bonus! Net profit: ₹${cityBonusTotal}`
      );

      return {
        ...prev,
        inventory: newInv,
        xp,
        level,
        respect: Math.min(100, prev.respect + respectBonus)
      };
    });
  };

  // --- Desi Tempo / Bus Stand ---
  const handleTempoClick = () => {
    villageAudio.playHorn();
    updateTaskProgress('ride_tempo', 1);
    setElderAdvice(
      gameState.language === 'hi'
        ? "हॉर्न ओके प्लीज! ड्राइवर बाबू: 'मंडी खोलकर शहर मंडी एक्सप्रेस से सारी फसल +20% बोनस दाम में बेचो!'"
        : "Horn OK Please! Driver Babu: 'Use City Mandi Express in the Market to sell all harvest for a +20% bonus!'"
    );
  };

  // --- Market Buying & Selling + Fertilizer Shop ---
  const handleBuySeed = (crop: CropType) => {
    const price = CROP_DATA[crop].seedPrice;
    if (gameState.inventory.money >= price) {
      villageAudio.playCoins();
      setGameState(prev => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          money: prev.inventory.money - price,
          seeds: {
            ...prev.inventory.seeds,
            [crop]: (prev.inventory.seeds[crop] || 0) + 1
          }
        }
      }));
    }
  };

  const handleBuyFertilizer = (type: FertilizerType, count: 1 | 5 = 1) => {
    const data = FERTILIZER_DATA[type];
    const totalCost = count === 5 ? data.pack5Cost : data.cost * count;

    setGameState(prev => {
      if (prev.inventory.money < totalCost) return prev;
      villageAudio.playCoins();

      const currentFerts = prev.inventory.fertilizers || {
        [FertilizerType.DESI_GOBAR]: 0,
        [FertilizerType.VERMI_COMPOST]: 0,
        [FertilizerType.AMRIT_KHAAD]: 0
      };

      setElderAdvice(
        prev.language === 'hi'
          ? `${data.icon} आपने खाद भंडार से ${count} बोरी ${data.nameHi} खरीदी! इससे फसल सामान्य सीमा से ${data.growthMultiplier}x तेज़ बढ़ेगी!`
          : `${data.icon} Bought ${count}x ${type}! Speeds up crop growth to ${data.growthMultiplier}x beyond standard limits!`
      );

      return {
        ...prev,
        selectedFertilizer: type,
        selectedTool: Tool.MANURE,
        inventory: {
          ...prev.inventory,
          money: prev.inventory.money - totalCost,
          fertilizers: {
            ...currentFerts,
            [type]: (currentFerts[type] || 0) + count
          }
        }
      };
    });
  };

  const handleSelectFertilizer = (type: FertilizerType) => {
    setGameState(prev => ({
      ...prev,
      selectedFertilizer: type,
      selectedTool: Tool.MANURE
    }));
  };

  const handleFertilizeAll = (preferredType?: FertilizerType) => {
    setGameState(prev => {
      const newFerts = {
        ...(prev.inventory.fertilizers || {
          [FertilizerType.DESI_GOBAR]: 0,
          [FertilizerType.VERMI_COMPOST]: 0,
          [FertilizerType.AMRIT_KHAAD]: 0
        })
      };

      const activeType = preferredType || prev.selectedFertilizer || FertilizerType.DESI_GOBAR;
      const order: FertilizerType[] = [
        activeType,
        FertilizerType.AMRIT_KHAAD,
        FertilizerType.VERMI_COMPOST,
        FertilizerType.DESI_GOBAR
      ];

      let appliedCount = 0;
      let ripenedCount = 0;

      const newPlots = prev.plots.map(plot => {
        if (plot.state !== LandState.GROWING && plot.state !== LandState.PLOWED && plot.state !== LandState.SEEDED) {
          return plot;
        }
        const availFert = order.find(f => (newFerts[f] || 0) > 0);
        if (!availFert) return plot;

        const info = FERTILIZER_DATA[availFert];
        if (plot.fertilizer === availFert && plot.state !== LandState.GROWING) return plot;

        newFerts[availFert] -= 1;
        appliedCount += 1;

        const nextProgress =
          plot.state === LandState.GROWING
            ? Math.min(100, plot.growthProgress + info.instantBoost)
            : plot.growthProgress;
        const isNowRipe = plot.state === LandState.GROWING && nextProgress >= 100;
        if (isNowRipe) ripenedCount += 1;

        return {
          ...plot,
          fertilizer: availFert,
          fertilizerMultiplier: info.growthMultiplier,
          growthProgress: nextProgress,
          state: isNowRipe ? LandState.RIPE : plot.state,
          waterLevel: Math.min(100, plot.waterLevel + 20)
        };
      });

      if (appliedCount === 0) {
        const totalBags =
          (newFerts[FertilizerType.DESI_GOBAR] || 0) +
          (newFerts[FertilizerType.VERMI_COMPOST] || 0) +
          (newFerts[FertilizerType.AMRIT_KHAAD] || 0);

        setElderAdvice(
          totalBags === 0
            ? (prev.language === 'hi'
                ? "🧪 आपके पास देसी खाद नहीं है! मंडी (🏪) के 'खाद भंडार' से गोबर खाद या पंचगव्य अमृत खाद खरीदें।"
                : "🧪 Out of manure! Buy manure from the Fertilizer Shop in the Mandi (🏪).")
            : (prev.language === 'hi'
                ? "🌱 खाद डालने के लिए पहले खेत जोतें या बीज बोएं!"
                : "🌱 Plow or plant crops on plots first to apply manure!")
        );
        return prev;
      }

      villageAudio.playDig();
      villageAudio.playFluteNote(659);
      const { xp, level, moneyBonus, respectBonus } = applyXpGain(prev, appliedCount * 15);

      setElderAdvice(
        prev.language === 'hi'
          ? `🧪 कमाल! ${appliedCount} खेतों में शक्तिशाली देसी खाद डाल दी गई!${ripenedCount > 0 ? ` ${ripenedCount} फसलें तुरंत पक कर तैयार हो गईं!` : ' अब फसलें रिकॉर्ड रफ़्तार से बढ़ेंगी!'}`
          : `🧪 Applied manure to ${appliedCount} plots!${ripenedCount > 0 ? ` ${ripenedCount} crops ripened immediately!` : ' Crops are now growing at hyper speed!'}`
      );

      return {
        ...prev,
        plots: newPlots,
        selectedTool: Tool.MANURE,
        inventory: {
          ...prev.inventory,
          fertilizers: newFerts,
          money: prev.inventory.money + moneyBonus
        },
        xp,
        level,
        respect: Math.min(100, prev.respect + respectBonus)
      };
    });
  };

  const handleBuyAnimal = (type: AnimalType) => {
    const cost = ANIMAL_DATA[type].cost;
    if (gameState.inventory.money >= cost) {
      villageAudio.playCoins();
      const newAnimal = {
        id: Date.now().toString(),
        type: type,
        x: gameState.playerPos.x + 1,
        z: gameState.playerPos.z,
        rotation: Math.random() * Math.PI * 2,
        produceTimer: 0,
        isReady: false,
        age: 0,
        hunger: 100
      };

      setGameState(prev => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          money: prev.inventory.money - cost
        },
        animals: [...prev.animals, newAnimal]
      }));
    }
  };

  const handleSellAnimal = (type: AnimalType) => {
    setGameState(prev => {
      const owned = prev.animals.filter(a => a.type === type);
      if (owned.length === 0) return prev;

      owned.sort((a, b) => b.age - a.age);
      const toSell = owned[0];
      const cost = ANIMAL_DATA[type].cost;
      const price = toSell.age >= 100 ? Math.floor(cost * 1.5) : Math.floor(cost * 0.5);

      villageAudio.playCoins();
      const newAnimals = prev.animals.filter(a => a.id !== toSell.id);

      return {
        ...prev,
        inventory: {
          ...prev.inventory,
          money: prev.inventory.money + price
        },
        animals: newAnimals
      };
    });
  };

  const handleSellItem = (item: CropType | ResourceType | DishType, sellAll: boolean = false) => {
    const isCrop = Object.values(CropType).includes(item as CropType);
    const isDish = Object.values(DishType).includes(item as DishType);

    setGameState(prev => {
      const newInventory = { 
        ...prev.inventory, 
        crops: { ...prev.inventory.crops }, 
        resources: { ...prev.inventory.resources }, 
        dishes: { ...prev.inventory.dishes } 
      };

      let basePrice = 0;
      let amountAvailable = 0;

      if (isDish) {
        amountAvailable = newInventory.dishes[item as DishType] || 0;
        basePrice = DISH_DATA[item as DishType].sellPrice;
      } else if (isCrop) {
        amountAvailable = newInventory.crops[item as CropType] || 0;
        basePrice = CROP_DATA[item as CropType].sellPrice;
      } else {
        amountAvailable = newInventory.resources[item as ResourceType] || 0;
        basePrice = RESOURCE_PRICES[item as ResourceType];
      }

      if (amountAvailable <= 0) return prev;

      let multiplier = 1.0;
      if (prev.activeBuff?.type === BuffType.WEALTH) multiplier += 0.25;
      if (prev.upgrades.includes(UpgradeType.BULLOCK_CART)) multiplier += 0.20;
      if (prev.structures.some(s => s.type === StructureType.GRAIN_SILO) && isCrop) multiplier += 0.10;
      if (prev.currentFestival === 'BAISAKHI' && isCrop) multiplier += 0.30;

      const amountToSell = sellAll ? amountAvailable : 1;
      const totalEarned = Math.floor(basePrice * multiplier * amountToSell);

      if (isDish) newInventory.dishes[item as DishType] -= amountToSell;
      else if (isCrop) newInventory.crops[item as CropType] -= amountToSell;
      else newInventory.resources[item as ResourceType] -= amountToSell;

      newInventory.money += totalEarned;
      villageAudio.playCoins();

      setTimeout(() => updateTaskProgress('sell_crop', totalEarned), 0);

      return {
        ...prev,
        inventory: newInventory
      };
    });
  };

  // --- Cooking & Eating on Chulha ---
  const handleCook = (dish: DishType) => {
    const recipe = DISH_DATA[dish];
    const canCook = Object.entries(recipe.ingredients).every(([item, qty]) => {
      const type = item as CropType | ResourceType;
      const isRes = Object.values(ResourceType).includes(type as ResourceType);
      const invQty = isRes
        ? gameState.inventory.resources[type as ResourceType] || 0
        : gameState.inventory.crops[type as CropType] || 0;
      return invQty >= (qty || 0);
    });

    if (canCook) {
      villageAudio.playCooking();
      setGameState(prev => {
        const newInv = {
          ...prev.inventory,
          crops: { ...prev.inventory.crops },
          resources: { ...prev.inventory.resources },
          dishes: { ...prev.inventory.dishes }
        };

        Object.entries(recipe.ingredients).forEach(([item, qty]) => {
          const type = item as CropType | ResourceType;
          if (Object.values(ResourceType).includes(type as ResourceType)) {
            newInv.resources[type as ResourceType] -= (qty || 0);
          } else {
            newInv.crops[type as CropType] -= (qty || 0);
          }
        });

        newInv.dishes[dish] = (newInv.dishes[dish] || 0) + 1;
        return { ...prev, inventory: newInv };
      });
      updateTaskProgress('cook', 1);
    }
  };

  const handleEat = (dish: DishType) => {
    if (gameState.inventory.dishes[dish] > 0) {
      villageAudio.playFluteNote(587);
      const data = DISH_DATA[dish];
      const currentAbsTime = gameState.day * 24 + gameState.timeOfDay;

      setGameState(prev => ({
        ...prev,
        stamina: Math.min(prev.maxStamina ?? 100, (prev.stamina ?? 100) + 60),
        inventory: {
          ...prev.inventory,
          dishes: {
            ...prev.inventory.dishes,
            [dish]: prev.inventory.dishes[dish] - 1
          }
        },
        activeBuff: {
          type: data.buff,
          expiresAt: currentAbsTime + data.buffDuration
        }
      }));

      setElderAdvice(
        gameState.language === 'hi'
          ? `वाह! आपने ${data.nameHi} खाई। +60 ऊर्जा मिली और ${data.buff} सक्रिय हो गया!`
          : `Delicious! You ate ${dish}, restoring +60 Stamina and activating ${data.buff}!`
      );
      setShowCooking(false);
    }
  };

  // --- Buildings & Upgrades ---
  const handleBuyStructure = (type: StructureType) => {
    const cost = STRUCTURE_DATA[type].cost;
    if (gameState.inventory.money >= cost) {
      setGameState(prev => ({ ...prev, placingStructure: type }));
    }
  };

  const handleBuyUpgrade = (type: UpgradeType) => {
    const cost = UPGRADE_DATA[type].cost;
    if (gameState.inventory.money >= cost && !gameState.upgrades.includes(type)) {
      villageAudio.playCoins();
      setGameState(prev => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          money: prev.inventory.money - cost
        },
        upgrades: [...prev.upgrades, type]
      }));
      setElderAdvice(
        gameState.language === 'hi'
          ? `शानदार निर्णय! ${UPGRADE_DATA[type].nameHi} से आपके खेत की शान बढ़ गई!`
          : `Wise decision! The ${type} upgrade will serve your farm well!`
      );
    }
  };

  const handleCancelBuild = () => {
    setGameState(prev => ({ ...prev, placingStructure: null }));
  };

  const handlePlaneClick = (point: THREE.Vector3) => {
    if (gameState.placingStructure) {
      const cost = STRUCTURE_DATA[gameState.placingStructure].cost;
      if (gameState.inventory.money >= cost) {
        villageAudio.playCoins();
        const newStructure = {
          id: Date.now().toString(),
          type: gameState.placingStructure,
          x: point.x,
          z: point.z,
          rotation: 0
        };
        setGameState(prev => {
          const updatedStructures = [...prev.structures, newStructure];
          const updatedObstacles = getAllObstacles(updatedStructures, prev.upgrades);

          // Ensure player and animals are displaced outside the new structure's footprint
          const safePlayerPos = findNearestWalkablePoint(prev.playerPos, updatedObstacles, 0.45);
          const safeAnimals = prev.animals.map(a => {
            const safeAnimalPos = findNearestWalkablePoint({ x: a.x, z: a.z }, updatedObstacles, 0.5);
            return {
              ...a,
              x: safeAnimalPos.x,
              z: safeAnimalPos.z,
              path: [safeAnimalPos]
            };
          });

          return {
            ...prev,
            structures: updatedStructures,
            animals: safeAnimals,
            playerPos: safePlayerPos,
            inventory: { ...prev.inventory, money: prev.inventory.money - cost },
            placingStructure: null
          };
        });
      } else {
        setGameState(prev => ({ ...prev, placingStructure: null }));
      }
    } else {
      setGameState(prev => {
        const obstacles = getAllObstacles(prev.structures, prev.upgrades);
        const safeTarget = findNearestWalkablePoint({ x: point.x, z: point.z }, obstacles, 0.42);
        return {
          ...prev,
          playerPos: safeTarget
        };
      });
    }
  };

  // --- Daily Task Reward Claim ---
  const handleClaimTaskReward = (taskId: string) => {
    villageAudio.playCoins();
    setGameState(prev => {
      const task = prev.villageTasks.find(t => t.id === taskId);
      if (!task || task.claimed || !task.completed) return prev;

      const updatedTasks = prev.villageTasks.map(t =>
        t.id === taskId ? { ...t, claimed: true } : t
      );

      const { xp, level, moneyBonus, respectBonus } = applyXpGain(prev, 40);

      return {
        ...prev,
        inventory: {
          ...prev.inventory,
          money: prev.inventory.money + task.rewardMoney + moneyBonus
        },
        respect: Math.min(100, prev.respect + task.rewardRespect + respectBonus),
        xp,
        level,
        villageTasks: updatedTasks
      };
    });
  };

  // --- Sarpanch AI Guidance ---
  const handleAskElder = async () => {
    setElderAdvice(gameState.language === 'hi' ? "रुकिए बेटा, जरा सोचने दीजिए..." : "Hmm, let me ponder...");
    const advice = await getVillageElderAdvice(gameState);
    setElderAdvice(advice);
  };

  // Sound toggle
  const handleToggleSound = () => {
    const nextMuted = !gameState.isMuted;
    villageAudio.setMuted(nextMuted);
    setGameState(prev => ({ ...prev, isMuted: nextMuted }));
  };

  // Language toggle
  const handleToggleLanguage = () => {
    const nextLang = gameState.language === 'hi' ? 'en' : 'hi';
    setGameState(prev => ({ ...prev, language: nextLang }));
  };

  // Time speed toggle (1x Calm vs 2x Fast)
  const handleToggleTimeSpeed = () => {
    setGameState(prev => ({
      ...prev,
      timeSpeed: prev.timeSpeed === 1 ? 2 : 1
    }));
  };

  return (
    <div className="w-full h-screen bg-stone-950 overflow-hidden relative font-sans">
      <GameScene
        gameState={gameState}
        onPlotClick={handlePlotClick}
        onAnimalClick={handleAnimalClick}
        onNPCClick={handleNPCClick}
        onPlaneClick={handlePlaneClick}
        onChulhaClick={() => setShowCooking(true)}
        onTempleClick={handleTempleClick}
        onWellClick={handleWellClick}
        onShopClick={() => handleNPCClick(2)}
        onTalabClick={handleTalabClick}
        onChaiClick={handleChaiClick}
        onTempoClick={handleTempoClick}
        onSleepClick={handleSleep}
        onOpenRules={() => setShowRules(true)}
      />

      <UIOverlay
        gameState={gameState}
        onSelectTool={(t) => setGameState(prev => ({ ...prev, selectedTool: t }))}
        onBuySeed={handleBuySeed}
        onBuyAnimal={handleBuyAnimal}
        onSellAnimal={handleSellAnimal}
        onSellItem={handleSellItem}
        onBuyStructure={handleBuyStructure}
        onCancelBuild={handleCancelBuild}
        onBuyUpgrade={handleBuyUpgrade}
        elderAdvice={elderAdvice}
        onAskElder={handleAskElder}
        activeDialogue={activeDialogue}
        onCloseDialogue={() => setActiveDialogue(null)}
        showCooking={showCooking}
        onCloseCooking={() => setShowCooking(false)}
        onCook={handleCook}
        onEat={handleEat}
        onToggleSound={handleToggleSound}
        onToggleLanguage={handleToggleLanguage}
        onToggleTimeSpeed={handleToggleTimeSpeed}
        onClaimTaskReward={handleClaimTaskReward}
        onOpenMarket={() => handleNPCClick(2)}
        onOpenTemple={handleTempleClick}
        showRules={showRules}
        onToggleRules={() => setShowRules(prev => !prev)}
        onSleep={handleSleep}
        onCityMandiSellAll={handleCityMandiSellAll}
        onToggleManualNight={handleToggleManualNight}
        onPlowAll={handlePlowAll}
        onPlantAll={handlePlantAll}
        onWaterAll={handleWaterAll}
        onHarvestAll={handleHarvestAll}
        onCareAllAnimals={handleCareAllAnimals}
        onMoveDpad={handleMoveDpad}
        onQuickGoTo={handleQuickGoTo}
        onBuyFertilizer={handleBuyFertilizer}
        onSelectFertilizer={handleSelectFertilizer}
        onFertilizeAll={handleFertilizeAll}
      />
    </div>
  );
};

export default App;
