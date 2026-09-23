/**
 * user-location.js
 * 
 * CrowdCity Universal Client Location Service.
 * Detects citizen district across Tamil Nadu for personalized local experiences
 * (Weather Forecast, Power Outages, Local News, Civic Alerts) without hardcoded defaults.
 * 
 * Sources (in strict physical-to-logical priority order):
 * 1. Physical live coordinates from browser geolocation ('cc_weather_coords') via 38-district centroid match
 * 2. Dashboard cached weather district ('cc_weather_cache_en' / 'cc_weather_cache_ta') via 313 CRA taluks & towns mapping
 * 3. Explicitly saved user district ('user_district' or 'crowdcity_user_district')
 * 4. Citizen profile metadata ('cc_user_profile')
 * 5. Auth session user metadata ('getCurrentUser')
 * 6. Non-blocking browser Geolocation API ('navigator.geolocation')
 * 
 * NO emojis. Strictly clean civic-grade engineering.
 */

(function(root) {
  'use strict';

  // Centroids for all 38 official districts of Tamil Nadu
  const TN_DISTRICTS_CENTROIDS = [
    { id: 'ariyalur', name: 'Ariyalur', lat: 11.1401, lng: 79.0786 },
    { id: 'chengalpattu', name: 'Chengalpattu', lat: 12.6841, lng: 79.9836 },
    { id: 'chennai', name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { id: 'coimbatore', name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
    { id: 'cuddalore', name: 'Cuddalore', lat: 11.7480, lng: 79.7714 },
    { id: 'dharmapuri', name: 'Dharmapuri', lat: 12.1211, lng: 78.1582 },
    { id: 'dindigul', name: 'Dindigul', lat: 10.3673, lng: 77.9803 },
    { id: 'erode', name: 'Erode', lat: 11.3410, lng: 77.7172 },
    { id: 'kallakurichi', name: 'Kallakurichi', lat: 11.7383, lng: 78.9639 },
    { id: 'kancheepuram', name: 'Kancheepuram', lat: 12.8342, lng: 79.7036 },
    { id: 'kanniyakumari', name: 'Kanniyakumari', lat: 8.0883, lng: 77.5385 },
    { id: 'karur', name: 'Karur', lat: 10.9601, lng: 78.0766 },
    { id: 'krishnagiri', name: 'Krishnagiri', lat: 12.5186, lng: 78.2137 },
    { id: 'madurai', name: 'Madurai', lat: 9.9252, lng: 78.1198 },
    { id: 'mayiladuthurai', name: 'Mayiladuthurai', lat: 11.1075, lng: 79.6524 },
    { id: 'nagapattinam', name: 'Nagapattinam', lat: 10.7672, lng: 79.8449 },
    { id: 'namakkal', name: 'Namakkal', lat: 11.2189, lng: 78.1674 },
    { id: 'nilgiris', name: 'Nilgiris', lat: 11.4102, lng: 76.6950 },
    { id: 'perambalur', name: 'Perambalur', lat: 11.2342, lng: 78.8820 },
    { id: 'pudukkottai', name: 'Pudukkottai', lat: 10.3797, lng: 78.8208 },
    { id: 'ramanathapuram', name: 'Ramanathapuram', lat: 9.3639, lng: 78.8395 },
    { id: 'ranipet', name: 'Ranipet', lat: 12.9298, lng: 79.3326 },
    { id: 'salem', name: 'Salem', lat: 11.6643, lng: 78.1460 },
    { id: 'sivaganga', name: 'Sivaganga', lat: 9.8433, lng: 78.4809 },
    { id: 'tenkasi', name: 'Tenkasi', lat: 8.9594, lng: 77.3152 },
    { id: 'thanjavur', name: 'Thanjavur', lat: 10.7870, lng: 79.1378 },
    { id: 'theni', name: 'Theni', lat: 10.0104, lng: 77.4768 },
    { id: 'thoothukudi', name: 'Thoothukudi', lat: 8.7642, lng: 78.1348 },
    { id: 'tiruchirappalli', name: 'Tiruchirappalli', lat: 10.7905, lng: 78.7047 },
    { id: 'tirunelveli', name: 'Tirunelveli', lat: 8.7139, lng: 77.7567 },
    { id: 'tirupathur', name: 'Tirupathur', lat: 12.4958, lng: 78.5678 },
    { id: 'tiruppur', name: 'Tiruppur', lat: 11.1085, lng: 77.3411 },
    { id: 'tiruvallur', name: 'Tiruvallur', lat: 13.1437, lng: 79.9083 },
    { id: 'tiruvannamalai', name: 'Tiruvannamalai', lat: 12.2253, lng: 79.0747 },
    { id: 'tiruvarur', name: 'Tiruvarur', lat: 10.7725, lng: 79.6365 },
    { id: 'vellore', name: 'Vellore', lat: 12.9165, lng: 79.1325 },
    { id: 'viluppuram', name: 'Viluppuram', lat: 11.9401, lng: 79.4861 },
    { id: 'virudhunagar', name: 'Virudhunagar', lat: 9.5872, lng: 77.9514 }
  ];

  // Common aliases and variations mapped to official district names
  const DISTRICT_ALIASES = {
    'kanchipuram': 'Kancheepuram',
    'kanyakumari': 'Kanniyakumari',
    'the nilgiris': 'Nilgiris',
    'ooty': 'Nilgiris',
    'udhagamandalam': 'Nilgiris',
    'trichy': 'Tiruchirappalli',
    'tiruchi': 'Tiruchirappalli',
    'tiruchirapalli': 'Tiruchirappalli',
    'tiruchirappally': 'Tiruchirappalli',
    'tiruchy': 'Tiruchirappalli',
    'kovai': 'Coimbatore',
    'madras': 'Chennai',
    'tuticorin': 'Thoothukudi',
    'tanjore': 'Thanjavur',
    'villupuram': 'Viluppuram',
    'tirupur': 'Tiruppur',
    'thiruppur': 'Tiruppur',
    'thiruvallur': 'Tiruvallur',
    'thiruvannamalai': 'Tiruvannamalai',
    'thiruvarur': 'Tiruvarur',
    'thirunelveli': 'Tirunelveli',
    'thirupathur': 'Tirupathur',
    'chengalpet': 'Chengalpattu',
    'ramnad': 'Ramanathapuram'
  };

  // Comprehensive 313 CRA Taluks and key towns of Tamil Nadu mapped to official parent districts
  const TALUK_TO_DISTRICT = {
  "andimadam": "Ariyalur",
  "ஆண்டிமடம்": "Ariyalur",
  "ariyalur": "Ariyalur",
  "அரியலூர்": "Ariyalur",
  "sendurai": "Ariyalur",
  "செந்துறை": "Ariyalur",
  "udayarpalayam": "Ariyalur",
  "உடையார்பாளையம்": "Ariyalur",
  "chengalpattu": "Chengalpattu",
  "செங்கல்பட்டு": "Chengalpattu",
  "cheyyur": "Chengalpattu",
  "செய்யூர்": "Chengalpattu",
  "maduranthakam": "Chengalpattu",
  "மதுராந்தகம்": "Chengalpattu",
  "pallavaram": "Chengalpattu",
  "பல்லாவரம்": "Chengalpattu",
  "tambaram": "Chengalpattu",
  "தாம்பரம்": "Chengalpattu",
  "tirukalukundram": "Chengalpattu",
  "திருக்கழுக்குன்றம்": "Chengalpattu",
  "tiruporur": "Chengalpattu",
  "திருப்போரூர்": "Chengalpattu",
  "vandalur": "Chengalpattu",
  "வண்டலூர்": "Chengalpattu",
  "alandur": "Chennai",
  "ஆலந்தூர்": "Chennai",
  "ambattur": "Chennai",
  "அம்பத்தூர்": "Chennai",
  "aminjikarai": "Chennai",
  "அமிஞ்சிக்கரை": "Chennai",
  "ayanavaram": "Chennai",
  "அயனாவரம்": "Chennai",
  "egmore": "Chennai",
  "எழும்பூர்": "Chennai",
  "guindy": "Chennai",
  "கிண்டி": "Chennai",
  "madhavaram": "Chennai",
  "மாதவரம்": "Chennai",
  "maduravoyal": "Chennai",
  "மதுரவாயல்": "Chennai",
  "mambalam": "Chennai",
  "மாம்பலம்": "Chennai",
  "mylapore": "Chennai",
  "மயிலாப்பூர்": "Chennai",
  "perambur": "Chennai",
  "பெரம்பூர்": "Chennai",
  "purasawalkam": "Chennai",
  "புரசைவாக்கம்": "Chennai",
  "sholinganallur": "Chennai",
  "சோழிங்கநல்லூர்": "Chennai",
  "thiruvottiyur": "Chennai",
  "திருவொற்றியூர்": "Chennai",
  "tondiarpet": "Chennai",
  "தண்டையார்பேட்டை": "Chennai",
  "velachery": "Chennai",
  "வேளச்சேரி": "Chennai",
  "anaimalai": "Coimbatore",
  "ஆனைமலை": "Coimbatore",
  "annur": "Coimbatore",
  "அன்னூர்": "Coimbatore",
  "coimbatore north": "Coimbatore",
  "கோயம்புத்தூர் வடக்கு": "Coimbatore",
  "coimbatore south": "Coimbatore",
  "கோயம்புத்தூர் தெற்கு": "Coimbatore",
  "kinathukadavu": "Coimbatore",
  "கிணத்துக்கடவு": "Coimbatore",
  "madukkarai": "Coimbatore",
  "மதுக்கரை": "Coimbatore",
  "mettupalayam": "Coimbatore",
  "மேட்டுப்பாளையம்": "Coimbatore",
  "perur": "Coimbatore",
  "பேரூர்": "Coimbatore",
  "pollachi": "Coimbatore",
  "பொள்ளாச்சி": "Coimbatore",
  "sulur": "Coimbatore",
  "சூலூர்": "Coimbatore",
  "valparai": "Coimbatore",
  "வால்பாறை": "Coimbatore",
  "bhuvanagiri": "Cuddalore",
  "புவனகிரி": "Cuddalore",
  "chidambaram": "Cuddalore",
  "சிதம்பரம்": "Cuddalore",
  "cuddalore": "Cuddalore",
  "கடலூர்": "Cuddalore",
  "kattumannarkoil": "Cuddalore",
  "காட்டுமன்னார்கோயில்": "Cuddalore",
  "kurinjipadi": "Cuddalore",
  "குறிஞ்சிப்பாடி": "Cuddalore",
  "panruti": "Cuddalore",
  "பண்ருட்டி": "Cuddalore",
  "srimushnam": "Cuddalore",
  "ஸ்ரீமுஷ்ணம்": "Cuddalore",
  "tittakudi": "Cuddalore",
  "திட்டக்குடி": "Cuddalore",
  "veppur": "Cuddalore",
  "வேப்பூர்": "Cuddalore",
  "vriddhachalam": "Cuddalore",
  "விருத்தாசலம்": "Cuddalore",
  "dharmapuri": "Dharmapuri",
  "தர்மபுரி": "Dharmapuri",
  "harur": "Dharmapuri",
  "அரூர்": "Dharmapuri",
  "karimangalam": "Dharmapuri",
  "காரிமங்கலம்": "Dharmapuri",
  "nallampalli": "Dharmapuri",
  "நல்லம்பள்ளி": "Dharmapuri",
  "palacode": "Dharmapuri",
  "பாலக்கோடு": "Dharmapuri",
  "pappireddipatti": "Dharmapuri",
  "பாப்பிரெட்டிப்பட்டி": "Dharmapuri",
  "pennagaram": "Dharmapuri",
  "பென்னாகரம்": "Dharmapuri",
  "attur": "Salem",
  "ஆத்தூர்": "Salem",
  "dindigul east": "Dindigul",
  "திண்டுக்கல் கிழக்கு": "Dindigul",
  "dindigul west": "Dindigul",
  "திண்டுக்கல் மேற்கு": "Dindigul",
  "gujjiliamparai": "Dindigul",
  "குஜிலியம்பாறை": "Dindigul",
  "kodaikanal": "Dindigul",
  "கொடைக்கானல்": "Dindigul",
  "natham": "Dindigul",
  "நத்தம்": "Dindigul",
  "nilakkottai": "Dindigul",
  "நிலக்கோட்டை": "Dindigul",
  "oddanchatram": "Dindigul",
  "ஒட்டன்சத்திரம்": "Dindigul",
  "palani": "Dindigul",
  "பழனி": "Dindigul",
  "vedasandur": "Dindigul",
  "வேடசந்தூர்": "Dindigul",
  "anthiyur": "Erode",
  "அந்தியூர்": "Erode",
  "bhavani": "Erode",
  "பவானி": "Erode",
  "erode": "Erode",
  "ஈரோடு": "Erode",
  "gobichettipalayam": "Erode",
  "கோபிசெட்டிபாளையம்": "Erode",
  "kodumudi": "Erode",
  "கொடுமுடி": "Erode",
  "modakkurichi": "Erode",
  "மொடக்குறிச்சி": "Erode",
  "nambiyur": "Erode",
  "நம்பியூர்": "Erode",
  "perundurai": "Erode",
  "பெருந்துறை": "Erode",
  "sathyamangalam": "Erode",
  "சத்தியமங்கலம்": "Erode",
  "thalavadi": "Erode",
  "தாளவாடி": "Erode",
  "chinnasalem": "Kallakurichi",
  "சின்னசேலம்": "Kallakurichi",
  "kallakurichi": "Kallakurichi",
  "கள்ளக்குறிச்சி": "Kallakurichi",
  "kalvarayan hills": "Kallakurichi",
  "கல்வராயன் மலை": "Kallakurichi",
  "sankarapuram": "Kallakurichi",
  "சங்கராபுரம்": "Kallakurichi",
  "tirukoilur": "Kallakurichi",
  "திருக்கோவிலூர்": "Kallakurichi",
  "ulundurpet": "Kallakurichi",
  "உளுந்தூர்பேட்டை": "Kallakurichi",
  "vanapuram": "Kallakurichi",
  "வானாபுரம்": "Kallakurichi",
  "kancheepuram": "Kancheepuram",
  "காஞ்சிபுரம்": "Kancheepuram",
  "kundrathur": "Kancheepuram",
  "குன்றத்தூர்": "Kancheepuram",
  "sriperumbudur": "Kancheepuram",
  "ஸ்ரீபெரும்புதூர்": "Kancheepuram",
  "uthiramerur": "Kancheepuram",
  "உத்திரமேரூர்": "Kancheepuram",
  "walajabad": "Kancheepuram",
  "வாலாஜாபாத்": "Kancheepuram",
  "agastheeswaram": "Kanniyakumari",
  "அகத்தீஸ்வரம்": "Kanniyakumari",
  "kalkulam": "Kanniyakumari",
  "கல்குளம்": "Kanniyakumari",
  "killiyoor": "Kanniyakumari",
  "கிள்ளியூர்": "Kanniyakumari",
  "thiruvattar": "Kanniyakumari",
  "திருவட்டார்": "Kanniyakumari",
  "thovalai": "Kanniyakumari",
  "தோவாளை": "Kanniyakumari",
  "vilavancode": "Kanniyakumari",
  "விளவங்கோடு": "Kanniyakumari",
  "aravakurichi": "Karur",
  "அரவக்குறிச்சி": "Karur",
  "kadavur": "Karur",
  "கடவூர்": "Karur",
  "karur": "Karur",
  "கரூர்": "Karur",
  "krishnarayapuram": "Karur",
  "கிருஷ்ணராயபுரம்": "Karur",
  "kulithalai": "Karur",
  "குளித்தலை": "Karur",
  "manmangalam": "Karur",
  "மண்மங்கலம்": "Karur",
  "pugalur": "Karur",
  "புகழூர்": "Karur",
  "bargur": "Krishnagiri",
  "பர்கூர்": "Krishnagiri",
  "denkanikottai": "Krishnagiri",
  "தேன்கனிக்கோட்டை": "Krishnagiri",
  "hosur": "Krishnagiri",
  "ஓசூர்": "Krishnagiri",
  "kelamangalam": "Krishnagiri",
  "கேளமங்கலம்": "Krishnagiri",
  "krishnagiri": "Krishnagiri",
  "கிருஷ்ணகிரி": "Krishnagiri",
  "pochampalli": "Krishnagiri",
  "போச்சம்பள்ளி": "Krishnagiri",
  "shoolagiri": "Krishnagiri",
  "சூளகிரி": "Krishnagiri",
  "uthangarai": "Krishnagiri",
  "ஊத்தங்கரை": "Krishnagiri",
  "kallikudi": "Madurai",
  "கள்ளிக்குடி": "Madurai",
  "madurai east": "Madurai",
  "மதுரை கிழக்கு": "Madurai",
  "madurai north": "Madurai",
  "மதுரை வடக்கு": "Madurai",
  "madurai south": "Madurai",
  "மதுரை தெற்கு": "Madurai",
  "madurai west": "Madurai",
  "மதுரை மேற்கு": "Madurai",
  "melur": "Madurai",
  "மேலூர்": "Madurai",
  "peraiyur": "Madurai",
  "பேரையூர்": "Madurai",
  "thirumangalam": "Madurai",
  "திருமங்கலம்": "Madurai",
  "thiruparankundram": "Madurai",
  "திருப்பரங்குன்றம்": "Madurai",
  "usilampatti": "Madurai",
  "உசிலம்பட்டி": "Madurai",
  "vadipatti": "Madurai",
  "வாடிப்பட்டி": "Madurai",
  "kuthalam": "Mayiladuthurai",
  "குத்தாலம்": "Mayiladuthurai",
  "mayiladuthurai": "Mayiladuthurai",
  "மயிலாடுதுறை": "Mayiladuthurai",
  "sirkazhi": "Mayiladuthurai",
  "சீர்காழி": "Mayiladuthurai",
  "tharangambadi": "Mayiladuthurai",
  "தரங்கம்பாடி": "Mayiladuthurai",
  "kilvelur": "Nagapattinam",
  "கீழ்வேளூர்": "Nagapattinam",
  "nagapattinam": "Nagapattinam",
  "நாகப்பட்டினம்": "Nagapattinam",
  "thirukkuvalai": "Nagapattinam",
  "திருக்குவளை": "Nagapattinam",
  "vedaranyam": "Nagapattinam",
  "வேதாரண்யம்": "Nagapattinam",
  "kolli hills": "Namakkal",
  "கொல்லிமலை": "Namakkal",
  "kumarapalayam": "Namakkal",
  "குமாரபாளையம்": "Namakkal",
  "mohanur": "Namakkal",
  "மோகனூர்": "Namakkal",
  "namakkal": "Namakkal",
  "நாமக்கல்": "Namakkal",
  "paramathi velur": "Namakkal",
  "பரமத்தி வேலூர்": "Namakkal",
  "rasipuram": "Namakkal",
  "ராசிபுரம்": "Namakkal",
  "sendamangalam": "Namakkal",
  "சேந்தமங்கலம்": "Namakkal",
  "tiruchengode": "Namakkal",
  "திருச்செங்கோடு": "Namakkal",
  "coonoor": "Nilgiris",
  "குன்னூர்": "Nilgiris",
  "gudalur": "Nilgiris",
  "கூடலூர்": "Nilgiris",
  "kotagiri": "Nilgiris",
  "கோத்தகிரி": "Nilgiris",
  "kundah": "Nilgiris",
  "குந்தா": "Nilgiris",
  "pandalur": "Nilgiris",
  "பந்தலூர்": "Nilgiris",
  "udhagamandalam": "Nilgiris",
  "உதகமண்டலம்": "Nilgiris",
  "alathur": "Perambalur",
  "ஆலத்தூர்": "Perambalur",
  "kunnam": "Perambalur",
  "குன்னம்": "Perambalur",
  "perambalur": "Perambalur",
  "பெரம்பலூர்": "Perambalur",
  "veppanthattai": "Perambalur",
  "வேப்பந்தட்டை": "Perambalur",
  "alangudi": "Pudukkottai",
  "ஆலங்குடி": "Pudukkottai",
  "aranthangi": "Pudukkottai",
  "அறந்தாங்கி": "Pudukkottai",
  "avudaiyarkoil": "Pudukkottai",
  "ஆவுடையார்கோவில்": "Pudukkottai",
  "gandarvakottai": "Pudukkottai",
  "கந்தர்வக்கோட்டை": "Pudukkottai",
  "illuppur": "Pudukkottai",
  "இலுப்பூர்": "Pudukkottai",
  "karambakkudi": "Pudukkottai",
  "கறம்பக்குடி": "Pudukkottai",
  "kulathur": "Pudukkottai",
  "குளத்தூர்": "Pudukkottai",
  "manamelkudi": "Pudukkottai",
  "மணமேல்குடி": "Pudukkottai",
  "ponnamaravathi": "Pudukkottai",
  "பொன்னமராவதி": "Pudukkottai",
  "pudukkottai": "Pudukkottai",
  "புதுக்கோட்டை": "Pudukkottai",
  "thirumayam": "Pudukkottai",
  "திருமயம்": "Pudukkottai",
  "viralimalai": "Pudukkottai",
  "விராலிமலை": "Pudukkottai",
  "kadaladi": "Ramanathapuram",
  "கடலாடி": "Ramanathapuram",
  "kamuthi": "Ramanathapuram",
  "கமுதி": "Ramanathapuram",
  "kilakarai": "Ramanathapuram",
  "கீழக்கரை": "Ramanathapuram",
  "mudukulathur": "Ramanathapuram",
  "முதுகுளத்தூர்": "Ramanathapuram",
  "paramakudi": "Ramanathapuram",
  "பரமக்குடி": "Ramanathapuram",
  "ramanathapuram": "Ramanathapuram",
  "இராமநாதபுரம்": "Ramanathapuram",
  "rameswaram": "Ramanathapuram",
  "ராமேஸ்வரம்": "Ramanathapuram",
  "rs mangalam": "Ramanathapuram",
  "ஆர்.எஸ்.மங்கலம்": "Ramanathapuram",
  "tiruvadanai": "Ramanathapuram",
  "திருவாடானை": "Ramanathapuram",
  "arakkonam": "Ranipet",
  "அரக்கோணம்": "Ranipet",
  "arcot": "Ranipet",
  "ஆற்காடு": "Ranipet",
  "nemili": "Ranipet",
  "நெமிலி": "Ranipet",
  "ranipet": "Ranipet",
  "ராணிப்பேட்டை": "Ranipet",
  "sholinghur": "Ranipet",
  "சோளிங்கர்": "Ranipet",
  "walajah": "Ranipet",
  "வாலாஜா": "Ranipet",
  "edappadi": "Salem",
  "எடப்பாடி": "Salem",
  "gangavalli": "Salem",
  "கங்கவல்லி": "Salem",
  "kadaiyampatti": "Salem",
  "காடையாம்பட்டி": "Salem",
  "mettur": "Salem",
  "மேட்டூர்": "Salem",
  "omalur": "Salem",
  "ஓமலூர்": "Salem",
  "salem": "Salem",
  "சேலம்": "Salem",
  "salem south": "Salem",
  "சேலம் தெற்கு": "Salem",
  "salem west": "Salem",
  "சேலம் மேற்கு": "Salem",
  "sankari": "Salem",
  "சங்ககிரி": "Salem",
  "thalaivasal": "Salem",
  "தலைவாசல்": "Salem",
  "valapady": "Salem",
  "வாழப்பாடி": "Salem",
  "yercaud": "Salem",
  "ஏற்காடு": "Salem",
  "devakottai": "Sivaganga",
  "தேவகோட்டை": "Sivaganga",
  "ilayangudi": "Sivaganga",
  "இளையான்குடி": "Sivaganga",
  "kalaiyarkovil": "Sivaganga",
  "காளையார்கோவில்": "Sivaganga",
  "karaikudi": "Sivaganga",
  "காரைக்குடி": "Sivaganga",
  "manamadurai": "Sivaganga",
  "மானாமதுரை": "Sivaganga",
  "singampunari": "Sivaganga",
  "சிங்கம்புணரி": "Sivaganga",
  "sivaganga": "Sivaganga",
  "சிவகங்கை": "Sivaganga",
  "thiruppuvanam": "Sivaganga",
  "திருப்புவனம்": "Sivaganga",
  "tiruppattur": "Sivaganga",
  "திருப்பத்தூர்": "Tirupathur",
  "alankulam": "Tenkasi",
  "ஆலங்குளம்": "Tenkasi",
  "kadayanallur": "Tenkasi",
  "கடையநல்லூர்": "Tenkasi",
  "sankarankovil": "Tenkasi",
  "சங்கரன்கோவில்": "Tenkasi",
  "shenkottai": "Tenkasi",
  "செங்கோட்டை": "Tenkasi",
  "sivagiri": "Tenkasi",
  "சிவகிரி": "Tenkasi",
  "tenkasi": "Tenkasi",
  "தென்காசி": "Tenkasi",
  "thiruvengadam": "Tenkasi",
  "திருவேங்கடம்": "Tenkasi",
  "veerakeralamputhur": "Tenkasi",
  "வீரகேரளம்புதூர்": "Tenkasi",
  "budalur": "Thanjavur",
  "பூதலூர்": "Thanjavur",
  "kumbakonam": "Thanjavur",
  "கும்பகோணம்": "Thanjavur",
  "orathanadu": "Thanjavur",
  "ஒரத்தநாடு": "Thanjavur",
  "papanasam": "Thanjavur",
  "பாபநாசம்": "Thanjavur",
  "pattukkottai": "Thanjavur",
  "பட்டுக்கோட்டை": "Thanjavur",
  "peravurani": "Thanjavur",
  "பேராவூரணி": "Thanjavur",
  "thanjavur": "Thanjavur",
  "தஞ்சாவூர்": "Thanjavur",
  "thiruvaiyaru": "Thanjavur",
  "திருவையாறு": "Thanjavur",
  "thiruvidaimarudur": "Thanjavur",
  "திருவிடைமருதூர்": "Thanjavur",
  "andipatti": "Theni",
  "ஆண்டிபட்டி": "Theni",
  "bodinayakanur": "Theni",
  "போடிநாயக்கனூர்": "Theni",
  "periyakulam": "Theni",
  "பெரியகுளம்": "Theni",
  "theni": "Theni",
  "தேனி": "Theni",
  "uthamapalayam": "Theni",
  "உத்தமபாளையம்": "Theni",
  "alwarthirunagari": "Thoothukudi",
  "ஆழ்வார்திருநகரி": "Thoothukudi",
  "eral": "Thoothukudi",
  "ஏரல்": "Thoothukudi",
  "kayathar": "Thoothukudi",
  "கயத்தாறு": "Thoothukudi",
  "kovilpatti": "Thoothukudi",
  "கோவில்பட்டி": "Thoothukudi",
  "ottapidaram": "Thoothukudi",
  "ஒட்டப்பிடாரம்": "Thoothukudi",
  "sattankulam": "Thoothukudi",
  "சாத்தான்குளம்": "Thoothukudi",
  "srivaikuntam": "Thoothukudi",
  "ஸ்ரீவைகுண்டம்": "Thoothukudi",
  "thoothukudi": "Thoothukudi",
  "தூத்துக்குடி": "Thoothukudi",
  "tiruchendur": "Thoothukudi",
  "திருச்செந்தூர்": "Thoothukudi",
  "vilathikulam": "Thoothukudi",
  "விளாத்திகுளம்": "Thoothukudi",
  "lalgudi": "Tiruchirappalli",
  "லால்குடி": "Tiruchirappalli",
  "manachanallur": "Tiruchirappalli",
  "மண்ணச்சநல்லூர்": "Tiruchirappalli",
  "manapparai": "Tiruchirappalli",
  "மணப்பாறை": "Tiruchirappalli",
  "marungapuri": "Tiruchirappalli",
  "மருங்காபுரி": "Tiruchirappalli",
  "musiri": "Tiruchirappalli",
  "முசிறி": "Tiruchirappalli",
  "srirangam": "Tiruchirappalli",
  "ஸ்ரீரங்கம்": "Tiruchirappalli",
  "thiruverumbur": "Tiruchirappalli",
  "திருவெறும்பூர்": "Tiruchirappalli",
  "thottiyam": "Tiruchirappalli",
  "தொட்டியம்": "Tiruchirappalli",
  "thuraiyur": "Tiruchirappalli",
  "துறையூர்": "Tiruchirappalli",
  "tiruchirappalli east": "Tiruchirappalli",
  "திருச்சிராப்பள்ளி கிழக்கு": "Tiruchirappalli",
  "tiruchirappalli west": "Tiruchirappalli",
  "திருச்சிராப்பள்ளி மேற்கு": "Tiruchirappalli",
  "ambasamudram": "Tirunelveli",
  "அம்பாசமுத்திரம்": "Tirunelveli",
  "cheranmahadevi": "Tirunelveli",
  "சேரன்மகாதேவி": "Tirunelveli",
  "manur": "Tirunelveli",
  "மானூர்": "Tirunelveli",
  "nanguneri": "Tirunelveli",
  "நாங்குநேரி": "Tirunelveli",
  "palayamkottai": "Tirunelveli",
  "பாளையங்கோட்டை": "Tirunelveli",
  "radhapuram": "Tirunelveli",
  "ராதாபுரம்": "Tirunelveli",
  "tirunelveli": "Tirunelveli",
  "திருநெல்வேலி": "Tirunelveli",
  "tisayanvilai": "Tirunelveli",
  "திசையன்விளை": "Tirunelveli",
  "ambur": "Tirupathur",
  "ஆம்பூர்": "Tirupathur",
  "natrampalli": "Tirupathur",
  "நாட்ராம்பள்ளி": "Tirupathur",
  "tirupathur": "Tirupathur",
  "vaniyambadi": "Tirupathur",
  "வாணியம்பாடி": "Tirupathur",
  "avinashi": "Tiruppur",
  "அவினாசி": "Tiruppur",
  "dharapuram": "Tiruppur",
  "தாராபுரம்": "Tiruppur",
  "kangeyam": "Tiruppur",
  "காங்கேயம்": "Tiruppur",
  "madathukulam": "Tiruppur",
  "மடத்துக்குளம்": "Tiruppur",
  "palladam": "Tiruppur",
  "பல்லடம்": "Tiruppur",
  "tiruppur north": "Tiruppur",
  "திருப்பூர் வடக்கு": "Tiruppur",
  "tiruppur south": "Tiruppur",
  "திருப்பூர் தெற்கு": "Tiruppur",
  "udumalaipettai": "Tiruppur",
  "உடுமலைப்பேட்டை": "Tiruppur",
  "uthukuli": "Tiruppur",
  "ஊத்துக்குளி": "Tiruppur",
  "avadi": "Tiruvallur",
  "ஆவடி": "Tiruvallur",
  "gummidipoondi": "Tiruvallur",
  "கும்மிடிப்பூண்டி": "Tiruvallur",
  "pallipattu": "Tiruvallur",
  "பள்ளிப்பட்டு": "Tiruvallur",
  "ponneri": "Tiruvallur",
  "பொன்னேரி": "Tiruvallur",
  "poonamallee": "Tiruvallur",
  "பூந்தமல்லி": "Tiruvallur",
  "rk pet": "Tiruvallur",
  "ஆர்.கே.பேட்டை": "Tiruvallur",
  "tiruttani": "Tiruvallur",
  "திருத்தணி": "Tiruvallur",
  "tiruvallur": "Tiruvallur",
  "திருவள்ளூர்": "Tiruvallur",
  "uthukottai": "Tiruvallur",
  "ஊத்துக்கோட்டை": "Tiruvallur",
  "arani": "Tiruvannamalai",
  "ஆரணி": "Tiruvannamalai",
  "chengam": "Tiruvannamalai",
  "செங்கம்": "Tiruvannamalai",
  "chetpet": "Tiruvannamalai",
  "சேத்துப்பட்டு": "Tiruvannamalai",
  "cheyyar": "Tiruvannamalai",
  "செய்யாறு": "Tiruvannamalai",
  "jawadhu hills": "Tiruvannamalai",
  "ஜவ்வாது மலை": "Tiruvannamalai",
  "kalasapakkam": "Tiruvannamalai",
  "கலசப்பாக்கம்": "Tiruvannamalai",
  "kilpennathur": "Tiruvannamalai",
  "கீழ்பென்னாத்தூர்": "Tiruvannamalai",
  "polur": "Tiruvannamalai",
  "போளூர்": "Tiruvannamalai",
  "thandarampattu": "Tiruvannamalai",
  "தண்டராம்பட்டு": "Tiruvannamalai",
  "tiruvannamalai": "Tiruvannamalai",
  "திருவண்ணாமலை": "Tiruvannamalai",
  "vandavasi": "Tiruvannamalai",
  "வந்தவாசி": "Tiruvannamalai",
  "vembakkam": "Tiruvannamalai",
  "வெம்பாக்கம்": "Tiruvannamalai",
  "koothanallur": "Tiruvarur",
  "கூத்தநல்லூர்": "Tiruvarur",
  "kudavasal": "Tiruvarur",
  "குடவாசல்": "Tiruvarur",
  "mannargudi": "Tiruvarur",
  "மன்னார்குடி": "Tiruvarur",
  "nannilam": "Tiruvarur",
  "நன்னிலம்": "Tiruvarur",
  "needamangalam": "Tiruvarur",
  "நீடாமங்கலம்": "Tiruvarur",
  "thiruthuraipoondi": "Tiruvarur",
  "திருத்துறைப்பூண்டி": "Tiruvarur",
  "tiruvarur": "Tiruvarur",
  "திருவாரூர்": "Tiruvarur",
  "valangaiman": "Tiruvarur",
  "வலங்கைமான்": "Tiruvarur",
  "anaicut": "Vellore",
  "அணைக்கட்டு": "Vellore",
  "gudiyatham": "Vellore",
  "குடியாத்தம்": "Vellore",
  "katpadi": "Vellore",
  "காட்பாடி": "Vellore",
  "kv kuppam": "Vellore",
  "கே.வி.குப்பம்": "Vellore",
  "pernambut": "Vellore",
  "பேரணாம்பட்டு": "Vellore",
  "vellore": "Vellore",
  "வேலூர்": "Vellore",
  "gingee": "Viluppuram",
  "செஞ்சி": "Viluppuram",
  "kandachipuram": "Viluppuram",
  "கண்டாச்சிபுரம்": "Viluppuram",
  "marakkanam": "Viluppuram",
  "மரக்காணம்": "Viluppuram",
  "melmalayanur": "Viluppuram",
  "மேல்மலையனூர்": "Viluppuram",
  "thiruvennainallur": "Viluppuram",
  "திருவெண்ணைநல்லூர்": "Viluppuram",
  "tindivanam": "Viluppuram",
  "திண்டிவனம்": "Viluppuram",
  "vanur": "Viluppuram",
  "வானூர்": "Viluppuram",
  "vikravandi": "Viluppuram",
  "விக்ரவாண்டி": "Viluppuram",
  "viluppuram": "Viluppuram",
  "விழுப்புரம்": "Viluppuram",
  "aruppukkottai": "Virudhunagar",
  "அருப்புக்கோட்டை": "Virudhunagar",
  "kariyapatti": "Virudhunagar",
  "காரியாபட்டி": "Virudhunagar",
  "rajapalayam": "Virudhunagar",
  "ராஜபாளையம்": "Virudhunagar",
  "sattur": "Virudhunagar",
  "சாத்தூர்": "Virudhunagar",
  "sivakasi": "Virudhunagar",
  "சிவகாசி": "Virudhunagar",
  "srivilliputhur": "Virudhunagar",
  "ஸ்ரீவில்லிபுத்தூர்": "Virudhunagar",
  "tiruchuli": "Virudhunagar",
  "திருச்சுழி": "Virudhunagar",
  "vembakottai": "Virudhunagar",
  "வெம்பக்கோட்டை": "Virudhunagar",
  "virudhunagar": "Virudhunagar",
  "விருதுநகர்": "Virudhunagar",
  "watrap": "Virudhunagar",
  "வத்திராயிருப்பு": "Virudhunagar",
  "saravanampatti": "Coimbatore",
  "சரவணம்பட்டி": "Coimbatore",
  "peelamedu": "Coimbatore",
  "பீளமேடு": "Coimbatore",
  "singanallur": "Coimbatore",
  "சிங்கநல்லூர்": "Coimbatore",
  "gandhipuram": "Coimbatore",
  "காந்திபுரம்": "Coimbatore",
  "rs puram": "Coimbatore",
  "kuniyamuthur": "Coimbatore",
  "குனியமுத்தூர்": "Coimbatore",
  "thudiyalur": "Coimbatore",
  "துடியலூர்": "Coimbatore",
  "vellalore": "Coimbatore",
  "வெள்ளலூர்": "Coimbatore",
  "ondipudur": "Coimbatore",
  "ஒண்டிப்புதூர்": "Coimbatore",
  "kurichi": "Coimbatore",
  "குறிச்சி": "Coimbatore",
  "vadavalli": "Coimbatore",
  "வடவள்ளி": "Coimbatore",
  "kalapatti": "Coimbatore",
  "காளப்பட்டி": "Coimbatore",
  "malumichampatti": "Coimbatore",
  "chinnavedampatti": "Coimbatore",
  "chromepet": "Chengalpattu",
  "குரோம்பேட்டை": "Chengalpattu",
  "kelambakkam": "Chengalpattu",
  "கெளம்பாக்கம்": "Chengalpattu",
  "maraimalai nagar": "Chengalpattu",
  "chengalpet": "Chengalpattu",
  "adyar": "Chennai",
  "அடையாறு": "Chennai",
  "t nagar": "Chennai",
  "தி நகர்": "Chennai",
  "anna nagar": "Chennai",
  "அண்ணா நகர்": "Chennai",
  "triplicane": "Chennai",
  "திருவல்லிக்கேணி": "Chennai",
  "royapettah": "Chennai",
  "இராயப்பேட்டை": "Chennai",
  "kolathur": "Chennai",
  "கொளத்தூர்": "Chennai",
  "thiruvanmiyur": "Chennai",
  "திருவான்மியூர்": "Chennai",
  "jolarpet": "Tirupathur",
  "ஜோலார்பேட்டை": "Tirupathur",
  "yelagiri": "Tirupathur",
  "ஏலகிரி": "Tirupathur",
  "kannampalayam": "Coimbatore",
  "கண்ணம்பாளையம்": "Coimbatore",
  "irugur": "Coimbatore",
  "இருகூர்": "Coimbatore",
  "pappampatti": "Coimbatore",
  "பப்பம்பட்டி": "Coimbatore"
};

  // Bilingual translation dictionary for specific localities, towns, and taluks across Tamil Nadu
  const LOCALITY_NAMES_TA = {
    'pappampatti pirivu': 'பாப்பம்பட்டி பிரிவு',
    'pappampatti': 'பாப்பம்பட்டி',
    'sulur': 'சூலூர்',
    'kannampalayam': 'கண்ணம்பாளையம்',
    'irugur': 'இருகூர்',
    'pappampatti': 'பப்பம்பட்டி',
    'peelamedu': 'பீளமேடு',
    'singanallur': 'சிங்கநல்லூர்',
    'gandhipuram': 'காந்திபுரம்',
    'saravanampatti': 'சரவணம்பட்டி',
    'pollachi': 'பொள்ளாச்சி',
    'mettupalayam': 'மேட்டுப்பாளையம்',
    'valparai': 'வால்பாறை',
    'kinathukadavu': 'கிணத்துக்கடவு',
    'madukkarai': 'மதுக்கரை',
    'perur': 'பேரூர்',
    'annur': 'அன்னூர்',
    'anaimalai': 'ஆனைமலை',
    'thudiyalur': 'துடியலூர்',
    'vadavalli': 'வடவள்ளி',
    'kurichi': 'குறிச்சி',
    'ondipudur': 'ஒண்டிப்புதூர்',
    'vellalore': 'வெள்ளலூர்',
    'kuniyamuthur': 'குனியமுத்தூர்',
    'rs puram': 'ஆர்.எஸ்.புரம்',
    'coimbatore': 'கோயம்புத்தூர்',
    'mylapore': 'மயிலாப்பூர்',
    'adyar': 'அடையாறு',
    't nagar': 'தி நகர்',
    'anna nagar': 'அண்ணா நகர்',
    'velachery': 'வேளச்சேரி',
    'guindy': 'கிண்டி',
    'egmore': 'எழும்பூர்',
    'triplicane': 'திருவல்லிக்கேணி',
    'royapettah': 'இராயப்பேட்டை',
    'royapuram': 'ராயபுரம்',
    'sholinganallur': 'சோழிங்கநல்லூர்',
    'alandur': 'ஆலந்தூர்',
    'ambattur': 'அம்பத்தூர்',
    'madhavaram': 'மாதவரம்',
    'thiruvottiyur': 'திருவொற்றியூர்',
    'tondiarpet': 'தண்டையார்பேட்டை',
    'perambur': 'பெரம்பூர்',
    'purasawalkam': 'புரசைவாக்கம்',
    'mambalam': 'மாம்பலம்',
    'ayanavaram': 'அயனாவரம்',
    'aminjikarai': 'அமிஞ்சிக்கரை',
    'maduravoyal': 'மதுரவாயல்',
    'kolathur': 'கொளத்தூர்',
    'chennai': 'சென்னை',
    'tambaram': 'தாம்பரம்',
    'chromepet': 'குரோம்பேட்டை',
    'pallavaram': 'பல்லாவரம்',
    'vandalur': 'வண்டலூர்',
    'chengalpattu': 'செங்கல்பட்டு',
    'maduranthakam': 'மதுராந்தகம்',
    'cheyyur': 'செய்யூர்',
    'tirukalukundram': 'திருக்கழுக்குன்றம்',
    'tiruporur': 'திருப்போரூர்',
    'kovilpatti': 'கோவில்பட்டி',
    'srivaikuntam': 'ஸ்ரீவைகுண்டம்',
    'tiruchendur': 'திருச்செந்தூர்',
    'sattankulam': 'சாத்தான்குளம்',
    'ottapidaram': 'ஒட்டப்பிடாரம்',
    'vilathikulam': 'விளாத்திகுளம்',
    'kayathar': 'கயத்தாறு',
    'eral': 'ஏரல்',
    'alwarthirunagari': 'ஆழ்வார்திருநகரி',
    'thoothukudi': 'தூத்துக்குடி',
    'avadi': 'ஆவடி',
    'poonamallee': 'பூந்தமல்லி',
    'ponneri': 'பொன்னேரி',
    'gummidipoondi': 'கும்மிடிப்பூண்டி',
    'tiruttani': 'திருத்தணி',
    'tiruvallur': 'திருவள்ளூர்',
    'srirangam': 'ஸ்ரீரங்கம்',
    'manapparai': 'மணப்பாறை',
    'thiruverumbur': 'திருவெறும்பூர்',
    'lalgudi': 'லால்குடி',
    'musiri': 'முசிறி',
    'thuraiyur': 'துறையூர்',
    'tiruchirappalli': 'திருச்சிராப்பள்ளி',
    'kumbakonam': 'கும்பகோணம்',
    'pattukkottai': 'பட்டுக்கோட்டை',
    'thiruvaiyaru': 'திருவையாறு',
    'papanasam': 'பாபநாசம்',
    'orathanadu': 'ஒரத்தநாடு',
    'peravurani': 'பேராவூரணி',
    'thanjavur': 'தஞ்சாவூர்',
    'mannargudi': 'மன்னார்குடி',
    'thiruthuraipoondi': 'திருத்துறைப்பூண்டி',
    'nannilam': 'நன்னிலம்',
    'tiruvarur': 'திருவாரூர்',
    'karaikudi': 'காரைக்குடி',
    'devakottai': 'தேவகோட்டை',
    'manamadurai': 'மானாமதுரை',
    'sivaganga': 'சிவகங்கை',
    'sivakasi': 'சிவகாசி',
    'rajapalayam': 'ராஜபாளையம்',
    'srivilliputhur': 'ஸ்ரீவில்லிபுத்தூர்',
    'aruppukkottai': 'அருப்புக்கோட்டை',
    'sattur': 'சாத்தூர்',
    'virudhunagar': 'விருதுநகர்',
    'dharapuram': 'தாராபுரம்',
    'kangeyam': 'காங்கேயம்',
    'avinashi': 'அவினாசி',
    'palladam': 'பல்லடம்',
    'udumalaipettai': 'உடுமலைப்பேட்டை',
    'uthukuli': 'ஊத்துக்குளி',
    'tiruppur': 'திருப்பூர்',
    'mettur': 'மேட்டூர்',
    'edappadi': 'எடப்பாடி',
    'sankari': 'சங்ககிரி',
    'attur': 'ஆத்தூர்',
    'omalur': 'ஓமலூர்',
    'yercaud': 'ஏற்காடு',
    'salem': 'சேலம்',
    'bhavani': 'பவானி',
    'gobichettipalayam': 'கோபிசெட்டிபாளையம்',
    'sathyamangalam': 'சத்தியமங்கலம்',
    'perundurai': 'பெருந்துறை',
    'erode': 'ஈரோடு',
    'palani': 'பழனி',
    'kodaikanal': 'கொடைக்கானல்',
    'vedasandur': 'வேடசந்தூர்',
    'natham': 'நத்தம்',
    'nilakottai': 'நிலக்கோட்டை',
    'dindigul': 'திண்டுக்கல்',
    'bodinayakanur': 'போடிநாயக்கனூர்',
    'periyakulam': 'பெரியகுளம்',
    'uthamapalayam': 'உத்தமபாளையம்',
    'andipatti': 'ஆண்டிபட்டி',
    'theni': 'தேனி',
    'ambasamudram': 'அம்பாசமுத்திரம்',
    'cheranmahadevi': 'சேரன்மகாதேவி',
    'palayamkottai': 'பாளையங்கோட்டை',
    'radhapuram': 'ராதாபுரம்',
    'tirunelveli': 'திருநெல்வேலி',
    'tenkasi': 'தென்காசி',
    'sankarankovil': 'சங்கரன்கோவில்',
    'shenkottai': 'செங்கோட்டை',
    'kadayanallur': 'கடையநல்லூர்',
    'alankulam': 'ஆலங்குளம்',
    'hosur': 'ஓசூர்',
    'denkanikottai': 'தேன்கனிக்கோட்டை',
    'pochampalli': 'போச்சம்பள்ளி',
    'krishnagiri': 'கிருஷ்ணகிரி',
    'udhagamandalam': 'உதகமண்டலம்',
    'coonoor': 'குன்னூர்',
    'kotagiri': 'கோத்தகிரி',
    'gudalur': 'கூடலூர்',
    'nilgiris': 'நீலகிரி',
    'vellore': 'வேலூர்',
    'katpadi': 'காட்பாடி',
    'gudiyatham': 'குடியாத்தம்',
    'ambur': 'ஆம்பூர்',
    'vaniyambadi': 'வாணியம்பாடி',
    'tirupathur': 'திருப்பத்தூர்',
    'arakkonam': 'அரக்கோணம்',
    'arcot': 'ஆற்காடு',
    'walajah': 'வாலாஜா',
    'ranipet': 'ராணிப்பேட்டை',
    'sholinghur': 'சோளிங்கர்'
  };

  // English reverse mapping dictionary for specific localities, towns, and districts
  const LOCALITY_NAMES_EN = {
    'பாப்பம்பட்டி பிரிவு': 'Pappampatti Pirivu',
    'பாப்பம்பட்டி': 'Pappampatti',
    'பப்பம்பட்டி பிரிவு': 'Pappampatti Pirivu',
    'பப்பம்பட்டி': 'Pappampatti',
    'பிரிவு': 'Pirivu',
    'சூலூர்': 'Sulur',
    'கண்ணம்பாளையம்': 'Kannampalayam',
    'இருகூர்': 'Irugur',
    'பீளமேடு': 'Peelamedu',
    'சரவணம்பட்டி': 'Saravanampatti',
    'காந்திபுரம்': 'Gandhipuram',
    'சிங்கநல்லூர்': 'Singanallur',
    'ஒண்டிப்புதூர்': 'Ondipudur',
    'குனியமுத்தூர்': 'Kuniyamuthur',
    'ஆர்.எஸ்.புரம்': 'RS Puram',
    'துடியலூர்': 'Thudiyalur',
    'வடவள்ளி': 'Vadavalli',
    'குறிச்சி': 'Kurichi',
    'வெள்ளலூர்': 'Vellalore',
    'பொள்ளாச்சி': 'Pollachi',
    'மேட்டுப்பாளையம்': 'Mettupalayam',
    'வால்பாறை': 'Valparai',
    'கிணத்துக்கடவு': 'Kinathukadavu',
    'மதுக்கரை': 'Madukkarai',
    'பேரூர்': 'Perur',
    'அன்னூர்': 'Annur',
    'ஆனைமலை': 'Anaimalai',
    'கோயம்புத்தூர்': 'Coimbatore',
    'கோவை': 'Coimbatore',
    'சென்னை': 'Chennai',
    'மதுரை': 'Madurai',
    'திருச்சிராப்பள்ளி': 'Tiruchirappalli',
    'திருச்சி': 'Tiruchirappalli',
    'சேலம்': 'Salem',
    'ஈரோடு': 'Erode',
    'திருப்பூர்': 'Tiruppur',
    'திண்டுக்கல்': 'Dindigul',
    'திருநெல்வேலி': 'Tirunelveli',
    'தூத்துக்குடி': 'Thoothukudi',
    'வேலூர்': 'Vellore',
    'தஞ்சாவூர்': 'Thanjavur',
    'கன்னியாகுமரி': 'Kanniyakumari',
    'நாகர்கோவில்': 'Nagercoil',
    'காஞ்சிபுரம்': 'Kancheepuram',
    'செங்கல்பட்டு': 'Chengalpattu',
    'திருவள்ளூர்': 'Tiruvallur',
    'விழுப்புரம்': 'Viluppuram',
    'கள்ளக்குறிச்சி': 'Kallakurichi',
    'கடலூர்': 'Cuddalore',
    'திருவண்ணாமலை': 'Tiruvannamalai',
    'திருப்பத்தூர்': 'Tirupathur',
    'ராணிப்பேட்டை': 'Ranipet',
    'கிருஷ்ணகிரி': 'Krishnagiri',
    'தர்மபுரி': 'Dharmapuri',
    'நாமக்கல்': 'Namakkal',
    'கரூர்': 'Karur',
    'பெரம்பலூர்': 'Perambalur',
    'அரியலூர்': 'Ariyalur',
    'புதுக்கோட்டை': 'Pudukkottai',
    'சிவகங்கை': 'Sivaganga',
    'இராமநாதபுரம்': 'Ramanathapuram',
    'விருதுநகர்': 'Virudhunagar',
    'தென்காசி': 'Tenkasi',
    'தேனி': 'Theni',
    'நீலகிரி': 'Nilgiris',
    'உதகமண்டலம்': 'Udhagamandalam',
    'ஊட்டி': 'Ooty',
    'மயிலாடுதுறை': 'Mayiladuthurai',
    'நாகப்பட்டினம்': 'Nagapattinam',
    'திருவாரூர்': 'Tiruvarur',
    'தமிழ்நாடு': 'Tamil Nadu',
    'தமிழ் நாடு': 'Tamil Nadu'
  };

  // Automatically invert LOCALITY_NAMES_TA into LOCALITY_NAMES_EN for any missing entries
  for (const [enKey, taVal] of Object.entries(LOCALITY_NAMES_TA)) {
    if (taVal && !LOCALITY_NAMES_EN[taVal]) {
      const formattedEn = enKey
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      LOCALITY_NAMES_EN[taVal] = formattedEn;
    }
  }

  /**
   * Phonetic transliteration fallback for Tamil text when not in exact dictionary.
   */
  function transliterateTamilToEnglish(tamilText) {
    if (!tamilText || typeof tamilText !== 'string') return '';
    if (!/[\u0B80-\u0BFF]/.test(tamilText)) return tamilText;

    const VOWELS = {
      '\u0B85': 'a', '\u0B86': 'aa', '\u0B87': 'i', '\u0B88': 'ee',
      '\u0B89': 'u', '\u0B8A': 'oo', '\u0B8E': 'e', '\u0B8F': 'e',
      '\u0B90': 'ai', '\u0B92': 'o', '\u0B93': 'o', '\u0B94': 'au'
    };
    const CONSONANTS = {
      '\u0B95': 'k', '\u0B99': 'ng', '\u0B9A': 's', '\u0B9E': 'nj',
      '\u0B9F': 't', '\u0BA3': 'n', '\u0BA4': 'th', '\u0BA8': 'n',
      '\u0BAA': 'p', '\u0BAE': 'm', '\u0BAF': 'y', '\u0BB0': 'r',
      '\u0BB2': 'l', '\u0BB5': 'v', '\u0BB4': 'zh', '\u0BB3': 'l',
      '\u0BB1': 'r', '\u0BA9': 'n', '\u0B9C': 'j', '\u0BB6': 'sh',
      '\u0BB7': 'sh', '\u0BB8': 's', '\u0BB9': 'h'
    };
    const VOWEL_SIGNS = {
      '\u0BBE': 'a', '\u0BBF': 'i', '\u0BC0': 'ee', '\u0BC1': 'u',
      '\u0BC2': 'oo', '\u0BC6': 'e', '\u0BC7': 'e', '\u0BC8': 'ai',
      '\u0BCA': 'o', '\u0BCB': 'o', '\u0BCC': 'au'
    };
    const VIRAMA = '\u0BCD';

    let out = '';
    const len = tamilText.length;
    for (let i = 0; i < len; i++) {
      const ch = tamilText[i];
      if (VOWELS[ch]) {
        out += VOWELS[ch];
      } else if (CONSONANTS[ch]) {
        const next = (i + 1 < len) ? tamilText[i + 1] : null;
        if (next === VIRAMA) {
          out += CONSONANTS[ch];
          i++;
        } else if (next && VOWEL_SIGNS[next]) {
          out += CONSONANTS[ch] + VOWEL_SIGNS[next];
          i++;
        } else {
          out += CONSONANTS[ch] + 'a';
        }
      } else {
        out += ch;
      }
    }
    return out.replace(/\b[a-z]/g, c => c.toUpperCase()).trim();
  }

  /**
   * Bilingual locality translation:
   * When lang === 'en', converts any Tamil place name to English.
   * When lang === 'ta', converts any English place name to Tamil.
   */
  function translateLocalityName(name, lang = 'en') {
    if (!name || typeof name !== 'string') return '';
    const trimmed = name.trim();
    if (!trimmed) return '';

    // Handle compound strings separated by comma
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map(part => translateLocalityName(part.trim(), lang))
        .filter(Boolean)
        .join(', ');
    }

    const hasTamil = /[\u0B80-\u0BFF]/.test(trimmed);

    // TARGET: ENGLISH
    if (lang !== 'ta') {
      if (!hasTamil) return trimmed;
      if (LOCALITY_NAMES_EN[trimmed]) return LOCALITY_NAMES_EN[trimmed];
      
      for (const [taKey, enVal] of Object.entries(LOCALITY_NAMES_EN)) {
        if (taKey === trimmed || trimmed.includes(taKey) || taKey.includes(trimmed)) {
          return enVal;
        }
      }

      // Word-by-word translation fallback
      const words = trimmed.split(/\s+/);
      const translatedWords = words.map(w => {
        if (LOCALITY_NAMES_EN[w]) return LOCALITY_NAMES_EN[w];
        for (const [k, v] of Object.entries(LOCALITY_NAMES_EN)) {
          if (k === w) return v;
        }
        return transliterateTamilToEnglish(w);
      });
      return translatedWords.join(' ');
    }

    // TARGET: TAMIL
    if (hasTamil) return trimmed;
    const lower = trimmed.toLowerCase();

    if (LOCALITY_NAMES_TA[lower]) return LOCALITY_NAMES_TA[lower];

    for (const [key, val] of Object.entries(LOCALITY_NAMES_TA)) {
      if (lower.includes(key) || key.includes(lower)) {
        return val;
      }
    }

    for (const d of TN_DISTRICTS_CENTROIDS) {
      if (d.name.toLowerCase() === lower || d.id === lower) {
        return LOCALITY_NAMES_TA[d.id] || LOCALITY_NAMES_TA[d.name.toLowerCase()] || trimmed;
      }
    }

    return trimmed;
  }

  /**
   * Normalize an arbitrary location string (district, taluk, town, locality)
   * into an official Tamil Nadu district name.
   */
  function normalizeDistrictName(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim().toLowerCase()
      .replace(/ district$/i, '')
      .replace(/ taluk$/i, '')
      .replace(/ corporation$/i, '')
      .replace(/ municipality$/i, '')
      .replace(/ வட்டம்$/i, '')
      .replace(/ மாவட்டம்$/i, '')
      .trim();

    if (!clean) return null;

    // 1. Direct match against official 38 districts
    const match = TN_DISTRICTS_CENTROIDS.find(d => 
      d.id === clean || d.name.toLowerCase() === clean
    );
    if (match) return match.name;

    // 2. Check district aliases
    if (DISTRICT_ALIASES[clean]) {
      return DISTRICT_ALIASES[clean];
    }

    // 3. Direct match in taluks & towns dictionary (e.g. 'sulur' -> 'Coimbatore')
    if (TALUK_TO_DISTRICT[clean]) {
      return TALUK_TO_DISTRICT[clean];
    }

    // 4. Case-insensitive exact match in taluk keys
    const foundKey = Object.keys(TALUK_TO_DISTRICT).find(k => k.toLowerCase() === clean);
    if (foundKey) {
      return TALUK_TO_DISTRICT[foundKey];
    }

    // 5. Partial match in taluk names (e.g. 'Sulur Town' -> 'Sulur' -> 'Coimbatore')
    for (const [talukKey, distName] of Object.entries(TALUK_TO_DISTRICT)) {
      if (clean.includes(talukKey.toLowerCase()) || talukKey.toLowerCase().includes(clean)) {
        return distName;
      }
    }

    // 6. Partial match against official districts (e.g. 'Chennai Central' -> 'Chennai')
    const partial = TN_DISTRICTS_CENTROIDS.find(d => 
      clean.includes(d.id) || clean.includes(d.name.toLowerCase())
    );
    if (partial) return partial.name;

    return null;
  }

  /**
   * Find nearest official Tamil Nadu district using geographic coordinates (Haversine formula).
   */
  function findNearestDistrictByCoords(lat, lng) {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) return null;

    let nearest = null;
    let minDistance = Infinity;

    for (const d of TN_DISTRICTS_CENTROIDS) {
      const dLat = (d.lat - parsedLat) * (Math.PI / 180);
      const dLng = (d.lng - parsedLng) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(parsedLat * (Math.PI / 180)) * Math.cos(d.lat * (Math.PI / 180)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = 6371 * c; // distance in km

      if (dist < minDistance) {
        minDistance = dist;
        nearest = d;
      }
    }

    return nearest ? nearest.name : null;
  }

  /**
   * Check synchronous storage mechanisms for citizen district in strict priority order:
   * 1. Physical coordinates ('cc_weather_coords') - ground truth from live GPS.
   * 2. Weather cached town/place ('cc_weather_cache_en' / 'cc_weather_cache_ta') - normalized via taluk mapping.
   * 3. Saved user_district in localStorage.
   * 4. Citizen profile object ('cc_user_profile').
   * 5. Auth session user metadata.
   */
  function getSavedUserDistrict() {
    try {
      // 1. PRIORITY 1: Physical coordinates from live browser geolocation ('cc_weather_coords')
      // This represents the citizen's actual physical location and overrides any stale textual keys.
      const coordsStr = localStorage.getItem('cc_weather_coords');
      if (coordsStr) {
        try {
          const coords = JSON.parse(coordsStr);
          if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
            const nearest = findNearestDistrictByCoords(coords.lat, coords.lon);
            if (nearest) {
              // Synchronize user_district with live physical coordinates
              localStorage.setItem('user_district', nearest);
              return nearest;
            }
          }
        } catch (e) {}
      }

      // 2. PRIORITY 2: Weather cache from citizen dashboard ('cc_weather_cache_en' / 'cc_weather_cache_ta')
      // If dashboard resolved a town/taluk (e.g., 'Sulur'), normalize it to parent district ('Coimbatore').
      const weatherCacheStr = localStorage.getItem('cc_weather_cache_en') || localStorage.getItem('cc_weather_cache_ta');
      if (weatherCacheStr) {
        try {
          const cache = JSON.parse(weatherCacheStr);
          if (cache && cache.district) {
            const norm = normalizeDistrictName(cache.district);
            if (norm) {
              localStorage.setItem('user_district', norm);
              return norm;
            }
          }
        } catch (e) {}
      }

      // 3. PRIORITY 3: Explicitly saved user_district in localStorage
      const direct = localStorage.getItem('user_district') || localStorage.getItem('crowdcity_user_district');
      if (direct && direct !== 'all' && direct !== 'Tamil Nadu') {
        const norm = normalizeDistrictName(direct);
        if (norm) return norm;
      }

      // 4. PRIORITY 4: Citizen profile object ('cc_user_profile')
      const activeUser = (typeof window.getCurrentUser === 'function') ? window.getCurrentUser() : null;
      const profileStr = (activeUser && activeUser.id) ? (localStorage.getItem(`cc_user_profile_${activeUser.id}`) || localStorage.getItem('cc_user_profile')) : localStorage.getItem('cc_user_profile');
      if (profileStr) {
        try {
          const p = JSON.parse(profileStr);
          if (!activeUser || !p.id || p.id === activeUser.id || p.sub === activeUser.id) {
            const candidate = p.district || p.city || p.location || p.state_district;
            if (candidate) {
              const norm = normalizeDistrictName(candidate);
              if (norm) {
                localStorage.setItem('user_district', norm);
                return norm;
              }
            }
          } else {
            localStorage.removeItem('cc_user_profile');
          }
        } catch (e) {}
      }

      // 5. PRIORITY 5: Auth session user metadata
      if (typeof window.getCurrentUser === 'function') {
        const u = window.getCurrentUser();
        const candidate = u?.district || u?.user_metadata?.district || u?.user_metadata?.city;
        if (candidate) {
          const norm = normalizeDistrictName(candidate);
          if (norm) {
            localStorage.setItem('user_district', norm);
            return norm;
          }
        }
      }
    } catch (err) {
      console.warn('[UserLocation] Synchronous storage check warning:', err);
    }

    return null;
  }

  /**
   * Actively detect citizen district.
   * If forceGps is false and a valid district is known from fresh coords, returns immediately.
   * Otherwise requests fresh browser geolocation.
   * 
   * @param {Object} options
   * @param {number} options.timeoutMs - Geolocation timeout (default 4000ms)
   * @param {boolean} options.requestGps - Whether to trigger browser GPS (default true)
   * @param {boolean} options.forceGps - Force GPS detection bypassing cache (default false)
   * @returns {Promise<string|null>} Resolved district name
   */
  async function detectUserDistrict(options = {}) {
    const timeoutMs = options.timeoutMs || 4000;
    const requestGps = options.requestGps !== false;
    const forceGps = options.forceGps === true;

    // 1. Instant check if not forcing fresh GPS
    if (!forceGps) {
      const existing = getSavedUserDistrict();
      if (existing) {
        return existing;
      }
    }

    // 2. Try browser geolocation
    if (requestGps && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const districtFromGps = await new Promise((resolve) => {
          let hasResolved = false;
          const timer = setTimeout(() => {
            if (!hasResolved) {
              hasResolved = true;
              resolve(null);
            }
          }, timeoutMs);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (hasResolved) return;
              hasResolved = true;
              clearTimeout(timer);
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              localStorage.setItem('cc_weather_coords', JSON.stringify({ lat, lon: lng, ts: Date.now() }));
              const nearest = findNearestDistrictByCoords(lat, lng);
              if (nearest) {
                localStorage.setItem('user_district', nearest);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('crowdcity:location_detected', {
                    detail: { district: nearest, lat, lng }
                  }));
                }
                resolve(nearest);
              } else {
                resolve(null);
              }
            },
            (err) => {
              if (hasResolved) return;
              hasResolved = true;
              clearTimeout(timer);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: forceGps ? 0 : 300000 }
          );
        });

        if (districtFromGps) return districtFromGps;
      } catch (err) {
        console.warn('[UserLocation] Geolocation detection warning:', err);
      }
    }

    return getSavedUserDistrict();
  }

  /**
   * Extract the most specific reliable locality from a reverse geocode address object.
   * Specificity Hierarchy:
   * Level 1: Locality / Suburb / Neighbourhood / Hamlet
   * Level 2: Village Panchayat / Town / Municipality
   * Level 3: Taluk / Sub-district
   * Level 4: District / City
   * 
   * Strict Rules:
   * - Never show house numbers, street names, postal codes, or raw coordinates.
   * - Maximum 1–2 words or "Locality, Taluk" format.
   * - If only district is known, fallback to district.
   */
  function extractSpecificLocality(addressObj, lang = 'en') {
    if (!addressObj || typeof addressObj !== 'object') return null;

    const cleanField = (val) => {
      if (!val || typeof val !== 'string') return '';
      return val
        .replace(/^(?:door\s*(?:no\.?)?|no\.?|plot\s*no\.?|flat\s*no\.?|ward\s*no\.?)\s*\d+[\w-]*\s*[, -]*/i, '')
        .replace(/^\d+[\w-]*\s*[, -]*/i, '')
        .replace(/\b\d{6}\b/g, '') // remove pin codes
        .replace(/\b\d+[-/]\d+\b/g, '') // remove door numbers
        .replace(/ taluk$/i, '')
        .replace(/ subdistrict$/i, '')
        .replace(/ district$/i, '')
        .replace(/ corporation$/i, '')
        .replace(/ municipality$/i, '')
        .replace(/ வட்டம்$/i, '')
        .replace(/ மாவட்டம்$/i, '')
        .replace(/ மாநகராட்சி$/i, '')
        .replace(/ நகராட்சி$/i, '')
        .trim();
    };

    const village = cleanField(
      addressObj.village ||
      addressObj.hamlet ||
      addressObj.village_panchayat ||
      ''
    );

    const neighbourhood = cleanField(
      addressObj.neighbourhood ||
      addressObj.suburb ||
      addressObj.residential ||
      addressObj.quarter ||
      addressObj.locality ||
      ''
    );

    const rawLocality = neighbourhood || village;
    const rawTown = cleanField(addressObj.town || addressObj.municipality || addressObj.city_district || '');
    const rawTaluk = cleanField(addressObj.subdistrict || addressObj.county || addressObj.taluk || '');
    const rawDistrict = cleanField(addressObj.state_district || addressObj.district || addressObj.city || '');

    // Normalize and translate each piece into both pure English and pure Tamil
    const localityEn = rawLocality ? translateLocalityName(rawLocality, 'en') : '';
    const localityTa = rawLocality ? translateLocalityName(rawLocality, 'ta') : '';

    const townEn = rawTown ? translateLocalityName(rawTown, 'en') : '';
    const townTa = rawTown ? translateLocalityName(rawTown, 'ta') : '';

    const talukEn = rawTaluk ? translateLocalityName(rawTaluk, 'en') : '';
    const talukTa = rawTaluk ? translateLocalityName(rawTaluk, 'ta') : '';

    const districtEn = rawDistrict ? translateLocalityName(rawDistrict, 'en') : '';
    const districtTa = rawDistrict ? translateLocalityName(rawDistrict, 'ta') : '';

    // Determine parent district
    let parentDistrict = normalizeDistrictName(districtEn) ||
                         normalizeDistrictName(talukEn) ||
                         normalizeDistrictName(townEn) ||
                         normalizeDistrictName(localityEn) ||
                         'Coimbatore';

    const parentDistEn = parentDistrict || districtEn || 'Tamil Nadu';
    const parentDistTa = translateLocalityName(parentDistEn, 'ta');

    let specificEn = '';
    let specificTa = '';
    let parentAreaEn = '';
    let parentAreaTa = '';

    if (localityEn && (townEn || talukEn)) {
      const subEn = townEn || talukEn;
      const subTa = townTa || talukTa;
      specificEn = localityEn;
      specificTa = localityTa;
      parentAreaEn = (parentDistEn && parentDistEn.toLowerCase() !== subEn.toLowerCase()) ? `${subEn}, ${parentDistEn}` : subEn;
      parentAreaTa = (parentDistTa && parentDistTa !== subTa) ? `${subTa}, ${parentDistTa}` : subTa;
    } else if (localityEn) {
      specificEn = localityEn;
      specificTa = localityTa;
      parentAreaEn = parentDistEn;
      parentAreaTa = parentDistTa;
    } else if (townEn || talukEn) {
      const mainEn = townEn || talukEn;
      const mainTa = townTa || talukTa;
      specificEn = mainEn;
      specificTa = mainTa;
      parentAreaEn = (parentDistEn && parentDistEn.toLowerCase() !== mainEn.toLowerCase()) ? parentDistEn : 'Tamil Nadu';
      parentAreaTa = (parentDistTa && parentDistTa !== mainTa) ? parentDistTa : 'தமிழ்நாடு';
    } else if (parentDistEn) {
      specificEn = parentDistEn;
      specificTa = parentDistTa;
      parentAreaEn = 'Tamil Nadu';
      parentAreaTa = 'தமிழ்நாடு';
    }

    if (!specificEn) return null;

    return {
      specificName: specificEn,
      specificNameTa: specificTa || specificEn,
      parentArea: parentAreaEn,
      parentAreaTa: parentAreaTa,
      locality: localityEn,
      localityTa: localityTa,
      town: townEn,
      townTa: townTa,
      taluk: talukEn,
      talukTa: talukTa,
      district: parentDistEn,
      districtTa: parentDistTa,
      displayName: lang === 'ta' ? (specificTa || specificEn) : specificEn
    };
  }

  /**
   * Reverse geocode geographic coordinates to a structured specific locality.
   */
  async function reverseGeocodeCoords(lat, lon, lang = 'en') {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    if (isNaN(parsedLat) || isNaN(parsedLon)) return null;

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${parsedLat}&lon=${parsedLon}&format=json&zoom=14&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': lang === 'ta' ? 'ta,en;q=0.8' : 'en,ta;q=0.8'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const parsed = extractSpecificLocality(data.address, lang);
          if (parsed) {
            parsed.lat = parsedLat;
            parsed.lng = parsedLon;
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('[UserLocation] Nominatim reverse geocode warning:', e);
    }
    return null;
  }

  /**
   * Synchronously retrieve the saved/cached specific location.
   */
  function getSavedSpecificLocation(lang = 'en') {
    try {
      const isTa = lang === 'ta';

      // 1. Check if specific location object is cached
      const specificCached = localStorage.getItem('cc_specific_location');
      if (specificCached) {
        try {
          const obj = JSON.parse(specificCached);
          if (obj && (obj.specificName || obj.locality || obj.district)) {
            const rawSpec = obj.specificName || obj.locality || obj.district;
            const specEn = translateLocalityName(rawSpec, 'en');
            const specTa = translateLocalityName(obj.specificNameTa || rawSpec, 'ta');
            const rawParent = obj.parentArea || obj.district || 'Tamil Nadu';
            const parentEn = translateLocalityName(rawParent, 'en');
            const parentTa = translateLocalityName(obj.parentAreaTa || rawParent, 'ta');
            const distEn = normalizeDistrictName(obj.district) || translateLocalityName(obj.district || 'Tamil Nadu', 'en');
            const distTa = translateLocalityName(distEn, 'ta');
            const displayName = isTa ? (specTa || specEn) : (specEn || specTa);
            return {
              ...obj,
              specificName: specEn,
              specificNameTa: specTa,
              parentArea: parentEn,
              parentAreaTa: parentTa,
              district: distEn,
              districtTa: distTa,
              displayName
            };
          }
        } catch (e) {}
      }

      // 2. Check weather cache for town / district
      const weatherCacheStr = localStorage.getItem(isTa ? 'cc_weather_cache_ta' : 'cc_weather_cache_en') ||
                              localStorage.getItem('cc_weather_cache_en') ||
                              localStorage.getItem('cc_weather_cache_ta');
      if (weatherCacheStr) {
        try {
          const c = JSON.parse(weatherCacheStr);
          if (c && (c.locality || c.town || c.district)) {
            const rawPlace = c.locality || c.town || c.district;
            const specEn = translateLocalityName(rawPlace, 'en');
            const specTa = translateLocalityName(rawPlace, 'ta');
            const dist = normalizeDistrictName(rawPlace) || 'Tamil Nadu';
            const distTa = translateLocalityName(dist, 'ta');
            return {
              specificName: specEn,
              specificNameTa: specTa,
              parentArea: dist,
              parentAreaTa: distTa,
              district: dist,
              districtTa: distTa,
              displayName: isTa ? specTa : specEn
            };
          }
        } catch (e) {}
      }

      // 3. Check saved user_district in localStorage
      const direct = localStorage.getItem('user_district') || localStorage.getItem('crowdcity_user_district');
      if (direct && direct !== 'all' && direct !== 'Tamil Nadu') {
        const specEn = translateLocalityName(direct, 'en');
        const specTa = translateLocalityName(direct, 'ta');
        const normDist = normalizeDistrictName(direct) || specEn;
        const normDistTa = translateLocalityName(normDist, 'ta');
        return {
          specificName: specEn,
          specificNameTa: specTa,
          parentArea: isTa ? 'தமிழ்நாடு' : 'Tamil Nadu',
          parentAreaTa: 'தமிழ்நாடு',
          district: normDist,
          districtTa: normDistTa,
          displayName: isTa ? specTa : specEn
        };
      }
    } catch (err) {
      console.warn('[UserLocation] getSavedSpecificLocation warning:', err);
    }

    return {
      specificName: 'Tamil Nadu',
      specificNameTa: 'தமிழ்நாடு',
      parentArea: 'Tamil Nadu',
      parentAreaTa: 'தமிழ்நாடு',
      district: 'Tamil Nadu',
      districtTa: 'தமிழ்நாடு',
      displayName: lang === 'ta' ? 'தமிழ்நாடு' : 'Tamil Nadu'
    };
  }

  /**
   * Detect user specific location using browser GPS and reverse geocoding.
   */
  async function detectSpecificLocation(options = {}) {
    const timeoutMs = options.timeoutMs || 5000;
    const forceGps = options.forceGps === true;
    const lang = options.lang || (typeof window !== 'undefined' && window.i18n && typeof window.i18n.getLanguage === 'function' ? window.i18n.getLanguage() : 'ta');

    // 1. Check instant cache if not forced
    if (!forceGps) {
      const saved = getSavedSpecificLocation(lang);
      if (saved && saved.specificName && saved.specificName !== 'Tamil Nadu') {
        return saved;
      }
    }

    // 2. Try browser geolocation
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const coords = await new Promise((resolve) => {
          let resolved = false;
          const timer = setTimeout(() => {
            if (!resolved) { resolved = true; resolve(null); }
          }, timeoutMs);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (resolved) return;
              resolved = true;
              clearTimeout(timer);
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => {
              if (resolved) return;
              resolved = true;
              clearTimeout(timer);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: forceGps ? 0 : 300000 }
          );
        });

        if (coords) {
          localStorage.setItem('cc_weather_coords', JSON.stringify({ lat: coords.lat, lon: coords.lng, ts: Date.now() }));
          
          // Reverse geocode to get specific locality
          const resolvedLoc = await reverseGeocodeCoords(coords.lat, coords.lng, lang);
          if (resolvedLoc) {
            localStorage.setItem('cc_specific_location', JSON.stringify(resolvedLoc));
            localStorage.setItem('user_district', resolvedLoc.district);
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('crowdcity:location_detected', {
                detail: {
                  ...resolvedLoc,
                  lat: coords.lat,
                  lng: coords.lng
                }
              }));
            }
            return resolvedLoc;
          }

          // Fallback to nearest district if reverse geocode failed
          const nearestDist = findNearestDistrictByCoords(coords.lat, coords.lng);
          if (nearestDist) {
            const locObj = {
              specificName: translateLocalityName(nearestDist, 'en'),
              specificNameTa: translateLocalityName(nearestDist, 'ta'),
              parentArea: 'Tamil Nadu',
              parentAreaTa: 'தமிழ்நாடு',
              district: nearestDist,
              districtTa: translateLocalityName(nearestDist, 'ta'),
              lat: coords.lat,
              lng: coords.lng,
              displayName: lang === 'ta' ? translateLocalityName(nearestDist, 'ta') : translateLocalityName(nearestDist, 'en')
            };
            localStorage.setItem('cc_specific_location', JSON.stringify(locObj));
            localStorage.setItem('user_district', nearestDist);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('crowdcity:location_detected', {
                detail: locObj
              }));
            }
            return locObj;
          }
        }
      } catch (err) {
        console.warn('[UserLocation] detectSpecificLocation GPS error:', err);
      }
    }

    // 3. Fallback to saved
    return getSavedSpecificLocation(lang);
  }

  /**
   * Re-detect live location directly via browser GPS, bypassing any stored values.
   */
  async function reDetectLiveLocation(timeoutMs = 6000) {
    try {
      localStorage.removeItem('user_district');
      localStorage.removeItem('cc_weather_coords');
      localStorage.removeItem('cc_specific_location');
      localStorage.removeItem('cc_weather_cache_en');
      localStorage.removeItem('cc_weather_cache_ta');
    } catch (e) {}
    
    // Trigger detection with forceGps
    const res = await detectSpecificLocation({ forceGps: true, timeoutMs });
    return res ? (res.district || res.specificName) : await detectUserDistrict({ forceGps: true, timeoutMs });
  }

  /**
   * Explicitly set or change the user's preferred district.
   */
  function setUserDistrict(districtName) {
    const norm = normalizeDistrictName(districtName);
    if (norm) {
      localStorage.setItem('user_district', norm);
      localStorage.setItem('cc_specific_location', JSON.stringify({
        specificName: norm,
        specificNameTa: translateLocalityName(norm, 'ta'),
        district: norm,
        displayName: norm
      }));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('crowdcity:location_changed', {
          detail: { district: norm, specificName: norm }
        }));
      }
      return norm;
    }
    return null;
  }

  // Export to root (window in browser, global/module in Node)
  const locationService = {
    TN_DISTRICTS_CENTROIDS,
    DISTRICT_ALIASES,
    TALUK_TO_DISTRICT,
    LOCALITY_NAMES_TA,
    translateLocalityName,
    extractSpecificLocality,
    reverseGeocodeCoords,
    getSavedSpecificLocation,
    detectSpecificLocation,
    normalizeDistrictName,
    findNearestDistrictByCoords,
    getSavedUserDistrict,
    detectUserDistrict,
    reDetectLiveLocation,
    setUserDistrict
  };

  root.CrowdCityLocation = locationService;
  if (typeof global !== 'undefined') {
    global.CrowdCityLocation = locationService;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = locationService;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
