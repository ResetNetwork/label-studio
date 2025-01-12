export const getEmoji = (weeklyAnnotationCount, totalTasks = 0, finishedTasks = 0) => {
  const TARGET_WEEKLY = 70; // Target number of weekly annotations
  
  // Special cases
  if (totalTasks === 0) return '😐'; // Empty project
  if (totalTasks === finishedTasks) return '🎉'; // All tasks completed
  
  // Weekly annotation count cases
  if (weeklyAnnotationCount === undefined) return '';
  if (weeklyAnnotationCount === 0) return '😴';
  
  // Calculate percentage of target
  const percentage = (weeklyAnnotationCount / TARGET_WEEKLY) * 100;
  
  if (percentage < 35) return '🥱';      // Less than 35% of target
  if (percentage < 70) return '😊';      // Less than 70% of target
  if (percentage < 100) return '😃';     // Less than 100% of target
  if (percentage < 150) return '🤗';     // Less than 150% of target
  return '🚀';                           // 150% or more of target
}; 