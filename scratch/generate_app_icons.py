import os
from PIL import Image

logo_path = r"C:\Users\andyk\.gemini\antigravity\brain\b4acbc51-8dc0-42be-b8c1-fe5d2b73ff6a\.user_uploaded\media__1784298082555.png"
res_dir = r"c:\Users\andyk\Desktop\SmartNest\mobile\android\app\src\main\res"

sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
}

img = Image.open(logo_path)

print("Resizing logo and updating mipmap launcher icons...")
for folder, size in sizes.items():
    folder_path = os.path.join(res_dir, folder)
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
    
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    
    # Overwrite regular launcher icon
    launcher_path = os.path.join(folder_path, "ic_launcher.png")
    resized.save(launcher_path, "PNG")
    
    # Overwrite round launcher icon
    round_path = os.path.join(folder_path, "ic_launcher_round.png")
    resized.save(round_path, "PNG")
    print(f"Updated {folder} size {size}x{size}")

# Also update the Expo root assets icon just in case
assets_dir = r"c:\Users\andyk\Desktop\SmartNest\mobile\assets"
if not os.path.exists(assets_dir):
    os.makedirs(assets_dir)
resized_expo = img.resize((1024, 1024), Image.Resampling.LANCZOS)
resized_expo.save(os.path.join(assets_dir, "icon.png"), "PNG")
print("Updated Expo assets/icon.png")
