export type DietItem = { time: string; meal: string; description: string };
export type ExerciseItem = { name: string; duration: string; intensity: string };
export type MedicineItem = { name: string; time: string; dosage: string };

export type Plan = {
  diet: DietItem[];
  exercise: ExerciseItem[];
  medicine: MedicineItem[];
  hydration: string;
  motivation: string;
};

const DEFAULT_HYDRATION = "Stay hydrated throughout the day.";
const DEFAULT_MOTIVATION = "You've got this!";

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeArray = <T>(
  value: unknown,
  mapper: (item: unknown) => T | null,
): T[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(mapper).filter((item): item is T => item !== null);
};

const normalizeDietItem = (value: unknown): DietItem | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Record<string, unknown>;
  const time = asString(item.time);
  const meal = asString(item.meal);
  const description = asString(item.description);

  if (!time || !meal || !description) {
    return null;
  }

  return { time, meal, description };
};

const normalizeExerciseItem = (value: unknown): ExerciseItem | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Record<string, unknown>;
  const name = asString(item.name);
  const duration = asString(item.duration);
  const intensity = asString(item.intensity);

  if (!name || !duration || !intensity) {
    return null;
  }

  return { name, duration, intensity };
};

const normalizeMedicineItem = (value: unknown): MedicineItem | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Record<string, unknown>;
  const name = asString(item.name);
  const time = asString(item.time);
  const dosage = asString(item.dosage);

  if (!name || !time || !dosage) {
    return null;
  }

  return { name, time, dosage };
};

const extractJson = (raw: string): string => {
  const trimmed = raw.trim();
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

  if (withoutFence.startsWith("{") && withoutFence.endsWith("}")) {
    return withoutFence;
  }

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return withoutFence.slice(start, end + 1);
  }

  throw new Error("No JSON object found in AI response");
};

const normalizePlan = (data: unknown): Plan => {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  const diet = normalizeArray(obj.diet, normalizeDietItem);
  const exercise = normalizeArray(obj.exercise, normalizeExerciseItem);
  const medicine = normalizeArray(obj.medicine, normalizeMedicineItem);
  const hydration = asString(obj.hydration) ?? DEFAULT_HYDRATION;
  const motivation = asString(obj.motivation) ?? DEFAULT_MOTIVATION;

  return {
    diet,
    exercise,
    medicine,
    hydration,
    motivation,
  };
};

export const parsePlanResponse = (raw: string): Plan => {
  const jsonText = extractJson(raw);
  const data = JSON.parse(jsonText);
  return normalizePlan(data);
};
