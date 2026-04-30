import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function OnboardingStepHeader({
  step,
  total = 4,
}: {
  step: number;
  total?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Шаг {step} из {total}</Badge>
      </div>

      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, idx) => idx + 1).map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 w-6 rounded-full transition-all",
              step === i
                ? "bg-[color:var(--btn-primary-main,#E58B21)]"
                : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}
