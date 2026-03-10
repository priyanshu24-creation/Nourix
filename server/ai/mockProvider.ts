import type { AiProvider } from "./provider";
import type { Plan } from "./plan";
import type { ChatHistoryItem, ClientContext } from "./validators";

const hasAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

const pick = (options: string[]) => options[Math.floor(Math.random() * options.length)];

const formatTime = (date: Date, context?: ClientContext) => {
  const locale = context?.locale ?? "en-IN";
  const timeZone = context?.timeZone;
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
};

const buildScheduleTimes = (context?: ClientContext): [string, string, string] => {
  if (!context?.now) {
    return ["08:00", "13:30", "19:30"];
  }

  const now = new Date(context.now);
  if (Number.isNaN(now.getTime())) {
    return ["08:00", "13:30", "19:30"];
  }

  const first = new Date(now.getTime() + 30 * 60 * 1000);
  const second = new Date(first.getTime() + 4 * 60 * 60 * 1000);
  const third = new Date(second.getTime() + 5 * 60 * 60 * 1000);

  return [formatTime(first, context), formatTime(second, context), formatTime(third, context)];
};

const buildMockPlan = (prompt: string, context?: ClientContext): Plan => {
  const lower = prompt.toLowerCase();
  const isVegan = hasAny(lower, ["vegan", "plant-based"]);
  const isKeto = hasAny(lower, ["keto", "ketogenic", "low carb", "low-carb"]);
  const isGlutenFree = hasAny(lower, ["gluten-free", "gluten free"]);
  const [breakfastTime, lunchTime, dinnerTime] = buildScheduleTimes(context);

  const diet = [
    {
      time: breakfastTime,
      meal: isVegan ? "Poha with peanuts" : isKeto ? "Paneer bhurji with salad" : "Idli with sambar",
      description: isVegan
        ? "Flattened rice with onions, peas, peanuts, and lemon."
        : isKeto
          ? "Paneer bhurji, cucumber-tomato salad, and mint chutney."
          : "Steamed idli with sambar and coconut chutney.",
    },
    {
      time: lunchTime,
      meal: isVegan ? "Chana masala with rice" : isKeto ? "Tandoori chicken with salad" : "Dal, roti, and sabzi",
      description: isVegan
        ? "Chana masala, jeera rice, and kachumber salad."
        : isKeto
          ? "Tandoori chicken, sauteed veggies, and green chutney."
          : "Mixed dal, whole-wheat roti, seasonal sabzi, and salad.",
    },
    {
      time: dinnerTime,
      meal: isVegan ? "Khichdi with veggies" : isKeto ? "Palak paneer with salad" : "Khichdi and curd",
      description: isVegan
        ? "Moong dal khichdi with mixed vegetables and pickle."
        : isKeto
          ? "Palak paneer with cucumber-onion salad."
          : "Moong dal khichdi, curd, and a small salad.",
    },
  ];

  const exercise = [
    { name: "Brisk walk", duration: "25 minutes", intensity: "Low" },
    { name: "Bodyweight circuit", duration: "20 minutes", intensity: "Moderate" },
    { name: "Stretch & mobility", duration: "10 minutes", intensity: "Low" },
  ];

  const medicine = hasAny(lower, ["medicine", "medication", "pill", "tablet"])
    ? [{ name: "Prescribed medication", time: "09:00", dosage: "As directed" }]
    : [];

  const hydration = isKeto
    ? "Aim for 2.5-3 liters of water and consider electrolytes."
    : "Aim for 2-2.5 liters of water across the day.";

  const motivation = context?.weekday
    ? `Happy ${context.weekday}. Small steps today build big progress tomorrow.`
    : "Small steps today build big progress tomorrow.";

  if (isGlutenFree) {
    diet[0].description += " (Gluten-free)";
    diet[1].description += " (Gluten-free)";
    diet[2].description += " (Gluten-free)";
  }

  return { diet, exercise, medicine, hydration, motivation };
};

const buildMockChat = (message: string): string => {
  const lower = message.toLowerCase();
  if (hasAny(lower, ["who are you", "what is your name", "your name", "name?"])) {
    return "I’m Nourix, your AI wellness companion. I’m here to help with routines, motivation, and support.";
  }
  if (hasAny(lower, ["hi", "hello", "hey", "wassup", "what's up", "sup"])) {
    return pick([
      "Hey! I’m here. How are you feeling today?",
      "Hi there! What’s on your mind?",
      "Hey! Want to talk through anything, or need a quick boost?",
    ]);
  }
  if (hasAny(lower, ["thanks", "thank you", "thx"])) {
    return pick([
      "You’re welcome. I’m here whenever you need.",
      "Anytime. Want to keep going or take a quick reset?",
      "Glad to help. What’s one small thing you can do next?",
    ]);
  }
  if (hasAny(lower, ["stress", "overwhelmed", "anxious", "anxiety"])) {
    return "That sounds heavy. Try a 60-second reset: inhale for 4, hold for 4, exhale for 6, repeat. What part feels most intense right now?";
  }
  if (hasAny(lower, ["sad", "depressed", "down", "hopeless"])) {
    return "I’m really sorry you’re feeling this way. You’re not alone here. Would it help to talk about what’s been weighing on you most?";
  }
  if (hasAny(lower, ["angry", "frustrated", "irritated"])) {
    return "Totally understandable to feel that way. Want to vent for a minute, or should we figure out a small next step?";
  }
  return pick([
    "Thanks for sharing. I’m here with you. Tell me a bit more about what you need right now.",
    "I’m listening. What would feel most helpful in this moment?",
    "I’ve got you. Want to unpack what’s going on, or focus on a quick next step?",
  ]);
};

export class MockProvider implements AiProvider {
  async generatePlan(prompt: string, _requestId?: string, context?: ClientContext): Promise<Plan> {
    return buildMockPlan(prompt, context);
  }

  async chat(message: string, _history: ChatHistoryItem[]): Promise<string> {
    return buildMockChat(message);
  }
}
