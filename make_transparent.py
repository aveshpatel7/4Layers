from PIL import Image

src_path = r"c:\Users\andyk\Desktop\SmartNest\mobile\assets\4layers_logo.png"
img = Image.open(src_path).convert("RGBA")

datas = img.getdata()

new_data = []
for item in datas:
    r, g, b, a = item
    # If the pixel is dark black background (r, g, b values all low, and green is not dominant)
    # The green ring has high green values (g > 80 and g > r * 1.5)
    if g < 60 or (r < 40 and g < 40 and b < 40):
        # Make transparent
        new_data.append((0, 0, 0, 0))
    else:
        # Keep crisp pixel
        new_data.append((r, g, b, a))

img.putdata(new_data)
img.save(src_path, "PNG")
print("Successfully made 4layers_logo.png background transparent!")
