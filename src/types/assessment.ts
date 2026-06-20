import type { Aptitude, PersonalityTrait, InterestCluster, Riasec } from "./profile";

export type AssessmentDimension = Aptitude | "personality";

// Signals attached to each MCQ choice. Aptitude questions use `score`; personality
// questions use the behavioral fields. A single choice may carry multiple signals.
export interface ChoiceSignal {
  score?: 0 | 100;               // aptitude items only: correct=100, wrong=0
  trait?: PersonalityTrait;      // personality/work-pref items
  traitValue?: number;           // -1..1
  interest?: InterestCluster;    // personality items that also reveal interests
  interestValue?: number;        // 0..1
  riasec?: Riasec;               // RIASEC alignment signal
  riasecValue?: number;          // 0..1
}

export interface AssessmentChoice {
  id: string;                    // 'a' | 'b' | 'c' | 'd'
  text: string;
  signals: ChoiceSignal[];
}

export interface AssessmentItem {
  id: string;
  dimension: AssessmentDimension;
  questionText: string;
  choices: AssessmentChoice[];
  tags?: InterestCluster[]; // interest clusters this question is most relevant for
}

// Safe subset sent to the client — no scores or signals exposed.
export interface AssessmentItemPublic {
  id: string;
  dimension: AssessmentDimension;
  questionText: string;
  choices: Array<{ id: string; text: string }>;
}
