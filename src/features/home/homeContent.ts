export const WEEKLY_LEARNING_QUOTES = [
  { text: 'Education is the most powerful weapon which you can use to change the world.', author: 'Nelson Mandela' },
  { text: 'The beautiful thing about learning is nobody can take it away from you.', author: 'B.B. King' },
  { text: 'Live as if you were to die tomorrow. Learn as if you were to live forever.', author: 'Mahatma Gandhi' },
  { text: 'Wisdom is not a product of schooling but of the lifelong attempt to acquire it.', author: 'Albert Einstein' },
  { text: 'I am always ready to learn although I do not always like being taught.', author: 'Winston Churchill' },
  { text: 'Develop a passion for learning. If you do, you will never cease to grow.', author: "Anthony J. D'Angelo" },
  { text: 'You do not understand anything until you learn it more than one way.', author: 'Marvin Minsky' },
  { text: 'Change is the end result of all true learning.', author: 'Leo Buscaglia' },
  { text: 'Anyone who stops learning is old, whether at twenty or eighty. Anyone who keeps learning stays young.', author: 'Henry Ford' },
  { text: 'Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.', author: 'Richard Feynman' },
  { text: 'I am still learning.', author: 'Michelangelo' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'Education is the passport to the future, for tomorrow belongs to those who prepare for it today.', author: 'Malcolm X' },
  { text: 'Leadership and learning are indispensable to each other.', author: 'John F. Kennedy' },
  { text: 'The more that you read, the more things you will know. The more that you learn, the more places you will go.', author: 'Dr. Seuss' },
  { text: 'Learning is not attained by chance. It must be sought for with ardour and attended with diligence.', author: 'Abigail Adams' },
  { text: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
  { text: 'The purpose of education is to replace an empty mind with an open one.', author: 'Malcolm Forbes' },
  { text: 'What we learn with pleasure we never forget.', author: 'Alfred Mercier' },
  { text: 'Never let formal education get in the way of your learning.', author: 'Mark Twain' },
  { text: 'Learning is not the product of teaching. Learning is the product of the activity of learners.', author: 'John Holt' },
  { text: 'While we teach, we learn.', author: 'Seneca' },
  { text: 'For the things we have to learn before we can do them, we learn by doing them.', author: 'Aristotle' },
  { text: 'One child, one teacher, one book, one pen can change the world.', author: 'Malala Yousafzai' },
  { text: 'Once you learn to read, you will be forever free.', author: 'Frederick Douglass' },
  { text: 'Real knowledge is to know the extent of one’s ignorance.', author: 'Confucius' },
  { text: 'Knowing others is intelligence; knowing yourself is true wisdom.', author: 'Lao Tzu' },
  { text: 'Curiosity is the engine of achievement.', author: 'Sir Ken Robinson' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Learning never exhausts the mind.', author: 'Leonardo da Vinci' },
  { text: 'Education is not preparation for life; education is life itself.', author: 'John Dewey' },
  { text: 'When you know better, you do better.', author: 'Maya Angelou' },
  { text: 'Learning is a treasure that will follow its owner everywhere.', author: 'Chinese proverb' },
];

export function getWeeklyLearningQuote(now = new Date()) {
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const daysSinceYearStart = Math.floor((now.getTime() - yearStart.getTime()) / 86400000);
  const weekNumber = Math.floor((daysSinceYearStart + yearStart.getDay()) / 7);
  const stableWeeklyIndex = Math.abs((now.getFullYear() * 53 + weekNumber) * 17) % WEEKLY_LEARNING_QUOTES.length;
  return WEEKLY_LEARNING_QUOTES[stableWeeklyIndex];
}
