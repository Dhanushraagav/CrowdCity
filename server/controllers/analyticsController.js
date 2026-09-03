import { getTamilNaduCivicIntelligence } from '../services/analyticsService.js';
import logger from '../config/logger.js';

/**
 * Controller for Tamil Nadu 38-District Civic Intelligence
 */
export const getTamilNaduAnalytics = async (req, res) => {
  try {
    const { district, date_range, category, status, priority, department, start_date, end_date } = req.query;

    const analyticsData = await getTamilNaduCivicIntelligence({
      district: district || 'all',
      date_range: date_range || 'all_time',
      category: category || 'all',
      status: status || 'all',
      priority: priority || 'all',
      department: department || 'all',
      start_date,
      end_date
    });

    return res.status(200).json({
      success: true,
      data: analyticsData
    });
  } catch (err) {
    logger.error('Failed to generate Tamil Nadu Civic Intelligence: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve civic intelligence analytics',
      details: err.message
    });
  }
};

/**
 * Controller for single district deep dive
 */
export const getDistrictAnalytics = async (req, res) => {
  try {
    const { districtId } = req.params;
    const { date_range, category, status, priority, department, start_date, end_date } = req.query;

    const analyticsData = await getTamilNaduCivicIntelligence({
      district: districtId,
      date_range: date_range || 'all_time',
      category: category || 'all',
      status: status || 'all',
      priority: priority || 'all',
      department: department || 'all',
      start_date,
      end_date
    });

    return res.status(200).json({
      success: true,
      data: analyticsData
    });
  } catch (err) {
    logger.error(`Failed to generate analytics for district ${req.params.districtId}: %O`, err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve district analytics',
      details: err.message
    });
  }
};
