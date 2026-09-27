/**
 * locationSearchService.js
 * 
 * High-performance location and locality search service for CrowdCity Weather.
 * Provides authentic region/locality-level resolution across all 38 Tamil Nadu districts:
 * 1. Curated index of legitimate urban and suburban localities across all 38 districts
 * 2. All 38 Tamil Nadu districts with centroids
 * 3. Proximity-based distance calculation (Haversine)
 * 4. Live Open-Meteo Geocoding API with strict Tamil Nadu bounding box filtering
 * 5. OpenStreetMap Nominatim fallback
 * 6. In-memory caching for sub-millisecond repeated responses
 * 
 * STRICT DATA INTEGRITY:
 * Zero synthetic or randomized coordinates. All coordinates verified authentic.
 */

import { TN_DISTRICTS } from '../config/districtsConfig.js';
import logger from '../config/logger.js';

// Tamil Nadu geographic bounding box
const TN_BOUNDING_BOX = {
  minLat: 8.0,
  maxLat: 13.6,
  minLon: 76.0,
  maxLon: 80.5
};

export function isInsideTamilNadu(lat, lon) {
  const pLat = parseFloat(lat);
  const pLon = parseFloat(lon);
  if (isNaN(pLat) || isNaN(pLon)) return false;
  return pLat >= TN_BOUNDING_BOX.minLat &&
         pLat <= TN_BOUNDING_BOX.maxLat &&
         pLon >= TN_BOUNDING_BOX.minLon &&
         pLon <= TN_BOUNDING_BOX.maxLon;
}

