import numpy as np
import matplotlib.pyplot as plt
import os


circle_color = "black"
wave_color = "#E00000"   # groen wave_color = "#E00000"   "#00A651" 
R = 5
amplitude = 0.9
waves = 10
line_width = 7


theta = np.linspace(0, 2 * np.pi, 2000)

# Normale cirkel
x_circle = R * np.cos(theta)
y_circle = R * np.sin(theta)

# Golvende cirkel
r_wave = R + amplitude * np.sin(waves * theta)
x_wave = r_wave * np.cos(theta)
y_wave = r_wave * np.sin(theta)



fig, ax = plt.subplots(figsize=(8, 8))

# Transparante achtergrond
fig.patch.set_alpha(0)
ax.patch.set_alpha(0)

# Normale zwarte cirkel
ax.plot(
    x_circle,
    y_circle,
    color=circle_color,
    linewidth=line_width
)

# Gekleurde golvende cirkel
ax.plot(
    x_wave,
    y_wave,
    color=wave_color,
    linewidth=line_width
)

ax.set_aspect("equal")
ax.axis("off")

# Ruimte rondom
margin = 1
ax.set_xlim(-(R + amplitude + margin), R + amplitude + margin)
ax.set_ylim(-(R + amplitude + margin), R + amplitude + margin)



download_path = os.path.join(
    os.path.expanduser("~"),
    "Downloads",
    "Waves_R_10.svg"
)

plt.savefig(
    download_path,
    format="svg",
    transparent=True,
    bbox_inches="tight",
    pad_inches=0.1
)

plt.show()

print("SVG opgeslagen op:")
print(download_path)
