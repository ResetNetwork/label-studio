export const getEmoji = (weeklyAnnotationCount, totalTasks = 0, finishedTasks = 0) => {
  // Special cases
  if (totalTasks === 0) return '😐'; // Empty project
  if (totalTasks === finishedTasks) return '🎉'; // All tasks completed
  
  // Weekly annotation count cases
  if (weeklyAnnotationCount === undefined) return '';
  if (weeklyAnnotationCount === 0) return '😴';
  if (weeklyAnnotationCount < 25) return '🥱';
  if (weeklyAnnotationCount < 50) return '😊';
  if (weeklyAnnotationCount < 75) return '😃';
  if (weeklyAnnotationCount < 100) return '🤗';
  return '🚀';
}; 