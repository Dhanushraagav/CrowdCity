import sharp from 'sharp';
import logger from '../config/logger.js';

export const IMAGE_HASH_STRONG_MATCH_THRESHOLD = 0.85;
export const IMAGE_HASH_POSSIBLE_MATCH_THRESHOLD = 0.75;

/**
 * Computes a difference hash (dHash) for an image.
 *
 * @param {Buffer|string} imageInput - Buffer, base64 string, or a URL string
 * @returns {Promise<{hash: string, width: number, height: number} | null>}
 */
export async function computeImageHash(imageInput) {
    if (!imageInput) {
        return null;
    }

    try {
        let inputBuffer;
        if (Buffer.isBuffer(imageInput)) {
            inputBuffer = imageInput;
        } else if (typeof imageInput === 'string') {
            if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
                const response = await fetch(imageInput);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                inputBuffer = Buffer.from(arrayBuffer);
            } else {
                // Base64
                const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
                inputBuffer = Buffer.from(base64Data, 'base64');
            }
        } else {
            return null;
        }

        // Get metadata for width and height
        const metadata = await sharp(inputBuffer).metadata();

        // Resize to 9x8, convert to grayscale, and get raw pixel data
        const { data } = await sharp(inputBuffer)
            .resize(9, 8, { fit: 'fill' })
            .grayscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        let hash = '';
        // dHash algorithm: Compare adjacent pixels in each row (8 rows, 9 columns)
        // 8 rows * 8 comparisons per row = 64 bits
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const leftPixelIndex = y * 9 + x;
                const rightPixelIndex = leftPixelIndex + 1;
                
                const leftPixel = data[leftPixelIndex];
                const rightPixel = data[rightPixelIndex];

                hash += leftPixel > rightPixel ? '1' : '0';
            }
        }

        // Convert binary string to hex
        let hexHash = '';
        for (let i = 0; i < 64; i += 4) {
            const hexChar = parseInt(hash.slice(i, i + 4), 2).toString(16);
            hexHash += hexChar;
        }

        return {
            hash: hexHash,
            width: metadata.width || 0,
            height: metadata.height || 0
        };

    } catch (error) {
        logger.warn(`Failed to compute image hash: ${error.message}`);
        return null;
    }
}

/**
 * Computes the Hamming distance between two hex hashes.
 *
 * @param {string} hashA - First hash
 * @param {string} hashB - Second hash
 * @returns {number} Hamming distance (0-64)
 */
export function computeHammingDistance(hashA, hashB) {
    if (typeof hashA !== 'string' || typeof hashB !== 'string' || hashA.length !== 16 || hashB.length !== 16) {
        return 64;
    }

    let distance = 0;
    for (let i = 0; i < 16; i++) {
        const valA = parseInt(hashA[i], 16);
        const valB = parseInt(hashB[i], 16);
        // XOR the values and count the set bits
        let xor = valA ^ valB;
        while (xor > 0) {
            distance += xor & 1;
            xor >>= 1;
        }
    }
    return distance;
}

/**
 * Computes a similarity score between two hex hashes.
 *
 * @param {string} hashA - First hash
 * @param {string} hashB - Second hash
 * @returns {number} Similarity score between 0.0 and 1.0
 */
export function computeImageSimilarity(hashA, hashB) {
    if (!hashA || !hashB) {
        return 0;
    }

    const distance = computeHammingDistance(hashA, hashB);
    return 1.0 - (distance / 64);
}
