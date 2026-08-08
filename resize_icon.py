from PIL import Image
import os

# Source logo
src = r"c:\Users\andyk\Desktop\SmartNest\mobile\assets\4layers_logo.png"
base = r"c:\Users\andyk\Desktop\SmartNest\mobile\android\app\src\main\res"

# Android mipmap sizes for launcher icons
sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

img = Image.open(src).convert("RGBA")

for folder, size in sizes.items():
    out_dir = os.path.join(base, folder)
    resized = img.resize((size, size), Image.LANCZOS)
    # Save as PNG
    for name in ["ic_launcher.png", "ic_launcher_round.png"]:
        out_path = os.path.join(out_dir, name)
        resized.save(out_path, "PNG")
        print(f"Saved {out_path} ({size}x{size})")

print("Done! All mipmap icons updated.")
