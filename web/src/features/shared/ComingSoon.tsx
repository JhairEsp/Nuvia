import { Sparkles } from "lucide-react";
import { EmptyState } from "../../components/ui/empty-state";

export default function ComingSoon({
  title,
  description,
  phase = "En roadmap",
}: {
  title: string;
  description: string;
  phase?: string;
}) {
  return (
    <EmptyState
      icon={Sparkles}
      phase={phase}
      title={title}
      description={description}
    />
  );
}
