/**
 * officeController.js
 * 
 * Express controller for Government Offices & E-Sevai endpoints.
 */

import * as officeService from '../services/officeService.js';
import logger from '../config/logger.js';

export async function getOffices(req, res) {
  try {
    const { district, taluk, type, search, lat, lng, radiusKm, page, limit } = req.query;

    const result = await officeService.getGovernmentOffices({
      district,
      taluk,
      type,
      search,
      lat,
      lng,
      radiusKm,
      page,
      limit
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error(`[officeController:getOffices] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve government offices.',
      message: error.message
    });
  }
}

export async function getOfficeById(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Office ID is required.' });
    }

    const office = await officeService.getOfficeById(id);
    if (!office) {
      return res.status(404).json({ success: false, error: 'Government office not found.' });
    }

    return res.status(200).json({
      success: true,
      data: office
    });
  } catch (error) {
    logger.error(`[officeController:getOfficeById] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve government office.',
      message: error.message
    });
  }
}

export async function getDistricts(req, res) {
  try {
    const result = await officeService.getDistrictsAndTaluks();
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`[officeController:getDistricts] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve districts.',
      message: error.message
    });
  }
}
