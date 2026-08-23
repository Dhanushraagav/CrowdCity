"""
CrowdCity AI - Automated Dataset Downloader & Preparer
Downloads public open civic hazard dataset samples and sets up folder structures for training.

Dataset Categories:
1. potholes (Road Damage)
2. streetlights (Broken Street Lights)
3. signal_lights (Broken Signal Lights & Traffic Hazards)
4. garbage (Overflowing Trash & Dumping)
5. non_civic (Irrelevant Photos - Furniture, Clothes, Selfies)

Usage:
python download_dataset.py
"""

import os
import urllib.request
import zipfile
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

CLASSES = ['potholes', 'streetlights', 'signal_lights', 'garbage', 'non_civic']

def setup_dataset_structure():
    print("[INFO] Creating dataset directory structure...")
    for split in ['train', 'val']:
        for cls_name in CLASSES:
            dir_path = os.path.join(DATASET_DIR, split, cls_name)
            os.makedirs(dir_path, exist_ok=True)
    print(f"[SUCCESS] Dataset folders prepared at {DATASET_DIR}")

def download_sample_dataset():
    """
    Downloads curated public open sample dataset zip from GitHub repository
    """
    zip_path = os.path.join(BASE_DIR, "civic_dataset_sample.zip")
    # Sample open-source dataset release URL
    url = "https://github.com/Dhanushraagav/CrowdCity/releases/download/v1.0-dataset/civic_dataset_sample.zip"
    
    print(f"[INFO] Downloading sample dataset from {url}...")
    try:
        urllib.request.urlretrieve(url, zip_path)
        print("[INFO] Extracting dataset files...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(DATASET_DIR)
        os.remove(zip_path)
        print("[SUCCESS] Dataset downloaded and extracted successfully!")
    except Exception as e:
        print(f"[NOTE] Could not download auto-zip: {e}")
        print("\n=== MANUAL DATASET SOURCES FOR TRAINING ===")
        print("You can download full datasets from Kaggle / Roboflow in 1 click:")
        print("1. Pothole Dataset: https://www.kaggle.com/datasets/vigneshwarraj/pothole-dataset-for-yolo-and-vision")
        print("2. Garbage Dataset: https://www.kaggle.com/datasets/techsocr/garbage-classification")
        print("3. Streetlight Dataset: https://universe.roboflow.com/search?q=streetlight")
        print("4. Traffic Signal Dataset: https://universe.roboflow.com/search?q=traffic+light")
        print("\nPlace downloaded images into:")
        print(f" -> {os.path.join(DATASET_DIR, 'train', 'potholes')}")
        print(f" -> {os.path.join(DATASET_DIR, 'train', 'streetlights')}")
        print(f" -> {os.path.join(DATASET_DIR, 'train', 'signal_lights')}")
        print(f" -> {os.path.join(DATASET_DIR, 'train', 'garbage')}")
        print(f" -> {os.path.join(DATASET_DIR, 'train', 'non_civic')}")

if __name__ == "__main__":
    setup_dataset_structure()
    download_sample_dataset()
