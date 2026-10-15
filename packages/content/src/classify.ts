import type { Category } from './taxonomy';

/** Keywords used by the rule-based classifier. Matched against stemmed words. */
export const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  movement: ['walk', 'step', 'hike', 'commut', 'stroll', 'bike', 'cycl', 'stair', 'stretch', 'yoga', 'mobil', 'run', 'jog', 'swim', 'dance'],
  exercise: ['exercis', 'workout', 'gym', 'lift', 'weight', 'pushup', 'push', 'squat', 'plank', 'train', 'cardio', 'sport', 'pilat', 'crossfit', 'situp', 'pullup', 'climb', 'basketbal', 'footbal', 'soccer', 'tenni'],
  sleep: ['sleep', 'bed', 'bedtim', 'nap', 'wake', 'rest'],
  hydration: ['water', 'hydrat', 'drink', 'glass', 'bottl'],
  nutrition: ['eat', 'food', 'meal', 'veget', 'fruit', 'cook', 'breakfast', 'lunch', 'dinner', 'protein', 'snack', 'junk', 'sugar', 'soda', 'fast', 'diet', 'salad', 'candi', 'sweet', 'chocol', 'takeout', 'conveni'],
  health: ['medic', 'pill', 'vitamin', 'meds', 'medicin', 'insulin', 'physio', 'therapi', 'floss', 'teeth', 'brush', 'dentist', 'skincar', 'shower', 'hygien', 'smoke', 'cigarett', 'vape', 'alcohol', 'beer', 'wine', 'drunk'],
  mindfulness: ['medit', 'pray', 'prayer', 'mindful', 'breath', 'gratitud', 'journal', 'reflect', 'calm', 'devot', 'bibl', 'quran'],
  learning: ['read', 'studi', 'learn', 'book', 'cours', 'lesson', 'languag', 'duolingo', 'practic', 'review', 'flashcard', 'homework', 'lectur', 'research', 'podcast', 'piano', 'guitar', 'instrument'],
  craft: ['code', 'program', 'build', 'project', 'write', 'draw', 'paint', 'design', 'creat', 'craft', 'compos', 'music', 'art', 'sketch', 'blog', 'side', 'work', 'focus', 'deep'],
  chores: ['clean', 'tidi', 'dish', 'laundri', 'vacuum', 'chore', 'room', 'desk', 'organ', 'trash', 'garden', 'plant', 'bed', 'kitchen', 'declutt'],
  finance: ['budget', 'money', 'save', 'spend', 'expens', 'invest', 'bill', 'financ', 'impuls', 'purchas', 'shop', 'buy'],
  social: ['call', 'friend', 'famili', 'mom', 'dad', 'parent', 'text', 'social', 'volunt', 'visit', 'date', 'partner'],
  screen: ['scroll', 'doomscrol', 'phone', 'screen', 'social', 'tiktok', 'instagram', 'youtub', 'netflix', 'game', 'gaming', 'twitter', 'reddit', 'news'],
  other: [],
};

/** Words that signal an Avoid habit when they start the name. */
export const AVOID_PREFIXES = ['avoid', 'no', 'stop', 'quit', 'dont', "don't", 'never', 'less', 'skip', 'resist', 'limit', 'cut', 'reduce', 'without'];

/** Synonym groups used for duplicate detection: words in a group are treated as equal. */
export const SYNONYM_GROUPS: string[][] = [
  ['water', 'hydrat', 'drink', 'glass', 'bottl'],
  ['walk', 'stroll', 'step', 'hike'],
  ['run', 'jog'],
  ['read', 'book'],
  ['studi', 'learn', 'review', 'homework'],
  ['medit', 'mindful', 'breath'],
  ['exercis', 'workout', 'gym', 'train'],
  ['clean', 'tidi', 'declutt'],
  ['junk', 'snack', 'candi', 'sweet', 'sugar', 'chocol'],
  ['scroll', 'doomscrol', 'phone', 'screen', 'tiktok', 'instagram'],
  ['medic', 'meds', 'pill', 'medicin'],
  ['code', 'program'],
  ['sleep', 'bed', 'bedtim'],
];

/** Example phrasings per category; the server embeds these to classify by meaning. */
export const CATEGORY_EXEMPLARS: Record<Category, string[]> = {
  movement: ['walk home from work', 'take a 20 minute walk', 'go for a jog', 'hit 8000 steps', 'stretch for ten minutes'],
  exercise: ['go to the gym', 'do a strength workout', '30 push-ups', 'play basketball', 'lift weights'],
  sleep: ['sleep 8 hours', 'be in bed by 11pm', 'no screens before bed', 'wake up at 7'],
  hydration: ['drink water', 'drink 8 glasses of water', 'stay hydrated', 'refill my water bottle'],
  nutrition: ['eat vegetables', 'cook dinner at home', 'avoid junk food', 'no sugary drinks', 'eat a healthy breakfast'],
  health: ['take my medication', 'brush and floss', 'take vitamins', 'do physiotherapy exercises', 'no cigarettes'],
  mindfulness: ['meditate for 10 minutes', 'pray', 'write in my gratitude journal', 'breathing exercises'],
  learning: ['read 20 pages', 'study for 30 minutes', 'practice Spanish', 'do my online course', 'practice piano'],
  craft: ['work on my side project', 'code for an hour', 'write 500 words', 'draw a sketch', 'deep work session'],
  chores: ['clean my desk', 'do the dishes', 'do laundry', 'tidy my room', 'water the plants'],
  finance: ['track my spending', 'no impulse purchases', 'review my budget', 'save money'],
  social: ['call my family', 'message a friend', 'spend time with my partner', 'volunteer'],
  screen: ['avoid late night doomscrolling', 'limit social media to 30 minutes', 'no phone in the morning', 'no gaming on weeknights'],
  other: ['do something good today'],
};

/** Neutral starting points. Tapping one only fills the name; the player chooses everything else. */
export const HABIT_IDEAS: string[] = [
  'Exercise',
  'Go for a walk',
  'Stretch',
  'Read',
  'Study',
  'Practice a skill',
  'Meditate',
  'Write in a journal',
  'Drink water',
  'Cook a meal',
  'Tidy up',
  'Go to bed on time',
  'Limit screen time',
  'Plan tomorrow',
];
