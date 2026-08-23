"""
CrowdCity AI - Dedicated Image Classifier Trainer
Trains PyTorch MobileNetV3 / ResNet50 model on custom civic hazard image datasets.

Dataset Structure Required:
dataset/
  ├── potholes/
  ├── streetlights/
  ├── signal_lights/
  ├── garbage/
  └── non_civic/

Usage:
python train_classifier.py --dataset_dir ./dataset --epochs 15 --batch_size 32
"""

import os
import argparse
import sys

# Force PyTorch and Torchvision into 100% Pure Offline Mode (Zero Internet Requests)
os.environ['TORCH_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_OFFLINE'] = '1'

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torchvision import datasets, transforms, models
except ImportError:
    print("\n" + "="*70)
    print("[ERROR] PyTorch (torch / torchvision) is not installed in your Python environment.")
    print("="*70)
    print("\nPlease run this command to install PyTorch:")
    print("  pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu")
    print("\nOr for GPU acceleration (if you have an NVIDIA graphics card):")
    print("  pip install torch torchvision")
    print("="*70 + "\n")
    sys.exit(1)

try:
    from prepare_dataset import run_prep
except ImportError:
    try:
        from ai_models.prepare_dataset import run_prep
    except ImportError:
        run_prep = None

def train_model(dataset_dir, epochs=15, batch_size=32, lr=0.001, target_acc=0.85, save_dir="./weights"):
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, "civic_vision_model.pth")

    if run_prep:
        try:
            run_prep()
        except Exception as prep_err:
            print(f"[WARN] Auto-prep warning: {prep_err}")
    
    print(f"[INFO] Initializing dataset pipeline from {dataset_dir}...")
    
    data_transforms = {
        'train': transforms.Compose([
            transforms.RandomResizedCrop(224),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.2, contrast=0.2),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
        'val': transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
    }

    image_datasets = {x: datasets.ImageFolder(os.path.join(dataset_dir, x), data_transforms[x])
                      for x in ['train', 'val'] if os.path.exists(os.path.join(dataset_dir, x))}
    
    if not image_datasets:
        print("[ERROR] Dataset folders 'train' and 'val' not found. Please organize images into subfolders.")
        return

    dataloaders = {x: torch.utils.data.DataLoader(image_datasets[x], batch_size=batch_size, shuffle=True, num_workers=2)
                   for x in image_datasets}

    class_names = image_datasets['train'].classes
    print(f"[INFO] Recognized Classes ({len(class_names)}): {class_names}")

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"[INFO] Training on device: {device}")
    print(f"[INFO] Early Stopping target accuracy set to: {target_acc * 100:.1f}%")

    # Load MobileNetV3 Backbone in 100% PURE OFFLINE MODE (Zero network calls)
    print("[INFO] 100% PURE OFFLINE MODE ENABLED: Initializing MobileNetV3 architecture locally with zero online network requests.")
    if hasattr(models, 'MobileNet_V3_Small_Weights'):
        model = models.mobilenet_v3_small(weights=None)
    else:
        model = models.mobilenet_v3_small(pretrained=False)

    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, len(class_names))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    best_acc = 0.0

    for epoch in range(epochs):
        print(f"\nEpoch {epoch+1}/{epochs}")
        print("-" * 55)

        epoch_val_acc = 0.0

        for phase in ['train', 'val']:
            if phase not in dataloaders:
                continue
            
            model.train() if phase == 'train' else model.eval()

            running_loss = 0.0
            running_corrects = 0
            total_batches = len(dataloaders[phase])
            dataset_size = len(image_datasets[phase])

            for batch_idx, (inputs, labels) in enumerate(dataloaders[phase]):
                inputs = inputs.to(device)
                labels = labels.to(device)

                optimizer.zero_grad()

                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)

                    if phase == 'train':
                        loss.backward()
                        optimizer.step()

                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)

                # Real-time progress bar output
                pct = ((batch_idx + 1) / total_batches) * 100
                bar_len = 20
                filled = int(bar_len * (batch_idx + 1) // total_batches)
                bar = '█' * filled + '░' * (bar_len - filled)
                current_acc = (running_corrects.double() / ((batch_idx + 1) * batch_size)).item()
                
                print(
                    f"\r[{phase.upper()}] |{bar}| {pct:5.1f}% [{batch_idx+1:4d}/{total_batches:4d} batches] "
                    f"Loss: {loss.item():.4f} | Acc: {current_acc:.4f}",
                    end="", flush=True
                )

            epoch_loss = running_loss / dataset_size
            epoch_acc = (running_corrects.double() / dataset_size).item()

            if phase == 'val':
                epoch_val_acc = epoch_acc

            print(f"\n[{phase.upper()} SUMMARY] Loss: {epoch_loss:.4f} | Accuracy: {epoch_acc*100:.2f}%\n")

        # Save Checkpoint if best accuracy
        check_acc = epoch_val_acc if 'val' in dataloaders else epoch_acc
        if check_acc > best_acc:
            best_acc = check_acc
            torch.save(model.state_dict(), save_path)
            print(f"[CHECKPOINT] Best model weights updated and saved to {save_path} (Acc: {best_acc*100:.2f}%)")

        # Early Stopping Trigger
        if check_acc >= target_acc:
            print(f"\n[EARLY STOPPING TRIGGERED] Target accuracy of {target_acc*100:.1f}% reached ({check_acc*100:.2f}%)! Saving best weights and completing training early.")
            break

    print(f"\n[SUCCESS] Training completed! Best weights saved at {save_path} with Best Accuracy: {best_acc*100:.2f}%")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Custom Vision Model for CrowdCity AI")
    parser.add_argument("--dataset_dir", type=str, default="./dataset", help="Path to dataset directory")
    parser.add_argument("--epochs", type=int, default=15, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument("--target_acc", type=float, default=0.85, help="Target accuracy ratio for early stopping (e.g. 0.85 for 85 percent)")
    args = parser.parse_args()

    train_model(args.dataset_dir, args.epochs, args.batch_size, args.target_acc)
