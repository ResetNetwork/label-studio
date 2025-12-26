import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { Tooltip } from "@humansignal/ui";
import { useAPI } from '../../providers/ApiProvider';
import { formatDuration } from '../../utils/format';
import { cn } from '../../utils/bem';
import './UserStatsCard.scss';

const getMetricEmoji = (key, value) => {
  switch (key) {
    case 'annotations_today':
      if (value === 0) return '😴';
      if (value < 10) return '🌱';
      if (value < 30) return '⭐';
      if (value < 50) return '🔥';
      return '🚀';
    case 'annotations_week':
      if (value === 0) return '💤';
      if (value < 10) return '🌱';
      if (value < 50) return '🌿';
      if (value < 100) return '✨';
      if (value < 200) return '💫';
      return '🌟';
    case 'annotations_quarter':
      if (value === 0) return '🌑';
      if (value < 250) return '🌒';
      if (value < 500) return '🌓';
      if (value < 1000) return '🌔';
      return '🌕';
    case 'avg_annotation_time':
      // Lower is better for annotation time
      if (value < 30) return '⚡';
      if (value < 60) return '🏃';
      if (value < 120) return '👣';
      if (value < 240) return '🐢';
      return '🎯';
    case 'regularity':
      if (value === 0) return '🌪️';
      if (value < 30) return '🌧️';
      if (value < 60) return '⛅';
      if (value < 90) return '🌤️';
      return '☀️';
    case 'projects_contributed':
      if (value === 0) return '🌱';
      if (value === 1) return '🌿';
      if (value < 3) return '🎨';
      if (value < 5) return '🎪';
      return '🎯';
    case 'total_time_week':
      if (value === 0) return '⏰';
      if (value < 2) return '⌚';
      if (value < 5) return '⏱️';
      if (value < 10) return '🕰️';
      return '⚡';
    default:
      return '';
  }
};

const MetricItem = ({ label, value, tooltip, metricKey }) => (
  <div className={cn("user-stats").elem("metric").toClassName()} role="listitem">
    <Tooltip title={tooltip}>
      <div className={cn("user-stats").elem("metric-content").toClassName()}>
        <div className={cn("user-stats").elem("value").toClassName()} aria-label={`${value} ${label}`}>
          {value} {getMetricEmoji(metricKey, typeof value === 'string' ? parseFloat(value) : value)}
        </div>
        <div className={cn("user-stats").elem("label").toClassName()}>{label}</div>
      </div>
    </Tooltip>
  </div>
);

export const UserStatsCard = () => {
  const { callApi } = useAPI();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await callApi('userMetrics', {
        handleError: false,
      });

      // Validate response exists
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format from server');
      }

      // Check for required fields
      const requiredFields = [
        'annotations_today',
        'annotations_week',
        'annotations_quarter',
        'avg_annotation_time',
        'regularity',
        'projects_contributed',
        'total_time_week'
      ];
      
      const missingFields = requiredFields.filter(field => !(field in response));
      if (missingFields.length > 0) {
        throw new Error(`Missing required metrics: ${missingFields.join(', ')}`);
      }

      setMetrics(response);
    } catch (err) {
      setError(err.message || 'Failed to load metrics');
      
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchMetrics();
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatMetricValue = (key, value) => {
    if (value === undefined || value === null) return '0';

    switch (key) {
      case 'avg_annotation_time':
        return formatDuration(value);
      case 'regularity':
        return `${Math.round(value)}%`;
      case 'total_time_week':
        return `${parseFloat(value).toFixed(1)}h`;
      default:
        return parseInt(value).toLocaleString();
    }
  };

  const getMetricTooltip = (key) => {
    const tooltips = {
      annotations_today: 'Number of annotations you created today',
      annotations_week: 'Number of annotations you created in the last 7 days',
      annotations_quarter: 'Number of annotations you created in the last 90 days',
      total_time_week: 'Total time spent annotating this week',
      avg_annotation_time: 'Average time spent per annotation (excluding top/bottom 10%)',
      regularity: 'Percentage of the last 10 days where you created 3 or more annotations',
      projects_contributed: 'Number of different projects you have contributed to',
    };
    return tooltips[key] || '';
  };

  const getMetricLabel = (key) => {
    const labels = {
      annotations_today: 'Today',
      annotations_week: 'This Week',
      annotations_quarter: 'This Quarter',
      total_time_week: 'Hours This Week',
      avg_annotation_time: 'Avg Time',
      regularity: 'Regularity',
      projects_contributed: 'Projects',
    };
    return labels[key] || key;
  };

  if (error) {
    return (
      <div className={cn("user-stats").mod({ error: true }).toClassName()}>
        <div className={cn("user-stats").elem("error").toClassName()}>
          <div className={cn("user-stats").elem("error-title").toClassName()}>Error loading metrics</div>
          <div className={cn("user-stats").elem("error-message").toClassName()}>{error}</div>
          <button
            className={cn("user-stats").elem("error-action").toClassName()}
            onClick={fetchMetrics}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("user-stats").mod({ loading }).toClassName()}>
      <div className={cn("user-stats").elem("header").toClassName()}>
        <div className={cn("user-stats").elem("title").toClassName()}>Annotation Stats</div>
      </div>

      {loading ? (
        <div className={cn("user-stats").elem("loading").toClassName()} role="status" aria-label="Loading metrics">
          <Spin size="large" />
        </div>
      ) : (
        <div className={cn("user-stats").elem("content").toClassName()} role="list">
          {metrics && Object.entries(metrics).map(([key, value]) => (
            <MetricItem
              key={key}
              label={getMetricLabel(key)}
              value={formatMetricValue(key, value)}
              tooltip={getMetricTooltip(key)}
              metricKey={key}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default UserStatsCard; 