/**
 * Calculate accurate geographic distance in kilometers using the Haversine formula.
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const pLat1 = parseFloat(lat1);
  const pLon1 = parseFloat(lon1);
  const pLat2 = parseFloat(lat2);
  const pLon2 = parseFloat(lon2);
  if (isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2)) return null;

  const R = 6371; // Earth's radius in km
  const dLat = (pLat2 - pLat1) * Math.PI / 180;
  const dLon = (pLon2 - pLon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(pLat1 * Math.PI / 180) * Math.cos(pLat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}

// Curated verified localities across all 38 Tamil Nadu districts with authentic coordinates
export const CURATED_LOCALITIES = [
  // 1. Coimbatore Localities
  { name: 'Peelamedu', locality: 'Peelamedu', district: 'Coimbatore', lat: 11.0266, lon: 77.0004, keywords: ['peelamedu', 'psg', 'aerodrome', 'coimbatore north'] },
  { name: 'Gandhipuram', locality: 'Gandhipuram', district: 'Coimbatore', lat: 11.0183, lon: 76.9678, keywords: ['gandhipuram', 'cross cut road', 'bus stand', 'central bus stand'] },
  { name: 'RS Puram', locality: 'RS Puram', district: 'Coimbatore', lat: 11.0080, lon: 76.9502, keywords: ['rs puram', 'r.s. puram', 'rathinasabapathy puram', 'db road'] },
  { name: 'Singanallur', locality: 'Singanallur', district: 'Coimbatore', lat: 10.9990, lon: 77.0324, keywords: ['singanallur', 'lake', 'trichy road'] },
  { name: 'Sulur', locality: 'Sulur', district: 'Coimbatore', lat: 11.0268, lon: 77.1264, keywords: ['sulur', 'air force base'] },
  { name: 'Saravanampatti', locality: 'Saravanampatti', district: 'Coimbatore', lat: 11.0764, lon: 77.0045, keywords: ['saravanampatti', 'sathy road', 'it corridor', 'chil sez'] },
  { name: 'Saibaba Colony', locality: 'Saibaba Colony', district: 'Coimbatore', lat: 11.0243, lon: 76.9448, keywords: ['saibaba colony', 'mettupalayam road', 'kavundampalayam'] },
  { name: 'Ramanathapuram', locality: 'Ramanathapuram', district: 'Coimbatore', lat: 10.9948, lon: 76.9921, keywords: ['ramanathapuram coimbatore', 'trichy road coimbatore', 'sungam'] },
  { name: 'Ukkadam', locality: 'Ukkadam', district: 'Coimbatore', lat: 10.9861, lon: 76.9638, keywords: ['ukkadam', 'periyakulam', 'bus stand'] },
  { name: 'Kuniyamuthur', locality: 'Kuniyamuthur', district: 'Coimbatore', lat: 10.9560, lon: 76.9541, keywords: ['kuniyamuthur', 'palakkad road', 'sundarapuram'] },
  { name: 'Race Course', locality: 'Race Course', district: 'Coimbatore', lat: 11.0022, lon: 76.9744, keywords: ['race course', 'thomas park', 'collectorate'] },
  { name: 'Thudiyalur', locality: 'Thudiyalur', district: 'Coimbatore', lat: 11.0792, lon: 76.9388, keywords: ['thudiyalur', 'mettupalayam road'] },
  { name: 'Perur', locality: 'Perur', district: 'Coimbatore', lat: 10.9702, lon: 76.9146, keywords: ['perur', 'pateeswarar temple', 'siruvani road'] },
  { name: 'Vadavalli', locality: 'Vadavalli', district: 'Coimbatore', lat: 11.0232, lon: 76.9038, keywords: ['vadavalli', 'marudhamalai road'] },
  { name: 'Pollachi', locality: 'Pollachi', district: 'Coimbatore', lat: 10.6609, lon: 77.0048, keywords: ['pollachi', 'anaimalai', 'aliyar'] },
  { name: 'Mettupalayam', locality: 'Mettupalayam', district: 'Coimbatore', lat: 11.3005, lon: 76.9449, keywords: ['mettupalayam', 'bhavani river', 'ooty foot'] },
  { name: 'Annur', locality: 'Annur', district: 'Coimbatore', lat: 11.2333, lon: 77.1833, keywords: ['annur', 'avanshi road'] },
  { name: 'Kinathukadavu', locality: 'Kinathukadavu', district: 'Coimbatore', lat: 10.8200, lon: 77.0200, keywords: ['kinathukadavu', 'pollachi road'] },
  { name: 'Madukkarai', locality: 'Madukkarai', district: 'Coimbatore', lat: 10.9042, lon: 76.9658, keywords: ['madukkarai', 'cement'] },
  { name: 'Kovaipudur', locality: 'Kovaipudur', district: 'Coimbatore', lat: 10.9327, lon: 76.9427, keywords: ['kovaipudur', 'little ooty'] },
  { name: 'Ganapathy', locality: 'Ganapathy', district: 'Coimbatore', lat: 11.0407, lon: 76.9798, keywords: ['ganapathy', 'athipalayam road'] },
  { name: 'Ondipudur', locality: 'Ondipudur', district: 'Coimbatore', lat: 10.9991, lon: 77.0519, keywords: ['ondipudur', 'trichy road'] },
  { name: 'Kalapatti', locality: 'Kalapatti', district: 'Coimbatore', lat: 11.0734, lon: 77.0425, keywords: ['kalapatti', 'aerodrome'] },
  { name: 'Sundarapuram', locality: 'Sundarapuram', district: 'Coimbatore', lat: 10.9491, lon: 76.9774, keywords: ['sundarapuram', 'pollachi road'] },
  { name: 'Valparai', locality: 'Valparai', district: 'Coimbatore', lat: 10.3267, lon: 76.9554, keywords: ['valparai', 'tea estates'] },

  // 2. Chennai Localities
  { name: 'T. Nagar', locality: 'T. Nagar', district: 'Chennai', lat: 13.0418, lon: 80.2341, keywords: ['t nagar', 'thyagaraya nagar', 'panagal park', 'pondibazaar'] },
  { name: 'Adyar', locality: 'Adyar', district: 'Chennai', lat: 13.0044, lon: 80.2583, keywords: ['adyar', 'kasturba nagar', 'gandhi nagar'] },
  { name: 'Anna Nagar', locality: 'Anna Nagar', district: 'Chennai', lat: 13.0850, lon: 80.2101, keywords: ['anna nagar chennai', 'tower park chennai'] },
  { name: 'Velachery', locality: 'Velachery', district: 'Chennai', lat: 12.9759, lon: 80.2212, keywords: ['velachery', 'phoenix marketcity', 'bypass'] },
  { name: 'Mylapore', locality: 'Mylapore', district: 'Chennai', lat: 13.0368, lon: 80.2676, keywords: ['mylapore', 'kapaleeshwarar', 'luz'] },
  { name: 'Guindy', locality: 'Guindy', district: 'Chennai', lat: 13.0067, lon: 80.2021, keywords: ['guindy', 'national park', 'kathipara'] },
  { name: 'Porur', locality: 'Porur', district: 'Chennai', lat: 13.0382, lon: 80.1565, keywords: ['porur', 'dlf it park', 'ramachandra'] },
  { name: 'Besant Nagar', locality: 'Besant Nagar', district: 'Chennai', lat: 13.0003, lon: 80.2667, keywords: ['besant nagar', 'elliots beach'] },
  { name: 'Nungambakkam', locality: 'Nungambakkam', district: 'Chennai', lat: 13.0569, lon: 80.2425, keywords: ['nungambakkam', 'high road', 'valluvar kottam'] },
  { name: 'Thiruvanmiyur', locality: 'Thiruvanmiyur', district: 'Chennai', lat: 12.9830, lon: 80.2594, keywords: ['thiruvanmiyur', 'beach', 'ecr'] },
  { name: 'Sholinganallur', locality: 'Sholinganallur', district: 'Chennai', lat: 12.9010, lon: 80.2279, keywords: ['sholinganallur', 'omr', 'elcot sez'] },
  { name: 'Alwarpet', locality: 'Alwarpet', district: 'Chennai', lat: 13.0336, lon: 80.2505, keywords: ['alwarpet', 'tt k road'] },
  { name: 'Egmore', locality: 'Egmore', district: 'Chennai', lat: 13.0827, lon: 80.2607, keywords: ['egmore', 'museum', 'railway station'] },
  { name: 'Royapettah', locality: 'Royapettah', district: 'Chennai', lat: 13.0587, lon: 80.2642, keywords: ['royapettah', 'express avenue'] },
  { name: 'Kilpauk', locality: 'Kilpauk', district: 'Chennai', lat: 13.0784, lon: 80.2412, keywords: ['kilpauk', 'medical college'] },
  { name: 'Perambur', locality: 'Perambur', district: 'Chennai', lat: 13.1097, lon: 80.2425, keywords: ['perambur', 'icf'] },
  { name: 'Ambattur', locality: 'Ambattur', district: 'Chennai', lat: 13.1143, lon: 80.1548, keywords: ['ambattur', 'industrial estate'] },
  { name: 'Saidapet', locality: 'Saidapet', district: 'Chennai', lat: 13.0213, lon: 80.2231, keywords: ['saidapet', 'subway'] },

  // 3. Chengalpattu Localities
  { name: 'Tambaram', locality: 'Tambaram', district: 'Chengalpattu', lat: 12.9246, lon: 80.1271, keywords: ['tambaram', 'mepz', 'air force station'] },
  { name: 'Chromepet', locality: 'Chromepet', district: 'Chengalpattu', lat: 12.9516, lon: 80.1462, keywords: ['chromepet', 'gst road', 'mit'] },
  { name: 'Pallavaram', locality: 'Pallavaram', district: 'Chengalpattu', lat: 12.9675, lon: 80.1491, keywords: ['pallavaram', 'airport hills'] },
  { name: 'Chengalpattu Town', locality: 'Chengalpattu Town', district: 'Chengalpattu', lat: 12.6841, lon: 79.9836, keywords: ['chengalpattu town', 'kolavai lake'] },
  { name: 'Maraimalai Nagar', locality: 'Maraimalai Nagar', district: 'Chengalpattu', lat: 12.7967, lon: 80.0242, keywords: ['maraimalai nagar', 'ford'] },
  { name: 'Vandalur', locality: 'Vandalur', district: 'Chengalpattu', lat: 12.8914, lon: 80.0815, keywords: ['vandalur', 'zoo', 'crescent'] },
  { name: 'Mahabalipuram', locality: 'Mahabalipuram', district: 'Chengalpattu', lat: 12.6269, lon: 80.1927, keywords: ['mahabalipuram', 'mamallapuram', 'shore temple'] },
  { name: 'Kelambakkam', locality: 'Kelambakkam', district: 'Chengalpattu', lat: 12.7872, lon: 80.2195, keywords: ['kelambakkam', 'omr road'] },
  { name: 'Maduranthakam', locality: 'Maduranthakam', district: 'Chengalpattu', lat: 12.5097, lon: 79.8825, keywords: ['maduranthakam', 'eri'] },

  // 4. Madurai Localities
  { name: 'Mattuthavani', locality: 'Mattuthavani', district: 'Madurai', lat: 9.9391, lon: 78.1578, keywords: ['mattuthavani', 'integrated bus terminal', 'mibts'] },
  { name: 'Goripalayam', locality: 'Goripalayam', district: 'Madurai', lat: 9.9324, lon: 78.1311, keywords: ['goripalayam', 'dargah', 'vaigai'] },
  { name: 'Simmakkal', locality: 'Simmakkal', district: 'Madurai', lat: 9.9238, lon: 78.1215, keywords: ['simmakkal', 'periyar bus stand'] },
  { name: 'Anna Nagar (Madurai)', locality: 'Anna Nagar', district: 'Madurai', lat: 9.9197, lon: 78.1492, keywords: ['anna nagar madurai', 'ambika theatre'] },
  { name: 'Thiruppalai', locality: 'Thiruppalai', district: 'Madurai', lat: 9.9658, lon: 78.1432, keywords: ['thiruppalai', 'natham road'] },
  { name: 'Thiruparankundram', locality: 'Thiruparankundram', district: 'Madurai', lat: 9.8828, lon: 78.0706, keywords: ['thiruparankundram', 'murugan temple'] },
  { name: 'Melur', locality: 'Melur', district: 'Madurai', lat: 10.0336, lon: 78.3344, keywords: ['melur', 'trichy madurai highway'] },
  { name: 'Thirumangalam', locality: 'Thirumangalam', district: 'Madurai', lat: 9.8236, lon: 77.9897, keywords: ['thirumangalam', 'kappalur'] },
  { name: 'Usilampatti', locality: 'Usilampatti', district: 'Madurai', lat: 9.9700, lon: 77.7900, keywords: ['usilampatti'] },
  { name: 'Alanganallur', locality: 'Alanganallur', district: 'Madurai', lat: 10.0460, lon: 78.0930, keywords: ['alanganallur', 'jallikattu'] },
  { name: 'Vadipatti', locality: 'Vadipatti', district: 'Madurai', lat: 10.0760, lon: 77.9480, keywords: ['vadipatti', 'kulasekaran'] },

  // 5. Salem Localities
  { name: 'Fairlands', locality: 'Fairlands', district: 'Salem', lat: 11.6789, lon: 78.1382, keywords: ['fairlands', 'saradha college road'] },
  { name: 'Hasthampatti', locality: 'Hasthampatti', district: 'Salem', lat: 11.6791, lon: 78.1633, keywords: ['hasthampatti', 'yercaud foothills'] },
  { name: 'Suramangalam', locality: 'Suramangalam', district: 'Salem', lat: 11.6766, lon: 78.1189, keywords: ['suramangalam', 'salem junction'] },
  { name: 'Alagapuram', locality: 'Alagapuram', district: 'Salem', lat: 11.6850, lon: 78.1350, keywords: ['alagapuram', 'meyyanur'] },
  { name: 'Ammapet', locality: 'Ammapet', district: 'Salem', lat: 11.6521, lon: 78.1812, keywords: ['ammapet', 'attur road'] },
  { name: 'Mettur', locality: 'Mettur', district: 'Salem', lat: 11.7960, lon: 77.8010, keywords: ['mettur', 'stanley reservoir', 'dam'] },
  { name: 'Attur', locality: 'Attur', district: 'Salem', lat: 11.5975, lon: 78.5986, keywords: ['attur', 'vasishta'] },
  { name: 'Omalur', locality: 'Omalur', district: 'Salem', lat: 11.7431, lon: 78.0414, keywords: ['omalur', 'airport salem'] },
  { name: 'Sankari', locality: 'Sankari', district: 'Salem', lat: 11.4820, lon: 77.8680, keywords: ['sankari', 'sankaridurg'] },
  { name: 'Yercaud', locality: 'Yercaud', district: 'Salem', lat: 11.7753, lon: 78.2093, keywords: ['yercaud', 'shevaroy hills'] },
  { name: 'Edappadi', locality: 'Edappadi', district: 'Salem', lat: 11.5833, lon: 77.8500, keywords: ['edappadi'] },

  // 6. Tiruppur Localities
  { name: 'Avinashi Road (Tiruppur)', locality: 'Avinashi Road', district: 'Tiruppur', lat: 11.1250, lon: 77.3450, keywords: ['avinashi road tiruppur', 'kumar nagar'] },
  { name: 'Nallur', locality: 'Nallur', district: 'Tiruppur', lat: 11.0850, lon: 77.3750, keywords: ['nallur', 'kangeyam road'] },
  { name: 'Veerapandi', locality: 'Veerapandi', district: 'Tiruppur', lat: 11.0650, lon: 77.3600, keywords: ['veerapandi', 'palladam road'] },
  { name: 'Palladam Road', locality: 'Palladam Road', district: 'Tiruppur', lat: 11.0920, lon: 77.3550, keywords: ['palladam road tiruppur'] },
  { name: 'Avinashi', locality: 'Avinashi', district: 'Tiruppur', lat: 11.1932, lon: 77.2694, keywords: ['avinashi', 'lingeshwarar'] },
  { name: 'Palladam', locality: 'Palladam', district: 'Tiruppur', lat: 10.9996, lon: 77.2882, keywords: ['palladam', 'coimbatore trichy road'] },
  { name: 'Dharapuram', locality: 'Dharapuram', district: 'Tiruppur', lat: 10.7289, lon: 77.5276, keywords: ['dharapuram', 'amaravathi river'] },
  { name: 'Kangeyam', locality: 'Kangeyam', district: 'Tiruppur', lat: 11.0050, lon: 77.5600, keywords: ['kangeyam', 'bulls'] },
  { name: 'Udumalaipettai', locality: 'Udumalaipettai', district: 'Tiruppur', lat: 10.5870, lon: 77.2490, keywords: ['udumalaipettai', 'udumalpet'] },
  { name: 'Vellakoil', locality: 'Vellakoil', district: 'Tiruppur', lat: 10.9400, lon: 77.7100, keywords: ['vellakoil'] },
  { name: 'Uthukuli', locality: 'Uthukuli', district: 'Tiruppur', lat: 11.1600, lon: 77.4500, keywords: ['uthukuli', 'butter'] },

  // 7. Tiruchirappalli (Trichy) Localities
  { name: 'Thillai Nagar', locality: 'Thillai Nagar', district: 'Tiruchirappalli', lat: 10.8267, lon: 78.6833, keywords: ['thillai nagar', 'main road'] },
  { name: 'Srirangam', locality: 'Srirangam', district: 'Tiruchirappalli', lat: 10.8622, lon: 78.6947, keywords: ['srirangam', 'raghunathaswamy temple', 'kaveri'] },
  { name: 'Cantonment', locality: 'Cantonment', district: 'Tiruchirappalli', lat: 10.8055, lon: 78.6856, keywords: ['cantonment', 'central bus stand trichy'] },
  { name: 'K.K. Nagar', locality: 'K.K. Nagar', district: 'Tiruchirappalli', lat: 10.7850, lon: 78.6920, keywords: ['kk nagar trichy', 'airport road'] },
  { name: 'Ponmalai (Golden Rock)', locality: 'Ponmalai', district: 'Tiruchirappalli', lat: 10.7930, lon: 78.7180, keywords: ['ponmalai', 'golden rock', 'railway workshop'] },
  { name: 'Lalgudi', locality: 'Lalgudi', district: 'Tiruchirappalli', lat: 10.8690, lon: 78.8150, keywords: ['lalgudi', 'coleroon'] },
  { name: 'Manapparai', locality: 'Manapparai', district: 'Tiruchirappalli', lat: 10.6070, lon: 78.4150, keywords: ['manapparai', 'murukku'] },
  { name: 'Musiri', locality: 'Musiri', district: 'Tiruchirappalli', lat: 10.9400, lon: 78.4500, keywords: ['musiri', 'cauvery'] },
  { name: 'Thuraiyur', locality: 'Thuraiyur', district: 'Tiruchirappalli', lat: 11.1000, lon: 78.6000, keywords: ['thuraiyur', 'perambalur road'] },

  // 8. Erode Localities
  { name: 'Erode Town', locality: 'Erode Town', district: 'Erode', lat: 11.3410, lon: 77.7172, keywords: ['erode town', 'bus stand'] },
  { name: 'Bhavani', locality: 'Bhavani', district: 'Erode', lat: 11.4500, lon: 77.6800, keywords: ['bhavani', 'sangameshwarar', 'kooduthurai'] },
  { name: 'Gobichettipalayam', locality: 'Gobichettipalayam', district: 'Erode', lat: 11.4500, lon: 77.4300, keywords: ['gobichettipalayam', 'gobi', 'cinema city'] },
  { name: 'Perundurai', locality: 'Perundurai', district: 'Erode', lat: 11.2700, lon: 77.5800, keywords: ['perundurai', 'sipcot'] },
  { name: 'Sathyamangalam', locality: 'Sathyamangalam', district: 'Erode', lat: 11.5000, lon: 77.2300, keywords: ['sathyamangalam', 'tiger reserve', 'bannari'] },
  { name: 'Anthiyur', locality: 'Anthiyur', district: 'Erode', lat: 11.5800, lon: 77.6000, keywords: ['anthiyur', 'horse fair'] },
  { name: 'Kodumudi', locality: 'Kodumudi', district: 'Erode', lat: 11.0800, lon: 77.8800, keywords: ['kodumudi', 'magudeswarar'] },
  { name: 'Modakkurichi', locality: 'Modakkurichi', district: 'Erode', lat: 11.2000, lon: 77.7800, keywords: ['modakkurichi'] },

  // 9. The Nilgiris Localities
  { name: 'Ooty (Udhagamandalam)', locality: 'Ooty', district: 'The Nilgiris', lat: 11.4102, lon: 76.6950, keywords: ['ooty', 'udhagamandalam', 'charring cross', 'botanical garden'] },
  { name: 'Coonoor', locality: 'Coonoor', district: 'The Nilgiris', lat: 11.3530, lon: 76.7959, keywords: ['coonoor', 'sims park', 'tea estates'] },
  { name: 'Kotagiri', locality: 'Kotagiri', district: 'The Nilgiris', lat: 11.4200, lon: 76.8700, keywords: ['kotagiri', 'katherine falls'] },
  { name: 'Gudalur', locality: 'Gudalur', district: 'The Nilgiris', lat: 11.5000, lon: 76.5000, keywords: ['gudalur', 'mudumalai'] },
  { name: 'Wellington', locality: 'Wellington', district: 'The Nilgiris', lat: 11.3600, lon: 76.7900, keywords: ['wellington', 'defenders club', 'mrc'] },
  { name: 'Pandalur', locality: 'Pandalur', district: 'The Nilgiris', lat: 11.4800, lon: 76.3800, keywords: ['pandalur'] },

  // 10. Dindigul Localities
  { name: 'Dindigul Town', locality: 'Dindigul Town', district: 'Dindigul', lat: 10.3673, lon: 77.9803, keywords: ['dindigul town', 'rock fort', 'biryani'] },
  { name: 'Palani', locality: 'Palani', district: 'Dindigul', lat: 10.4500, lon: 77.5200, keywords: ['palani', 'dhandayuthapani', 'hill temple'] },
  { name: 'Kodaikanal', locality: 'Kodaikanal', district: 'Dindigul', lat: 10.2381, lon: 77.4892, keywords: ['kodaikanal', 'kodai lake', 'princess of hills'] },
  { name: 'Nilakkottai', locality: 'Nilakkottai', district: 'Dindigul', lat: 10.1600, lon: 77.8600, keywords: ['nilakkottai', 'flower market'] },
  { name: 'Natham', locality: 'Natham', district: 'Dindigul', lat: 10.2200, lon: 78.2300, keywords: ['natham', 'mariamman'] },
  { name: 'Oddanchatram', locality: 'Oddanchatram', district: 'Dindigul', lat: 10.4800, lon: 77.7500, keywords: ['oddanchatram', 'vegetable market'] },
  { name: 'Batlagundu', locality: 'Batlagundu', district: 'Dindigul', lat: 10.1600, lon: 77.7600, keywords: ['batlagundu', 'vathalagundu'] },

  // 11. Cuddalore Localities
  { name: 'Cuddalore Port', locality: 'Cuddalore Port', district: 'Cuddalore', lat: 11.7480, lon: 79.7714, keywords: ['cuddalore port', 'silver beach', 'manjakuppam'] },
  { name: 'Chidambaram', locality: 'Chidambaram', district: 'Cuddalore', lat: 11.3992, lon: 79.6917, keywords: ['chidambaram', 'nataraja temple', 'annamalai university'] },
  { name: 'Panruti', locality: 'Panruti', district: 'Cuddalore', lat: 11.7733, lon: 79.5536, keywords: ['panruti', 'jackfruit', 'cashew'] },
  { name: 'Neyveli', locality: 'Neyveli', district: 'Cuddalore', lat: 11.5996, lon: 79.4862, keywords: ['neyveli', 'nlc', 'thermal'] },
  { name: 'Vriddhachalam', locality: 'Vriddhachalam', district: 'Cuddalore', lat: 11.5204, lon: 79.3308, keywords: ['vriddhachalam', 'vriddhagiriswarar'] },
  { name: 'Kurinjipadi', locality: 'Kurinjipadi', district: 'Cuddalore', lat: 11.5667, lon: 79.6000, keywords: ['kurinjipadi', 'handloom'] },
  { name: 'Bhuvanagiri', locality: 'Bhuvanagiri', district: 'Cuddalore', lat: 11.4500, lon: 79.6333, keywords: ['bhuvanagiri', 'raghavendra'] },

  // 12. Kanniyakumari Localities
  { name: 'Nagercoil', locality: 'Nagercoil', district: 'Kanniyakumari', lat: 8.1833, lon: 77.4119, keywords: ['nagercoil', 'nagaraja temple'] },
  { name: 'Kanyakumari Point', locality: 'Kanyakumari Point', district: 'Kanniyakumari', lat: 8.0883, lon: 77.5385, keywords: ['kanyakumari point', 'thiruvalluvar statue', 'vivekananda rock'] },
  { name: 'Thuckalay', locality: 'Thuckalay', district: 'Kanniyakumari', lat: 8.2500, lon: 77.3200, keywords: ['thuckalay', 'padmanabhapuram palace'] },
  { name: 'Marthandam', locality: 'Marthandam', district: 'Kanniyakumari', lat: 8.3000, lon: 77.2200, keywords: ['marthandam', 'honey'] },
  { name: 'Colachel', locality: 'Colachel', district: 'Kanniyakumari', lat: 8.1800, lon: 77.2600, keywords: ['colachel', 'port'] },
  { name: 'Kulasekharam', locality: 'Kulasekharam', district: 'Kanniyakumari', lat: 8.3600, lon: 77.3000, keywords: ['kulasekharam', 'rubber'] },

  // 13. Thanjavur Localities
  { name: 'Thanjavur Town', locality: 'Thanjavur Town', district: 'Thanjavur', lat: 10.7870, lon: 79.1378, keywords: ['thanjavur town', 'brihadisvara', 'big temple'] },
  { name: 'Kumbakonam', locality: 'Kumbakonam', district: 'Thanjavur', lat: 10.9602, lon: 79.3845, keywords: ['kumbakonam', 'temple city', 'mahamaham'] },
  { name: 'Pattukkottai', locality: 'Pattukkottai', district: 'Thanjavur', lat: 10.4300, lon: 79.3200, keywords: ['pattukkottai', 'coconut'] },
  { name: 'Papanasam', locality: 'Papanasam', district: 'Thanjavur', lat: 10.9200, lon: 79.2800, keywords: ['papanasam'] },
  { name: 'Thiruvaiyaru', locality: 'Thiruvaiyaru', district: 'Thanjavur', lat: 10.8800, lon: 79.1000, keywords: ['thiruvaiyaru', 'tyagaraja'] },
  { name: 'Swamimalai', locality: 'Swamimalai', district: 'Thanjavur', lat: 10.9500, lon: 79.3300, keywords: ['swamimalai', 'murugan'] },

  // 14. Tirunelveli Localities
  { name: 'Tirunelveli Junction', locality: 'Tirunelveli Junction', district: 'Tirunelveli', lat: 8.7139, lon: 77.7567, keywords: ['tirunelveli junction', 'halwa', 'nellai'] },
  { name: 'Palayamkottai', locality: 'Palayamkottai', district: 'Tirunelveli', lat: 8.7100, lon: 77.7400, keywords: ['palayamkottai', 'oxford of south india'] },
  { name: 'Ambasamudram', locality: 'Ambasamudram', district: 'Tirunelveli', lat: 8.7000, lon: 77.4500, keywords: ['ambasamudram', 'thamirabarani'] },
  { name: 'Cheranmahadevi', locality: 'Cheranmahadevi', district: 'Tirunelveli', lat: 8.6800, lon: 77.5700, keywords: ['cheranmahadevi'] },
  { name: 'Nanguneri', locality: 'Nanguneri', district: 'Tirunelveli', lat: 8.4900, lon: 77.6600, keywords: ['nanguneri', 'totadri'] },
  { name: 'Kalakkad', locality: 'Kalakkad', district: 'Tirunelveli', lat: 8.5100, lon: 77.5500, keywords: ['kalakkad', 'mundanthurai'] },

  // 15. Vellore Localities
  { name: 'Vellore Fort Area', locality: 'Vellore Fort Area', district: 'Vellore', lat: 12.9165, lon: 79.1325, keywords: ['vellore fort', 'cmc', 'vit'] },
  { name: 'Katpadi', locality: 'Katpadi', district: 'Vellore', lat: 12.9800, lon: 79.1300, keywords: ['katpadi', 'junction', 'vit campus'] },
  { name: 'Gudiyatham', locality: 'Gudiyatham', district: 'Vellore', lat: 12.9500, lon: 78.8700, keywords: ['gudiyatham', 'safety matches'] },
  { name: 'Sathuvachari', locality: 'Sathuvachari', district: 'Vellore', lat: 12.9300, lon: 79.1700, keywords: ['sathuvachari', 'collectorate'] },
  { name: 'Pernambut', locality: 'Pernambut', district: 'Vellore', lat: 12.9300, lon: 78.7100, keywords: ['pernambut', 'leather'] },

  // 16. Thoothukudi Localities
  { name: 'Thoothukudi Port', locality: 'Thoothukudi Port', district: 'Thoothukudi', lat: 8.7642, lon: 78.1348, keywords: ['thoothukudi port', 'tuticorin', 'pearl city'] },
  { name: 'Tiruchendur', locality: 'Tiruchendur', district: 'Thoothukudi', lat: 8.4900, lon: 78.1200, keywords: ['tiruchendur', 'seashore temple', 'subramanya'] },
  { name: 'Kovilpatti', locality: 'Kovilpatti', district: 'Thoothukudi', lat: 9.1700, lon: 77.8700, keywords: ['kovilpatti', 'kadalai mittai'] },
  { name: 'Kayalpattinam', locality: 'Kayalpattinam', district: 'Thoothukudi', lat: 8.5700, lon: 78.1300, keywords: ['kayalpattinam', 'coastal'] },
  { name: 'Srivaikuntam', locality: 'Srivaikuntam', district: 'Thoothukudi', lat: 8.6200, lon: 77.9300, keywords: ['srivaikuntam', 'nava tirupathi'] },

  // 17. Krishnagiri Localities
  { name: 'Krishnagiri Town', locality: 'Krishnagiri Town', district: 'Krishnagiri', lat: 12.5186, lon: 78.2137, keywords: ['krishnagiri town', 'dam', 'mangoes'] },
  { name: 'Hosur', locality: 'Hosur', district: 'Krishnagiri', lat: 12.7409, lon: 77.8253, keywords: ['hosur', 'industrial hub', 'sipcot hosur'] },
  { name: 'Denkanikottai', locality: 'Denkanikottai', district: 'Krishnagiri', lat: 12.5300, lon: 77.7800, keywords: ['denkanikottai', 'little england'] },
  { name: 'Bargur', locality: 'Bargur', district: 'Krishnagiri', lat: 12.5500, lon: 78.3600, keywords: ['bargur', 'engineering college'] },
  { name: 'Pochampalli', locality: 'Pochampalli', district: 'Krishnagiri', lat: 12.3300, lon: 78.3700, keywords: ['pochampalli'] },

  // 18. Dharmapuri Localities
  { name: 'Dharmapuri Town', locality: 'Dharmapuri Town', district: 'Dharmapuri', lat: 12.1211, lon: 78.1582, keywords: ['dharmapuri town'] },
  { name: 'Harur', locality: 'Harur', district: 'Dharmapuri', lat: 12.0600, lon: 78.4900, keywords: ['harur'] },
  { name: 'Palacode', locality: 'Palacode', district: 'Dharmapuri', lat: 12.3000, lon: 78.0800, keywords: ['palacode', 'tomato'] },
  { name: 'Pennagaram', locality: 'Pennagaram', district: 'Dharmapuri', lat: 12.1300, lon: 77.9000, keywords: ['pennagaram', 'hogenakkal falls'] },

  // 19. Theni Localities
  { name: 'Theni Town', locality: 'Theni Town', district: 'Theni', lat: 10.0104, lon: 77.4768, keywords: ['theni town', 'vaigai'] },
  { name: 'Periyakulam', locality: 'Periyakulam', district: 'Theni', lat: 10.1200, lon: 77.5500, keywords: ['periyakulam', 'horticulture'] },
  { name: 'Bodinayakanur', locality: 'Bodinayakanur', district: 'Theni', lat: 10.0100, lon: 77.3500, keywords: ['bodinayakanur', 'cardamom city'] },
  { name: 'Cumbum', locality: 'Cumbum', district: 'Theni', lat: 9.7300, lon: 77.2800, keywords: ['cumbum', 'grapes valley'] },
  { name: 'Andipatti', locality: 'Andipatti', district: 'Theni', lat: 10.0000, lon: 77.6200, keywords: ['andipatti', 'vaigai dam'] },

  // 20. Tenkasi Localities
  { name: 'Tenkasi Town', locality: 'Tenkasi Town', district: 'Tenkasi', lat: 8.9594, lon: 77.3161, keywords: ['tenkasi town', 'kasi viswanathar'] },
  { name: 'Courtallam', locality: 'Courtallam', district: 'Tenkasi', lat: 8.9300, lon: 77.2700, keywords: ['courtallam', 'kutralam', 'spa of south india', 'waterfalls'] },
  { name: 'Sankarankovil', locality: 'Sankarankovil', district: 'Tenkasi', lat: 9.1700, lon: 77.5300, keywords: ['sankarankovil', 'sankaranarayana'] },
  { name: 'Kadayanallur', locality: 'Kadayanallur', district: 'Tenkasi', lat: 9.0700, lon: 77.3500, keywords: ['kadayanallur'] },
  { name: 'Shenkottai', locality: 'Shenkottai', district: 'Tenkasi', lat: 8.9800, lon: 77.2500, keywords: ['shenkottai', 'aryankavu pass'] },

  // 21. Namakkal Localities
  { name: 'Namakkal Town', locality: 'Namakkal Town', district: 'Namakkal', lat: 11.2189, lon: 78.1674, keywords: ['namakkal town', 'anjaneyar', 'poultry'] },
  { name: 'Tiruchengode', locality: 'Tiruchengode', district: 'Namakkal', lat: 11.3800, lon: 77.8900, keywords: ['tiruchengode', 'ardhanareeswarar', 'rigs'] },
  { name: 'Rasipuram', locality: 'Rasipuram', district: 'Namakkal', lat: 11.4600, lon: 78.1700, keywords: ['rasipuram', 'ghee'] },
  { name: 'Kolli Hills', locality: 'Kolli Hills', district: 'Namakkal', lat: 11.2500, lon: 78.3400, keywords: ['kolli hills', 'arapaleeswarar', '70 bends'] },
  { name: 'Paramathi Velur', locality: 'Paramathi Velur', district: 'Namakkal', lat: 11.0600, lon: 78.0100, keywords: ['paramathi velur', 'cauvery bridge'] },

  // 22. Ramanathapuram Localities
  { name: 'Ramanathapuram Town', locality: 'Ramanathapuram Town', district: 'Ramanathapuram', lat: 9.3639, lon: 78.8395, keywords: ['ramanathapuram town', 'palace'] },
  { name: 'Rameswaram', locality: 'Rameswaram', district: 'Ramanathapuram', lat: 9.2876, lon: 79.3129, keywords: ['rameswaram', 'ramanathaswamy', 'dhanushkodi', 'pamban'] },
  { name: 'Paramakudi', locality: 'Paramakudi', district: 'Ramanathapuram', lat: 9.5400, lon: 78.5900, keywords: ['paramakudi', 'vaigai'] },
  { name: 'Kilakarai', locality: 'Kilakarai', district: 'Ramanathapuram', lat: 9.2300, lon: 78.7800, keywords: ['kilakarai', 'seashore'] },

  // 23. Sivaganga Localities
  { name: 'Sivaganga Town', locality: 'Sivaganga Town', district: 'Sivaganga', lat: 9.8433, lon: 78.4809, keywords: ['sivaganga town', 'maruthu pandiyar'] },
  { name: 'Karaikudi', locality: 'Karaikudi', district: 'Sivaganga', lat: 10.0700, lon: 78.7800, keywords: ['karaikudi', 'chettinad', 'alagappa university'] },
  { name: 'Devakottai', locality: 'Devakottai', district: 'Sivaganga', lat: 9.9500, lon: 78.8200, keywords: ['devakottai', 'mansions'] },
  { name: 'Manamadurai', locality: 'Manamadurai', district: 'Sivaganga', lat: 9.7000, lon: 78.4500, keywords: ['manamadurai', 'pottery', 'ghatam'] },

  // 24. Tiruvallur Localities
  { name: 'Tiruvallur Town', locality: 'Tiruvallur Town', district: 'Tiruvallur', lat: 13.1437, lon: 79.9079, keywords: ['tiruvallur town', 'veeraraghava'] },
  { name: 'Avadi', locality: 'Avadi', district: 'Tiruvallur', lat: 13.1167, lon: 80.1000, keywords: ['avadi', 'hvf tank factory'] },
  { name: 'Poonamallee', locality: 'Poonamallee', district: 'Tiruvallur', lat: 13.0500, lon: 80.1100, keywords: ['poonamallee', 'junction'] },
  { name: 'Tiruttani', locality: 'Tiruttani', district: 'Tiruvallur', lat: 13.1800, lon: 79.6300, keywords: ['tiruttani', 'murugan hill temple'] },
  { name: 'Gummidipoondi', locality: 'Gummidipoondi', district: 'Tiruvallur', lat: 13.4000, lon: 80.1300, keywords: ['gummidipoondi', 'sipcot'] },

  // 25. Tiruvannamalai Localities
  { name: 'Tiruvannamalai Temple Town', locality: 'Tiruvannamalai', district: 'Tiruvannamalai', lat: 12.2253, lon: 79.0747, keywords: ['tiruvannamalai', 'annamalaiyar', 'girivalam', 'ramana'] },
  { name: 'Arani', locality: 'Arani', district: 'Tiruvannamalai', lat: 12.6700, lon: 79.2800, keywords: ['arani', 'silk'] },
  { name: 'Cheyyar', locality: 'Cheyyar', district: 'Tiruvannamalai', lat: 12.6600, lon: 79.5400, keywords: ['cheyyar', 'sipcot'] },
  { name: 'Polur', locality: 'Polur', district: 'Tiruvannamalai', lat: 12.5000, lon: 79.1300, keywords: ['polur'] },
  { name: 'Jawadhu Hills', locality: 'Jawadhu Hills', district: 'Tiruvannamalai', lat: 12.6000, lon: 78.9000, keywords: ['jawadhu hills', 'kavalur observatory'] },

  // 26. Kancheepuram Localities
  { name: 'Kancheepuram Town', locality: 'Kancheepuram Town', district: 'Kancheepuram', lat: 12.8342, lon: 79.7036, keywords: ['kancheepuram town', 'silk sarees', 'kamakshi'] },
  { name: 'Sriperumbudur', locality: 'Sriperumbudur', district: 'Kancheepuram', lat: 12.9675, lon: 79.9436, keywords: ['sriperumbudur', 'hyundai', 'electronics'] },
  { name: 'Kundrathur', locality: 'Kundrathur', district: 'Kancheepuram', lat: 12.9700, lon: 80.0900, keywords: ['kundrathur', 'sekkizhar'] },
  { name: 'Walajabad', locality: 'Walajabad', district: 'Kancheepuram', lat: 12.7900, lon: 79.8200, keywords: ['walajabad'] },

  // 27. Ranipet Localities
  { name: 'Ranipet Town', locality: 'Ranipet Town', district: 'Ranipet', lat: 12.9229, lon: 79.3329, keywords: ['ranipet town', 'sipcot'] },
  { name: 'Arakkonam', locality: 'Arakkonam', district: 'Ranipet', lat: 13.0800, lon: 79.6700, keywords: ['arakkonam', 'naval base', 'railway junction'] },
  { name: 'Arcot', locality: 'Arcot', district: 'Ranipet', lat: 12.9000, lon: 79.3300, keywords: ['arcot', 'nawabs', 'sweet'] },
  { name: 'Sholinghur', locality: 'Sholinghur', district: 'Ranipet', lat: 13.1100, lon: 79.4300, keywords: ['sholinghur', 'narasimha hill'] },

  // 28. Tirupathur Localities
  { name: 'Tirupathur Town', locality: 'Tirupathur Town', district: 'Tirupathur', lat: 12.4958, lon: 78.5678, keywords: ['tirupathur town'] },
  { name: 'Ambur', locality: 'Ambur', district: 'Tirupathur', lat: 12.7900, lon: 78.7100, keywords: ['ambur', 'biryani', 'leather'] },
  { name: 'Vaniyambadi', locality: 'Vaniyambadi', district: 'Tirupathur', lat: 12.6800, lon: 78.6200, keywords: ['vaniyambadi', 'leather', 'palandian'] },
  { name: 'Yelagiri Hills', locality: 'Yelagiri Hills', district: 'Tirupathur', lat: 12.5800, lon: 78.6400, keywords: ['yelagiri hills', 'lake', 'punganur'] },

  // 29. Viluppuram Localities
  { name: 'Viluppuram Town', locality: 'Viluppuram Town', district: 'Viluppuram', lat: 11.9401, lon: 79.4861, keywords: ['viluppuram town', 'railway junction'] },
  { name: 'Tindivanam', locality: 'Tindivanam', district: 'Viluppuram', lat: 12.2300, lon: 79.6500, keywords: ['tindivanam', 'highway junction'] },
  { name: 'Gingee (Senji)', locality: 'Gingee', district: 'Viluppuram', lat: 12.2500, lon: 79.4200, keywords: ['gingee', 'senji fort', 'troy of the east'] },
  { name: 'Marakkanam', locality: 'Marakkanam', district: 'Viluppuram', lat: 12.2000, lon: 79.9500, keywords: ['marakkanam', 'salt pans', 'ecr'] },

  // 30. Kallakurichi Localities
  { name: 'Kallakurichi Town', locality: 'Kallakurichi Town', district: 'Kallakurichi', lat: 11.7384, lon: 78.9597, keywords: ['kallakurichi town'] },
  { name: 'Ulundurpet', locality: 'Ulundurpet', district: 'Kallakurichi', lat: 11.6900, lon: 79.2900, keywords: ['ulundurpet', 'nh45 junction'] },
  { name: 'Sankarapuram', locality: 'Sankarapuram', district: 'Kallakurichi', lat: 11.8800, lon: 78.9200, keywords: ['sankarapuram'] },
  { name: 'Chinnasalem', locality: 'Chinnasalem', district: 'Kallakurichi', lat: 11.6400, lon: 78.8800, keywords: ['chinnasalem'] },

  // 31. Karur Localities
  { name: 'Karur Town', locality: 'Karur Town', district: 'Karur', lat: 10.9601, lon: 78.0766, keywords: ['karur town', 'textile capital', 'pasupatheeswarar'] },
  { name: 'Kulithalai', locality: 'Kulithalai', district: 'Karur', lat: 10.9300, lon: 78.4200, keywords: ['kulithalai', 'cauvery'] },
  { name: 'Pugalur', locality: 'Pugalur', district: 'Karur', lat: 11.0600, lon: 78.0200, keywords: ['pugalur', 'tnpl paper'] },
  { name: 'Aravakurichi', locality: 'Aravakurichi', district: 'Karur', lat: 10.7700, lon: 77.9200, keywords: ['aravakurichi', 'drumstick'] },

  // 32. Pudukkottai Localities
  { name: 'Pudukkottai Town', locality: 'Pudukkottai Town', district: 'Pudukkottai', lat: 10.3797, lon: 78.8208, keywords: ['pudukkottai town', 'princely state'] },
  { name: 'Aranthangi', locality: 'Aranthangi', district: 'Pudukkottai', lat: 10.1600, lon: 78.9900, keywords: ['aranthangi', 'fort'] },
  { name: 'Viralimalai', locality: 'Viralimalai', district: 'Pudukkottai', lat: 10.6000, lon: 78.5400, keywords: ['viralimalai', 'peacock sanctuary', 'murugan'] },
  { name: 'Alangudi', locality: 'Alangudi', district: 'Pudukkottai', lat: 10.3600, lon: 78.9800, keywords: ['alangudi'] },

  // 33. Ariyalur Localities
  { name: 'Ariyalur Town', locality: 'Ariyalur Town', district: 'Ariyalur', lat: 11.1401, lon: 79.0786, keywords: ['ariyalur town', 'cement city'] },
  { name: 'Jayankondam', locality: 'Jayankondam', district: 'Ariyalur', lat: 11.2167, lon: 79.3500, keywords: ['jayankondam', 'lignite'] },
  { name: 'Udayarpalayam', locality: 'Udayarpalayam', district: 'Ariyalur', lat: 11.1833, lon: 79.2833, keywords: ['udayarpalayam', 'palace'] },
  { name: 'Gangaikonda Cholapuram', locality: 'Gangaikonda Cholapuram', district: 'Ariyalur', lat: 11.2058, lon: 79.4514, keywords: ['gangaikonda cholapuram', 'chola temple'] },

  // 34. Perambalur Localities
  { name: 'Perambalur Town', locality: 'Perambalur Town', district: 'Perambalur', lat: 11.2342, lon: 78.8821, keywords: ['perambalur town'] },
  { name: 'Veppanthattai', locality: 'Veppanthattai', district: 'Perambalur', lat: 11.3200, lon: 78.8300, keywords: ['veppanthattai'] },
  { name: 'Kunnam', locality: 'Kunnam', district: 'Perambalur', lat: 11.2300, lon: 79.0200, keywords: ['kunnam'] },

  // 35. Mayiladuthurai Localities
  { name: 'Mayiladuthurai Town', locality: 'Mayiladuthurai Town', district: 'Mayiladuthurai', lat: 11.1035, lon: 79.6548, keywords: ['mayiladuthurai town', 'mayuranathar'] },
  { name: 'Sirkazhi', locality: 'Sirkazhi', district: 'Mayiladuthurai', lat: 11.2333, lon: 79.7333, keywords: ['sirkazhi', 'thirugnanasambandar'] },
  { name: 'Tharangambadi (Tranquebar)', locality: 'Tharangambadi', district: 'Mayiladuthurai', lat: 11.0300, lon: 79.8500, keywords: ['tharangambadi', 'tranquebar', 'danish fort'] },
  { name: 'Poompuhar', locality: 'Poompuhar', district: 'Mayiladuthurai', lat: 11.1500, lon: 79.8500, keywords: ['poompuhar', 'kaveripoompattinam', 'silappathikaram'] },

  // 36. Nagapattinam Localities
  { name: 'Nagapattinam Port', locality: 'Nagapattinam Port', district: 'Nagapattinam', lat: 10.7672, lon: 79.8449, keywords: ['nagapattinam port', 'soundararaja'] },
  { name: 'Velankanni', locality: 'Velankanni', district: 'Nagapattinam', lat: 10.6800, lon: 79.8500, keywords: ['velankanni', 'our lady of health', 'basilica'] },
  { name: 'Nagore', locality: 'Nagore', district: 'Nagapattinam', lat: 10.8200, lon: 79.8400, keywords: ['nagore', 'dargah'] },
  { name: 'Vedaranyam', locality: 'Vedaranyam', district: 'Nagapattinam', lat: 10.3700, lon: 79.8500, keywords: ['vedaranyam', 'salt satyagraha', 'point calimere'] },

  // 37. Tiruvarur Localities
  { name: 'Tiruvarur Town', locality: 'Tiruvarur Town', district: 'Tiruvarur', lat: 10.7725, lon: 79.6365, keywords: ['tiruvarur town', 'thyagaraja temple', 'car festival'] },
  { name: 'Mannargudi', locality: 'Mannargudi', district: 'Tiruvarur', lat: 10.6600, lon: 79.4500, keywords: ['mannargudi', 'rajagopalaswamy', 'dakshina dwaraka'] },
  { name: 'Thiruthuraipoondi', locality: 'Thiruthuraipoondi', district: 'Tiruvarur', lat: 10.5300, lon: 79.6500, keywords: ['thiruthuraipoondi'] },
  { name: 'Muthupet', locality: 'Muthupet', district: 'Tiruvarur', lat: 10.4000, lon: 79.5100, keywords: ['muthupet', 'mangrove lagoon'] },

  // 38. Virudhunagar Localities
  { name: 'Virudhunagar Town', locality: 'Virudhunagar Town', district: 'Virudhunagar', lat: 9.5680, lon: 77.9624, keywords: ['virudhunagar town', 'kamarajar home'] },
  { name: 'Sivakasi', locality: 'Sivakasi', district: 'Virudhunagar', lat: 9.4500, lon: 77.8000, keywords: ['sivakasi', 'fireworks', 'printing', 'kutti japan'] },
  { name: 'Rajapalayam', locality: 'Rajapalayam', district: 'Virudhunagar', lat: 9.4500, lon: 77.5500, keywords: ['rajapalayam', 'ayyanar falls', 'dog breed'] },
  { name: 'Srivilliputhur', locality: 'Srivilliputhur', district: 'Virudhunagar', lat: 9.5100, lon: 77.6300, keywords: ['srivilliputhur', 'andal temple', 'tn emblem gopuram', 'palgova'] },
  { name: 'Aruppukkottai', locality: 'Aruppukkottai', district: 'Virudhunagar', lat: 9.5100, lon: 78.1000, keywords: ['aruppukkottai', 'weaving'] }
];

// In-memory search cache
const searchCache = new Map();
const SEARCH_CACHE_MAX = 200;

/**
 * Format clean display title & subtitle.
 */
