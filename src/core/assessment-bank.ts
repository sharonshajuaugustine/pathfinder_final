import type { AssessmentItem } from "@/types/assessment";

// 10 general interest-discovery questions.
// Choices describe values, activities, and feelings — never field names or careers.
// The signal system maps each choice to interest clusters behind the scenes.
//
// Server-only. GET /api/assessment strips signals before sending to the client.
export const ASSESSMENT_ITEMS: AssessmentItem[] = [

  {
    id: "int_01",
    dimension: "personality",
    questionText: "After a long school day, which would help you relax AND feel productive?",
    choices: [
      {
        id: "a",
        text: "Helping a neighbour or family member with something they're struggling with",
        signals: [
          { interest: "helping_teaching", interestValue: 0.7 },
          { interest: "health_medicine", interestValue: 0.4 },
          { trait: "social", traitValue: 0.8 },
        ],
      },
      {
        id: "b",
        text: "Tinkering with a gadget, app, or something broken that needs fixing",
        signals: [
          { interest: "technology_coding", interestValue: 0.7 },
          { interest: "building_engineering", interestValue: 0.5 },
          { trait: "analytical", traitValue: 0.6 },
          { trait: "practical", traitValue: 0.5 },
        ],
      },
      {
        id: "c",
        text: "Drawing, writing, cooking, or making something creative",
        signals: [
          { interest: "design_visual", interestValue: 0.7 },
          { interest: "media_communication", interestValue: 0.5 },
          { riasec: "artistic", riasecValue: 0.8 },
        ],
      },
      {
        id: "d",
        text: "Reading about how the world works — science, money, news, or nature",
        signals: [
          { interest: "science_research", interestValue: 0.5 },
          { interest: "business_money", interestValue: 0.4 },
          { interest: "nature_agriculture", interestValue: 0.3 },
          { trait: "analytical", traitValue: 0.6 },
        ],
      },
    ],
  },

  {
    id: "int_02",
    dimension: "personality",
    questionText: "A close friend needs help urgently. In which situation do you feel most useful?",
    choices: [
      {
        id: "a",
        text: "They're unwell — you take care of them and try to figure out what's wrong",
        signals: [
          { interest: "health_medicine", interestValue: 0.9 },
          { trait: "social", traitValue: 0.7 },
        ],
      },
      {
        id: "b",
        text: "Their device is broken and they need it working by tomorrow",
        signals: [
          { interest: "technology_coding", interestValue: 0.8 },
          { interest: "building_engineering", interestValue: 0.4 },
          { trait: "analytical", traitValue: 0.7 },
        ],
      },
      {
        id: "c",
        text: "They're stressed and need someone to listen, guide, and help them think clearly",
        signals: [
          { interest: "helping_teaching", interestValue: 0.8 },
          { interest: "law_justice", interestValue: 0.4 },
          { trait: "social", traitValue: 0.9 },
        ],
      },
      {
        id: "d",
        text: "They need an event organised — budget, tasks, and people managed",
        signals: [
          { interest: "business_money", interestValue: 0.8 },
          { trait: "structured", traitValue: 0.7 },
          { riasec: "enterprising", riasecValue: 0.7 },
        ],
      },
    ],
  },

  {
    id: "int_03",
    dimension: "personality",
    questionText: "You have ₹10,000 to spend on learning something new. What do you choose?",
    choices: [
      {
        id: "a",
        text: "A first-aid, nutrition, or healthcare short course",
        signals: [
          { interest: "health_medicine", interestValue: 0.9 },
          { interest: "science_research", interestValue: 0.3 },
        ],
      },
      {
        id: "b",
        text: "A coding, digital skills, or electronics workshop",
        signals: [
          { interest: "technology_coding", interestValue: 0.9 },
          { trait: "analytical", traitValue: 0.5 },
        ],
      },
      {
        id: "c",
        text: "An art, photography, music, or creative writing class",
        signals: [
          { interest: "design_visual", interestValue: 0.8 },
          { interest: "media_communication", interestValue: 0.5 },
          { riasec: "artistic", riasecValue: 0.8 },
        ],
      },
      {
        id: "d",
        text: "A business, investing, or public speaking course",
        signals: [
          { interest: "business_money", interestValue: 0.8 },
          { interest: "numbers_analysis", interestValue: 0.4 },
          { riasec: "enterprising", riasecValue: 0.7 },
        ],
      },
    ],
  },

  {
    id: "int_04",
    dimension: "personality",
    questionText: "Which kind of mistake bothers you the most when you make it?",
    choices: [
      {
        id: "a",
        text: "A mistake that hurt someone's feelings or made their situation worse",
        signals: [
          { trait: "social", traitValue: 0.9 },
          { interest: "helping_teaching", interestValue: 0.6 },
          { interest: "health_medicine", interestValue: 0.4 },
        ],
      },
      {
        id: "b",
        text: "A mistake that broke a system or process others were depending on",
        signals: [
          { interest: "technology_coding", interestValue: 0.5 },
          { interest: "building_engineering", interestValue: 0.5 },
          { trait: "analytical", traitValue: 0.7 },
          { trait: "structured", traitValue: 0.6 },
        ],
      },
      {
        id: "c",
        text: "A mistake that missed a good opportunity to earn or grow",
        signals: [
          { interest: "business_money", interestValue: 0.8 },
          { trait: "risk_taking", traitValue: 0.6 },
          { riasec: "enterprising", riasecValue: 0.7 },
        ],
      },
      {
        id: "d",
        text: "A mistake that made something look, sound, or feel wrong or ugly",
        signals: [
          { interest: "design_visual", interestValue: 0.8 },
          { interest: "media_communication", interestValue: 0.5 },
          { riasec: "artistic", riasecValue: 0.7 },
        ],
      },
    ],
  },

  {
    id: "int_05",
    dimension: "personality",
    questionText: "Which type of school day would you enjoy the most?",
    choices: [
      {
        id: "a",
        text: "Doing a lab experiment or studying how the human body works",
        signals: [
          { interest: "science_research", interestValue: 0.7 },
          { interest: "health_medicine", interestValue: 0.6 },
          { trait: "analytical", traitValue: 0.6 },
          { riasec: "investigative", riasecValue: 0.7 },
        ],
      },
      {
        id: "b",
        text: "Building or assembling something in a workshop or computer lab",
        signals: [
          { interest: "building_engineering", interestValue: 0.7 },
          { interest: "technology_coding", interestValue: 0.6 },
          { trait: "practical", traitValue: 0.7 },
        ],
      },
      {
        id: "c",
        text: "Debating, performing, or presenting in front of the class",
        signals: [
          { interest: "law_justice", interestValue: 0.5 },
          { interest: "media_communication", interestValue: 0.6 },
          { trait: "social", traitValue: 0.7 },
          { riasec: "enterprising", riasecValue: 0.6 },
        ],
      },
      {
        id: "d",
        text: "Organising a school event, fundraiser, or team activity",
        signals: [
          { interest: "business_money", interestValue: 0.6 },
          { interest: "helping_teaching", interestValue: 0.5 },
          { trait: "social", traitValue: 0.6 },
          { riasec: "enterprising", riasecValue: 0.7 },
        ],
      },
    ],
  },

  {
    id: "int_06",
    dimension: "personality",
    questionText: "Which person's real-life story would you most enjoy reading about?",
    choices: [
      {
        id: "a",
        text: "Someone who saved hundreds of lives working in difficult conditions",
        signals: [
          { interest: "health_medicine", interestValue: 0.8 },
          { interest: "defence_adventure", interestValue: 0.3 },
          { trait: "social", traitValue: 0.7 },
        ],
      },
      {
        id: "b",
        text: "A scientist whose discovery completely changed how we understand the world",
        signals: [
          { interest: "science_research", interestValue: 0.9 },
          { trait: "analytical", traitValue: 0.7 },
          { riasec: "investigative", riasecValue: 0.8 },
        ],
      },
      {
        id: "c",
        text: "An artist, filmmaker, or writer whose work moved millions of people",
        signals: [
          { interest: "media_communication", interestValue: 0.7 },
          { interest: "design_visual", interestValue: 0.7 },
          { riasec: "artistic", riasecValue: 0.8 },
        ],
      },
      {
        id: "d",
        text: "Someone who built a company from nothing and created thousands of jobs",
        signals: [
          { interest: "business_money", interestValue: 0.9 },
          { trait: "risk_taking", traitValue: 0.8 },
          { riasec: "enterprising", riasecValue: 0.8 },
        ],
      },
    ],
  },

  {
    id: "int_07",
    dimension: "personality",
    questionText: "What does your ideal workplace look and feel like?",
    choices: [
      {
        id: "a",
        text: "A place where people come to you for care, advice, or support",
        signals: [
          { interest: "health_medicine", interestValue: 0.6 },
          { interest: "helping_teaching", interestValue: 0.6 },
          { trait: "social", traitValue: 0.8 },
        ],
      },
      {
        id: "b",
        text: "A screen, tools, and a quiet space to build or solve something",
        signals: [
          { interest: "technology_coding", interestValue: 0.7 },
          { interest: "building_engineering", interestValue: 0.5 },
          { trait: "analytical", traitValue: 0.6 },
        ],
      },
      {
        id: "c",
        text: "A creative studio with cameras, canvases, or design tools around you",
        signals: [
          { interest: "design_visual", interestValue: 0.8 },
          { interest: "media_communication", interestValue: 0.6 },
          { riasec: "artistic", riasecValue: 0.8 },
        ],
      },
      {
        id: "d",
        text: "Outdoors or on the move — nature, construction sites, or the field",
        signals: [
          { interest: "nature_agriculture", interestValue: 0.7 },
          { interest: "defence_adventure", interestValue: 0.5 },
          { interest: "building_engineering", interestValue: 0.4 },
          { trait: "practical", traitValue: 0.7 },
        ],
      },
    ],
  },

  {
    id: "int_08",
    dimension: "personality",
    questionText: "If you volunteered for a community project, which would feel most meaningful?",
    choices: [
      {
        id: "a",
        text: "Teaching children in an underserved school or tutoring for free",
        signals: [
          { interest: "helping_teaching", interestValue: 0.9 },
          { trait: "social", traitValue: 0.8 },
        ],
      },
      {
        id: "b",
        text: "Setting up a computer lab or fixing digital tools for a local NGO",
        signals: [
          { interest: "technology_coding", interestValue: 0.8 },
          { interest: "helping_teaching", interestValue: 0.3 },
        ],
      },
      {
        id: "c",
        text: "Creating posters, videos, or a campaign to raise awareness",
        signals: [
          { interest: "design_visual", interestValue: 0.6 },
          { interest: "media_communication", interestValue: 0.7 },
          { riasec: "artistic", riasecValue: 0.6 },
        ],
      },
      {
        id: "d",
        text: "Planting trees, cleaning rivers, or protecting animals in the wild",
        signals: [
          { interest: "nature_agriculture", interestValue: 0.9 },
          { trait: "practical", traitValue: 0.5 },
        ],
      },
    ],
  },

  {
    id: "int_09",
    dimension: "personality",
    questionText: "You finish a big task and feel genuinely proud. Which scenario is it?",
    choices: [
      {
        id: "a",
        text: "Someone is healthier, safer, or happier directly because of what you did",
        signals: [
          { interest: "health_medicine", interestValue: 0.7 },
          { interest: "helping_teaching", interestValue: 0.6 },
          { trait: "social", traitValue: 0.8 },
        ],
      },
      {
        id: "b",
        text: "A product, tool, or system you built is now being used by real people",
        signals: [
          { interest: "technology_coding", interestValue: 0.8 },
          { interest: "building_engineering", interestValue: 0.5 },
          { trait: "analytical", traitValue: 0.5 },
        ],
      },
      {
        id: "c",
        text: "Something you created — a design, story, or video — got people talking",
        signals: [
          { interest: "media_communication", interestValue: 0.7 },
          { interest: "design_visual", interestValue: 0.7 },
          { riasec: "artistic", riasecValue: 0.7 },
        ],
      },
      {
        id: "d",
        text: "A case was won, a wrong was corrected, or justice was served",
        signals: [
          { interest: "law_justice", interestValue: 0.9 },
          { trait: "analytical", traitValue: 0.6 },
          { riasec: "enterprising", riasecValue: 0.5 },
        ],
      },
    ],
  },

  {
    id: "int_10",
    dimension: "personality",
    questionText: "Which statement sounds most like the real you?",
    choices: [
      {
        id: "a",
        text: "I feel happiest when I directly help someone and can see they're better for it",
        signals: [
          { interest: "helping_teaching", interestValue: 0.7 },
          { interest: "health_medicine", interestValue: 0.6 },
          { trait: "social", traitValue: 0.9 },
        ],
      },
      {
        id: "b",
        text: "I feel happiest when I figure out how something works or build something that functions",
        signals: [
          { interest: "science_research", interestValue: 0.5 },
          { interest: "technology_coding", interestValue: 0.6 },
          { interest: "building_engineering", interestValue: 0.5 },
          { trait: "analytical", traitValue: 0.8 },
          { riasec: "investigative", riasecValue: 0.7 },
        ],
      },
      {
        id: "c",
        text: "I feel happiest when I create something that people enjoy, admire, or are moved by",
        signals: [
          { interest: "design_visual", interestValue: 0.7 },
          { interest: "media_communication", interestValue: 0.7 },
          { riasec: "artistic", riasecValue: 0.9 },
        ],
      },
      {
        id: "d",
        text: "I feel happiest when I take charge, make things happen, and see real results",
        signals: [
          { interest: "business_money", interestValue: 0.7 },
          { interest: "defence_adventure", interestValue: 0.4 },
          { trait: "risk_taking", traitValue: 0.8 },
          { riasec: "enterprising", riasecValue: 0.8 },
        ],
      },
    ],
  },

];
