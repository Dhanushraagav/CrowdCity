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
   * Request browser geolocation with fast two-stage acquisition & session caching
   */
  getCurrentPosition: function(forceFresh = false) {
    return new Promise((resolve) => {
      // Check if we have cached position in sessionStorage (< 5 minutes old)
      if (!forceFresh) {
        try {
          const cached = sessionStorage.getItem('cc_last_emergency_loc');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.latitude && parsed.longitude && (Date.now() - (parsed.time || 0) < 300000)) {
              this.currentLocation = { ...parsed, isFallback: false };
              resolve(this.currentLocation);
              this.refreshPositionBackground();
              return;
            }
          }
        } catch (e) {}
      }

      if (!navigator.geolocation) {
        console.warn('Geolocation not supported by browser. Using default Tamil Nadu location.');
        this.currentLocation = { ...this.fallbackCoords, isFallback: true };
        resolve(this.currentLocation);
        return;
      }

      let resolved = false;
      const done = (loc) => {
        if (resolved) return;
        resolved = true;
        this.currentLocation = loc;
        try {
          sessionStorage.setItem('cc_last_emergency_loc', JSON.stringify({ ...loc, time: Date.now() }));
        } catch (e) {}
        resolve(loc);
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          done({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            isFallback: false
          });
        },
        (error) => {
          // Fast fallback to cell/wifi location if GPS takes too long
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              done({
                latitude: pos2.coords.latitude,
                longitude: pos2.coords.longitude,
                accuracy: pos2.coords.accuracy,
                isFallback: false
              });
            },
            () => {
              console.warn('Geolocation access denied or timed out:', error.message);
              done({ ...this.fallbackCoords, isFallback: true, error: error.message });
            },
            { enableHighAccuracy: false, timeout: 2500, maximumAge: 120000 }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 3500,
          maximumAge: forceFresh ? 0 : 60000
        }
      );
    });
  },

  refreshPositionBackground: function() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fresh = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          isFallback: false
        };
        this.currentLocation = fresh;
        try {
          sessionStorage.setItem('cc_last_emergency_loc', JSON.stringify({ ...fresh, time: Date.now() }));
        } catch (e) {}
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
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