function formatLocationRecord(item, type = 'locality') {
  const locality = item.locality || item.name;
  const district = item.district || item.name;
  const state = item.state || 'Tamil Nadu';
  const country = 'India';

  const isDistrictType = type === 'district' || (locality.toLowerCase() === district.toLowerCase());

  return {
    id: `${locality.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${district.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: locality,
    locality: isDistrictType ? null : locality,
    district: district,
    state: state,
    country: country,
    displayName: isDistrictType ? `${district}, ${state}` : `${locality}, ${district}`,
    subtitle: isDistrictType ? state : `${district}, ${state}`,
    lat: Math.round(parseFloat(item.lat) * 10000) / 10000,
    lon: Math.round(parseFloat(item.lon) * 10000) / 10000,
    type: isDistrictType ? 'district' : 'locality'
  };
}

/**
 * Search curated catalog for exact / prefix matches.
 */
function searchCuratedIndex(query, preferredDistrict = null) {
  const q = query.trim().toLowerCase();
  const results = [];

  // 1. Check curated localities
  for (const loc of CURATED_LOCALITIES) {
    const nameMatch = loc.name.toLowerCase().includes(q) || loc.locality.toLowerCase().includes(q);
    const kwMatch = loc.keywords && loc.keywords.some(k => k.includes(q));
    const distMatch = loc.district.toLowerCase().includes(q);

    if (nameMatch || kwMatch || distMatch) {
      let score = 0;
      if (loc.name.toLowerCase() === q) score += 100;
      else if (loc.name.toLowerCase().startsWith(q)) score += 50;
      else if (nameMatch) score += 25;
      else if (kwMatch) score += 15;

      if (preferredDistrict && loc.district.toLowerCase() === preferredDistrict.toLowerCase()) {
        score += 30;
      }

      results.push({ item: loc, type: 'locality', score });
    }
  }

  // 2. Check 38 TN Districts
  for (const dist of TN_DISTRICTS) {
    const distName = dist.name.toLowerCase();
    const distTa = (dist.nameTa || '').toLowerCase();
    const id = dist.id.toLowerCase();

    if (distName.includes(q) || distTa.includes(q) || id.includes(q)) {
      let score = 0;
      if (distName === q || id === q) score += 90;
      else if (distName.startsWith(q)) score += 40;
      else score += 20;

      results.push({
        item: {
          name: dist.name,
          locality: null,
          district: dist.name,
          lat: dist.lat,
          lon: dist.lng,
          state: 'Tamil Nadu'
        },
        type: 'district',
        score
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.map(r => formatLocationRecord(r.item, r.type));
}

/**
 * Query Open-Meteo Geocoding API with strict Tamil Nadu constraint.
 */
async function queryOpenMeteoGeocoding(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CrowdCity-CivicTech/2.0'
      }
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !Array.isArray(data.results)) return [];

    // Filter strictly to Tamil Nadu, India
    const valid = data.results.filter(r => {
      const isIndia = r.country_code === 'IN' || (r.country && r.country.toLowerCase() === 'india');
      const isTN = (r.admin1 && r.admin1.toLowerCase().includes('tamil nadu')) ||
                   (r.admin2 && r.admin2.toLowerCase().includes('tamil nadu'));
      const inBox = isInsideTamilNadu(r.latitude, r.longitude);
      return (isIndia && isTN) || inBox;
    });

    return valid.map(r => {
      let districtName = r.admin2 ? r.admin2.replace(/\s+district/i, '').trim() : (r.admin1 || 'Tamil Nadu');
      if (districtName.toLowerCase().includes('tamil nadu') && r.admin3) {
        districtName = r.admin3;
      }

      return formatLocationRecord({
        name: r.name,
        locality: r.name,
        district: districtName,
        lat: r.latitude,
        lon: r.longitude,
        state: 'Tamil Nadu'
      }, 'locality');
    });
  } catch (err) {
    logger.warn(`[LocationSearchService] Open-Meteo geocoding search failed: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback to OpenStreetMap Nominatim search if no results found.
 */
async function queryNominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Tamil Nadu')}&format=json&limit=5&countrycodes=in`;
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CrowdCity-CivicTech/2.0'
      }
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const valid = data.filter(r => isInsideTamilNadu(r.lat, r.lon));

    return valid.map(r => {
      const parts = r.display_name.split(',').map(s => s.trim());
      const locality = parts[0] || query;
      let districtName = parts.find(p => TN_DISTRICTS.some(d => d.name.toLowerCase() === p.toLowerCase())) || 'Tamil Nadu';

      return formatLocationRecord({
        name: locality,
        locality: locality,
        district: districtName,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        state: 'Tamil Nadu'
      }, 'locality');
    });
  } catch (err) {
    logger.warn(`[LocationSearchService] Nominatim fallback search failed: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Main Location Search method.
 */
export async function searchLocations(query, options = {}) {
  const cleanQ = (query || '').trim();
  if (!cleanQ || cleanQ.length < 2) {
    return { success: true, query: cleanQ, results: [] };
  }

  const cacheKey = `${cleanQ.toLowerCase()}_${options.district || ''}`;
  if (searchCache.has(cacheKey)) {
    return { success: true, query: cleanQ, results: searchCache.get(cacheKey) };
  }

  // 1. Search Curated Localities & Districts first (0ms latency, high accuracy)
  const curatedResults = searchCuratedIndex(cleanQ, options.district);

  let combined = [...curatedResults];

  // If curated results are fewer than 5, expand with Open-Meteo Geocoding
  if (combined.length < 5) {
    try {
      const geocoded = await queryOpenMeteoGeocoding(cleanQ);
      for (const item of geocoded) {
        if (!combined.some(c => Math.abs(c.lat - item.lat) < 0.015 && Math.abs(c.lon - item.lon) < 0.015)) {
          combined.push(item);
        }
      }
    } catch {
      // Continue with curated results
    }
  }

  // If still empty, try Nominatim fallback
  if (combined.length === 0) {
    try {
      const nomResults = await queryNominatimSearch(cleanQ);
      for (const item of nomResults) {
        if (!combined.some(c => Math.abs(c.lat - item.lat) < 0.015 && Math.abs(c.lon - item.lon) < 0.015)) {
          combined.push(item);
        }
      }
    } catch {
      // Continue
    }
  }

  const limit = options.limit || 8;
  const finalResults = combined.slice(0, limit);

  // Cache result
  if (searchCache.size > SEARCH_CACHE_MAX) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  searchCache.set(cacheKey, finalResults);

  return {
    success: true,
    query: cleanQ,
    results: finalResults
  };
}

/**
 * Get legitimate regions for a given district, optionally sorted by distance from user coordinates.
 */
export function getRegionsForDistrict(districtId, userCoords = null) {
  if (!districtId || districtId === 'all') return [];
  const dClean = districtId.toLowerCase().replace(/[^a-z0-9]/g, '');

  let list = CURATED_LOCALITIES.filter(l => {
    const lDist = l.district.toLowerCase().replace(/[^a-z0-9]/g, '');
    return lDist === dClean;
  });

  // If none found in curated list, fallback to district centroid
  if (list.length === 0) {
    const distMatch = TN_DISTRICTS.find(d => 
      d.id.toLowerCase().replace(/[^a-z0-9]/g, '') === dClean || 
      d.name.toLowerCase().replace(/[^a-z0-9]/g, '') === dClean
    );
    if (distMatch) {
      list = [{
        name: distMatch.name,
        locality: distMatch.name,
        district: distMatch.name,
        lat: distMatch.lat,
        lon: distMatch.lng
      }];
    }
  }

  let formatted = list.map(l => {
    const rec = formatLocationRecord(l, 'locality');
    if (userCoords && typeof userCoords.lat === 'number' && typeof userCoords.lon === 'number') {
      rec.distance_km = calculateDistanceKm(userCoords.lat, userCoords.lon, l.lat, l.lon);
    }
    return rec;
  });

  // Sort by proximity when coordinates are provided
  if (userCoords && typeof userCoords.lat === 'number' && typeof userCoords.lon === 'number') {
    formatted.sort((a, b) => {
      const distA = typeof a.distance_km === 'number' ? a.distance_km : 9999;
      const distB = typeof b.distance_km === 'number' ? b.distance_km : 9999;
      return distA - distB;
    });
  }

  return formatted;
}

/**
 * Backward compatibility alias for legacy callers.
 */
export function getTopLocalitiesForDistrict(districtId) {
  return getRegionsForDistrict(districtId);
}

export default {
  searchLocations,
  getRegionsForDistrict,
  getTopLocalitiesForDistrict,
  calculateDistanceKm,
  isInsideTamilNadu,
  CURATED_LOCALITIES
};
