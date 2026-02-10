import OpenAI from "openai";
import { PlannerOut } from "./types";
import { pickRecentHistory } from "./utils";
import { CoachContext } from "./context";

export async function runResponder(args: {
  openai: OpenAI;
  userText: string;
  planner: PlannerOut;
  recentHistory: { type: string; body: string; created_at: string }[];
  context: CoachContext;
}) {
  const { openai, userText, planner, recentHistory, context } = args;
  const threadMemory = context.memory ?? {};
  const workouts = context.workouts ?? [];
  const coachHome = context.coachHome ?? null;

  const responderSystem = [
    "Ты — дружелюбный и мотивирующий персональный тренер для любителя.",
    "Пиши по-русски, тепло и поддерживающе, но без воды.",
    "",
    "КЛЮЧЕВОЕ:",
    "— СНАЧАЛА дай прямой ответ на вопрос пользователя (самое нужное).",
    "— Затем (если уместно) добавь 1–3 конкретных совета или план.",
    "— Заканчивай ОДНИМ уточняющим вопросом, только если это реально нужно.",
    "",
    "ОГРАНИЧЕНИЯ ТОЧНОСТИ:",
    "— Факты о тренировках бери ТОЛЬКО из WORKOUTS_FACTS.",
    "— Если поле отсутствует — пиши «нет данных».",
    "— НИКОГДА не выдумывай: длительность доступного времени ('завтра 30 минут'), травмы, погоду, экипировку, если пользователь это явно не сказал.",
    "",
    "АНТИ-ПОПУГАЙ:",
    "— Не повторяй одни и те же 1–2 тренировки в каждом ответе.",
    "— Не начинай каждый ответ с анализа прошлого, если вопрос про другое.",
    "— Если пользователь спрашивает 'темп последней тренировки' и есть дистанция+время — посчитай темп (мин/км).",
    "— 'предпоследняя тренировка' = workouts[1] (если массив отсортирован по дате по убыванию).",
    "— Если пользователь просит рекомендации по последней тренировке — сначала коротко оцени, затем 2–3 рекомендации. Не задавай тупые уточнения.",
    "",
    "Безопасность:",
    "— При боли/травме: не мотивируй «терпи и беги». Дай осторожные шаги, и красные флаги.",
  ].join("\n");

  const plannerBlock = `PLANNER_JSON:\n${JSON.stringify(planner, null, 2)}`;
  const memoryBlock = `THREAD_MEMORY_JSON:\n${JSON.stringify(threadMemory ?? {}, null, 2)}`;
  const factsBlock = `WORKOUTS_FACTS_JSON:\n${JSON.stringify(
    { window_days: planner.needs.workouts_window_days, workouts },
    null,
    2
  )}`;
  const coachHomeBlock = `COACH_HOME_JSON:\n${JSON.stringify(coachHome ?? null, null, 2)}`;

  const convo = pickRecentHistory(recentHistory, 14).map((m) => {
    if (m.type === "user") return { role: "user" as const, content: m.body };
    if (m.type === "coach") return { role: "assistant" as const, content: m.body };
    return { role: "system" as const, content: m.body };
  });
  convo.push({ role: "user", content: userText });

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.4,
    max_tokens: 950,
    messages: [
      { role: "system", content: responderSystem },
      { role: "system", content: plannerBlock },
      { role: "system", content: memoryBlock },
      { role: "system", content: factsBlock },
      { role: "system", content: coachHomeBlock },
      ...convo,
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "Извини, не получилось сформировать ответ. Попробуй ещё раз.";
}