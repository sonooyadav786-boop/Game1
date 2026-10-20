import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GameState, Season } from "../types";

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const FALLBACK_ADVICE_HI = [
  "राम राम बेटा! वर्षा ऋतु में धान की रोपाई करो और शीत ऋतु में गेहूँ और सरसों। मिट्टी की सेवा करोगे तो वो तुम्हें धनवान बनाएगी।",
  "अरे बेटा, मवेशियों को समय पर चारा-पानी दो। गौ माता प्रसन्न रहेंगी तो घर में दूध और बरकत की कभी कमी नहीं होगी।",
  "मंडी में भाव देखकर फसल बेचना। जब जेब में पैसे कम हों तो पहले बीज खरीदो और धीरे-धीरे बचत बढ़ाओ।",
  "सुबह मंदिर जाकर भगवान का आशीर्वाद लो, दिन भर खेत में काम करने की नई ऊर्जा मिलती है!",
  "चूल्हे पर ताज़ा मक्के की रोटी और सरसों का साग बनाओ, शरीर में चीते जैसी फुर्ती आ जाएगी!"
];

const FALLBACK_ADVICE_EN = [
  "Ram Ram beta! In Monsoon, sow green Rice paddy, and in Winter, golden Wheat and yellow Mustard. Love the soil and it will reward you with gold!",
  "Feed your cattle with nutritious wheat stalks. A contented cow brings abundant milk and Lakshmi to your home.",
  "Check the Mandi rates carefully. Invest in sturdy seeds first before buying luxury upgrades.",
  "Visit the village Mandir in the morning for Pandit Ji's blessing. Pure thoughts bring bountiful crops!",
  "Cook hot Makki di Roti and Sarson ka Saag on your Chulha. Desi food gives the power to farm all day!"
];

export const getVillageElderAdvice = async (gameState: GameState): Promise<string> => {
  const isHi = gameState.language === 'hi';
  
  if (!ai || !apiKey) {
    const pool = isHi ? FALLBACK_ADVICE_HI : FALLBACK_ADVICE_EN;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const modelId = "gemini-2.5-flash";
  const prompt = `
    You are the wise Village Sarpanch (Head) of an Indian village named "Gaon". 
    Language requested: ${isHi ? 'Pure rural Hindi (Devanagari script)' : 'Rustic, warm Indian English with words like beta, arre, chalo'}.
    
    Current Village Status:
    - Season: ${gameState.season}
    - Weather: ${gameState.weather}
    - Time: ${Math.floor(gameState.timeOfDay)}:00 hours
    - Money: ₹${gameState.inventory.money}
    - Day: ${gameState.day}
    - Village Respect: ${gameState.respect}/100
    
    Give the player brief rustic advice (max 2 sentences) about farming, caring for cattle, village harmony, or mandi prices.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        maxOutputTokens: 120,
        temperature: 0.7,
      }
    });

    return response.text?.trim() || (isHi ? FALLBACK_ADVICE_HI[0] : FALLBACK_ADVICE_EN[0]);
  } catch (error) {
    const pool = isHi ? FALLBACK_ADVICE_HI : FALLBACK_ADVICE_EN;
    return pool[Math.floor(Math.random() * pool.length)];
  }
};
