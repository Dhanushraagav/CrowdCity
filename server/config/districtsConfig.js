/**
 * Centralized Configuration for all 38 Districts of Tamil Nadu
 * Provides authoritative metadata, geographic centroids, and locality matching.
 */

export const TN_DISTRICTS = [
  {
    id: 'ariyalur',
    name: 'Ariyalur',
    nameTa: 'அரியலூர்',
    code: 'ari',
    lat: 11.1401,
    lng: 79.0786,
    keywords: ['ariyalur', 'udayarpalayam', 'sendurai', 'andimadam', 'jayankondam', 'gangaikonda cholapuram']
  },
  {
    id: 'chengalpattu',
    name: 'Chengalpattu',
    nameTa: 'செங்கல்பட்டு',
    code: 'cpt',
    lat: 12.6841,
    lng: 79.9836,
    keywords: ['chengalpattu', 'tambaram', 'pallavaram', 'chromepet', 'maraimalai nagar', 'vandalur', 'kelambakkam', 'mahabalipuram', 'mamallapuram', 'maduranthakam', 'tiruporur', 'cheyyur']
  },
  {
    id: 'chennai',
    name: 'Chennai',
    nameTa: 'சென்னை',
    code: 'chn',
    lat: 13.0827,
    lng: 80.2707,
    keywords: ['chennai', 'madras', 't nagar', 'guindy', 'velachery', 'anna nagar', 'mylapore', 'adyar', 'egmore', 'royapettah', 'triplicane', 'george town', 'perambur', 'kilpauk', 'nungambakkam', 'saidapet']
  },
  {
    id: 'coimbatore',
    name: 'Coimbatore',
    nameTa: 'கோயம்புத்தூர்',
    code: 'cbe',
    lat: 11.0168,
    lng: 76.9558,
    keywords: ['coimbatore', 'kovai', 'sulur', 'kannampalayam', 'irugur', 'peelamedu', 'gandhipuram', 'rs puram', 'singanallur', 'saravanampatti', 'pollachi', 'mettupalayam', 'thudiyalur', 'kinathukadavu', 'valparai', 'pappampatty']
  },
  {
    id: 'cuddalore',
    name: 'Cuddalore',
    nameTa: 'கடலூர்',
    code: 'cud',
    lat: 11.7480,
    lng: 79.7714,
    keywords: ['cuddalore', 'chidambaram', 'panruti', 'vriddhachalam', 'neveli', 'neyveli', 'kurinjipadi', 'tittakudi', 'bhuvanagiri', 'srimushnam']
  },
  {
    id: 'dharmapuri',
    name: 'Dharmapuri',
    nameTa: 'தர்மபுரி',
    code: 'dpi',
    lat: 12.1211,
    lng: 78.1582,
    keywords: ['dharmapuri', 'harur', 'palacode', 'pennagaram', 'marandahalli', 'pappireddipatti', 'karimangalam', 'nallampalli']
  },
  {
    id: 'dindigul',
    name: 'Dindigul',
    nameTa: 'திண்டுக்கல்',
    code: 'dgl',
    lat: 10.3673,
    lng: 77.9803,
    keywords: ['dindigul', 'palani', 'kodaikanal', 'odaipatti', 'natham', 'nilakkottai', 'attur', 'vedasandur', 'gujjiliamparai']
  },
  {
    id: 'erode',
    name: 'Erode',
    nameTa: 'ஈரோடு',
    code: 'erd',
    lat: 11.3410,
    lng: 77.7172,
    keywords: ['erode', 'bhavani', 'gobichettipalayam', 'perundurai', 'anthiyur', 'sathyamangalam', 'kodumudi', 'modakkurichi', 'thalavadi']
  },
  {
    id: 'kallakurichi',
    name: 'Kallakurichi',
    nameTa: 'கள்ளக்குறிச்சி',
    code: 'kki',
    lat: 11.7384,
    lng: 78.9597,
    keywords: ['kallakurichi', 'sankarapuram', 'chinnasalem', 'ulundurpet', 'tirukoilur', 'kalvarayan hills', 'manalurpet']
  },
  {
    id: 'kancheepuram',
    name: 'Kancheepuram',
    nameTa: 'காஞ்சிபுரம்',
    code: 'kpm',
    lat: 12.8342,
    lng: 79.7036,
    keywords: ['kancheepuram', 'kanchipuram', 'sriperumbudur', 'walajabad', 'kundrathur', 'uthiramerur']
  },
  {
    id: 'kanniyakumari',
    name: 'Kanniyakumari',
    nameTa: 'கன்னியாகுமரி',
    code: 'kkm',
    lat: 8.0883,
    lng: 77.5385,
    keywords: ['kanniyakumari', 'kanyakumari', 'nagercoil', 'thuckalay', 'marthandam', 'kuzhithurai', 'padmanabhapuram', 'agastheeswaram', 'killiyoor']
  },
  {
    id: 'karur',
    name: 'Karur',
    nameTa: 'கரூர்',
    code: 'krr',
    lat: 10.9601,
    lng: 78.0766,
    keywords: ['karur', 'kulithalai', 'aravakurichi', 'krishnarayapuram', 'manmangalam', 'pugalur', 'kadavur']
  },
  {
    id: 'krishnagiri',
    name: 'Krishnagiri',
    nameTa: 'கிருஷ்ணகிரி',
    code: 'kgi',
    lat: 12.5186,
    lng: 78.2137,
    keywords: ['krishnagiri', 'hosur', 'denkanikottai', 'pochampalli', 'uthangarai', 'bargur', 'shoolagiri', 'kelamangalam']
  },
  {
    id: 'madurai',
    name: 'Madurai',
    nameTa: 'மதுரை',
    code: 'mdu',
    lat: 9.9252,
    lng: 78.1198,
    keywords: ['madurai', 'melur', 'thirumangalam', 'usilampatti', 'vadipatti', 'sholavandan', 'alanganallur', 'peraiyur', 'tirupparankunram']
  },
  {
    id: 'mayiladuthurai',
    name: 'Mayiladuthurai',
    nameTa: 'மயிலாடுதுறை',
    code: 'myd',
    lat: 11.1035,
    lng: 79.6548,
    keywords: ['mayiladuthurai', 'sirazhi', 'sirkazhi', 'tarangambadi', 'tharangambadi', 'kuthalam', 'poompuhar']
  },
  {
    id: 'nagapattinam',
    name: 'Nagapattinam',
    nameTa: 'நாகப்பட்டினம்',
    code: 'ngp',
    lat: 10.7672,
    lng: 79.8449,
    keywords: ['nagapattinam', 'velankanni', 'vedaranyam', 'kilvelur', 'thirukkuvalai', 'nagore']
  },
  {
    id: 'namakkal',
    name: 'Namakkal',
    nameTa: 'நாமக்கல்',
    code: 'nmk',
    lat: 11.2189,
    lng: 78.1674,
    keywords: ['namakkal', 'tiruchengode', 'rasipuram', 'paramathi velur', 'kolli hills', 'sendamangalam', 'kumarapalayam']
  },
  {
    id: 'nilgiris',
    name: 'The Nilgiris',
    nameTa: 'நீலகிரி',
    code: 'nil',
    lat: 11.4916,
    lng: 76.7337,
    keywords: ['nilgiris', 'the nilgiris', 'ooty', 'udhagamandalam', 'coonoor', 'kotagiri', 'gudalur', 'pandalur', 'kundah']
  },
  {
    id: 'perambalur',
    name: 'Perambalur',
    nameTa: 'பெரம்பலூர்',
    code: 'pbl',
    lat: 11.2342,
    lng: 78.8821,
    keywords: ['perambalur', 'veppanthattai', 'kunnam', 'alathur']
  },
  {
    id: 'pudukkottai',
    name: 'Pudukkottai',
    nameTa: 'புதுக்கோட்டை',
    code: 'pdk',
    lat: 10.3797,
    lng: 78.8208,
    keywords: ['pudukkottai', 'pudukottai', 'aranthangi', 'illuppur', 'karambakkudi', 'kulathur', 'alangudi', 'gandarvakottai', 'avudaiyarkoil', 'manamelkudi', 'viralimalai']
  },
  {
    id: 'ramanathapuram',
    name: 'Ramanathapuram',
    nameTa: 'இராமநாதபுரம்',
    code: 'ram',
    lat: 9.3639,
    lng: 78.8395,
    keywords: ['ramanathapuram', 'ramnad', 'rameswaram', 'paramakudi', 'tiruvadanai', 'r s mangalam', 'rs mangalam', 'mudukulathur', 'kamuthi', 'kilakarai', 'kadaladi']
  },
  {
    id: 'ranipet',
    name: 'Ranipet',
    nameTa: 'ராணிப்பேட்டை',
    code: 'rpt',
    lat: 12.9229,
    lng: 79.3329,
    keywords: ['ranipet', 'walajah', 'arcot', 'arrakkonam', 'arakkonam', 'sholinghur', 'nemili', 'panapakkam']
  },
  {
    id: 'salem',
    name: 'Salem',
    nameTa: 'சேலம்',
    code: 'slm',
    lat: 11.6643,
    lng: 78.1460,
    keywords: ['salem', 'mettur', 'attur', 'omalur', 'edappadi', 'sankari', 'valapady', 'gangavalli', 'yercaud', 'kadaiyampatti']
  },
  {
    id: 'sivaganga',
    name: 'Sivaganga',
    nameTa: 'சிவகங்கை',
    code: 'svg',
    lat: 9.8433,
    lng: 78.4809,
    keywords: ['sivaganga', 'karaikudi', 'devakottai', 'manamadurai', 'tiruppattur', 'ilayangudi', 'kalaiyarkovil', 'singampunari']
  },
  {
    id: 'tenkasi',
    name: 'Tenkasi',
    nameTa: 'தென்காசி',
    code: 'tks',
    lat: 8.9594,
    lng: 77.3161,
    keywords: ['tenkasi', 'sankarankovil', 'courtallam', 'kutralam', 'kadayanallur', 'puliyankudi', 'shenkottai', 'sivagiri', 'veerakeralamputhur', 'alankulam', 'thiruvengadam']
  },
  {
    id: 'thanjavur',
    name: 'Thanjavur',
    nameTa: 'தஞ்சாவூர்',
    code: 'tjr',
    lat: 10.7870,
    lng: 79.1378,
    keywords: ['thanjavur', 'tanjore', 'kumbakonam', 'papanasam', 'pattukkottai', 'orathanadu', 'thiruvaiyaru', 'peravurani', 'budalur', 'thiruvidaimarudur']
  },
  {
    id: 'theni',
    name: 'Theni',
    nameTa: 'தேனி',
    code: 'tni',
    lat: 10.0104,
    lng: 77.4768,
    keywords: ['theni', 'periyakulam', 'bodinayakanur', 'bodi', 'uthamapalayam', 'cumbum', 'andipatti']
  },
  {
    id: 'thoothukudi',
    name: 'Thoothukudi',
    nameTa: 'தூத்துக்குடி',
    code: 'tcy',
    lat: 8.7642,
    lng: 78.1348,
    keywords: ['thoothukudi', 'tuticorin', 'kovilpatti', 'tiruchendur', 'kayalpattinam', 'srivaikuntam', 'vilathikulam', 'ottapidaram', 'sattankulam', 'erall']
  },
  {
    id: 'tiruchirappalli',
    name: 'Tiruchirappalli',
    nameTa: 'திருச்சிராப்பள்ளி',
    code: 'try',
    lat: 10.7905,
    lng: 78.7047,
    keywords: ['tiruchirappalli', 'trichy', 'thiruverumbur', 'srirangam', 'manapparai', 'musiri', 'lalgudi', 'thuraiyur', 'marungapuri']
  },
  {
    id: 'tirunelveli',
    name: 'Tirunelveli',
    nameTa: 'திருநெல்வேலி',
    code: 'tnv',
    lat: 8.7139,
    lng: 77.7567,
    keywords: ['tirunelveli', 'palayamkottai', 'ambasamudram', 'cheranmahadevi', 'nanguneri', 'radhapuram', 'tisayanvilai', 'kalakkad']
  },
  {
    id: 'tirupathur',
    name: 'Tirupathur',
    nameTa: 'திருப்பத்தூர்',
    code: 'tpt',
    lat: 12.4926,
    lng: 78.5638,
    keywords: ['tirupathur', 'vaniyambadi', 'ambur', 'natrampalli', 'yelagiri']
  },
  {
    id: 'tiruppur',
    name: 'Tiruppur',
    nameTa: 'திருப்பூர்',
    code: 'tup',
    lat: 11.1085,
    lng: 77.3411,
    keywords: ['tiruppur', 'tirupur', 'avinashi', 'palladam', 'dharapuram', 'kangeyam', 'udumalaipettai', 'madathukulam', 'uthukuli']
  },
  {
    id: 'tiruvallur',
    name: 'Tiruvallur',
    nameTa: 'திருவள்ளூர்',
    code: 'tlr',
    lat: 13.1432,
    lng: 79.9083,
    keywords: ['tiruvallur', 'avadi', 'ambattur', 'ponneri', 'gummidipoondi', 'poonamallee', 'tiruttani', 'uthukottai', 'pallipattu']
  },
  {
    id: 'tiruvannamalai',
    name: 'Tiruvannamalai',
    nameTa: 'திருவண்ணாமலை',
    code: 'tvm',
    lat: 12.2253,
    lng: 79.0747,
    keywords: ['tiruvannamalai', 'arani', 'cheyyar', 'polur', 'chengappattu', 'vandavasi', 'chengattur', 'chengam', 'thandarampattu', 'kalasapakkam', 'jawadhu hills']
  },
  {
    id: 'tiruvarur',
    name: 'Tiruvarur',
    nameTa: 'திருவாரூர்',
    code: 'tvr',
    lat: 10.7661,
    lng: 79.6344,
    keywords: ['tiruvarur', 'thiruvarur', 'mannargudi', 'thiruthuraipoondi', 'nannilam', 'kudavasal', 'valangaiman', 'koothanallur']
  },
  {
    id: 'vellore',
    name: 'Vellore',
    nameTa: 'வேலூர்',
    code: 'vel',
    lat: 12.9165,
    lng: 79.1325,
    keywords: ['vellore', 'katpadi', 'gudiyatham', 'anaicut', 'kv kuppam', 'pernambut']
  },
  {
    id: 'viluppuram',
    name: 'Viluppuram',
    nameTa: 'விழுப்புரம்',
    code: 'vpm',
    lat: 11.9401,
    lng: 79.4861,
    keywords: ['viluppuram', 'villupuram', 'tindivanam', 'gingee', 'vanur', 'vikravandi', 'kandachipuram', 'marakkanam']
  },
  {
    id: 'virudhunagar',
    name: 'Virudhunagar',
    nameTa: 'விருதுநகர்',
    code: 'vnr',
    lat: 9.5680,
    lng: 77.9624,
    keywords: ['virudhunagar', 'sivakasi', 'srivilliputhur', 'rajapalayam', 'aruppukkottai', 'sattur', 'kariyapatti', 'tiruchuli', 'vembakottai']
  }
];

