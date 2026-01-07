type Query = {
    _filters: Array<{ col: string; op: string; value: any }>;
    _order?: { col: string; ascending: boolean };
    _limit?: number;
  
    select: (cols: string) => Query;
    eq: (col: string, value: any) => Query;
    order: (col: string, opts: { ascending: boolean }) => Query;
    limit: (n: number) => Query;
    maybeSingle: () => Promise<{ data: any | null; error: { message: string } | null }>;
  };
  
  function makeQuery(table: string): Query {
    const q: Query = {
      _filters: [],
  
      select() {
        return q;
      },
      eq(col, value) {
        q._filters.push({ col, op: "eq", value });
        return q;
      },
      order(col, opts) {
        q._order = { col, ascending: opts.ascending };
        return q;
      },
      limit(n) {
        q._limit = n;
        return q;
      },
      async maybeSingle() {
        // Примитивная логика: если entity_id == "no-insight" -> null
        const entityId = q._filters.find((f) => f.col === "entity_id")?.value;
  
        if (entityId === "error") {
          return { data: null, error: { message: "Mock supabase error" } };
        }
  
        if (entityId === "no-insight") {
          return { data: null, error: null };
        }
  
        return {
          data: {
            id: "mock-insight-id",
            summary: "Норм тренировка: темп ровный, нагрузка умеренная.",
            content_md:
              "## Кратко\nХорошая аэробная работа.\n\n## Что хорошо\n- Ровный пульс\n- Темп без дерготни\n\n## Риски / что улучшить\n- Добавь заминку 10 минут\n\n## Следующая тренировка\nЛёгкая Z2 40–50 минут.",
            title: "AI-анализ тренировки",
            created_at: new Date().toISOString(),
          },
          error: null,
        };
      },
    };
  
    return q;
  }
  
  export const supabase = {
    from(table: string) {
      // Сейчас нужен только ai_insights
      return makeQuery(table);
    },
  };