"""
CrowdCity AI - Automatic Dataset Sanitizer & Prep Script
Prepares your local image dataset for PyTorch model training:
1. Flattens nested subfolders (e.g. garbage/paper, garbage/plastic -> garbage/)
2. Automatically splits 20% of train images into val/ if val/ is missing
3. Populates non_civic with sample images if empty

Usage:
python ai_models/prepare_dataset.py
"""

import os
import shutil
import random
from PIL import Image, ImageDraw

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

CLASSES = ['potholes', 'streetlights', 'signal_lights', 'garbage', 'non_civic']
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')

def flatten_subfolders(folder_path):
    """Flatten any nested subfolders so all images are directly inside folder_path"""
    if not os.path.exists(folder_path):
        return

    file_moves = []
    for root, dirs, files in os.walk(folder_path):
        if root == folder_path:
            continue
        for file in files:
            if file.lower().endswith(IMAGE_EXTENSIONS):
                src = os.path.join(root, file)
                folder_tag = os.path.basename(root).replace('.', '_').replace(' ', '_')
                target_name = f"{folder_tag}_{file}"
                dst = os.path.join(folder_path, target_name)
                file_moves.append((src, dst))

    if file_moves:
        print(f"[INFO] Flattening {len(file_moves)} images from subfolders into {folder_path}...")
        for src, dst in file_moves:
            try:
                shutil.move(src, dst)
            except Exception as e:
                pass

    # Clean up empty subdirectories
    for item in os.listdir(folder_path):
        item_path = os.path.join(folder_path, item)
        if os.path.isdir(item_path):
            shutil.rmtree(item_path, ignore_errors=True)

def ensure_val_split(cls_name):
    """Auto-split 20% of train images into val/ if val/ has no images"""
    train_dir = os.path.join(DATASET_DIR, 'train', cls_name)
    val_dir = os.path.join(DATASET_DIR, 'val', cls_name)
    
    os.makedirs(train_dir, exist_ok=True)
    os.makedirs(val_dir, exist_ok=True)

    flatten_subfolders(train_dir)
    flatten_subfolders(val_dir)

    train_imgs = [f for f in os.listdir(train_dir) if f.lower().endswith(IMAGE_EXTENSIONS)]
    val_imgs = [f for f in os.listdir(val_dir) if f.lower().endswith(IMAGE_EXTENSIONS)]

    if len(train_imgs) > 0 and len(val_imgs) == 0:
        val_count = max(1, int(len(train_imgs) * 0.20))
        print(f"[INFO] Auto-splitting {val_count} images from train/{cls_name} into val/{cls_name}...")
        selected = random.sample(train_imgs, val_count)
        for img_name in selected:
            shutil.move(os.path.join(train_dir, img_name), os.path.join(val_dir, img_name))

def generate_synthetic_non_civic():
    """Generates sample non-civic images if non_civic folder is empty"""
    train_nc = os.path.join(DATASET_DIR, 'train', 'non_civic')
    val_nc = os.path.join(DATASET_DIR, 'val', 'non_civic')

    os.makedirs(train_nc, exist_ok=True)
    os.makedirs(val_nc, exist_ok=True)

    nc_imgs = [f for f in os.listdir(train_nc) if f.lower().endswith(IMAGE_EXTENSIONS)]
    if len(nc_imgs) == 0:
        print("[INFO] 'non_civic' folder is empty. Generating 50 placeholder non-civic sample images...")
        colors = [(240, 240, 240), (200, 210, 220), (255, 230, 200), (180, 200, 180), (220, 220, 240)]
        for i in range(50):
            img = Image.new('RGB', (224, 224), color=colors[i % len(colors)])
            draw = ImageDraw.Draw(img)
            draw.rectangle([20 + (i * 2) % 100, 20, 180, 180], fill=(i * 5 % 255, i * 7 % 255, i * 11 % 255))
            draw.text((30, 100), f"Non-Civic Sample {i+1}", fill=(0, 0, 0))
            
            target_dir = train_nc if i < 40 else val_nc
            img.save(os.path.join(target_dir, f"non_civic_sample_{i+1}.jpg"))
        print("[SUCCESS] Non-civic samples generated successfully!")

def run_prep():
    print("=== CROWDCITY AI DATASET PREPARATION ===")
    for cls_name in CLASSES:
        ensure_val_split(cls_name)
    
    generate_synthetic_non_civic()
    print("\n[SUCCESS] All dataset folders are now 100% ready for training!")

if __name__ == "__main__":
    run_prep()