/**
 * Approximate Haversine Distance in Kilometers
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Resolve District with High Precision:
 * 1. Checks given explicit district column
 * 2. Keyword & taluk matching on address string
 * 3. Spatial nearest centroid from coordinates
 */
export function resolveDistrict(issue = {}) {
  // 1. If explicit valid district name is passed
  if (issue.district && typeof issue.district === 'string') {
    const directMatch = TN_DISTRICTS.find(d => 
      d.name.toLowerCase() === issue.district.trim().toLowerCase() ||
      d.id === issue.district.trim().toLowerCase()
    );
    if (directMatch) return directMatch;
  }

  const lat = parseFloat(issue.latitude);
  const lng = parseFloat(issue.longitude);
  const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat >= 8.0 && lat <= 13.6 && lng >= 76.0 && lng <= 80.5;

  let candidateFromText = null;
  const addressText = (issue.address || issue.title || '').toLowerCase();

  if (addressText) {
    // Check specific locality/taluk keywords first (e.g. 'sulur', 'guindy', 'tambaram', 'kannampalayam')
    for (const dist of TN_DISTRICTS) {
      for (const kw of dist.keywords) {
        if (kw !== dist.name.toLowerCase() && addressText.includes(kw)) {
          candidateFromText = dist;
          break;
        }
      }
      if (candidateFromText) break;
    }

    // Then check full district names
    if (!candidateFromText) {
      for (const dist of TN_DISTRICTS) {
        const distRegex = new RegExp(`\\b${dist.name.toLowerCase()}\\b`, 'i');
        if (distRegex.test(addressText)) {
          candidateFromText = dist;
          break;
        }
      }
    }
  }

  // If coordinates are valid, verify candidate geographic plausibility or find nearest centroid
  if (hasValidCoords) {
    if (candidateFromText) {
      const distFromCandidate = haversineDistanceKm(lat, lng, candidateFromText.lat, candidateFromText.lng);
      if (distFromCandidate <= 80) {
        return candidateFromText;
      }
    }

    // Find nearest district centroid
    let nearestDistrict = null;
    let minDistance = Infinity;
    for (const dist of TN_DISTRICTS) {
      const distKm = haversineDistanceKm(lat, lng, dist.lat, dist.lng);
      if (distKm < minDistance) {
        minDistance = distKm;
        nearestDistrict = dist;
      }
    }
    if (nearestDistrict) return nearestDistrict;
  }

  if (candidateFromText) return candidateFromText;

  // Fallback to Chennai or first district
  return TN_DISTRICTS.find(d => d.id === 'chennai') || TN_DISTRICTS[0];
}

export function getAllDistricts() {
  return TN_DISTRICTS;
}

export function getDistrictById(id) {
  if (!id) return null;
  const cleanId = String(id).toLowerCase().trim();
  return TN_DISTRICTS.find(d => d.id === cleanId || d.name.toLowerCase() === cleanId);
}
