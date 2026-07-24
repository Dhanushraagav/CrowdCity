/**
 * EmergencyLocation.js - Location Services Engine for CrowdCity AI v3.0 Emergency Center
 * Handles GPS Geolocation, Distance Calculation (Haversine Formula), Google Maps Links & Web Share.
 */

window.EmergencyLocation = {
  // Default Fallback Coordinates (Chennai / Tamil Nadu Center)
  fallbackCoords: {
    latitude: 13.0827,
    longitude: 80.2707,
    cityName: 'Chennai, Tamil Nadu'
  },

  currentLocation: null,

  /**
   * Request browser geolocation with high accuracy
   */
  getCurrentPosition: function() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported by browser. Using default Tamil Nadu location.');
        this.currentLocation = { ...this.fallbackCoords, isFallback: true };
        resolve(this.currentLocation);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            isFallback: false
          };
          resolve(this.currentLocation);
        },
        (error) => {
          console.warn('Geolocation access denied or timed out:', error.message);
          this.currentLocation = { ...this.fallbackCoords, isFallback: true, error: error.message };
          resolve(this.currentLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  },

  /**
   * Calculate distance between two coordinates using Haversine Formula (in km)
   */
  calculateDistance: function(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    return distanceKm;
  },

  deg2rad: function(deg) {
    return deg * (Math.PI / 180);
  },

  /**
   * Format distance string cleanly (e.g., "1.2 km" or "850 m")
   */
  formatDistance: function(distanceKm) {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  },

  /**
   * Generate Google Maps directions URL
   */
  getGoogleMapsDirectionsUrl: function(destLat, destLng, destName) {
    if (this.currentLocation && !this.currentLocation.isFallback) {
      return `https://www.google.com/maps/dir/?api=1&origin=${this.currentLocation.latitude},${this.currentLocation.longitude}&destination=${destLat},${destLng}&destination_place_id=${encodeURIComponent(destName || '')}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${destLat},${destLng}`;
  },

  /**
   * Generate sharable Google Maps location link
   */
  getShareableLocationUrl: function(lat, lng) {
    const latitude = lat || (this.currentLocation ? this.currentLocation.latitude : this.fallbackCoords.latitude);
    const longitude = lng || (this.currentLocation ? this.currentLocation.longitude : this.fallbackCoords.longitude);
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  },

  /**
   * Native Share API trigger
   */
  shareLocationNative: async function(title, text, url) {
    const shareUrl = url || this.getShareableLocationUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'My Emergency Location - CrowdCity AI',
          text: text || 'Here is my live emergency GPS position. Please send assistance.',
          url: shareUrl
        });
        return true;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Share failed:', err);
        }
      }
    }
    // Fallback: Copy to clipboard
    return this.copyToClipboard(shareUrl);
  },

  /**
   * Clipboard Copy Utility
   */
  copyToClipboard: function(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      return new Promise((resolve, reject) => {
        document.execCommand('copy') ? resolve() : reject();
        textArea.remove();
      });
    }
  }
};
