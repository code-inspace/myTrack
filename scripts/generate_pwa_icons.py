import os
from PIL import Image, ImageDraw

def generate_icon(size: int, filename: str):
    scale = 4
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background color #D4F63D (212, 246, 61)
    bg_color = (212, 246, 61, 255)
    corner_radius = int(canvas_size * 0.25)

    # Draw rounded rectangle
    draw.rounded_rectangle(
        [(0, 0), (canvas_size, canvas_size)],
        radius=corner_radius,
        fill=bg_color
    )

    # Checkmark in dark #111214 (17, 18, 20)
    stroke_color = (17, 18, 20, 255)
    stroke_width = int(canvas_size * 0.12)

    # Checkmark points matching (120, 270) -> (216, 366) -> (396, 150) normalized to 512
    p1 = (int(canvas_size * (120 / 512)), int(canvas_size * (270 / 512)))
    p2 = (int(canvas_size * (216 / 512)), int(canvas_size * (366 / 512)))
    p3 = (int(canvas_size * (396 / 512)), int(canvas_size * (150 / 512)))

    # Draw checkmark lines with rounded joints and caps
    draw.line([p1, p2, p3], fill=stroke_color, width=stroke_width, joint="round")
    
    # Rounded caps
    r = stroke_width // 2
    draw.ellipse([p1[0] - r, p1[1] - r, p1[0] + r, p1[1] + r], fill=stroke_color)
    draw.ellipse([p3[0] - r, p3[1] - r, p3[0] + r, p3[1] + r], fill=stroke_color)

    # Downscale with high quality Lanczos filter for ultra-crisp anti-aliasing
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    final_img.save(filename, "PNG")
    print(f"Generated: {filename} ({size}x{size})")

if __name__ == "__main__":
    generate_icon(180, "public/apple-touch-icon.png")
    generate_icon(180, "public/apple-touch-icon-precomposed.png")
    generate_icon(192, "public/icons/icon-192.png")
    generate_icon(512, "public/icons/icon-512.png")
    generate_icon(512, "public/icon.png")
    generate_icon(180, "src/app/apple-icon.png")
    generate_icon(512, "src/app/icon.png")
