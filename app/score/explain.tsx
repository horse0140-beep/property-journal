import { Screen } from "@/components/Screen";
import { ScoreCalculationExplainer } from "@/components/ScoreCalculationExplainer";
import { Header } from "@/components/Header";

export default function ScoreExplainScreen() {
  return (
    <Screen>
      <Header title="Score Calculation" />
      <ScoreCalculationExplainer />
    </Screen>
  );
}
